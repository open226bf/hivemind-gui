import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { TabsModule } from 'primeng/tabs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';

import { NetworksApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { AuthService } from '../../core/auth.service';
import { NetworkResponse, SwarmNetworkInfo } from '../../core/models';
import { NetworkFormComponent } from './network-form.component';

@Component({
  selector: 'hm-networks',
  imports: [
    DatePipe,
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    TooltipModule,
    TabsModule,
    NetworkFormComponent,
  ],
  templateUrl: './networks.component.html',
  styleUrl: './networks.component.scss',
})
export class Networks {
  private readonly api = inject(NetworksApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly ctx = inject(ClusterContextService);

  /** Networks are Admin-only (F-V1-01). */
  readonly canManage = inject(AuthService).isAdmin;

  readonly formRef = viewChild.required(NetworkFormComponent);

  readonly networks = signal<NetworkResponse[]>([]);
  readonly swarmNetworks = signal<SwarmNetworkInfo[]>([]);
  readonly loading = signal(false);
  readonly swarmLoading = signal(false);
  activeTab = 'registered';

  /** Bulk selection for the registered-networks table. */
  readonly selected = signal<NetworkResponse[]>([]);

  constructor() {
    effect(() => {
      this.ctx.selectedId(); // reload when the active cluster changes
      this.load();
      this.loadSwarm();
    });
  }

  load(): void {
    this.loading.set(true);
    this.selected.set([]); // drop stale selection (rows are about to be replaced)
    this.api.list(1, 1000).subscribe({
      next: (res) => {
        this.networks.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des réseaux impossible',
        });
      },
    });
  }

  loadSwarm(): void {
    this.swarmLoading.set(true);
    this.api.swarm().subscribe({
      next: (nets) => {
        this.swarmNetworks.set(nets);
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

  clearSelection(): void {
    this.selected.set([]);
  }

  /** Delete every selected registered network after one confirmation. */
  bulkDelete(): void {
    const items = this.selected();
    if (!items.length) return;
    this.confirmer.confirm({
      header: 'Supprimer la sélection',
      message: `Supprimer ${items.length} réseau(x) ? Action irréversible.`,
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

  remove(n: NetworkResponse): void {
    if (!confirm(`Supprimer le réseau "${n.name}" ?`)) return;
    this.api.remove(n.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${n.name} supprimé` });
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
}
