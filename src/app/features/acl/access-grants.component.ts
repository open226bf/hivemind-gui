import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { AclApi, UsersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { AclResourceType, GrantResponse, Verb } from '../../core/models';

/**
 * "Habilitations" panel: lists and manages the ACL grants on a cluster or hive
 * (ADR 0003). Shown only to users who can manage the resource (admins, or a
 * holder of the manage verb). Granting bumps the subject's token version
 * server-side, so access changes take effect immediately.
 */
@Component({
  selector: 'hm-access-grants',
  imports: [FormsModule, DatePipe, ButtonModule, TableModule, TagModule, SelectModule],
  template: `
    @if (canManage()) {
      <div class="card access-grants">
        <div class="ag-head">
          <h3><i class="pi pi-lock"></i> Habilitations</h3>
          <span class="muted">Qui peut accéder à {{ label() }}</span>
        </div>

        <div class="ag-add flex align-items-center gap-2 flex-wrap">
          <p-select
            [options]="userOptions()"
            [(ngModel)]="subjectId"
            optionLabel="label"
            optionValue="value"
            placeholder="Utilisateur"
            [filter]="true"
            styleClass="ag-user"
          />
          <p-select
            [options]="verbOptions"
            [(ngModel)]="verb"
            optionLabel="label"
            optionValue="value"
            styleClass="ag-verb"
          />
          <p-button
            label="Octroyer"
            icon="pi pi-plus"
            size="small"
            [disabled]="!subjectId || saving()"
            (onClick)="grant()"
          />
        </div>

        <p-table [value]="grants()" [loading]="loading()" dataKey="id" styleClass="mt-2">
          <ng-template #header>
            <tr>
              <th>Utilisateur</th>
              <th style="width: 120px">Droit</th>
              <th style="width: 160px">Expire</th>
              <th style="width: 60px"></th>
            </tr>
          </ng-template>
          <ng-template #body let-g>
            <tr>
              <td class="mono">{{ userLabel(g.subject_id) }}</td>
              <td><p-tag [value]="verbLabel(g.verb)" [severity]="verbSeverity(g.verb)" /></td>
              <td class="muted">{{ g.expires_at ? (g.expires_at | date: 'short') : '—' }}</td>
              <td>
                <p-button
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  size="small"
                  pTooltip="Révoquer"
                  (onClick)="revoke(g)"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="4">
                <div class="muted ag-empty">
                  <i class="pi pi-users"></i> Aucune habilitation explicite.
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }
  `,
  styles: [
    `
      .access-grants {
        padding: 16px 18px;
        margin-top: 16px;
      }
      .ag-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 12px;
      }
      .ag-head h3 {
        margin: 0;
        font-size: 15px;
      }
      .ag-head .pi {
        margin-right: 4px;
      }
      .ag-add {
        margin-bottom: 6px;
      }
      .ag-empty {
        padding: 18px;
        text-align: center;
      }
      .mono {
        font-variant-numeric: tabular-nums;
      }
      .muted {
        color: var(--hm-text-muted);
      }
    `,
  ],
})
export class AccessGrantsComponent {
  /** 'cluster' | 'hive' — the resource the grants attach to. */
  readonly resourceType = input.required<AclResourceType>();
  readonly resourceId = input.required<string>();
  /** The hive's cluster (for the cascade permission check). Ignored for clusters. */
  readonly clusterId = input<string | null>(null);

  private readonly acl = inject(AclApi);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(MessageService);

  readonly grants = signal<GrantResponse[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly users = signal<{ id: string; email: string }[]>([]);

  subjectId: string | null = null;
  verb: Verb = 'read';
  readonly verbOptions = [
    { label: 'Lecture', value: 'read' },
    { label: 'Écriture', value: 'write' },
    { label: 'Gestion', value: 'manage' },
  ];

  /** Only managers (or admins) of the resource see/use this panel. */
  readonly canManage = computed(() =>
    this.resourceType() === 'cluster'
      ? this.auth.canManageCluster(this.resourceId())
      : this.auth.canManageHive(this.clusterId(), this.resourceId()),
  );

  readonly userOptions = computed(() => this.users().map((u) => ({ label: u.email, value: u.id })));

  constructor() {
    effect(() => {
      // reload whenever the target resource changes and the user may manage it
      this.resourceId();
      if (this.canManage()) {
        this.load();
        this.loadUsers();
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    const req =
      this.resourceType() === 'cluster'
        ? this.acl.listClusterGrants(this.resourceId())
        : this.acl.listHiveGrants(this.resourceId());
    req.subscribe({
      next: (res) => {
        this.grants.set(res.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadUsers(): void {
    this.usersApi.list(1, 200).subscribe({
      next: (res) => this.users.set(res.items.map((u) => ({ id: u.id, email: u.email }))),
    });
  }

  grant(): void {
    if (!this.subjectId) return;
    this.saving.set(true);
    const body = { subject_id: this.subjectId, verb: this.verb };
    const req =
      this.resourceType() === 'cluster'
        ? this.acl.grantCluster(this.resourceId(), body)
        : this.acl.grantHive(this.resourceId(), body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.subjectId = null;
        this.verb = 'read';
        this.toast.add({ severity: 'success', summary: 'Habilitation', detail: 'Droit octroyé' });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Octroi impossible',
        });
      },
    });
  }

  revoke(g: GrantResponse): void {
    if (!confirm(`Révoquer l'accès de ${this.userLabel(g.subject_id)} ?`)) return;
    this.acl.revoke(g.id).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: 'Habilitation', detail: 'Droit révoqué' });
        this.load();
      },
      error: (err) =>
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Révocation impossible',
        }),
    });
  }

  label(): string {
    return this.resourceType() === 'cluster' ? 'ce cluster' : 'cette ruche';
  }

  userLabel(id: string): string {
    return this.users().find((u) => u.id === id)?.email ?? id.slice(0, 8);
  }

  verbLabel(v: Verb): string {
    return { read: 'Lecture', write: 'Écriture', manage: 'Gestion' }[v];
  }

  verbSeverity(v: Verb): 'success' | 'warn' | 'danger' {
    return v === 'manage' ? 'danger' : v === 'write' ? 'warn' : 'success';
  }
}
