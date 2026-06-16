import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService } from 'primeng/api';

import { ServicesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { EnvVar } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';

const KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

interface EditRow {
  key: string;
  value: string;
  is_secret: boolean;
  wasSecretFromServer: boolean;
}

@Component({
  selector: 'hm-service-tab-variables',
  imports: [FormsModule, TableModule, TagModule, ButtonModule, InputTextModule, CheckboxModule],
  templateUrl: './service-tab-variables.component.html',
  styleUrl: './service-tab-variables.component.scss',
})
export class ServiceTabVariables implements OnInit {
  private readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly toast = inject(MessageService);

  /** Operator or Admin may edit env vars (F-V1-01). */
  readonly canManage = inject(AuthService).isOperator;

  readonly vars = signal<EnvVar[]>([]);
  readonly rows = signal<EditRow[]>([]);
  readonly editing = signal(false);
  readonly saving = signal(false);

  readonly duplicateKey = computed(() => {
    const seen = new Set<string>();
    for (const r of this.rows()) {
      const k = r.key.trim();
      if (!k) continue;
      if (seen.has(k)) return k;
      seen.add(k);
    }
    return null;
  });

  readonly valid = computed(() => {
    if (this.duplicateKey()) return false;
    return this.rows().every((r) => r.key.trim() !== '' && this.keyValid(r.key));
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.api.env(this.store.serviceId()).subscribe((res) => this.vars.set(res.vars));
  }

  keyValid(key: string): boolean {
    return KEY_RE.test(key.trim());
  }

  startEdit(): void {
    this.rows.set(
      this.vars().map((v) => ({
        key: v.key,
        value: v.value,
        is_secret: v.is_secret,
        wasSecretFromServer: v.is_secret,
      })),
    );
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
    this.rows.set([]);
  }

  addRow(): void {
    this.rows.update((rs) => [...rs, { key: '', value: '', is_secret: false, wasSecretFromServer: false }]);
  }

  removeRow(index: number): void {
    this.rows.update((rs) => rs.filter((_, i) => i !== index));
  }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    const payload = {
      vars: this.rows().map((r) => ({ key: r.key.trim(), value: r.value, is_secret: r.is_secret })),
    };
    this.api.setEnv(this.store.serviceId(), payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.editing.set(false);
        this.vars.set(res.vars);
        this.toast.add({ severity: 'success', summary: 'Enregistré', detail: `${res.count} variable(s)` });
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message ?? 'Enregistrement impossible' });
      },
    });
  }
}
