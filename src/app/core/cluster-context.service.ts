import { Injectable, computed, inject, signal } from '@angular/core';

import { ClusterApi } from './api';
import { ClusterResponse } from './models';

const STORAGE_KEY = 'hm.selected-cluster';

/**
 * Holds the cluster selection shared across the app. A null selection means
 * "all clusters" (the aggregated dashboard overview); a specific id scopes the
 * dashboard to that cluster's node health. The choice is persisted so it
 * survives reloads.
 */
@Injectable({ providedIn: 'root' })
export class ClusterContextService {
  private readonly api = inject(ClusterApi);

  readonly clusters = signal<ClusterResponse[]>([]);
  readonly selectedId = signal<string | null>(this.readStored());
  /** The selector is only worth showing once more than one cluster exists. */
  readonly multiCluster = computed(() => this.clusters().length > 1);

  /** Loads the cluster list once (called from the shell on startup). */
  load(): void {
    this.api.list(1, 200).subscribe({
      next: (res) => {
        this.clusters.set(res.items);
        // Drop a stale selection that no longer maps to a known cluster.
        const sel = this.selectedId();
        if (sel && !res.items.some((c) => c.id === sel)) this.select(null);
      },
    });
  }

  select(id: string | null): void {
    this.selectedId.set(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }

  private readStored(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }
}
