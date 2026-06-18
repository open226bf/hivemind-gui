import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EMPTY, interval } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MonitoringApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { ClusterHealth, ContainerHealth, HealthVerdict, NodeHealth } from '../../core/models';

const REFRESH_MS = 8000;

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'info';

/** Cluster health view: per-node container health rollup + the containers that
 *  are struggling, scoped to the active cluster. Auto-refreshes; degrades to a
 *  clear message when the cluster cannot provide telemetry (503). */
@Component({
  selector: 'hm-cluster-health',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    TagModule,
    ToggleSwitchModule,
    TooltipModule,
    ProgressSpinnerModule,
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
  readonly showHealthy = signal(false);
  showHealthyModel = false;

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
}
