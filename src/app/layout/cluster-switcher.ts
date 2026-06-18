import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import { ClusterContextService } from '../core/cluster-context.service';

/** Sidebar-foot picker that scopes the whole app to the active cluster. */
@Component({
  selector: 'hm-cluster-switcher',
  imports: [FormsModule, SelectModule],
  templateUrl: './cluster-switcher.html',
  styleUrl: './cluster-switcher.scss',
})
export class ClusterSwitcher {
  readonly ctx = inject(ClusterContextService);

  readonly options = computed(() =>
    this.ctx.clusters().map((c) => ({ label: c.name, value: c.id })),
  );

  constructor() {
    this.ctx.load();
  }
}
