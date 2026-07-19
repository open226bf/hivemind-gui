import { Component, inject, signal, viewChild } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';

import { TemplatesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { TemplateResponse } from '../../core/models';
import { TemplateFormComponent } from './template-form.component';
import { TemplateInstantiateComponent } from './template-instantiate.component';

@Component({
  selector: 'hm-templates',
  imports: [
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    TooltipModule,
    TemplateFormComponent,
    TemplateInstantiateComponent,
  ],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
})
export class Templates {
  private readonly api = inject(TemplatesApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly auth = inject(AuthService);

  /** Admins manage templates; any Operator may instantiate (F-V2-07). */
  readonly isAdmin = this.auth.isAdmin;
  readonly canInstantiate = this.auth.isOperator;

  readonly formRef = viewChild.required(TemplateFormComponent);
  readonly instantiateRef = viewChild.required(TemplateInstantiateComponent);

  readonly templates = signal<TemplateResponse[]>([]);
  readonly loading = signal(false);

  // ─── Bulk selection ──────────────────────────────────────────────────────────
  readonly selected = signal<TemplateResponse[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.selected.set([]); // drop stale selection (rows are about to be replaced)
    // Client-side paginate/sort/filter over a generous page; the table handles
    // the rest without extra round-trips.
    this.api.list(1, 1000).subscribe({
      next: (res) => {
        this.templates.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des templates impossible',
        });
      },
    });
  }

  openCreate(): void {
    this.formRef().open(null);
  }

  openEdit(t: TemplateResponse): void {
    this.formRef().open(t);
  }

  openInstantiate(t: TemplateResponse): void {
    this.instantiateRef().open(t);
  }

  remove(t: TemplateResponse): void {
    if (!confirm(`Supprimer le template "${t.name}" ?`)) return;
    this.api.remove(t.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${t.name} supprimé` });
        this.load();
      },
      error: (err) => {
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Suppression impossible',
        });
      },
    });
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────────────

  clearSelection(): void {
    this.selected.set([]);
  }

  bulkDelete(): void {
    const items = this.selected();
    if (!items.length) return;
    this.confirmer.confirm({
      header: 'Supprimer la sélection',
      message: `Supprimer ${items.length} élément(s) ? Action irréversible.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        forkJoin(items.map((x) => this.api.remove(x.id))).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimés',
              detail: `${items.length} supprimé(s)`,
            });
            this.clearSelection();
            this.load();
          },
          error: (err) =>
            this.toast.add({
              severity: 'error',
              summary: 'Erreur',
              detail: err?.error?.message ?? 'Suppression impossible',
            }),
        });
      },
    });
  }
}
