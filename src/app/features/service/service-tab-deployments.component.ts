import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { DeploymentStatus } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';

@Component({
  selector: 'hm-service-tab-deployments',
  imports: [DatePipe, DecimalPipe, TableModule, TagModule],
  templateUrl: './service-tab-deployments.component.html',
  styleUrl: './service-tab-deployments.component.scss',
})
export class ServiceTabDeployments {
  protected readonly store = inject(ServiceDetailStore);

  severity(status: DeploymentStatus): 'success' | 'info' | 'danger' | 'warn' {
    if (status === 'succeeded') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'rolled_back') return 'warn';
    return 'info';
  }
}
