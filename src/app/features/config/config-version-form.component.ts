import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

import { ConfigsApi } from '../../core/api';
import { ConfigResponse } from '../../core/models';

@Component({
  selector: 'hm-config-version-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule],
  templateUrl: './config-version-form.component.html',
  styleUrl: './config-version-form.component.scss',
})
export class ConfigVersionFormComponent {
  private readonly api = inject(ConfigsApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly config = input<ConfigResponse | null>(null);
  readonly saved = output<void>();
  readonly saving = signal(false);

  form = { content: '', comment: '' };

  open(): void {
    this.form = { content: '', comment: '' };
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    const c = this.config();
    if (!c || !this.form.content) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Le contenu est obligatoire',
      });
      return;
    }
    if (!this.form.comment.trim()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Un commentaire est obligatoire pour chaque version',
      });
      return;
    }
    this.saving.set(true);
    this.api
      .addVersion(c.id, {
        content: this.form.content,
        comment: this.form.comment.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.toast.add({ severity: 'success', summary: 'Version ajoutée', detail: c.name });
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'Erreur',
            detail: err?.error?.message ?? 'Ajout impossible',
          });
        },
      });
  }
}
