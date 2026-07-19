import { Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

import { HivesApi, ServicesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { HiveResponse, ServiceResponse } from '../../core/models';
import { HiveFormComponent } from './hive-form.component';
import { HiveTabVariables } from './hive-tab-variables.component';
import { ServiceFormComponent } from '../service/service-form.component';
import { Services } from '../service/services.component';
import { AccessGrantsComponent } from '../acl/access-grants.component';

@Component({
  selector: 'hm-hive-detail',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    TabsModule,
    HiveFormComponent,
    HiveTabVariables,
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

  private readonly auth = inject(AuthService);
  /** Write gate on this hive (manage services / edit / delete), from the grant
   *  on the hive or its cluster (ADR 0003); operator role in shadow mode. */
  readonly canManage = computed(() =>
    this.auth.canWriteHive(this.hive()?.cluster_id ?? null, this.id()),
  );
  /** Grant management (the "Habilitations" tab) needs the manage verb. */
  readonly canManageGrants = computed(() =>
    this.auth.canManageHive(this.hive()?.cluster_id ?? null, this.id()),
  );
  readonly formRef = viewChild.required(HiveFormComponent);

  activeTab = 'services';

  readonly isUnassigned = computed(() => this.id() === 'unassigned');
  protected readonly hive = signal<HiveResponse | null>(null);
  readonly services = signal<ServiceResponse[]>([]);
  readonly loading = signal(false);
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

  protected openCreate() {
    this.formVisible.set(true);
  }
}
