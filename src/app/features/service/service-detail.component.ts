import { Component, DestroyRef, OnInit, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmationService, MessageService } from 'primeng/api';

import { finalize } from 'rxjs/operators';

import { DeploymentsApi, ServicesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ServiceResponse } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';
import { ServiceFormComponent } from './service-form.component';
import { RedeployConfirm } from './redeploy-confirm.component';

interface Tab {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'hm-service-detail',
  providers: [ServiceDetailStore],
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet, TagModule, ButtonModule, InputNumberModule, ProgressSpinnerModule, ServiceFormComponent, RedeployConfirm],
  templateUrl: './service-detail.component.html',
  styleUrl: './service-detail.component.scss',
})
export class ServiceDetail implements OnInit {
  readonly id = input.required<string>();

  protected readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly deployApi = inject(DeploymentsApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private alive = true;
  private polling = false;

  readonly editVisible = signal(false);
  readonly editingService = signal<ServiceResponse | undefined>(undefined);
  readonly scaleValue = signal(1);
  readonly scaling = signal(false);

  private readonly redeployDialog = viewChild.required(RedeployConfirm);

  /** Operator or Admin may edit and deploy services (F-V1-01). */
  readonly canManage = inject(AuthService).isOperator;

  readonly tabs: Tab[] = [
    { label: 'Général',      path: 'general',     icon: 'pi-info-circle'  },
    { label: 'Supervision',  path: 'supervision',  icon: 'pi-chart-bar'   },
    { label: 'Logs',         path: 'logs',         icon: 'pi-align-left'  },
    { label: 'Déploiements', path: 'deployments',  icon: 'pi-cloud-upload' },
    { label: 'Variables',    path: 'variables',    icon: 'pi-sliders-h'   },
    { label: 'Ressources',   path: 'resources',    icon: 'pi-microchip'   },
    { label: 'Montages',     path: 'mounts',       icon: 'pi-database'    },
    { label: 'Snapshots',    path: 'snapshots',    icon: 'pi-camera'      },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => (this.alive = false));
    effect(() => {
      const svc = this.store.service();
      if (svc) this.scaleValue.set(svc.replicas);
    });
  }

  ngOnInit(): void {
    this.store.serviceId.set(this.id());
    this.reload();
  }

  reload(): void {
    const id = this.id();
    this.api.get(id).subscribe((svc) => {
      this.store.service.set(svc);
      // Pull live status up front so the drift banner appears on the header
      // without having to navigate to the Supervision tab first.
      if (svc.status === 'deployed') {
        this.api.status(id).subscribe({
          next: (st) => {
            this.store.liveStatus.set(st);
            if (st.externally_removed) {
              this.toast.add({
                severity: 'warn',
                summary: 'Service retiré hors Hivemind',
                detail: 'Synchronisation: le service a été supprimé directement sur Swarm.',
              });
              this.api.get(id).subscribe((fresh) => this.store.service.set(fresh));
            }
          },
          error: () => this.store.liveStatus.set(null),
        });
      } else {
        this.store.liveStatus.set(null);
      }
    });
    this.api.deployments(id).subscribe((res) => {
      this.store.deployments.set(res.items);
      const latest = res.items[0];
      this.store.latestStatus.set(latest?.status);
      if (latest && (latest.status === 'pending' || latest.status === 'in_progress')) {
        this.poll(latest.id);
      }
    });
  }

  deploy(): void {
    const svc = this.store.service();
    if (!svc) return;
    // First deploy (or redeploy after undeploy) goes straight through.
    // Redeploying a live service opens the Portainer-style confirm dialog
    // so the operator can opt in to re-pulling the image.
    if (svc.status !== 'deployed') {
      this.triggerDeploy('Déploiement lancé', 'En cours…', {});
      return;
    }
    this.redeployDialog().open(svc.name);
  }

  onRedeployConfirmed(opts: { repull: boolean }): void {
    this.triggerDeploy('Redéploiement lancé', 'Recréation des tâches…', { force: true, repull: opts.repull });
  }

  undeploy(): void {
    const svc = this.store.service();
    if (!svc) return;
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
            this.toast.add({ severity: 'success', summary: 'Retiré', detail: `${svc.name} retiré du cluster` });
            this.store.service.set(updated);
            this.store.liveStatus.set(null);
            this.reload();
          },
          error: (err) => {
            this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Retrait impossible' });
          },
        });
      },
    });
  }

  /** Fires a deployment, optimistically marking the service as pending and polling for the outcome. */
  private triggerDeploy(summary: string, detail: string, opts: { force?: boolean; repull?: boolean }): void {
    const id = this.id();
    this.store.latestStatus.set('pending');
    this.api.deploy(id, opts).subscribe({
      next: (dep) => {
        this.toast.add({ severity: 'info', summary, detail });
        this.store.deployments.update((list) => [dep, ...list]);
        this.poll(dep.id);
      },
      error: (err) => {
        this.store.latestStatus.set(undefined);
        this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Déploiement impossible' });
      },
    });
  }

  private poll(deploymentId: string): void {
    if (this.polling) return;
    this.polling = true;
    const tick = () => {
      if (!this.alive) return;
      this.deployApi.get(deploymentId).subscribe({
        next: (dep) => {
          this.store.latestStatus.set(dep.status);
          if (dep.status === 'succeeded' || dep.status === 'failed' || dep.status === 'rolled_back') {
            this.polling = false;
            this.reload();
            this.toast.add(
              dep.status === 'succeeded'
                ? { severity: 'success', summary: 'Déployé', detail: 'Déploiement terminé' }
                : { severity: 'error', summary: 'Échec', detail: dep.error_message ?? 'Le déploiement a échoué' },
            );
            return;
          }
          setTimeout(tick, 2000);
        },
        error: () => (this.polling = false),
      });
    };
    setTimeout(tick, 1500);
  }

  applyScale(): void {
    const replicas = this.scaleValue();
    this.scaling.set(true);
    this.api
      .update(this.id(), { replicas })
      .pipe(finalize(() => this.scaling.set(false)))
      .subscribe({
        next: () => this.triggerDeploy(`Scale → ${replicas}`, 'Déploiement lancé…', {}),
        error: (err) => this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Mise à jour impossible' }),
      });
  }

  openEdit(): void {
    const svc = this.store.service();
    if (!svc) return;
    this.editingService.set(svc);
    this.editVisible.set(true);
  }

  onFormSaved(): void {
    this.reload();
  }

  statusSeverity(status: string): 'success' | 'info' | 'secondary' | 'danger' {
    return status === 'deployed' ? 'success' : status === 'removed' ? 'danger' : 'info';
  }
}
