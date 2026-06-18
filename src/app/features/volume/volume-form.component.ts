import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { VolumesApi } from '../../core/api';

@Component({
  selector: 'hm-volume-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule],
  templateUrl: './volume-form.component.html',
  styleUrl: './volume-form.component.scss',
})
export class VolumeFormComponent {
  private readonly api = inject(VolumesApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly drivers = [{ label: 'local', value: 'local' }];

  // The target cluster comes from the active selection (X-Hivemind-Cluster
  // header set by clusterInterceptor); no per-form picker needed.
  form = { name: '', driver: 'local' };

  open(): void {
    this.form = { name: '', driver: 'local' };
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
        driver: this.form.driver || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.visible.set(false);
          this.toast.add({
            severity: 'success',
            summary: 'Créé',
            detail: `Volume ${this.form.name}`,
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
