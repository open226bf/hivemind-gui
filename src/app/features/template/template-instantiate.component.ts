import { Component, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import { TemplatesApi } from '../../core/api';
import { InstantiateTemplateRequest, LockableField, TemplateResponse } from '../../core/models';

@Component({
  selector: 'hm-template-instantiate',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, TagModule],
  templateUrl: './template-instantiate.component.html',
  styleUrl: './template-instantiate.component.scss',
})
export class TemplateInstantiateComponent {
  private readonly api = inject(TemplatesApi);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);

  readonly visible = model(false);
  readonly saving = signal(false);
  readonly template = signal<TemplateResponse | null>(null);

  form = { name: '', description: '', tag: '', replicas: null as number | null };

  open(t: TemplateResponse): void {
    this.template.set(t);
    this.form = { name: '', description: '', tag: t.spec.tag, replicas: t.spec.replicas };
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  isLocked(field: LockableField): boolean {
    return this.template()?.locked_fields.includes(field) ?? false;
  }

  save(): void {
    const t = this.template();
    if (!t) return;
    if (!this.form.name) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Le nom du service est obligatoire',
      });
      return;
    }
    const body: InstantiateTemplateRequest = {
      name: this.form.name,
      description: this.form.description || undefined,
    };
    // Only send overrides for fields the template leaves unlocked.
    if (!this.isLocked('tag') && this.form.tag !== t.spec.tag) body.tag = this.form.tag;
    if (
      !this.isLocked('replicas') &&
      this.form.replicas != null &&
      this.form.replicas !== t.spec.replicas
    ) {
      body.replicas = this.form.replicas;
    }

    this.saving.set(true);
    this.api.instantiate(t.id, body).subscribe({
      next: (svc) => {
        this.saving.set(false);
        this.visible.set(false);
        this.toast.add({
          severity: 'success',
          summary: 'Service créé',
          detail: `${svc.name} depuis ${t.name}`,
        });
        this.router.navigate(['/services', svc.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Instanciation impossible',
        });
      },
    });
  }
}
