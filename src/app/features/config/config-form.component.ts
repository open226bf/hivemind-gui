import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { ClusterApi, ConfigsApi } from '../../core/api';

@Component({
  selector: 'hm-config-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule, SelectModule],
  templateUrl: './config-form.component.html',
  styleUrl: './config-form.component.scss',
})
export class ConfigFormComponent {
  private readonly api = inject(ConfigsApi);
  private readonly clusterApi = inject(ClusterApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly clusterOptions = signal<{ label: string; value: string }[]>([]);
  private defaultClusterId = '';

  form = { name: '', target_path: '', content: '', comment: '', cluster: '' };

  constructor() {
    this.clusterApi.list(1, 200).subscribe({
      next: (res) => {
        this.clusterOptions.set(
          res.items.map((c) => ({
            label: c.is_default ? `${c.name} (défaut)` : c.name,
            value: c.id,
          })),
        );
        this.defaultClusterId = res.items.find((c) => c.is_default)?.id ?? res.items[0]?.id ?? '';
        if (!this.form.cluster) this.form.cluster = this.defaultClusterId;
      },
    });
  }

  open(): void {
    this.form = {
      name: '',
      target_path: '',
      content: '',
      comment: '',
      cluster: this.defaultClusterId,
    };
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
        cluster: this.form.cluster || undefined,
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
