import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TabsModule } from 'primeng/tabs';
import { ConfirmationService, MessageService } from 'primeng/api';

import { VolumesApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { AuthService } from '../../core/auth.service';
import { firstErrorMessage, settleAll } from '../../core/bulk';
import { confirmDestructive } from '../../core/confirm';
import { collectAll } from '../../core/paging';
import { SwarmVolumeInfo, VolumeResponse } from '../../core/models';
import { VolumeFormComponent } from './volume-form.component';

@Component({
  selector: 'hm-volumes',
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    SelectModule,
    TooltipModule,
    TabsModule,
    VolumeFormComponent,
  ],
  templateUrl: './volumes.component.html',
  styleUrl: './volumes.component.scss',
})
export class Volumes {
  private readonly api = inject(VolumesApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly ctx = inject(ClusterContextService);

  /** Volume catalog management is Admin-only (F-V2-06). */
  readonly canManage = inject(AuthService).isAdmin;

  readonly formRef = viewChild.required(VolumeFormComponent);

  readonly volumes = signal<VolumeResponse[]>([]);
  readonly swarmVolumes = signal<SwarmVolumeInfo[]>([]);
  readonly loading = signal(false);
  readonly swarmLoading = signal(false);
  activeTab = 'registered';

  // ─── Bulk selection (registered catalog) ─────────────────────────────────────
  readonly selected = signal<VolumeResponse[]>([]);
  driverFilter: string | null = null;
  /** Distinct drivers present in the catalog, for the categorical column filter. */
  readonly driverOptions = computed(() =>
    [...new Set(this.volumes().map((v) => v.driver))].sort().map((d) => ({ label: d, value: d })),
  );

  constructor() {
    effect(() => {
      this.ctx.selectedId();
      this.load();
      this.loadSwarm();
    });
  }

  load(): void {
    this.loading.set(true);
    this.selected.set([]); // drop stale selection (rows are about to be replaced)
    collectAll((page, size) => this.api.list(page, size)).subscribe({
      next: (items) => {
        this.volumes.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des volumes impossible',
        });
      },
    });
  }

  loadSwarm(): void {
    this.swarmLoading.set(true);
    this.api.swarm().subscribe({
      next: (vols) => {
        this.swarmVolumes.set(vols);
        this.swarmLoading.set(false);
      },
      error: () => {
        this.swarmLoading.set(false);
      },
    });
  }

  openCreate(): void {
    this.formRef().open();
  }

  onSaved(): void {
    this.load();
    this.loadSwarm();
  }

  remove(v: VolumeResponse): void {
    confirmDestructive(
      this.confirmer,
      { header: 'Supprimer le volume', message: `Supprimer le volume "${v.name}" ?` },
      () =>
        this.api.remove(v.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimé',
              detail: `${v.name} supprimé`,
            });
            this.onSaved();
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Erreur',
              detail: err?.error?.message ?? 'Suppression impossible (volume monté ?)',
            });
          },
        }),
    );
  }

  // ─── Bulk actions (registered catalog) ────────────────────────────────────────

  clearSelection(): void {
    this.selected.set([]);
  }

  bulkDelete(): void {
    const items = this.selected();
    if (!items.length) return;
    confirmDestructive(
      this.confirmer,
      {
        header: 'Supprimer la sélection',
        message: `Supprimer ${items.length} volume(s) ? Action irréversible.`,
      },
      () =>
        settleAll(items, (x) => this.api.remove(x.id)).subscribe((res) => {
          // Refresh whatever the outcome: a partial failure still removed rows.
          this.clearSelection();
          this.onSaved();
          if (res.failed.length) {
            this.toast.add({
              severity: 'error',
              summary: 'Suppression partielle',
              detail: `${res.succeeded.length}/${items.length} supprimé(s) — ${firstErrorMessage(
                res.failed,
                'suppression impossible',
              )}`,
            });
            return;
          }
          this.toast.add({
            severity: 'success',
            summary: 'Supprimés',
            detail: `${items.length} supprimé(s)`,
          });
        }),
    );
  }
}
