import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { SecretsApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { AuthService } from '../../core/auth.service';
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
  private readonly ctx = inject(ClusterContextService);

  /** Secrets are Admin-only (F-V1-01). */
  readonly canManage = inject(AuthService).isAdmin;

  readonly createFormRef = viewChild.required(SecretFormComponent);
  readonly rotateFormRef = viewChild.required(SecretRotateFormComponent);

  readonly secrets = signal<SecretResponse[]>([]);
  readonly loading = signal(false);
  readonly rotateTarget = signal<SecretResponse | null>(null);

  constructor() {
    effect(() => {
      this.ctx.selectedId();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list(1, 50, this.ctx.selectedId() ?? undefined).subscribe({
      next: (res) => {
        this.secrets.set(res.items);
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

  openCreate(): void {
    this.createFormRef().open();
  }

  openRotate(s: SecretResponse): void {
    this.rotateTarget.set(s);
    this.rotateFormRef().open();
  }

  remove(s: SecretResponse): void {
    if (!confirm(`Supprimer le secret "${s.name}" ?`)) return;
    this.api.remove(s.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${s.name} supprimé` });
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
}
