import { Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

import { HivesApi, ServicesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
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

  /** Operators manage hives and assignments (F — ruches). */
  readonly canManage = inject(AuthService).isOperator;

  readonly formRef = viewChild.required(HiveFormComponent);

  readonly hives = signal<HiveResponse[]>([]);
  readonly unassignedCount = signal(0);
  readonly loading = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => { this.hives.set(res.items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.add({ severity: 'error', summary: 'Erreur', detail: 'Chargement des ruches impossible' }); },
    });
    this.servicesApi.list(1, 1, { unassigned: true }).subscribe((r) => this.unassignedCount.set(r.total));
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
      next: () => { this.toast.add({ severity: 'success', summary: 'Supprimée', detail: `${h.name} supprimée` }); this.load(); },
      error: (err) => { this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Suppression impossible (ruche non vide ?)' }); },
    });
  }
}
