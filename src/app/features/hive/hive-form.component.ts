import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { HivesApi } from '../../core/api';
import { HiveResponse } from '../../core/models';

const PALETTE = [
  '#E8920C',
  '#FBB040',
  '#43a047',
  '#fb8c00',
  '#8e24aa',
  '#e53935',
  '#00897b',
  '#5e35b1',
  '#6d4c41',
];

@Component({
  selector: 'hm-hive-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule],
  templateUrl: './hive-form.component.html',
  styleUrl: './hive-form.component.scss',
})
export class HiveFormComponent {
  private readonly api = inject(HivesApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly palette = PALETTE;

  form = { name: '', description: '', color: PALETTE[0] };

  open(h: HiveResponse | null): void {
    if (h) {
      this.editingId.set(h.id);
      this.form = { name: h.name, description: h.description, color: h.color || PALETTE[0] };
    } else {
      this.editingId.set(null);
      this.form = { name: '', description: '', color: PALETTE[0] };
    }
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Le nom est obligatoire',
      });
      return;
    }
    this.saving.set(true);
    const body = {
      name: this.form.name.trim(),
      description: this.form.description || undefined,
      color: this.form.color,
    };
    const id = this.editingId();
    const done = {
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.toast.add({
          severity: 'success',
          summary: id ? 'Modifiée' : 'Créée',
          detail: `Ruche ${this.form.name}`,
        });
        this.saved.emit();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Opération impossible',
        });
      },
    };
    if (id) this.api.update(id, body).subscribe(done);
    else this.api.create(body).subscribe(done);
  }
}
