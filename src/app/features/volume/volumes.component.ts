import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';

import { VolumesApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { AuthService } from '../../core/auth.service';
import { SwarmVolumeInfo, VolumeResponse } from '../../core/models';
import { VolumeFormComponent } from './volume-form.component';

@Component({
  selector: 'hm-volumes',
  imports: [DatePipe, TableModule, ButtonModule, TagModule, TooltipModule, TabsModule, VolumeFormComponent],
  templateUrl: './volumes.component.html',
  styleUrl: './volumes.component.scss',
})
export class Volumes {
  private readonly api = inject(VolumesApi);
  private readonly toast = inject(MessageService);
  private readonly ctx = inject(ClusterContextService);

  /** Volume catalog management is Admin-only (F-V2-06). */
  readonly canManage = inject(AuthService).isAdmin;

  readonly formRef = viewChild.required(VolumeFormComponent);

  readonly volumes = signal<VolumeResponse[]>([]);
  readonly swarmVolumes = signal<SwarmVolumeInfo[]>([]);
  readonly loading = signal(false);
  readonly swarmLoading = signal(false);
  activeTab = 'registered';

  constructor() {
    effect(() => {
      this.ctx.selectedId();
      this.load();
      this.loadSwarm();
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list(1, 50, this.ctx.selectedId() ?? undefined).subscribe({
      next: (res) => { this.volumes.set(res.items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.add({ severity: 'error', summary: 'Erreur', detail: 'Chargement des volumes impossible' }); },
    });
  }

  loadSwarm(): void {
    this.swarmLoading.set(true);
    this.api.swarm(this.ctx.selectedId() ?? undefined).subscribe({
      next: (vols) => { this.swarmVolumes.set(vols); this.swarmLoading.set(false); },
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

  remove(v: VolumeResponse): void {
    if (!confirm(`Supprimer le volume "${v.name}" ?`)) return;
    this.api.remove(v.id).subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: 'Supprimé', detail: `${v.name} supprimé` }); this.load(); },
      error: (err) => { this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Suppression impossible (volume monté ?)' }); },
    });
  }
}
