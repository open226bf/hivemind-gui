import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';

import { UsersApi } from '../../core/api';
import { Role, UserResponse } from '../../core/models';

@Component({
  selector: 'hm-user-form',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    ToggleSwitchModule,
  ],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent {
  private readonly api = inject(UsersApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);
  readonly mode = signal<'create' | 'edit'>('create');

  readonly roles = [
    { label: 'Admin — gestion complète (utilisateurs, secrets, réseaux)', value: 'admin' as Role },
    { label: 'Operator — déploiement et gestion des services', value: 'operator' as Role },
    { label: 'Viewer — consultation seule', value: 'viewer' as Role },
  ];

  private editingId: string | null = null;
  form = this.empty();

  open(user?: UserResponse): void {
    if (user) {
      this.mode.set('edit');
      this.editingId = user.id;
      this.form = { email: user.email, password: '', role: user.role, active: user.active };
    } else {
      this.mode.set('create');
      this.editingId = null;
      this.form = this.empty();
    }
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    if (this.mode() === 'create') {
      if (!this.form.email || !this.form.password) {
        this.toast.add({
          severity: 'warn',
          summary: 'Champs requis',
          detail: 'Email et mot de passe sont obligatoires',
        });
        return;
      }
      this.saving.set(true);
      this.api
        .create({ email: this.form.email, password: this.form.password, role: this.form.role })
        .subscribe({
          next: () => this.onSaved('Créé', this.form.email),
          error: (e) => this.onError(e),
        });
    } else {
      this.saving.set(true);
      this.api
        .update(this.editingId!, {
          role: this.form.role,
          active: this.form.active,
          password: this.form.password ? this.form.password : undefined,
        })
        .subscribe({
          next: () => this.onSaved('Modifié', this.form.email),
          error: (e) => this.onError(e),
        });
    }
  }

  private onSaved(verb: string, email: string): void {
    this.saving.set(false);
    this.visible.set(false);
    this.toast.add({ severity: 'success', summary: verb, detail: `Utilisateur ${email}` });
    this.saved.emit();
  }

  private onError(err: { error?: { message?: string } }): void {
    this.saving.set(false);
    this.toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err?.error?.message ?? 'Opération impossible',
    });
  }

  private empty() {
    return { email: '', password: '', role: 'viewer' as Role, active: true };
  }
}
