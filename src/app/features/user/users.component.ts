import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { UsersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Role, UserResponse } from '../../core/models';
import { UserFormComponent } from './user-form.component';

@Component({
  selector: 'hm-users',
  imports: [DatePipe, TableModule, ButtonModule, TagModule, TooltipModule, UserFormComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class Users {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(MessageService);
  private readonly auth = inject(AuthService);

  readonly formRef = viewChild.required(UserFormComponent);

  readonly users = signal<UserResponse[]>([]);
  readonly loading = signal(false);

  readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => { this.users.set(res.items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.add({ severity: 'error', summary: 'Erreur', detail: 'Chargement des utilisateurs impossible' }); },
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
      next: () => { this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${u.email} supprimé` }); this.load(); },
      error: (err) => { this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Suppression impossible' }); },
    });
  }

  roleSeverity(role: Role): 'danger' | 'info' | 'secondary' {
    if (role === 'admin') return 'danger';
    if (role === 'operator') return 'info';
    return 'secondary';
  }
}
