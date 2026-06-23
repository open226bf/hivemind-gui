import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

import { HivesApi, ServicesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ClusterContextService } from '../../core/cluster-context.service';
import { HiveResponse } from '../../core/models';
import { HiveFormComponent } from './hive-form.component';

@Component({
  selector: 'hm-hives',
  imports: [ButtonModule, HiveFormComponent],
  templateUrl: './hives.component.html',
  styleUrl: './hives.component.scss',
})
export class Hives {
  private readonly api = inject(HivesApi);
  private readonly servicesApi = inject(ServicesApi);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  private readonly ctx = inject(ClusterContextService);
  private readonly auth = inject(AuthService);

  /** Whether the user may create a hive on the active cluster (write on it). */
  readonly canCreate = computed(() => {
    if (this.auth.isAdmin()) return true;
    const cid = this.ctx.selectedId();
    return cid ? this.auth.canWriteCluster(cid) : this.auth.isOperator();
  });

  /** Per-hive gates (cluster grants cascade down). */
  canEdit(h: HiveResponse): boolean {
    return this.auth.canWriteHive(h.cluster_id, h.id);
  }
  canDelete(h: HiveResponse): boolean {
    return this.auth.canManageHive(h.cluster_id, h.id);
  }

  readonly formRef = viewChild.required(HiveFormComponent);

  readonly hives = signal<HiveResponse[]>([]);
  readonly unassignedCount = signal(0);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      this.ctx.selectedId(); // reload when the active cluster changes
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => {
        this.hives.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des ruches impossible',
        });
      },
    });
    this.servicesApi
      .list(1, 1, { unassigned: true })
      .subscribe((r) => this.unassignedCount.set(r.total));
  }

  open(h: HiveResponse): void {
    this.router.navigate(['/hives', h.id]);
  }

  openUnassigned(): void {
    this.router.navigate(['/hives', 'unassigned']);
  }

  openCreate(): void {
    this.formRef().open(null);
  }

  openEdit(h: HiveResponse): void {
    this.formRef().open(h);
  }

  remove(h: HiveResponse): void {
    if (!confirm(`Supprimer la ruche "${h.name}" ?`)) return;
    this.api.remove(h.id).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: 'Supprimée',
          detail: `${h.name} supprimée`,
        });
        this.load();
      },
      error: (err) => {
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Suppression impossible (ruche non vide ?)',
        });
      },
    });
  }
}
