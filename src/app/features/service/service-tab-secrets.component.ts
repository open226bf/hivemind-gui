import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';

import { ServicesApi } from '../../core/api';
import { FileMount, ServiceConfigResponse, ServiceSecretResponse } from '../../core/models';
import { formatFileMode, parseFileMode } from '../../core/filemode';
import { ServiceDetailStore } from '../service/service-detail.store';

/** What the form holds while a row is open: every field is text, the mode
 *  included, so what the user typed survives until it validates. */
interface MountDraft {
  target_path: string;
  uid: string;
  gid: string;
  mode: string;
}

/** One attached secret or config, flattened so both tables share a row type. */
interface AttachmentRow {
  kind: 'secret' | 'config';
  id: string;
  name: string;
  mount: FileMount;
}

@Component({
  selector: 'hm-service-tab-secrets',
  imports: [NgTemplateOutlet, FormsModule, TableModule, ButtonModule, InputTextModule],
  templateUrl: './service-tab-secrets.component.html',
  styleUrl: './service-tab-secrets.component.scss',
})
export class ServiceTabSecrets implements OnInit {
  private readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly toast = inject(MessageService);

  /** Write gate from this service's hive/cluster grant (ADR 0003). */
  readonly canManage = this.store.canManage;

  readonly secrets = signal<AttachmentRow[]>([]);
  readonly configs = signal<AttachmentRow[]>([]);
  readonly loading = signal(true);

  /**
   * Rows are edited one at a time rather than all at once as in the Mounts tab:
   * each attachment is its own request, so a bulk save would fire one per row
   * and could half-fail, leaving the table disagreeing with the cluster.
   */
  readonly editingKey = signal<string | null>(null);
  readonly draft = signal<MountDraft>({ target_path: '', uid: '', gid: '', mode: '' });
  readonly saving = signal(false);

  readonly pathError = computed(() => {
    const p = this.draft().target_path.trim();
    return p !== '' && !p.startsWith('/');
  });
  readonly uidError = computed(() => !ownerValid(this.draft().uid));
  readonly gidError = computed(() => !ownerValid(this.draft().gid));
  readonly modeError = computed(() => parseFileMode(this.draft().mode) === undefined);

  readonly valid = computed(
    () => !this.pathError() && !this.uidError() && !this.gidError() && !this.modeError(),
  );

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    const id = this.store.serviceId();
    this.loading.set(true);
    forkJoin({
      secrets: this.api.serviceSecrets(id),
      configs: this.api.serviceConfigs(id),
    }).subscribe({
      next: ({ secrets, configs }) => {
        this.secrets.set(secrets.map(toSecretRow));
        this.configs.set(configs.map(toConfigRow));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  key(row: AttachmentRow): string {
    return `${row.kind}:${row.id}`;
  }

  /** Secrets land under /run/secrets whatever the path; configs go where asked. */
  pathPlaceholder(row: AttachmentRow): string {
    return row.kind === 'secret' ? '/run/secrets/db_password' : '/etc/nginx/nginx.conf';
  }

  /** The owner as stored: empty means the orchestrator decides, which is root. */
  ownerLabel(mount: FileMount): string {
    if (!mount.uid && !mount.gid) return 'root (défaut)';
    return `${mount.uid || '0'}:${mount.gid || '0'}`;
  }

  /** Zero is "not chosen", and the deployment then applies 0444. */
  modeLabel(mount: FileMount): string {
    return formatFileMode(mount.mode) || '0444 (défaut)';
  }

  startEdit(row: AttachmentRow): void {
    this.draft.set({
      target_path: row.mount.target_path ?? '',
      uid: row.mount.uid ?? '',
      gid: row.mount.gid ?? '',
      mode: formatFileMode(row.mount.mode),
    });
    this.editingKey.set(this.key(row));
  }

  cancel(): void {
    this.editingKey.set(null);
  }

  /**
   * Replaces the draft rather than mutating it in place.
   *
   * This is why the template binds [ngModel] + (ngModelChange) instead of the
   * shorter [(ngModel)]="draft().uid": writing through the object a signal holds
   * leaves the signal's own value identical, so the validation computeds above
   * never re-run and the Save button keeps whatever state it had when the row
   * was opened.
   */
  patch(change: Partial<MountDraft>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  save(row: AttachmentRow): void {
    if (!this.valid()) return;
    const d = this.draft();
    // valid() has already gated on parseFileMode returning a number; the ?? 0
    // below only narrows the type.
    const mount: FileMount = {
      target_path: d.target_path.trim(),
      uid: d.uid.trim(),
      gid: d.gid.trim(),
      mode: parseFileMode(d.mode) ?? 0,
    };
    const id = this.store.serviceId();
    const req =
      row.kind === 'secret'
        ? this.api.updateSecretAttachment(id, row.id, mount)
        : this.api.updateConfigAttachment(id, row.id, mount);

    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.editingKey.set(null);
        this.reload();
        this.toast.add({
          severity: 'success',
          summary: 'Enregistré',
          detail: `${row.name} — appliqué au prochain déploiement.`,
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Enregistrement impossible',
        });
      },
    });
  }
}

/** Empty is valid — it leaves the owner to the orchestrator. Anything else must
 *  be numeric: the container runtime does not resolve user names. */
function ownerValid(value: string): boolean {
  const v = value.trim();
  return v === '' || /^[0-9]{1,10}$/.test(v);
}

function toSecretRow(s: ServiceSecretResponse): AttachmentRow {
  return { kind: 'secret', id: s.secret_id, name: s.name, mount: mountOf(s) };
}

function toConfigRow(c: ServiceConfigResponse): AttachmentRow {
  return { kind: 'config', id: c.config_id, name: c.name, mount: mountOf(c) };
}

function mountOf(a: FileMount): FileMount {
  return { target_path: a.target_path, uid: a.uid, gid: a.gid, mode: a.mode };
}
