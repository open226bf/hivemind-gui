import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EMPTY, Observable, interval } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ClusterApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { ClusterOverview } from '../../core/models';

const REFRESH_MS = 5000;

@Component({
  selector: 'hm-dashboard',
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class Dashboard implements OnInit {
  private readonly api = inject(ClusterApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly ctx = inject(ClusterContextService);

  readonly overview = signal<ClusterOverview | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  readonly autoRefresh = signal(true);
  autoRefreshModel = true;

  /** Ratio of ready nodes, for the health bar (0 when no nodes). */
  readonly readyRatio = computed(() => {
    const c = this.overview()?.cluster;
    return c && c.node_total > 0 ? (c.ready_nodes / c.node_total) * 100 : 0;
  });

  constructor() {
    // Refresh immediately when the header cluster selection changes.
    effect(() => {
      this.ctx.selectedId();
      this.fetch();
    });
  }

  ngOnInit(): void {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.autoRefresh() && this.overview()) return;
        this.fetch();
      });
  }

  /** Loads the overview scoped to the selected cluster. Never aggregates. */
  private fetch(): void {
    const id = this.ctx.selectedId();
    if (!id) return; // no cluster selected yet (pre-load); wait for the resolution
    this.refreshing.set(true);
    const req: Observable<ClusterOverview> = this.api.overviewFor(id);
    req.pipe(catchError(() => EMPTY)).subscribe((ov) => {
      this.overview.set(ov);
      this.loading.set(false);
      this.refreshing.set(false);
      this.lastUpdated.set(new Date());
    });
  }

  setAutoRefresh(on: boolean): void {
    this.autoRefresh.set(on);
  }

  /** Formats a byte count as GiB with one decimal. */
  gib(bytes: number): string {
    return (bytes / 1024 ** 3).toFixed(1);
  }

  roleSeverity(role: string): 'info' | 'secondary' {
    return role === 'manager' ? 'info' : 'secondary';
  }

  stateSeverity(state: string): 'success' | 'danger' | 'warn' {
    if (state === 'ready') return 'success';
    if (state === 'down') return 'danger';
    return 'warn';
  }

  availabilitySeverity(av: string): 'success' | 'warn' | 'secondary' {
    if (av === 'active') return 'success';
    if (av === 'drain') return 'secondary';
    return 'warn';
  }
}
