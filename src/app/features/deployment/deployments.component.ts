import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
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
    InputTextModule,
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

  readonly total = signal(0);
  readonly first = signal(0);
  readonly loading = signal(false);
  readonly pageSize = PAGE_SIZE;

  // Raw server page (pagination stays server-side). The global search and column
  // sort below are applied client-side over the currently-loaded page only.
  private readonly loadedPage = signal<DeploymentResponse[]>([]);
  readonly searchTerm = signal('');
  private readonly sortField = signal<string | null>(null);
  private readonly sortOrder = signal<1 | -1>(1);

  readonly deployments = computed<DeploymentResponse[]>(() => {
    const names = this.serviceMap();
    const term = this.searchTerm().trim().toLowerCase();
    let rows = this.loadedPage();
    if (term) {
      rows = rows.filter((d) =>
        [names[d.service_id], d.service_id, d.image_tag, d.trigger, d.status, d.error_message].some(
          (v) => (v ?? '').toLowerCase().includes(term),
        ),
      );
    }
    const field = this.sortField();
    if (field) {
      const dir = this.sortOrder();
      rows = [...rows].sort((a, b) => {
        const av = this.sortValue(a, field);
        const bv = this.sortValue(b, field);
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return 0;
      });
    }
    return rows;
  });

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
          this.loadedPage.set(res.items);
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

  onPage(event: {
    first?: number | null;
    rows?: number | null;
    sortField?: string | string[] | null;
    sortOrder?: number | null;
  }): void {
    // Column sort is client-side over the loaded page; capture the meta the
    // lazy table emits, then let the server refetch drive pagination as before.
    this.sortField.set(typeof event.sortField === 'string' ? event.sortField : null);
    this.sortOrder.set((event.sortOrder ?? 1) < 0 ? -1 : 1);
    const page = Math.floor((event.first ?? 0) / PAGE_SIZE) + 1;
    this.search(page);
  }

  onSearch(value: string): void {
    this.searchTerm.set(value ?? '');
  }

  private sortValue(d: DeploymentResponse, field: string): string | number {
    switch (field) {
      case 'service':
        return (this.serviceMap()[d.service_id] ?? d.service_id).toLowerCase();
      case 'image_tag':
        return (d.image_tag ?? '').toLowerCase();
      case 'trigger':
        return (d.trigger ?? '').toLowerCase();
      case 'error_message':
        return (d.error_message ?? '').toLowerCase();
      case 'started_at':
        return d.started_at ? new Date(d.started_at).getTime() : 0;
      case 'finished_at':
        return d.finished_at ? new Date(d.finished_at).getTime() : 0;
      case 'duration_ms':
        return d.duration_ms ?? 0;
      case 'status':
      default:
        return d.status ?? '';
    }
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
