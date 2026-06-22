import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { EMPTY, interval } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MonitoringApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { ClusterHealth, MetricSample, NodeHealth } from '../../core/models';
import { ResourceGauge } from './resource-gauge.component';

const REFRESH_MS = 8000;

/** A node's resource usage, derived by summing its containers' metrics and
 *  normalising against the node's advertised capacity. */
interface NodeUsage {
  node: NodeHealth;
  cpuPercent: number; // 0..100 of the node's cores
  memPercent: number; // 0..100 of the node's RAM
  memUsedBytes: number;
  containerCount: number;
}

/** Dedicated node-resource dashboard: per-node CPU/RAM usage as Grafana-style
 *  radial gauges, plus a cluster overview. Frontend-only — it joins the health
 *  snapshot (capacity per node) with the per-container metrics (usage) and
 *  aggregates by node. Fully populated in agent mode (cluster-wide metrics); in
 *  direct mode only the connected node has usage (a banner explains this). */
@Component({
  selector: 'hm-node-resources',
  imports: [DatePipe, ButtonModule, TagModule, TooltipModule, ResourceGauge],
  templateUrl: './node-resources.component.html',
  styleUrl: './node-resources.component.scss',
})
export class NodeResourcesView implements OnInit {
  private readonly api = inject(MonitoringApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly ctx = inject(ClusterContextService);

  readonly health = signal<ClusterHealth | null>(null);
  readonly metrics = signal<MetricSample[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  /** 503 — the active cluster can't provide telemetry (stub / no agent yet). */
  readonly unavailable = signal(false);

  /** Direct clusters only expose metrics for the connected node (ADR 0002). */
  readonly partialMetrics = computed(() => this.health()?.metrics_coverage === 'connected-node');

  /** Per-node usage: sum each node's container metrics, normalise to capacity. */
  readonly nodeUsages = computed<NodeUsage[]>(() => {
    const h = this.health();
    if (!h) return [];
    const byNode = new Map<string, { cpu: number; mem: number; count: number }>();
    for (const s of this.metrics()) {
      const id = s.node_id ?? '';
      const agg = byNode.get(id) ?? { cpu: 0, mem: 0, count: 0 };
      agg.cpu += s.cpu_percent;
      agg.mem += s.mem_used_bytes;
      agg.count += 1;
      byNode.set(id, agg);
    }
    // Skip the synthetic "unscheduled tasks" bucket (empty node_id): it has no
    // capacity, so a gauge against it is meaningless. Those tasks surface on the
    // Santé view and in alerts.
    return h.nodes
      .filter((n) => n.node_id !== '')
      .map((n) => {
        const agg = byNode.get(n.node_id) ?? { cpu: 0, mem: 0, count: 0 };
        return {
          node: n,
          // cpu_percent is "100% = one core"; divide by the node's cores to get
          // utilisation against capacity (0..100).
          cpuPercent: n.cpus > 0 ? Math.min(100, agg.cpu / n.cpus) : 0,
          memPercent: n.memory_bytes > 0 ? Math.min(100, (agg.mem / n.memory_bytes) * 100) : 0,
          memUsedBytes: agg.mem,
          containerCount: agg.count,
        };
      });
  });

  /** Cluster-wide rollup: total used cores / total cores, total used mem / total. */
  readonly clusterUsage = computed(() => {
    let cores = 0;
    let coresUsed = 0;
    let mem = 0;
    let memUsed = 0;
    for (const u of this.nodeUsages()) {
      cores += u.node.cpus;
      coresUsed += (u.cpuPercent / 100) * u.node.cpus;
      mem += u.node.memory_bytes;
      memUsed += u.memUsedBytes;
    }
    return {
      cpuPercent: cores > 0 ? Math.min(100, (coresUsed / cores) * 100) : 0,
      memPercent: mem > 0 ? Math.min(100, (memUsed / mem) * 100) : 0,
      cores,
      coresUsed,
      mem,
      memUsed,
    };
  });

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

    this.api
      .metrics()
      .pipe(catchError(() => EMPTY))
      .subscribe((r) => this.metrics.set(r.items));

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

  cpuDetail(u: NodeUsage): string {
    return `${this.formatCpus((u.cpuPercent / 100) * u.node.cpus)} / ${this.formatCpus(u.node.cpus)} cœurs`;
  }
  memDetail(u: NodeUsage): string {
    return `${this.formatMem(u.memUsedBytes)} / ${this.formatMem(u.node.memory_bytes)}`;
  }
  clusterCpuDetail(): string {
    const c = this.clusterUsage();
    return `${this.formatCpus(c.coresUsed)} / ${this.formatCpus(c.cores)} cœurs`;
  }
  clusterMemDetail(): string {
    const c = this.clusterUsage();
    return `${this.formatMem(c.memUsed)} / ${this.formatMem(c.mem)}`;
  }

  formatCpus(cpus: number): string {
    return Number.isInteger(cpus) ? `${cpus}` : cpus.toFixed(1);
  }
  formatMem(bytes: number): string {
    const gib = bytes / 1024 ** 3;
    if (gib >= 1) return `${gib.toFixed(gib < 10 ? 1 : 0)} GiB`;
    return `${Math.round(bytes / 1024 ** 2)} MiB`;
  }
}
