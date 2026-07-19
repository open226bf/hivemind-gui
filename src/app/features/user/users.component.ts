import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';

import { UsersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Role, UserResponse } from '../../core/models';
import { UserFormComponent } from './user-form.component';

@Component({
  selector: 'hm-users',
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    SelectModule,
    UserFormComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class Users {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly auth = inject(AuthService);

  readonly formRef = viewChild.required(UserFormComponent);

  readonly users = signal<UserResponse[]>([]);
  readonly loading = signal(false);

  // ─── Bulk selection ──────────────────────────────────────────────────────────
  readonly selected = signal<UserResponse[]>([]);
  roleFilter: Role | null = null;
  readonly roleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Opérateur', value: 'operator' },
    { label: 'Lecteur', value: 'viewer' },
  ];

  readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.selected.set([]); // drop stale selection (rows are about to be replaced)
    // Client-side paginate/sort/filter over a generous page; the table handles
    // the rest without extra round-trips.
    this.api.list(1, 1000).subscribe({
      next: (res) => {
        this.users.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des utilisateurs impossible',
        });
      },
    });
  }

  openCreate(): void {
    this.formRef().open();
  }

  openEdit(u: UserResponse): void {
    this.formRef().open(u);
  }

  remove(u: UserResponse): void {
    if (u.id === this.currentUserId()) return;
    if (!confirm(`Supprimer l'utilisateur "${u.email}" ?`)) return;
    this.api.remove(u.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${u.email} supprimé` });
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

  // ─── Bulk actions ─────────────────────────────────────────────────────────────

  clearSelection(): void {
    this.selected.set([]);
  }

  /** Delete every selected user after one confirmation. The current user cannot
   *  delete their own account, so self is excluded (mirrors the per-row guard). */
  bulkDelete(): void {
    const items = this.selected().filter((u) => u.id !== this.currentUserId());
    if (!items.length) return;
    this.confirmer.confirm({
      header: 'Supprimer la sélection',
      message: `Supprimer ${items.length} utilisateur(s) ? Action irréversible.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        forkJoin(items.map((u) => this.api.remove(u.id))).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimés',
              detail: `${items.length} supprimé(s)`,
            });
            this.clearSelection();
            this.load();
          },
          error: (err) =>
            this.toast.add({
              severity: 'error',
              summary: 'Erreur',
              detail: err?.error?.message ?? 'Suppression impossible',
            }),
        });
      },
    });
  }

  roleSeverity(role: Role): 'danger' | 'info' | 'secondary' {
    if (role === 'admin') return 'danger';
    if (role === 'operator') return 'info';
    return 'secondary';
  }
}
