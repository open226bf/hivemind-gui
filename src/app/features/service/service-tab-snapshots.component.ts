import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService } from 'primeng/api';

import { ServicesApi, SnapshotsApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { SnapshotResponse } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';

@Component({
  selector: 'hm-service-tab-snapshots',
  imports: [
    DatePipe,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    DialogModule,
    InputTextModule,
  ],
  templateUrl: './service-tab-snapshots.component.html',
  styleUrl: './service-tab-snapshots.component.scss',
})
export class ServiceTabSnapshots implements OnInit {
  protected readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly snapshotsApi = inject(SnapshotsApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);

  readonly canManage = inject(AuthService).isOperator;

  readonly snapshots = signal<SnapshotResponse[]>([]);
  readonly loading = signal(false);
  readonly capturing = signal(false);
  readonly rollingBack = signal<string | undefined>(undefined);

  // Capture dialog.
  readonly captureVisible = signal(false);
  captureLabel = '';

  // Warnings dialog (shown after a rollback that produced non-fatal warnings).
  readonly warnings = signal<string[]>([]);
  readonly warningsVisible = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.store.serviceId();
    if (!id) return;
    this.loading.set(true);
    this.api.snapshots(id).subscribe({
      next: (res) => {
        this.snapshots.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des snapshots impossible',
        });
      },
    });
  }

  openCapture(): void {
    this.captureLabel = '';
    this.captureVisible.set(true);
  }

  capture(): void {
    const id = this.store.serviceId();
    if (!id) return;
    this.capturing.set(true);
    this.api.createSnapshot(id, { label: this.captureLabel.trim() || undefined }).subscribe({
      next: () => {
        this.capturing.set(false);
        this.captureVisible.set(false);
        this.toast.add({
          severity: 'success',
          summary: 'Snapshot créé',
          detail: 'État du service capturé',
        });
        this.load();
      },
      error: (err) => {
        this.capturing.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Capture impossible',
        });
      },
    });
  }

  rollback(snap: SnapshotResponse): void {
    const created = new Date(snap.created_at).toLocaleString();
    this.confirmer.confirm({
      header: 'Restaurer ce snapshot',
      message: `Restaurer le service à l'état capturé le ${created} ? La définition actuelle (image, variables, montages, attachements) sera remplacée puis redéployée.`,
      icon: 'pi pi-history',
      acceptLabel: 'Restaurer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.rollingBack.set(snap.id);
        this.snapshotsApi.rollback(snap.id).subscribe({
          next: (res) => {
            this.rollingBack.set(undefined);
            this.toast.add({
              severity: 'info',
              summary: 'Restauration lancée',
              detail: 'Redéploiement en cours…',
            });
            if (res.warnings?.length) {
              this.warnings.set(res.warnings);
              this.warningsVisible.set(true);
            }
            // Refresh the parent shell so status/deployments reflect the rollback.
            this.store.latestStatus.set(res.deployment.status);
            this.store.deployments.update((list) => [res.deployment, ...list]);
          },
          error: (err) => {
            this.rollingBack.set(undefined);
            this.toast.add({
              severity: 'error',
              summary: 'Erreur',
              detail: err?.error?.message ?? 'Restauration impossible',
            });
          },
        });
      },
    });
  }

  remove(snap: SnapshotResponse): void {
    this.confirmer.confirm({
      header: 'Supprimer le snapshot',
      message: `Supprimer définitivement ce snapshot ${snap.label ? `« ${snap.label} »` : ''} ? Cette action est irréversible.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.snapshotsApi.remove(snap.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimé',
              detail: 'Snapshot supprimé',
            });
            this.snapshots.update((list) => list.filter((s) => s.id !== snap.id));
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
}
