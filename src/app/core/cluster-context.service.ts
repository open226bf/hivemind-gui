import { Injectable, computed, inject, signal } from '@angular/core';

import { ClusterApi } from './api';
import { AuthService } from './auth.service';
import { ClusterResponse } from './models';

const STORAGE_KEY = 'hm.selected-cluster';
/** Sentinel persisted when the user explicitly picks the aggregated view. */
const ALL = '__all__';

/**
 * Holds the cluster selection shared across the app. A null selection means
 * "all clusters" (the aggregated dashboard overview); a specific id scopes the
 * dashboard to that cluster's node health.
 *
 * Persistence is tri-state so we can tell an explicit "all" choice apart from a
 * first visit: the default cluster is preselected when no preference exists yet,
 * while an explicit "all" pick is remembered.
 */
@Injectable({ providedIn: 'root' })
export class ClusterContextService {
  private readonly api = inject(ClusterApi);
  private readonly auth = inject(AuthService);

  readonly clusters = signal<ClusterResponse[]>([]);
  readonly selectedId = signal<string | null>(this.storedSelection());
  /** The selector is only worth showing once more than one cluster exists. */
  readonly multiCluster = computed(() => this.clusters().length > 1);

  /** Loads the cluster list once (called from the shell on startup), keeping
   *  only the clusters the user may reach (admins see all; ADR 0003). */
  load(): void {
    this.api.list(1, 200).subscribe({
      next: (res) => {
        const visible = this.filterReachable(res.items);
        this.clusters.set(visible);
        this.reconcileSelection(visible);
      },
    });
  }

  /** Restricts the cluster list to those granted to the user. A null reachable
   *  set means "no restriction" (admin). */
  private filterReachable(clusters: ClusterResponse[]): ClusterResponse[] {
    const reachable = this.auth.reachableClusterIds();
    if (reachable === null) return clusters;
    return clusters.filter((c) => reachable.has(c.id));
  }

  select(id: string | null): void {
    this.selectedId.set(id);
    localStorage.setItem(STORAGE_KEY, id ?? ALL);
  }

  /**
   * Resolves the active selection against the freshly loaded clusters:
   * - no stored preference  -> preselect the default cluster;
   * - a stale id (cluster gone) -> fall back to the default cluster;
   * - an explicit "all" or a still-valid id -> keep as-is.
   */
  private reconcileSelection(clusters: ClusterResponse[]): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    const defaultId = clusters.find((c) => c.is_default)?.id ?? clusters[0]?.id ?? null;

    if (raw === null) {
      this.selectedId.set(defaultId); // first visit: default cluster, not persisted
      return;
    }
    if (raw === ALL) {
      this.selectedId.set(null);
      return;
    }
    this.selectedId.set(clusters.some((c) => c.id === raw) ? raw : defaultId);
  }

  /** Initial value before the cluster list has loaded. */
  private storedSelection(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && raw !== ALL ? raw : null;
  }
}
