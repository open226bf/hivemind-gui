import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { DiscoveryApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { DiscoveredService, DiscoveredServiceClass } from '../../core/models';

/** Read-only brownfield discovery (ADR 0004, lot 2): every service running on
 *  the active cluster, classified as managed / foreign / orphan. Adoption of
 *  foreign services arrives in lot 4. */
@Component({
  selector: 'hm-discovered-services',
  imports: [DatePipe, RouterLink, TableModule, ButtonModule, TagModule, TooltipModule],
  templateUrl: './discovered-services.component.html',
  styleUrl: './discovered-services.component.scss',
})
export class DiscoveredServices {
  private readonly api = inject(DiscoveryApi);
  private readonly toast = inject(MessageService);
  private readonly ctx = inject(ClusterContextService);

  readonly services = signal<DiscoveredService[]>([]);
  readonly loading = signal(false);

  readonly foreignCount = computed(
    () => this.services().filter((s) => s.class === 'foreign').length,
  );

  constructor() {
    effect(() => {
      this.ctx.selectedId(); // reload when the active cluster changes
      this.load();
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
