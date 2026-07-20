import { Component, computed, inject } from '@angular/core';

import { LogViewer } from './log-viewer.component';
import { ServiceDetailStore } from './service-detail.store';

/** Logs tab of a managed service: the shared log viewer pointed at this
 *  service's stream. */
@Component({
  selector: 'hm-service-tab-logs',
  imports: [LogViewer],
  template: `<hm-log-viewer [path]="path()" />`,
})
export class ServiceTabLogs {
  private readonly store = inject(ServiceDetailStore);

  protected readonly path = computed(() => `/services/${this.store.serviceId()}/logs`);
}
