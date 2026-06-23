import { Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';

import { HivesApi, ServicesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { HiveResponse, ServiceResponse } from '../../core/models';
import { HiveFormComponent } from './hive-form.component';
import { ServiceFormComponent } from '../service/service-form.component';
import { Services } from '../service/services.component';
import { AccessGrantsComponent } from '../acl/access-grants.component';

@Component({
  selector: 'hm-hive-detail',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    MultiSelectModule,
    HiveFormComponent,
    ServiceFormComponent,
    Services,
    AccessGrantsComponent,
  ],
  templateUrl: './hive-detail.component.html',
  styleUrl: './hive-detail.component.scss',
})
export class HiveDetail {
  readonly id = input.required<string>();

  private readonly api = inject(HivesApi);
  private readonly servicesApi = inject(ServicesApi);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);

  readonly canManage = inject(AuthService).isOperator;
  readonly formRef = viewChild.required(HiveFormComponent);

  readonly isUnassigned = computed(() => this.id() === 'unassigned');
  protected readonly hive = signal<HiveResponse | null>(null);
  readonly services = signal<ServiceResponse[]>([]);
  readonly loading = signal(false);

  // ─── Manage dialog ──────────────────────────────────────────────────────────
  manageVisible = false;
  readonly serviceOptions = signal<{ label: string; value: string }[]>([]);
  selectedIds: string[] = [];
  readonly managing = signal(false);
  readonly formVisible = signal(false);

  constructor() {
    effect(() => {
      this.id(); // re-run on param change
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    if (this.isUnassigned()) {
      this.hive.set(null);
      this.servicesApi.list(1, 1000, { unassigned: true }).subscribe({
        next: (r) => {
          this.services.set(r.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }
    this.api.get(this.id()).subscribe({
      next: (h) => this.hive.set(h),
      error: () =>
        this.toast.add({ severity: 'error', summary: 'Erreur', detail: 'Ruche introuvable' }),
    });
    this.api.services(this.id()).subscribe({
      next: (s) => {
        this.services.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  color(): string {
    return this.hive()?.color || '#E8920C';
  }

  openEdit(): void {
    const h = this.hive();
    if (h) this.formRef().open(h);
  }

  remove(): void {
    const h = this.hive();
    if (!h) return;
    if (!confirm(`Supprimer la ruche "${h.name}" ?`)) return;
    this.api.remove(h.id).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: 'Supprimée',
          detail: `${h.name} supprimée`,
        });
        this.router.navigate(['/hives']);
      },
      error: (err) =>
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Suppression impossible (ruche non vide ?)',
        }),
    });
  }

  openManage(): void {
    const h = this.hive();
    if (!h) return;
    this.managing.set(false);
    this.servicesApi.list(1, 1000).subscribe((res) => {
      this.serviceOptions.set(
        res.items.map((s) => ({
          label:
            s.hive_id && s.hive_id !== h.id ? `${s.name}  (déjà dans une autre ruche)` : s.name,
          value: s.id,
        })),
      );
      this.selectedIds = res.items.filter((s) => s.hive_id === h.id).map((s) => s.id);
      this.manageVisible = true;
    });
  }

  saveManage(): void {
    const h = this.hive();
    if (!h) return;
    const current = new Set(this.services().map((s) => s.id));
    const selected = new Set(this.selectedIds);
    const toAssign = this.selectedIds.filter((id) => !current.has(id));
    const toUnassign = [...current].filter((id) => !selected.has(id));

    const ops = [
      ...toAssign.map((id) => this.servicesApi.assignHive(id, h.id)),
      ...toUnassign.map((id) => this.servicesApi.assignHive(id, null)),
    ];
    if (ops.length === 0) {
      this.manageVisible = false;
      return;
    }

    this.managing.set(true);
    forkJoin(ops).subscribe({
      next: () => {
        this.managing.set(false);
        this.manageVisible = false;
        this.toast.add({
          severity: 'success',
          summary: 'Mis à jour',
          detail: `${toAssign.length} ajouté(s), ${toUnassign.length} retiré(s)`,
        });
        this.load();
      },
      error: (err) => {
        this.managing.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Mise à jour impossible',
        });
      },
    });
  }

  protected openCreate() {
    this.formVisible.set(true);
  }
}
