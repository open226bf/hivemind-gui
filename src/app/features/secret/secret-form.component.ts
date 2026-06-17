import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { ClusterApi, SecretsApi } from '../../core/api';

@Component({
  selector: 'hm-secret-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, PasswordModule, SelectModule],
  templateUrl: './secret-form.component.html',
  styleUrl: './secret-form.component.scss',
})
export class SecretFormComponent {
  private readonly api = inject(SecretsApi);
  private readonly clusterApi = inject(ClusterApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly clusterOptions = signal<{ label: string; value: string }[]>([]);
  private defaultClusterId = '';

  form = { name: '', target_path: '', value: '', cluster: '' };

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
    this.form = { name: '', target_path: '', value: '', cluster: this.defaultClusterId };
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    if (!this.form.name || !this.form.value) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champs requis',
        detail: 'Nom et valeur sont obligatoires',
      });
      return;
    }
    this.saving.set(true);
    this.api
      .create({
        name: this.form.name,
        target_path: this.form.target_path || undefined,
        value: this.form.value,
        cluster: this.form.cluster || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.toast.add({
            severity: 'success',
            summary: 'Créé',
            detail: `Secret ${this.form.name}`,
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
