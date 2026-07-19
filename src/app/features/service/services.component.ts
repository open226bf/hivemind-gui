import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin, interval } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';

import { DeploymentsApi, HivesApi, ServicesApi } from '../../core/api';
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
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    InputTextModule,
    SelectModule,
    DialogModule,
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
  private readonly hivesApi = inject(HivesApi);
  private readonly deployApi = inject(DeploymentsApi);
  private readonly ctx = inject(ClusterContextService);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private alive = true;

  private readonly auth = inject(AuthService);

  /** Per-row write gate: a service inherits its hive/cluster grant (ADR 0003);
   *  falls back to the operator role in shadow mode. */
  canWriteService(s: ServiceResponse): boolean {
    return this.auth.canWriteService(s);
  }

  /** Whether the user can write at least one listed service. The per-service
   *  write grant is uniform within a hive view, so this gates the whole bulk
   *  selection UI (checkboxes + bulk bar) the same way per-row actions are gated. */
  readonly canWriteAny = computed(() => this.services().some((s) => this.canWriteService(s)));

  readonly services = signal<ServiceResponse[]>([]);
  readonly loading = signal(false);

  readonly deployStatus = signal<Record<string, DeploymentStatus | undefined>>({});
  private readonly polling = new Set<string>();

  readonly liveStatus = signal<Record<string, ServiceLiveStatus>>({});

  readonly formVisible = signal(false);
  readonly formMode = signal<'create' | 'edit'>('create');
  readonly editingService = signal<ServiceResponse | undefined>(undefined);

  // ─── Bulk selection ──────────────────────────────────────────────────────────
  readonly selected = signal<ServiceResponse[]>([]);
  statusFilter: ServiceStatus | null = null;
  readonly statusOptions = [
    { label: 'Brouillon', value: 'draft' },
    { label: 'Déployé', value: 'deployed' },
    { label: 'Retiré', value: 'removed' },
  ];

  // ─── Move-to-hive dialog (replaces the removed "Gérer les services") ──────────
  readonly moveVisible = signal(false);
  readonly moving = signal(false);
  readonly hiveOptions = signal<{ label: string; value: string | null }[]>([]);
  moveTargetHiveId: string | null = null;

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
    this.selected.set([]); // drop stale selection (rows are about to be replaced)
    const opts: { hive_id?: string; unassigned?: boolean } = {};
    if (this.unassigned()) opts.unassigned = true;
    else if (this.hiveId()) opts.hive_id = this.hiveId();
    // Client-side paginate/sort/filter over a generous page (a project's service
    // count is modest); the table handles the rest without extra round-trips.
    this.api.list(1, 1000, opts).subscribe({
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

  // ─── Bulk actions ─────────────────────────────────────────────────────────────

  clearSelection(): void {
    this.selected.set([]);
  }

  /** Deploy (or redeploy, forced) every selected service after one confirmation. */
  bulkDeploy(): void {
    const items = this.selected();
    if (items.length === 0) return;
    this.confirmer.confirm({
      header: 'Déployer la sélection',
      message: `Déployer ${items.length} service(s) ? Les services déjà déployés seront redéployés.`,
      icon: 'pi pi-cloud-upload',
      acceptLabel: 'Déployer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        for (const svc of items) {
          this.runDeploy(svc, svc.status === 'deployed' ? { force: true } : {});
        }
        this.clearSelection();
      },
    });
  }

  /** Undeploy every selected service currently on the cluster. */
  bulkUndeploy(): void {
    const items = this.selected().filter((s) => s.status === 'deployed');
    if (items.length === 0) {
      this.toast.add({
        severity: 'info',
        summary: 'Rien à retirer',
        detail: 'Aucun service déployé dans la sélection.',
      });
      return;
    }
    this.confirmer.confirm({
      header: 'Retirer du cluster',
      message: `Retirer ${items.length} service(s) du cluster ? Les définitions restent dans Hivemind.`,
      icon: 'pi pi-stop-circle',
      acceptLabel: 'Retirer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        forkJoin(items.map((s) => this.api.undeploy(s.id))).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Retirés',
              detail: `${items.length} service(s) retiré(s) du cluster`,
            });
            this.clearSelection();
            this.load();
          },
          error: (err) =>
            this.toast.add({
              severity: 'error',
              summary: 'Erreur',
              detail: err?.error?.message ?? 'Retrait impossible',
            }),
        });
      },
    });
  }

  /** Open the move-to-hive picker for the current selection. */
  openMove(): void {
    this.moveTargetHiveId = null;
    this.hivesApi.list(1, 1000).subscribe((res) => {
      this.hiveOptions.set([
        { label: 'Sans ruche', value: null },
        ...res.items.map((h) => ({ label: h.name, value: h.id as string | null })),
      ]);
      this.moveVisible.set(true);
    });
  }

  confirmMove(): void {
    const items = this.selected();
    if (items.length === 0) return;
    this.moving.set(true);
    forkJoin(items.map((s) => this.api.assignHive(s.id, this.moveTargetHiveId))).subscribe({
      next: () => {
        this.moving.set(false);
        this.moveVisible.set(false);
        const target =
          this.hiveOptions().find((o) => o.value === this.moveTargetHiveId)?.label ?? 'la ruche';
        this.toast.add({
          severity: 'success',
          summary: 'Déplacés',
          detail: `${items.length} service(s) → ${target}`,
        });
        this.clearSelection();
        this.load();
      },
      error: (err) => {
        this.moving.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Déplacement impossible',
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
