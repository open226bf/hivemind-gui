import { Injectable, computed, signal } from '@angular/core';

import {
  DeploymentResponse,
  DeploymentStatus,
  ServiceLiveStatus,
  ServiceResponse,
  TaskState,
} from '../../core/models';

/**
 * Scoped state for the service-detail shell + its child tabs.
 * Provided at the ServiceDetail component level so it is destroyed when the
 * user navigates away from the service detail route.
 */
@Injectable()
export class ServiceDetailStore {
  readonly serviceId = signal<string>('');
  readonly service = signal<ServiceResponse | null>(null);
  readonly liveStatus = signal<ServiceLiveStatus | null>(null);
  readonly tasks = signal<TaskState[]>([]);
  readonly deployments = signal<DeploymentResponse[]>([]);
  readonly latestStatus = signal<DeploymentStatus | undefined>(undefined);

  readonly deploying = computed(() => {
    const s = this.latestStatus();
    return s === 'pending' || s === 'in_progress';
  });

  readonly lastFailure = computed(() => {
    const d = this.deployments()[0];
    return d?.status === 'failed' ? (d.error_message ?? 'Échec du déploiement') : null;
  });
}
