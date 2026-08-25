import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';

import { ClusterApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { firstErrorMessage, settleAll } from '../../core/bulk';
import { confirmDestructive } from '../../core/confirm';
import { ClusterResponse, ClusterStatus } from '../../core/models';
import { collectAll } from '../../core/paging';
import { ClusterFormComponent } from './cluster-form.component';
import { AccessGrantsComponent } from '../acl/access-grants.component';

@Component({
  selector: 'hm-clusters',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    ClusterFormComponent,
    AccessGrantsComponent,
  ],
  templateUrl: './clusters.component.html',
  styleUrl: './clusters.component.scss',
})
export class Clusters {
  private readonly api = inject(ClusterApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);

  /** Cluster management is Admin-only (F-V1-01). */
  readonly canManage = inject(AuthService).isAdmin;

  // ─── Bulk selection ──────────────────────────────────────────────────────────
  readonly selected = signal<ClusterResponse[]>([]);
  statusFilter: ClusterStatus | null = null;
  readonly statusOptions = [
    { label: 'Joignable', value: 'reachable' },
    { label: 'Injoignable', value: 'unreachable' },
    { label: 'Inconnu', value: 'unknown' },
  ];

  readonly formRef = viewChild.required(ClusterFormComponent);

  /** Cluster whose ACL grants ("Habilitations") are open in the dialog (ADR 0003). */
  readonly grantsCluster = signal<ClusterResponse | null>(null);
  grantsVisible = false;

  readonly clusters = signal<ClusterResponse[]>([]);
  readonly loading = signal(false);
  readonly testingId = signal<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.load();
    // Auto-refresh so agent_status (online/offline) stays current without a manual reload.
    interval(8000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(true));
  }

  load(silent = false): void {
    if (!silent) {
      this.loading.set(true);
      // Drop stale selection on an explicit (re)load; preserve it across the
      // 8s background poll so a user's checkboxes don't clear underneath them.
      this.selected.set([]);
    }
    // The whole catalog is pulled page by page, then the table paginates,
    // sorts and filters client-side without extra round-trips.
    collectAll((page, size) => this.api.list(page, size)).subscribe({
      next: (items) => {
        this.clusters.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        if (!silent) {
          this.toast.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Chargement des clusters impossible',
          });
        }
      },
    });
  }

  openEdit(c: ClusterResponse): void {
    this.formRef().open(c);
  }

  openGrants(c: ClusterResponse): void {
    this.grantsCluster.set(c);
    this.grantsVisible = true;
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
    confirmDestructive(
      this.confirmer,
      {
        header: 'Supprimer le cluster',
        message: `Supprimer le cluster "${c.name}" ?`,
      },
      () => {
        this.api.remove(c.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimé',
              detail: `${c.name} supprimé`,
            });
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
      },
    );
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────────────

  clearSelection(): void {
    this.selected.set([]);
  }

  /** Delete every selected cluster after one confirmation. Mirrors the per-row
   *  guard: the default cluster can't be deleted and is skipped. */
  bulkDelete(): void {
    const items = this.selected().filter((c) => !c.is_default);
    const skipped = this.selected().length - items.length;
    if (items.length === 0) {
      this.toast.add({
        severity: 'info',
        summary: 'Rien à supprimer',
        detail: 'Le cluster par défaut ne peut pas être supprimé.',
      });
      return;
    }
    confirmDestructive(
      this.confirmer,
      {
        header: 'Supprimer la sélection',
        message:
          skipped > 0
            ? `Supprimer ${items.length} cluster(s) ? Le cluster par défaut sera ignoré. Action irréversible.`
            : `Supprimer ${items.length} cluster(s) ? Action irréversible.`,
      },
      () =>
        settleAll(items, (c) => this.api.remove(c.id)).subscribe((res) => {
          // Refresh whatever the outcome: a partial failure still changed rows.
          this.clearSelection();
          this.load();
          if (res.failed.length) {
            this.toast.add({
              severity: 'error',
              summary: 'Suppression partielle',
              detail: `${res.succeeded.length}/${items.length} supprimé(s) — ${firstErrorMessage(res.failed, 'Suppression impossible')}`,
            });
            return;
          }
          this.toast.add({
            severity: 'success',
            summary: 'Supprimés',
            detail: `${items.length} cluster(s) supprimé(s)`,
          });
        }),
    );
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

  agentSeverity(status?: string): 'success' | 'warn' | 'secondary' {
    switch (status) {
      case 'online':
        return 'success';
      case 'pending':
        return 'warn';
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
