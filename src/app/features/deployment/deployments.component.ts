import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { DeploymentsApi, ServicesApi } from '../../core/api';
import { DeploymentResponse, DeploymentStatus, ServiceResponse } from '../../core/models';

const PAGE_SIZE = 20;

@Component({
  selector: 'hm-deployments',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    SelectModule,
    DatePickerModule,
    TooltipModule,
  ],
  templateUrl: './deployments.component.html',
  styleUrl: './deployments.component.scss',
})
export class Deployments {
  private readonly api = inject(DeploymentsApi);
  private readonly svcApi = inject(ServicesApi);
  private readonly toast = inject(MessageService);

  readonly deployments = signal<DeploymentResponse[]>([]);
  readonly total = signal(0);
  readonly first = signal(0);
  readonly loading = signal(false);
  readonly pageSize = PAGE_SIZE;

  readonly serviceOptions = signal<{ label: string; value: string }[]>([]);
  readonly serviceMap = signal<Record<string, string>>({});

  filterService: string | null = null;
  filterStatus: string | null = null;
  filterFrom: Date | null = null;
  filterTo: Date | null = null;

  readonly statusOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'In progress', value: 'in_progress' },
    { label: 'Succeeded', value: 'succeeded' },
    { label: 'Failed', value: 'failed' },
    { label: 'Rolled back', value: 'rolled_back' },
  ];

  constructor() {
    this.loadServices();
    this.search();
  }

  private loadServices(): void {
    this.svcApi.list(1, 200).subscribe({
      next: (res) => {
        this.serviceOptions.set(
          res.items.map((s: ServiceResponse) => ({ label: s.name, value: s.id })),
        );
        const map: Record<string, string> = {};
        for (const s of res.items) map[s.id] = s.name;
        this.serviceMap.set(map);
      },
    });
  }

  search(page = 1): void {
    this.loading.set(true);
    this.api
      .list({
        service_id: this.filterService ?? undefined,
        status: this.filterStatus ?? undefined,
        from: this.filterFrom ? this.filterFrom.toISOString() : undefined,
        to: this.filterTo ? this.filterTo.toISOString() : undefined,
        page,
        size: PAGE_SIZE,
      })
      .subscribe({
        next: (res) => {
          this.deployments.set(res.items);
          this.total.set(res.total);
          this.first.set((page - 1) * PAGE_SIZE);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Chargement des déploiements impossible',
          });
        },
      });
  }

  onPage(event: { first?: number | null; rows?: number | null }): void {
    const page = Math.floor((event.first ?? 0) / PAGE_SIZE) + 1;
    this.search(page);
  }

  resetFilters(): void {
    this.filterService = null;
    this.filterStatus = null;
    this.filterFrom = null;
    this.filterTo = null;
    this.search();
  }

  severity(status: DeploymentStatus): 'success' | 'info' | 'danger' | 'warn' {
    if (status === 'succeeded') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'rolled_back') return 'warn';
    return 'info';
  }
}
