import { Component, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

import { NetworksApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { NetworkResponse, SwarmNetworkInfo } from '../../core/models';
import { NetworkFormComponent } from './network-form.component';

@Component({
  selector: 'hm-networks',
  imports: [DatePipe, TableModule, ButtonModule, TagModule, TooltipModule, TabsModule, NetworkFormComponent],
  templateUrl: './networks.component.html',
  styleUrl: './networks.component.scss',
})
export class Networks {
  private readonly api = inject(NetworksApi);
  private readonly toast = inject(MessageService);

  /** Networks are Admin-only (F-V1-01). */
  readonly canManage = inject(AuthService).isAdmin;

  readonly formRef = viewChild.required(NetworkFormComponent);

  readonly networks = signal<NetworkResponse[]>([]);
  readonly swarmNetworks = signal<SwarmNetworkInfo[]>([]);
  readonly loading = signal(false);
  readonly swarmLoading = signal(false);
  activeTab = 'registered';

  constructor() {
    this.load();
    this.loadSwarm();
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => { this.networks.set(res.items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.add({ severity: 'error', summary: 'Erreur', detail: 'Chargement des réseaux impossible' }); },
    });
  }

  loadSwarm(): void {
    this.swarmLoading.set(true);
    this.api.swarm().subscribe({
      next: (nets) => { this.swarmNetworks.set(nets); this.swarmLoading.set(false); },
      error: () => { this.swarmLoading.set(false); },
    });
  }

  openCreate(): void {
    this.formRef().open();
  }

  onSaved(): void {
    this.load();
    this.loadSwarm();
  }

  remove(n: NetworkResponse): void {
    if (!confirm(`Supprimer le réseau "${n.name}" ?`)) return;
    this.api.remove(n.id).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${n.name} supprimé` }); this.load(); },
      error: (err) => { this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Suppression impossible' }); },
    });
  }
}
