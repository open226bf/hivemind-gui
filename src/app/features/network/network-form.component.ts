import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';

import { ClusterApi, NetworksApi } from '../../core/api';

@Component({
  selector: 'hm-network-form',
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    ToggleSwitchModule,
  ],
  templateUrl: './network-form.component.html',
  styleUrl: './network-form.component.scss',
})
export class NetworkFormComponent {
  private readonly api = inject(NetworksApi);
  private readonly clusterApi = inject(ClusterApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly clusterOptions = signal<{ label: string; value: string }[]>([]);
  private defaultClusterId = '';

  form = { name: '', subnet: '', attachable: true, external: false, cluster: '' };

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
      subnet: '',
      attachable: true,
      external: false,
      cluster: this.defaultClusterId,
    };
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    if (!this.form.name) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Le nom est obligatoire',
      });
      return;
    }
    this.saving.set(true);
    this.api
      .create({
        name: this.form.name,
        subnet: this.form.subnet || undefined,
        attachable: this.form.attachable,
        external: this.form.external,
        cluster: this.form.cluster || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.toast.add({
            severity: 'success',
            summary: 'Créé',
            detail: `Réseau ${this.form.name}`,
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
