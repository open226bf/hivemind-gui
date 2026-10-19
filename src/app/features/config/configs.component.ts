import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService } from 'primeng/api';

import { ConfigsApi } from '../../core/api';
import { ClusterContextService } from '../../core/cluster-context.service';
import { AuthService } from '../../core/auth.service';
import { firstErrorMessage, settleAll } from '../../core/bulk';
import { confirmDestructive } from '../../core/confirm';
import { collectAll } from '../../core/paging';
import {
  ConfigResponse,
  ConfigVersionResponse,
  DiffLine,
  ImpactedService,
} from '../../core/models';
import { ConfigFormComponent } from './config-form.component';
import { ConfigVersionFormComponent } from './config-version-form.component';

@Component({
  selector: 'hm-configs',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    DrawerModule,
    TagModule,
    TooltipModule,
    SelectModule,
    InputTextModule,
    ConfigFormComponent,
    ConfigVersionFormComponent,
  ],
  templateUrl: './configs.component.html',
  styleUrl: './configs.component.scss',
})
export class Configs {
  private readonly api = inject(ConfigsApi);
  private readonly toast = inject(MessageService);
  private readonly confirmer = inject(ConfirmationService);
  private readonly ctx = inject(ClusterContextService);

  /** Operator or Admin may create configs, add versions and restore (F-V1-01). */
  readonly canManage = inject(AuthService).isOperator;

  readonly createFormRef = viewChild.required(ConfigFormComponent);
  readonly versionFormRef = viewChild.required(ConfigVersionFormComponent);

  readonly configs = signal<ConfigResponse[]>([]);
  readonly loading = signal(false);

  // ─── Bulk selection ──────────────────────────────────────────────────────────
  readonly selected = signal<ConfigResponse[]>([]);

  readonly versionTarget = signal<ConfigResponse | null>(null);
  drawerVisible = false;
  readonly versions = signal<ConfigVersionResponse[]>([]);
  readonly versionsLoading = signal(false);

  // ─── Diff (F-V2-08) ────────────────────────────────────────────────────────
  readonly versionOptions = computed(() =>
    this.versions().map((v) => ({ label: `v${v.version}`, value: v.version })),
  );
  diffFrom: number | null = null;
  diffTo: number | null = null;
  readonly diffLines = signal<DiffLine[] | null>(null);
  readonly diffLoading = signal(false);

  // ─── Impacted services (F-V2-08) ──────────────────────────────────────────
  readonly impacted = signal<ImpactedService[]>([]);

  constructor() {
    effect(() => {
      this.ctx.selectedId();
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.selected.set([]); // drop stale selection (rows are about to be replaced)
    collectAll((page, size) => this.api.list(page, size)).subscribe({
      next: (items) => {
        this.configs.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des configs impossible',
        });
      },
    });
  }

  openCreate(): void {
    this.createFormRef().open();
  }

  openAddVersion(c: ConfigResponse): void {
    this.versionTarget.set(c);
    this.versionFormRef().open();
  }

  openVersions(c: ConfigResponse): void {
    this.versionTarget.set(c);
    this.drawerVisible = true;
    this.diffLines.set(null);
    this.diffFrom = null;
    this.diffTo = null;
    this.loadVersions(c.id);
    this.api
      .impactedServices(c.id)
      .subscribe({ next: (s) => this.impacted.set(s), error: () => this.impacted.set([]) });
  }

  private loadVersions(id: string): void {
    this.versionsLoading.set(true);
    this.api.versions(id).subscribe({
      next: (v) => {
        this.versions.set(v);
        this.versionsLoading.set(false);
        // Default the comparison to the two most recent versions.
        if (v.length >= 2) {
          this.diffFrom = v[1].version;
          this.diffTo = v[0].version;
        }
      },
      error: () => {
        this.versionsLoading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Chargement des versions impossible',
        });
      },
    });
  }

  runDiff(): void {
    const c = this.versionTarget();
    if (!c || this.diffFrom == null || this.diffTo == null) return;
    if (this.diffFrom === this.diffTo) {
      this.diffLines.set([]);
      return;
    }
    this.diffLoading.set(true);
    this.api.diff(c.id, this.diffFrom, this.diffTo).subscribe({
      next: (res) => {
        this.diffLines.set(res.lines);
        this.diffLoading.set(false);
      },
      error: (err) => {
        this.diffLoading.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Diff impossible',
        });
      },
    });
  }

  restore(v: ConfigVersionResponse): void {
    const c = this.versionTarget();
    if (!c) return;
    confirmDestructive(
      this.confirmer,
      {
        header: `Restaurer v${v.version}`,
        message: `Restaurer la version v${v.version} ? Une nouvelle version au contenu identique sera créée.`,
        acceptLabel: 'Restaurer',
        acceptSeverity: 'warn',
        icon: 'pi pi-history',
      },
      () => this.runRestore(c.id, v.version),
    );
  }

  private runRestore(configId: string, version: number): void {
    this.api.restore(configId, version, '').subscribe({
      next: () => {
        this.loadVersions(configId);
        this.load();
        const n = this.impacted().length;
        this.toast.add({
          severity: 'success',
          summary: 'Restaurée',
          detail:
            n > 0
              ? `v${version} restaurée. ${n} service(s) impacté(s) — pensez à les redéployer.`
              : `v${version} restaurée.`,
        });
      },
      error: (err) =>
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Restauration impossible',
        }),
    });
  }

  onVersionAdded(): void {
    this.load();
    const c = this.versionTarget();
    if (c && this.drawerVisible) this.loadVersions(c.id);
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────────────

  clearSelection(): void {
    this.selected.set([]);
  }

  bulkDelete(): void {
    const items = this.selected();
    if (!items.length) return;
    confirmDestructive(
      this.confirmer,
      {
        header: 'Supprimer la sélection',
        message: `Supprimer ${items.length} config(s) ? Action irréversible.`,
      },
      () =>
        settleAll(items, (x) => this.api.remove(x.id)).subscribe((res) => {
          // Refresh whatever the outcome: a partial failure still removed rows.
          this.clearSelection();
          this.load();
          if (res.failed.length) {
            this.toast.add({
              severity: 'error',
              summary: 'Suppression partielle',
              detail: `${res.succeeded.length}/${items.length} supprimée(s) — ${firstErrorMessage(
                res.failed,
                'suppression impossible',
              )}`,
            });
            return;
          }
          this.toast.add({
            severity: 'success',
            summary: 'Supprimées',
            detail: `${items.length} config(s) supprimée(s)`,
          });
        }),
    );
  }

  remove(c: ConfigResponse): void {
    confirmDestructive(
      this.confirmer,
      { header: 'Supprimer la config', message: `Supprimer la config "${c.name}" ?` },
      () =>
        this.api.remove(c.id).subscribe({
          next: () => {
            this.toast.add({
              severity: 'success',
              summary: 'Supprimée',
              detail: `${c.name} supprimée`,
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
        }),
    );
  }
}
