import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { DiscoveryApi, HivesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ClusterContextService } from '../../core/cluster-context.service';
import { DiscoveredService, DiscoveredServiceClass } from '../../core/models';

interface HiveOption {
  label: string;
  value: string | null;
}

/** Brownfield discovery (ADR 0004): every service running on the active
 *  cluster, classified as managed / foreign / orphan, with adopt (foreign) and
 *  release (managed) actions. */
@Component({
  selector: 'hm-discovered-services',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    DialogModule,
    SelectModule,
  ],
  templateUrl: './discovered-services.component.html',
  styleUrl: './discovered-services.component.scss',
})
export class DiscoveredServices {
  private readonly api = inject(DiscoveryApi);
  private readonly hivesApi = inject(HivesApi);
  private readonly toast = inject(MessageService);
  private readonly ctx = inject(ClusterContextService);

  /** Adoption/release are writes (Operator). */
  readonly canWrite = inject(AuthService).isOperator;

  readonly services = signal<DiscoveredService[]>([]);
  readonly loading = signal(false);

  readonly foreignCount = computed(
    () => this.services().filter((s) => s.class === 'foreign').length,
  );

  // Adopt dialog state.
  readonly adoptVisible = signal(false);
  readonly adopting = signal(false);
  readonly target = signal<DiscoveredService | null>(null);
  readonly hives = signal<HiveOption[]>([]);
  selectedHive: string | null = null;

  constructor() {
    effect(() => {
      this.ctx.selectedId(); // reload when the active cluster changes
      this.load();
      this.loadHives();
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (items) => {
        this.services.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Découverte des services impossible',
        });
      },
    });
  }

  private loadHives(): void {
    this.hivesApi.list(1, 100).subscribe({
      next: (res) => {
        this.hives.set([
          { label: 'Aucune ruche', value: null },
          ...res.items.map((h) => ({ label: h.name, value: h.id })),
        ]);
      },
      error: () => this.hives.set([{ label: 'Aucune ruche', value: null }]),
    });
  }

  openAdopt(s: DiscoveredService): void {
    this.target.set(s);
    this.selectedHive = null;
    this.adoptVisible.set(true);
  }

  confirmAdopt(): void {
    const s = this.target();
    if (!s) return;
    this.adopting.set(true);
    this.api.adopt(s.swarm_service_id, this.selectedHive ?? undefined).subscribe({
      next: (res) => {
        this.adopting.set(false);
        this.adoptVisible.set(false);
        const detail = res.warnings.length
          ? `${s.name} adopté avec ${res.warnings.length} avertissement(s) : ${res.warnings.join(' ; ')}`
          : `${s.name} adopté`;
        this.toast.add({
          severity: res.warnings.length ? 'warn' : 'success',
          summary: 'Adopté',
          detail,
          life: res.warnings.length ? 10000 : 3000,
        });
        this.load();
      },
      error: (err) => {
        this.adopting.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Adoption impossible',
        });
      },
    });
  }

  release(s: DiscoveredService): void {
    if (
      !confirm(
        `Libérer "${s.name}" ? Le service continue de tourner mais ne sera plus géré par Hivemind.`,
      )
    )
      return;
    this.api.release(s.swarm_service_id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Libéré', detail: `${s.name} libéré` });
        this.load();
      },
      error: (err) => {
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Libération impossible',
        });
      },
    });
  }

  classLabel(c: DiscoveredServiceClass): string {
    switch (c) {
      case 'managed':
        return 'Géré';
      case 'foreign':
        return 'Non géré';
      case 'orphan':
        return 'Orphelin';
    }
  }

  classSeverity(c: DiscoveredServiceClass): 'success' | 'info' | 'warn' {
    switch (c) {
      case 'managed':
        return 'success';
      case 'foreign':
        return 'info';
      case 'orphan':
        return 'warn';
    }
  }
}
