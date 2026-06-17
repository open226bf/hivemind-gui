import { Component, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { ClusterApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ClusterResponse } from '../../core/models';
import { ClusterFormComponent } from './cluster-form.component';

@Component({
  selector: 'hm-clusters',
  imports: [DatePipe, TableModule, ButtonModule, TagModule, TooltipModule, ClusterFormComponent],
  templateUrl: './clusters.component.html',
  styleUrl: './clusters.component.scss',
})
export class Clusters {
  private readonly api = inject(ClusterApi);
  private readonly toast = inject(MessageService);

  /** Cluster management is Admin-only (F-V1-01). */
  readonly canManage = inject(AuthService).isAdmin;

  readonly formRef = viewChild.required(ClusterFormComponent);

  readonly clusters = signal<ClusterResponse[]>([]);
  readonly loading = signal(false);
  readonly testingId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => {
        this.clusters.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des clusters impossible',
        });
      },
    });
  }

  openCreate(): void {
    this.formRef().open();
  }

  openEdit(c: ClusterResponse): void {
    this.formRef().open(c);
  }

  onSaved(): void {
    this.load();
  }

  setDefault(c: ClusterResponse): void {
    if (c.is_default) return;
    this.api.setDefault(c.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Cluster par défaut', detail: c.name });
        this.load();
      },
      error: (err) => {
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Opération impossible',
        });
      },
    });
  }

  test(c: ClusterResponse): void {
    this.testingId.set(c.id);
    this.api.test(c.id).subscribe({
      next: (res) => {
        this.testingId.set(null);
        this.toast.add({ severity: 'success', summary: 'Joignable', detail: `${c.name} répond` });
        this.patch(res);
      },
      error: (err) => {
        this.testingId.set(null);
        this.toast.add({
          severity: 'warn',
          summary: 'Injoignable',
          detail: err?.error?.message ?? `${c.name} ne répond pas`,
        });
        this.load();
      },
    });
  }

  remove(c: ClusterResponse): void {
    if (c.is_default) {
      this.toast.add({
        severity: 'warn',
        summary: 'Action refusée',
        detail: 'Le cluster par défaut ne peut pas être supprimé',
      });
      return;
    }
    if (!confirm(`Supprimer le cluster "${c.name}" ?`)) return;
    this.api.remove(c.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${c.name} supprimé` });
        this.load();
      },
      error: (err) => {
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Suppression impossible',
        });
      },
    });
  }

  statusSeverity(status: string): 'success' | 'danger' | 'secondary' {
    switch (status) {
      case 'reachable':
        return 'success';
      case 'unreachable':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  labelPairs(c: ClusterResponse): string[] {
    return Object.entries(c.labels ?? {}).map(([k, v]) => `${k}=${v}`);
  }

  private patch(updated: ClusterResponse): void {
    this.clusters.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
  }
}
