import { Component, DestroyRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin, interval } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

import { DeploymentsApi, ServicesApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { AuthService } from '../../core/auth.service';
import {
  DeploymentStatus,
  ServiceLiveStatus,
  ServiceResponse,
  ServiceStatus,
} from '../../core/models';
import { ServiceFormComponent } from './service-form.component';
import { RedeployConfirm } from './redeploy-confirm.component';

const LIVE_REFRESH_MS = 8000;

@Component({
  selector: 'hm-services',
  imports: [
    DatePipe,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    TooltipModule,
    ServiceFormComponent,
    RedeployConfirm,
  ],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class Services {
  /** Filter to a specific hive. When set, only that hive's services are listed. */
  readonly hiveId = input<string | undefined>(undefined);
  /** Filter to services not attached to any hive. Mutually exclusive with hiveId. */
  readonly unassigned = input(false);
  /** Hide the built-in "Services" page header when embedded inside another page. */
  readonly embedded = input(false);

  private readonly api = inject(ServicesApi);
  private readonly deployApi = inject(DeploymentsApi);
  private readonly ctx = inject(ClusterContextService);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private alive = true;

  /** Operator or Admin may create, edit, deploy and delete services (F-V1-01). */
  readonly canManage = inject(AuthService).isOperator;

  readonly services = signal<ServiceResponse[]>([]);
  readonly loading = signal(false);

  readonly deployStatus = signal<Record<string, DeploymentStatus | undefined>>({});
  private readonly polling = new Set<string>();

  readonly liveStatus = signal<Record<string, ServiceLiveStatus>>({});

  readonly formVisible = signal(false);
  readonly formMode = signal<'create' | 'edit'>('create');
  readonly editingService = signal<ServiceResponse | undefined>(undefined);

  private readonly redeployDialog = viewChild.required(RedeployConfirm);
  private pendingRedeploy: ServiceResponse | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => (this.alive = false));
    // Reload whenever the filter inputs change (covers both initial mount and
    // navigation between hives without recreating the component).
    effect(() => {
      this.hiveId();
      this.unassigned();
      this.ctx.selectedId(); // reload when the active cluster changes
      this.load();
    });
    interval(LIVE_REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.refreshLiveStatus(this.services()));
  }

  live(serviceId: string): ServiceLiveStatus | undefined {
    return this.liveStatus()[serviceId];
  }

  private refreshLiveStatus(services: ServiceResponse[]): void {
    const deployed = services.filter((s) => s.status === 'deployed');
    if (deployed.length === 0) return;
    forkJoin(
      deployed.map((s) =>
        this.api.status(s.id).pipe(
          map((st) => ({ id: s.id, st: st as ServiceLiveStatus | undefined })),
          catchError(() => of({ id: s.id, st: undefined })),
        ),
      ),
    ).subscribe((results) => {
      this.liveStatus.update((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.st) next[r.id] = r.st;
          else delete next[r.id];
        }
        return next;
      });
      // Drift detection: if /status reports the swarm service was removed
      // out-of-band, the backend has already reconciled to status=removed —
      // refresh that service so the list shows the new badge.
      for (const r of results) {
        if (r.st?.externally_removed) {
          this.refreshService(r.id);
          this.toast.add({
            severity: 'warn',
            summary: 'Service retiré hors Hivemind',
            detail: 'Le service a été supprimé directement sur Swarm — état synchronisé.',
          });
        }
      }
    });
  }

  load(): void {
    this.loading.set(true);
    const opts: { hive_id?: string; unassigned?: boolean } = {};
    if (this.unassigned()) opts.unassigned = true;
    else if (this.hiveId()) opts.hive_id = this.hiveId();
    this.api.list(1, 50, opts).subscribe({
      next: (res) => {
        this.services.set(res.items);
        this.loading.set(false);
        this.refreshDeployStatuses(res.items);
        this.refreshLiveStatus(res.items);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des services impossible',
        });
      },
    });
  }

  private refreshDeployStatuses(services: ServiceResponse[]): void {
    if (services.length === 0) {
      this.deployStatus.set({});
      return;
    }
    forkJoin(
      services.map((s) =>
        this.api.deployments(s.id).pipe(
          map((res) => ({ id: s.id, dep: res.items[0] })),
          catchError(() => of({ id: s.id, dep: undefined })),
        ),
      ),
    ).subscribe((results) => {
      const statusMap: Record<string, DeploymentStatus | undefined> = {};
      for (const r of results) {
        statusMap[r.id] = r.dep?.status;
        if (r.dep && (r.dep.status === 'pending' || r.dep.status === 'in_progress')) {
          this.poll(r.id, r.dep.id);
        }
      }
      this.deployStatus.set(statusMap);
    });
  }

  isDeploying(serviceId: string): boolean {
    const s = this.deployStatus()[serviceId];
    return s === 'pending' || s === 'in_progress';
  }

  deploy(svc: ServiceResponse): void {
    // First-time deploy (no swarm service yet) just goes through. Redeploys
    // of an already-deployed service open the Portainer-style confirm dialog
    // so the operator can opt in to re-pulling the image.
    if (svc.status !== 'deployed') {
      this.runDeploy(svc, {});
      return;
    }
    this.pendingRedeploy = svc;
    this.redeployDialog().open(svc.name);
  }

  onRedeployConfirmed(opts: { repull: boolean }): void {
    const svc = this.pendingRedeploy;
    this.pendingRedeploy = undefined;
    if (!svc) return;
    this.runDeploy(svc, { force: true, repull: opts.repull });
  }

  private runDeploy(svc: ServiceResponse, opts: { force?: boolean; repull?: boolean }): void {
    this.setStatus(svc.id, 'pending');
    this.api.deploy(svc.id, opts).subscribe({
      next: (dep) => {
        this.toast.add({
          severity: 'info',
          summary: 'Déploiement lancé',
          detail: `${svc.name} en cours…`,
        });
        this.poll(svc.id, dep.id);
      },
      error: (err) => {
        this.setStatus(svc.id, undefined);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Déploiement impossible',
        });
      },
    });
  }

  private poll(serviceId: string, deploymentId: string): void {
    if (this.polling.has(serviceId)) return;
    this.polling.add(serviceId);
    const tick = () => {
      if (!this.alive) return;
      this.deployApi.get(deploymentId).subscribe({
        next: (dep) => {
          this.setStatus(serviceId, dep.status);
          if (
            dep.status === 'succeeded' ||
            dep.status === 'failed' ||
            dep.status === 'rolled_back'
          ) {
            this.polling.delete(serviceId);
            this.refreshService(serviceId);
            this.toast.add(
              dep.status === 'succeeded'
                ? { severity: 'success', summary: 'Déployé', detail: 'Déploiement terminé' }
                : {
                    severity: 'error',
                    summary: 'Échec',
                    detail: dep.error_message ?? 'Le déploiement a échoué',
                  },
            );
            return;
          }
          setTimeout(tick, 2000);
        },
        error: () => {
          this.polling.delete(serviceId);
          this.setStatus(serviceId, undefined);
        },
      });
    };
    setTimeout(tick, 1500);
  }

  private refreshService(id: string): void {
    this.api.get(id).subscribe((svc) => {
      this.services.update((list) => list.map((s) => (s.id === id ? svc : s)));
      this.refreshLiveStatus([svc]);
    });
  }

  private setStatus(serviceId: string, status: DeploymentStatus | undefined): void {
    this.deployStatus.update((m) => ({ ...m, [serviceId]: status }));
  }

  openCreate(): void {
    this.formMode.set('create');
    this.editingService.set(undefined);
    this.formVisible.set(true);
  }

  openEdit(svc: ServiceResponse): void {
    this.formMode.set('edit');
    this.editingService.set(svc);
    this.formVisible.set(true);
  }

  remove(svc: ServiceResponse): void {
    this.confirmer.confirm({
      header: 'Supprimer le service',
      message: `Supprimer définitivement "${svc.name}" ? Cette action est irréversible.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.remove(svc.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimé',
              detail: `${svc.name} supprimé`,
            });
            this.load();
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Erreur',
              detail: err?.error?.message ?? 'Suppression impossible',
            });
          },
        });
      },
    });
  }

  undeploy(svc: ServiceResponse): void {
    this.confirmer.confirm({
      header: 'Retirer du cluster Swarm',
      message: `Retirer "${svc.name}" du cluster ? La définition reste dans Hivemind et peut être redéployée à tout moment.`,
      icon: 'pi pi-stop-circle',
      acceptLabel: 'Retirer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.undeploy(svc.id).subscribe({
          next: (updated) => {
            this.toast.add({
              severity: 'success',
              summary: 'Retiré',
              detail: `${svc.name} retiré du cluster`,
            });
            this.services.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
            this.liveStatus.update((m) => {
              const next = { ...m };
              delete next[svc.id];
              return next;
            });
          },
          error: (err) => {
            this.toast.add({
              severity: 'error',
              summary: 'Erreur',
              detail: err?.error?.message ?? 'Retrait impossible',
            });
          },
        });
      },
    });
  }

  isExternallyRemoved(serviceId: string): boolean {
    return this.liveStatus()[serviceId]?.externally_removed === true;
  }

  statusSeverity(status: ServiceStatus): 'success' | 'info' | 'secondary' | 'danger' {
    switch (status) {
      case 'deployed':
        return 'success';
      case 'draft':
        return 'info';
      case 'removed':
        return 'danger';
      default:
        return 'secondary';
    }
  }
}
