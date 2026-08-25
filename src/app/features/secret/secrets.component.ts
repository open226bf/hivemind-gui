import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { SecretsApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { AuthService } from '../../core/auth.service';
import { firstErrorMessage, settleAll } from '../../core/bulk';
import { confirmDestructive } from '../../core/confirm';
import { collectAll } from '../../core/paging';
import { SecretResponse } from '../../core/models';
import { SecretFormComponent } from './secret-form.component';
import { SecretRotateFormComponent } from './secret-rotate-form.component';

@Component({
  selector: 'hm-secrets',
  imports: [
    DatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    TooltipModule,
    SecretFormComponent,
    SecretRotateFormComponent,
  ],
  templateUrl: './secrets.component.html',
  styleUrl: './secrets.component.scss',
})
export class Secrets {
  private readonly api = inject(SecretsApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly ctx = inject(ClusterContextService);

  /** Secrets are Admin-only (F-V1-01). */
  readonly canManage = inject(AuthService).isAdmin;

  readonly createFormRef = viewChild.required(SecretFormComponent);
  readonly rotateFormRef = viewChild.required(SecretRotateFormComponent);

  readonly secrets = signal<SecretResponse[]>([]);
  readonly loading = signal(false);
  readonly rotateTarget = signal<SecretResponse | null>(null);

  // ─── Bulk selection ──────────────────────────────────────────────────────────
  readonly selected = signal<SecretResponse[]>([]);

  constructor() {
    effect(() => {
      this.ctx.selectedId();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.selected.set([]); // drop stale selection (rows are about to be replaced)
    collectAll((page, size) => this.api.list(page, size)).subscribe({
      next: (items) => {
        this.secrets.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des secrets impossible',
        });
      },
    });
  }

  clearSelection(): void {
    this.selected.set([]);
  }

  bulkDelete(): void {
    const items = this.selected();
    if (!items.length) return;
    confirmDestructive(
      this.confirmer,
      {
        header: 'Supprimer la sélection',
        message: `Supprimer ${items.length} élément(s) ? Action irréversible.`,
      },
      () =>
        settleAll(items, (x) => this.api.remove(x.id)).subscribe((res) => {
          // Refresh whatever the outcome: a partial failure still removed rows.
          this.clearSelection();
          this.load();
          if (res.failed.length) {
            this.toast.add({
              severity: 'error',
              summary: 'Suppression partielle',
              detail: `${res.succeeded.length}/${items.length} supprimé(s) — ${firstErrorMessage(
                res.failed,
                'suppression impossible',
              )}`,
            });
            return;
          }
          this.toast.add({
            severity: 'success',
            summary: 'Supprimés',
            detail: `${items.length} supprimé(s)`,
          });
        }),
    );
  }

  openCreate(): void {
    this.createFormRef().open();
  }

  openRotate(s: SecretResponse): void {
    this.rotateTarget.set(s);
    this.rotateFormRef().open();
  }

  remove(s: SecretResponse): void {
    confirmDestructive(
      this.confirmer,
      { header: 'Supprimer le secret', message: `Supprimer le secret "${s.name}" ?` },
      () =>
        this.api.remove(s.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimé',
              detail: `${s.name} supprimé`,
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
        }),
    );
  }
}
