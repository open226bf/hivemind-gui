import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';

import { ServicesApi, VolumesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { MountDTO, MountType } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';

interface MountRow {
  type: MountType;
  source: string;
  target: string;
  read_only: boolean;
}

@Component({
  selector: 'hm-service-tab-mounts',
  imports: [FormsModule, TableModule, TagModule, ButtonModule, InputTextModule, SelectModule, CheckboxModule],
  templateUrl: './service-tab-mounts.component.html',
  styleUrl: './service-tab-mounts.component.scss',
})
export class ServiceTabMounts implements OnInit {
  private readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly volumesApi = inject(VolumesApi);
  private readonly toast = inject(MessageService);
  private readonly auth = inject(AuthService);

  /** Operator or Admin may edit mounts; bind mounts are Admin-only (F-V2-06). */
  readonly canManage = this.auth.isOperator;
  readonly isAdmin = this.auth.isAdmin;

  readonly mounts = signal<MountDTO[]>([]);
  readonly warnings = signal<string[]>([]);
  readonly rows = signal<MountRow[]>([]);
  readonly editing = signal(false);
  readonly saving = signal(false);

  /** Named-volume catalog for the volume-type source dropdown. */
  readonly volumeOptions = signal<{ label: string; value: string }[]>([]);

  readonly typeOptions = computed(() => [
    { label: 'Volume nommé', value: 'volume' as MountType, disabled: false },
    { label: 'Bind mount (hôte)' + (this.isAdmin() ? '' : ' — Admin'), value: 'bind' as MountType, disabled: !this.isAdmin() },
    { label: 'tmpfs (mémoire)', value: 'tmpfs' as MountType, disabled: false },
  ]);

  readonly valid = computed(() => {
    const rows = this.rows();
    const targets = new Set<string>();
    for (const r of rows) {
      if (!r.target.startsWith('/')) return false;
      if (targets.has(r.target)) return false;
      targets.add(r.target);
      if (r.type === 'volume' && !r.source.trim()) return false;
      if (r.type === 'bind' && !r.source.startsWith('/')) return false;
    }
    return true;
  });

  ngOnInit(): void {
    this.reload();
    this.volumesApi.list(1, 200).subscribe({
      next: (res) => this.volumeOptions.set(res.items.map((v) => ({ label: v.name, value: v.name }))),
    });
  }

  private reload(): void {
    this.api.mounts(this.store.serviceId()).subscribe((res) => {
      this.mounts.set(res.mounts);
      this.warnings.set(res.warnings ?? []);
    });
  }

  typeLabel(t: MountType): string {
    return t === 'volume' ? 'Volume' : t === 'bind' ? 'Bind' : 'tmpfs';
  }

  typeSeverity(t: MountType): 'success' | 'warn' | 'secondary' {
    return t === 'volume' ? 'success' : t === 'bind' ? 'warn' : 'secondary';
  }

  startEdit(): void {
    this.rows.set(this.mounts().map((m) => ({ ...m })));
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
    this.rows.set([]);
  }

  addRow(): void {
    this.rows.update((rs) => [...rs, { type: 'volume', source: '', target: '', read_only: false }]);
  }

  removeRow(index: number): void {
    this.rows.update((rs) => rs.filter((_, i) => i !== index));
  }

  /** tmpfs has no source; clear it when switching to tmpfs. */
  onTypeChange(row: MountRow): void {
    if (row.type === 'tmpfs') row.source = '';
  }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    const payload = {
      mounts: this.rows().map((r) => ({
        type: r.type,
        source: r.type === 'tmpfs' ? '' : r.source.trim(),
        target: r.target.trim(),
        read_only: r.read_only,
      })),
    };
    this.api.setMounts(this.store.serviceId(), payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.editing.set(false);
        this.mounts.set(res.mounts);
        this.warnings.set(res.warnings ?? []);
        this.toast.add({ severity: 'success', summary: 'Enregistré', detail: `${res.mounts.length} montage(s) — appliqué au prochain déploiement.` });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Enregistrement impossible' });
      },
    });
  }
}
