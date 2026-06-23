import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { EMPTY, interval } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MonitoringApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import {
  Alert,
  ClusterHealth,
  ContainerHealth,
  HealthVerdict,
  MetricSample,
  NodeHealth,
} from '../../core/models';

const REFRESH_MS = 8000;

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'info';

/** Cluster health view: per-node container health rollup + the containers that
 *  are struggling, scoped to the active cluster. Auto-refreshes; degrades to a
 *  clear message when the cluster cannot provide telemetry (503). */
@Component({
  selector: 'hm-cluster-health',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ButtonModule,
    TagModule,
    ToggleSwitchModule,
    TooltipModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    SelectModule,
    SelectButtonModule,
    TableModule,
  ],
  templateUrl: './cluster-health.component.html',
  styleUrl: './cluster-health.component.scss',
})
export class ClusterHealthView implements OnInit {
  private readonly api = inject(MonitoringApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly ctx = inject(ClusterContextService);

  readonly health = signal<ClusterHealth | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  /** 503 — the active cluster can't provide telemetry (stub / agent cluster). */
  readonly unavailable = signal(false);
  // Default on: this is a health + usage view, so show every container (with its
  // verdict and CPU/mem) rather than only the struggling ones.
  readonly showHealthy = signal(true);
  showHealthyModel = true;

  /** Active alerts from the engine (cross-cluster). */
  readonly alerts = signal<Alert[]>([]);

  /** Latest per-container usage, keyed by container id (joined to health). */
  readonly metricsByContainer = signal<Record<string, MetricSample>>({});

  /** 'list' = flat task table, 'cards' = per-node cards. */
  readonly viewMode = signal<'list' | 'cards'>('list');
  viewModeModel: 'list' | 'cards' = 'list';
  readonly viewOptions = [
    { label: 'Liste', value: 'list' },
    { label: 'Cartes', value: 'cards' },
  ];

  /** Selected node id, '' = all nodes. */
  readonly nodeFilter = signal('');
  nodeFilterModel = '';

  /** Node dropdown options ("Tous les nœuds" + one per node). */
  readonly nodeOptions = computed(() => {
    const opts = [{ label: 'Tous les nœuds', value: '' }];
    for (const n of this.health()?.nodes ?? []) {
      opts.push({ label: n.hostname || n.node_id, value: n.node_id });
    }
    return opts;
  });

  /** Flat task rows for the list view: every container (filtered by node + the
   *  "show healthy" toggle), worst-first then by service name. */
  readonly rows = computed(() => {
    const h = this.health();
    if (!h) return [];
    const nf = this.nodeFilter();
    const showAll = this.showHealthy();
    const out: { node: string; container: ContainerHealth }[] = [];
    for (const n of h.nodes) {
      if (nf && n.node_id !== nf) continue;
      for (const c of n.containers) {
        if (!showAll && c.verdict === 'ok') continue;
        out.push({ node: n.hostname || n.node_id, container: c });
      }
    }
    const rank = (v: string) => (v === 'critical' ? 0 : v === 'warning' ? 1 : v === 'ok' ? 2 : 3);
    return out.sort(
      (a, b) =>
        rank(a.container.verdict) - rank(b.container.verdict) ||
        (a.container.service_name || '').localeCompare(b.container.service_name || ''),
    );
  });

  /** Nodes to render as cards (card view), respecting the node filter. */
  readonly visibleNodes = computed(() => {
    const nodes = this.health()?.nodes ?? [];
    const nf = this.nodeFilter();
    return nf ? nodes.filter((n) => n.node_id === nf) : nodes;
  });

  /** Cluster-wide verdict rollup, summed over nodes. */
  readonly totals = computed(() => {
    const nodes = this.health()?.nodes ?? [];
    return nodes.reduce(
      (acc, n) => ({
        ok: acc.ok + n.ok,
        warning: acc.warning + n.warning,
        critical: acc.critical + n.critical,
      }),
      { ok: 0, warning: 0, critical: 0 },
    );
  });

  readonly nodeCount = computed(() => this.health()?.nodes.length ?? 0);

  /** Direct clusters only expose metrics for the connected node (ADR 0002). */
  readonly partialMetrics = computed(() => this.health()?.metrics_coverage === 'connected-node');

  constructor() {
    // Re-fetch when the header cluster selection changes.
    effect(() => {
      this.ctx.selectedId();
      this.fetch(false);
    });
  }

  ngOnInit(): void {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.health() || this.unavailable()) this.fetch(true);
      });
  }

  refresh(): void {
    this.fetch(true);
  }

  private fetch(isRefresh: boolean): void {
    if (isRefresh) this.refreshing.set(true);
    else this.loading.set(true);

    this.fetchAlerts();
    this.fetchMetrics();

    this.api
      .clusterHealth()
      .pipe(
        catchError((err: { status?: number }) => {
          this.unavailable.set(err?.status === 503);
          this.health.set(null);
          this.loading.set(false);
          this.refreshing.set(false);
          return EMPTY;
        }),
      )
      .subscribe((h) => {
        this.unavailable.set(false);
        this.health.set(h);
        this.lastUpdated.set(new Date());
        this.loading.set(false);
        this.refreshing.set(false);
      });
  }

  private fetchAlerts(): void {
    this.api
      .alerts()
      .pipe(catchError(() => EMPTY))
      .subscribe((r) => this.alerts.set(r.items));
  }

  private fetchMetrics(): void {
    this.api
      .metrics()
      .pipe(catchError(() => EMPTY))
      .subscribe((r) => {
        const byId: Record<string, MetricSample> = {};
        for (const s of r.items) byId[s.container_id] = s;
        this.metricsByContainer.set(byId);
      });
  }

  /** Usage sample for a container id, if available. */
  metric(containerId?: string): MetricSample | undefined {
    return containerId ? this.metricsByContainer()[containerId] : undefined;
  }

  /** Containers to render for a node: struggling only, unless "show healthy". */
  visibleContainers(n: NodeHealth): ContainerHealth[] {
    return this.showHealthy() ? n.containers : n.containers.filter((c) => c.verdict !== 'ok');
  }

  tagSeverity(verdict: HealthVerdict | string): TagSeverity {
    switch (verdict) {
      case 'ok':
        return 'success';
      case 'warning':
        return 'warn';
      case 'critical':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  verdictLabel(verdict: HealthVerdict | string): string {
    switch (verdict) {
      case 'ok':
        return 'Sain';
      case 'warning':
        return 'Dégradé';
      case 'critical':
        return 'Critique';
      default:
        return 'Inconnu';
    }
  }

  formatCpus(cpus: number): string {
    return Number.isInteger(cpus) ? `${cpus}` : cpus.toFixed(1);
  }

  formatMem(bytes: number): string {
    const gib = bytes / 1024 ** 3;
    if (gib >= 1) return `${gib.toFixed(gib < 10 ? 1 : 0)} GiB`;
    return `${Math.round(bytes / 1024 ** 2)} MiB`;
  }

  /** Memory usage % for a sample, clamped to 0..100. Falls back to a
   *  used/limit ratio when the backend didn't pre-compute mem_percent. */
  memPercent(m: MetricSample): number {
    const pct =
      m.mem_percent || (m.mem_limit_bytes ? (m.mem_used_bytes / m.mem_limit_bytes) * 100 : 0);
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  /** Threshold severity for the memory bar, mirroring the gauge palette. */
  memSeverity(m: MetricSample): 'ok' | 'warn' | 'crit' {
    const pct = this.memPercent(m);
    if (pct >= 85) return 'crit';
    if (pct >= 70) return 'warn';
    return 'ok';
  }
}
