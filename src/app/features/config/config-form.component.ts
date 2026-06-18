import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

import { ConfigsApi } from '../../core/api';

@Component({
  selector: 'hm-config-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule],
  templateUrl: './config-form.component.html',
  styleUrl: './config-form.component.scss',
})
export class ConfigFormComponent {
  private readonly api = inject(ConfigsApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);

  // The target cluster comes from the active selection (X-Hivemind-Cluster
  // header set by clusterInterceptor); no per-form picker needed.
  form = { name: '', target_path: '', content: '', comment: '' };

  open(): void {
    this.form = { name: '', target_path: '', content: '', comment: '' };
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    if (!this.form.name || !this.form.content) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champs requis',
        detail: 'Nom et contenu sont obligatoires',
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
      .create({
        name: this.form.name,
        target_path: this.form.target_path || undefined,
        content: this.form.content,
        comment: this.form.comment.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.toast.add({
            severity: 'success',
            summary: 'Créée',
            detail: `Config ${this.form.name}`,
          });
          this.saved.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'Erreur',
            detail: err?.error?.message ?? 'Création impossible',
          });
        },
      });
  }
}
