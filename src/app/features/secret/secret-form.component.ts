import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';

import { SecretsApi } from '../../core/api';

@Component({
  selector: 'hm-secret-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, PasswordModule],
  templateUrl: './secret-form.component.html',
  styleUrl: './secret-form.component.scss',
})
export class SecretFormComponent {
  private readonly api = inject(SecretsApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);

  form = { name: '', target_path: '', value: '' };

  open(): void {
    this.form = { name: '', target_path: '', value: '' };
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    if (!this.form.name || !this.form.value) {
      this.toast.add({ severity: 'warn', summary: 'Champs requis', detail: 'Nom et valeur sont obligatoires' });
      return;
    }
    this.saving.set(true);
    this.api.create({
      name: this.form.name,
      target_path: this.form.target_path || undefined,
      value: this.form.value,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.toast.add({ severity: 'success', summary: 'Créé', detail: `Secret ${this.form.name}` });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Création impossible' });
      },
    });
  }
}
