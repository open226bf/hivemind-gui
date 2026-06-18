import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subscription, forkJoin, interval } from 'rxjs';
import { catchError, startWith, switchMap } from 'rxjs/operators';

import { ServicesApi } from '../../core/api';
import { ServiceLiveStatus, TaskState } from '../../core/models';
import { StatusStreamService } from '../../core/status-stream.service';
import { ServiceDetailStore } from '../service/service-detail.store';
import { ContainerTerminalComponent } from '../container-terminal/container-terminal.component';

const REFRESH_MS = 5000;

@Component({
  selector: 'hm-service-tab-supervision',
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
    DrawerModule,
    ButtonModule,
    ContainerTerminalComponent,
  ],
  templateUrl: './service-tab-supervision.component.html',
  styleUrl: './service-tab-supervision.component.scss',
})
export class ServiceTabSupervision {
  protected readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly stream = inject(StatusStreamService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly terminalContainerId = signal<string | null>(null);
  readonly terminalVisible = signal(false);
  readonly autoRefresh = signal(true);
  readonly refreshing = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  /** True while updates arrive over the live SSE stream (vs polling fallback). */
  readonly live = signal(false);
  readonly selectedTask = signal<TaskState | null>(null);
  drawerVisible = false;
  autoRefreshModel = true;

  private feed?: Subscription;

  constructor() {
    // (Re)start the live feed when the service id resolves or auto-refresh
    // toggles. SSE pushes updates reactively; on any stream failure (e.g. a
    // proxy that blocks SSE) we fall back to polling so the view keeps working.
    effect(() => {
      const id = this.store.serviceId();
      const on = this.autoRefresh();
      this.stopFeed();
      if (id && on) this.startStream(id);
    });
    this.destroyRef.onDestroy(() => this.stopFeed());
  }

  private startStream(id: string): void {
    this.feed = this.stream.stream(id).subscribe({
      next: (u) => {
        this.live.set(true);
        this.apply(u.status, u.tasks);
      },
      error: () => {
        this.live.set(false);
        this.startPolling(id);
      },
    });
  }

  private startPolling(id: string): void {
    this.feed = interval(REFRESH_MS)
      .pipe(
        startWith(0),
        switchMap(() => {
          this.refreshing.set(true);
          return forkJoin({
            status: this.api.status(id),
            tasks: this.api.tasks(id),
          }).pipe(catchError(() => EMPTY));
        }),
      )
      .subscribe(({ status, tasks }) => this.apply(status, tasks.tasks));
  }

  private apply(status: ServiceLiveStatus, tasks: TaskState[]): void {
    this.store.liveStatus.set(status);
    this.store.tasks.set(tasks);
    this.lastUpdated.set(new Date());
    this.refreshing.set(false);
  }

  private stopFeed(): void {
    this.feed?.unsubscribe();
    this.feed = undefined;
    this.refreshing.set(false);
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
