import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { HivesApi } from '../../core/api';
import { ServiceDetailStore } from '../service/service-detail.store';

@Component({
  selector: 'hm-service-tab-general',
  imports: [DatePipe],
  templateUrl: './service-tab-general.component.html',
  styleUrl: './service-tab-general.component.scss',
})
export class ServiceTabGeneral {
  protected readonly store = inject(ServiceDetailStore);
  private readonly hivesApi = inject(HivesApi);

  /** Resolved name of the service's hive, if any. */
  readonly hiveName = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.store.service()?.hive_id;
      if (!id) {
        this.hiveName.set(null);
        return;
      }
      this.hivesApi.get(id).subscribe({
        next: (h) => this.hiveName.set(h.name),
        error: () => this.hiveName.set(null),
      });
    });
  }

  mib(bytes: number): string {
    return bytes ? `${Math.round(bytes / (1024 * 1024))} MiB` : '—';
  }
}
