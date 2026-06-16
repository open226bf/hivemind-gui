import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { EMPTY, forkJoin, interval } from 'rxjs';
import { catchError, startWith, switchMap } from 'rxjs/operators';

import { ServicesApi } from '../../core/api';
import { TaskState } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';
import { ContainerTerminalComponent } from '../container-terminal/container-terminal.component';

const REFRESH_MS = 5000;

@Component({
  selector: 'hm-service-tab-supervision',
  imports: [DatePipe, FormsModule, TableModule, TagModule, ToggleSwitchModule, DrawerModule, ButtonModule, ContainerTerminalComponent],
  templateUrl: './service-tab-supervision.component.html',
  styleUrl: './service-tab-supervision.component.scss',
})
export class ServiceTabSupervision implements OnInit {
  protected readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly terminalContainerId = signal<string | null>(null);
  readonly terminalVisible = signal(false);
  readonly autoRefresh = signal(true);
  readonly refreshing = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  readonly selectedTask = signal<TaskState | null>(null);
  drawerVisible = false;
  autoRefreshModel = true;

  ngOnInit(): void {
    interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => {
          const id = this.store.serviceId();
          if (!this.autoRefresh() || !id) return EMPTY;
          this.refreshing.set(true);
          return forkJoin({
            status: this.api.status(id),
            tasks: this.api.tasks(id),
          }).pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ status, tasks }) => {
        this.store.liveStatus.set(status);
        this.store.tasks.set(tasks.tasks);
        this.lastUpdated.set(new Date());
        this.refreshing.set(false);
      });
  }

  setAutoRefresh(on: boolean): void {
    this.autoRefresh.set(on);
  }

  openTask(t: TaskState): void {
    this.selectedTask.set(t);
    this.drawerVisible = true;
  }

  goToLogs(): void {
    this.drawerVisible = false;
    this.router.navigate(['../logs'], { relativeTo: this.route });
  }

  openTerminal(t: TaskState): void {
    if (!t.container_id) return;
    this.terminalContainerId.set(t.container_id);
    this.terminalVisible.set(true);
    this.drawerVisible = false;
  }

  onTerminalVisible(visible: boolean): void {
    this.terminalVisible.set(visible);
    if (!visible) this.terminalContainerId.set(null);
  }

  primaryIp(t: TaskState): string {
    if (!t.networks?.length) return '—';
    return this.stripCidr(t.networks[0].address);
  }

  stripCidr(addr: string): string {
    const slash = addr.indexOf('/');
    return slash > 0 ? addr.substring(0, slash) : addr;
  }

  shortImage(img?: string): string {
    if (!img) return '—';
    const at = img.indexOf('@');
    return at > 0 ? img.substring(0, at) : img;
  }

  taskSeverity(state: string): 'success' | 'warn' | 'danger' | 'secondary' {
    if (state === 'running') return 'success';
    if (state === 'failed' || state === 'rejected') return 'danger';
    if (state === 'shutdown' || state === 'complete') return 'secondary';
    return 'warn';
  }
}
