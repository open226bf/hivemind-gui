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

  private readonly auth = inject(AuthService);

  readonly services = signal<DiscoveredService[]>([]);
  readonly loading = signal(false);

  readonly foreignCount = computed(
    () => this.services().filter((s) => s.class === 'foreign').length,
  );

  /** Active cluster (discovery is cluster-scoped); null in the aggregated view. */
  private clusterId(): string | null {
    return this.ctx.selectedId();
  }

  /** Adoption targets the chosen hive (a cluster grant cascades); offer it when
   *  the user can write at least one valid target on this cluster (ADR 0003/0004).
   *  In shadow mode the verb helpers fall back to the operator role. */
  readonly canAdopt = computed(() => {
    const c = this.clusterId();
    if (!c) return this.auth.isOperator();
    return (
      this.auth.canWriteCluster(c) ||
      this.hives().some((h) => h.value !== null && this.auth.canWriteHive(c, h.value))
    );
  });

  /** Hive options the user may adopt into — "Aucune ruche" needs cluster write. */
  readonly adoptHives = computed<HiveOption[]>(() => {
    const c = this.clusterId();
    if (!c) return this.hives();
    const clusterWrite = this.auth.canWriteCluster(c);
    return this.hives().filter((h) =>
      h.value === null ? clusterWrite : clusterWrite || this.auth.canWriteHive(c, h.value),
    );
  });

  /** Release is a write on the adopted service's hive (a cluster grant cascades). */
  canRelease(s: DiscoveredService): boolean {
    const c = this.clusterId();
    if (!c) return this.auth.isOperator();
    return this.auth.canWriteService({ cluster_id: c, hive_id: s.hive_id });
  }

  // Adopt dialog state.
  readonly adoptVisible = signal(false);
  readonly adopting = signal(false);
  readonly target = signal<DiscoveredService | null>(null);
  readonly hives = signal<HiveOption[]>([]);
  selectedHive: string | null = null;

  // Post-adopt fidelity warnings (lossy spec reconstruction, ADR 0004).
  readonly warningsVisible = signal(false);
  readonly warnings = signal<string[]>([]);
  readonly warningsService = signal<{ name: string; id: string } | null>(null);

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
        if (res.warnings.length) {
          // Surface the lossy-reconstruction warnings in a persistent dialog so
          // the operator can actually read (and act on) each one, rather than a
          // transient toast.
          this.warnings.set(res.warnings);
          this.warningsService.set({ name: s.name, id: res.service_id });
          this.warningsVisible.set(true);
        } else {
          this.toast.add({ severity: 'success', summary: 'Adopté', detail: `${s.name} adopté` });
        }
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
