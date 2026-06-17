import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';

import { ClusterApi } from '../../core/api';
import { ClusterResponse, CreateClusterRequest, UpdateClusterRequest } from '../../core/models';

interface ClusterForm {
  name: string;
  endpoint: string;
  labels: string; // "key=value" lines
  caCert: string;
  clientCert: string;
  clientKey: string;
}

function emptyForm(): ClusterForm {
  return { name: '', endpoint: '', labels: '', caCert: '', clientCert: '', clientKey: '' };
}

@Component({
  selector: 'hm-cluster-form',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule],
  templateUrl: './cluster-form.component.html',
  styleUrl: './cluster-form.component.scss',
})
export class ClusterFormComponent {
  private readonly api = inject(ClusterApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);
  /** Set while editing; null in create mode. */
  readonly editing = signal<ClusterResponse | null>(null);

  form: ClusterForm = emptyForm();

  open(cluster?: ClusterResponse): void {
    this.editing.set(cluster ?? null);
    this.form = emptyForm();
    if (cluster) {
      this.form.name = cluster.name;
      this.form.endpoint = cluster.endpoint ?? '';
      this.form.labels = Object.entries(cluster.labels ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      // TLS material is write-only: never prefilled, only replaced if retyped.
    }
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Le nom est obligatoire',
      });
      return;
    }
    this.saving.set(true);
    const editing = this.editing();
    const done = (label: string) => {
      this.saving.set(false);
      this.visible.set(false);
      this.toast.add({ severity: 'success', summary: label, detail: this.form.name });
      this.saved.emit();
    };
    const fail = (err: unknown) => {
      this.saving.set(false);
      this.toast.add({
        severity: 'error',
        summary: 'Erreur',
        detail: (err as any)?.error?.message ?? 'Opération impossible',
      });
    };

    if (editing) {
      const body: UpdateClusterRequest = {
        name: this.form.name.trim(),
        endpoint: this.form.endpoint.trim(),
        labels: this.parseLabels(),
      };
      // Only send TLS fields when at least one was (re)entered.
      if (this.form.caCert || this.form.clientCert || this.form.clientKey) {
        body.ca_cert = this.form.caCert;
        body.client_cert = this.form.clientCert;
        body.client_key = this.form.clientKey;
      }
      this.api.update(editing.id, body).subscribe({ next: () => done('Modifié'), error: fail });
    } else {
      const body: CreateClusterRequest = {
        name: this.form.name.trim(),
        type: 'swarm',
        endpoint: this.form.endpoint.trim() || undefined,
        labels: this.parseLabels(),
        ca_cert: this.form.caCert || undefined,
        client_cert: this.form.clientCert || undefined,
        client_key: this.form.clientKey || undefined,
      };
      this.api.create(body).subscribe({ next: () => done('Créé'), error: fail });
    }
  }

  private parseLabels(): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const line of this.form.labels.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return Object.keys(out).length ? out : undefined;
  }
}
