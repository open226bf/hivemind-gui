import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';

import { SecretsApi } from '../../core/api';
import { SecretResponse } from '../../core/models';

@Component({
  selector: 'hm-secret-rotate-form',
  imports: [FormsModule, ButtonModule, DialogModule, PasswordModule],
  templateUrl: './secret-rotate-form.component.html',
  styleUrl: './secret-rotate-form.component.scss',
})
export class SecretRotateFormComponent {
  private readonly api = inject(SecretsApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly target = input<SecretResponse | null>(null);
  readonly saved = output<void>();
  readonly saving = signal(false);

  value = '';

  open(): void {
    this.value = '';
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    const t = this.target();
    if (!t || !this.value) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'La nouvelle valeur est obligatoire',
      });
      return;
    }
    this.saving.set(true);
    this.api.rotate(t.id, this.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.toast.add({ severity: 'success', summary: 'Rotation effectuée', detail: t.name });
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Rotation impossible',
        });
      },
    });
  }
}
