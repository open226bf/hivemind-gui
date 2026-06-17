import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService } from 'primeng/api';

import { ClusterApi } from '../../core/api';
import { ConnectionMode, EnrollClusterResponse } from '../../core/models';

const STATUS_POLL_MS = 4000;

@Component({
  selector: 'hm-cluster-enroll',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    SelectButtonModule,
  ],
  templateUrl: './cluster-enroll.component.html',
  styleUrl: './cluster-enroll.component.scss',
})
export class ClusterEnroll {
  private readonly api = inject(ClusterApi);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Set once the cluster exists (passed in via /clusters/:id/enroll, or after create). */
  readonly clusterId = signal<string | null>(null);
  readonly clusterName = signal('');
  readonly saving = signal(false);

  readonly modeOptions = [
    { label: 'Agent (dial-out)', value: 'agent' as ConnectionMode },
    { label: 'Direct (socket / mTLS)', value: 'direct' as ConnectionMode },
  ];
  mode: ConnectionMode = 'agent';

  // Identity (create only).
  form = { name: '', labels: '', endpoint: '', caCert: '', clientCert: '', clientKey: '' };

  /** Collapsible mutual-TLS section (direct mode). */
  readonly showTls = signal(false);

  // Enrollment result + live agent status.
  readonly enrollment = signal<EnrollClusterResponse | null>(null);
  readonly agentStatus = signal<string>('');

  /** The agent stack manifest, shown alongside the deploy command. */
  readonly manifest = `version: "3.8"
services:
  agent:
    image: hivemind/agent:latest
    deploy:
      mode: global            # one task per node
      restart_policy:
        condition: any
    environment:
      HIVEMIND_SERVER: "\${HIVEMIND_SERVER}"
      HIVEMIND_ENROLL_TOKEN: "\${HIVEMIND_ENROLL_TOKEN}"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro`;

  /** Cluster name must be a DNS-safe slug (create mode only). */
  private static readonly nameRe = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

  /** True when the name is acceptable for submission (existing clusters skip this). */
  nameOk(): boolean {
    return !!this.clusterId() || ClusterEnroll.nameRe.test(this.form.name.trim());
  }

  /** True when a non-empty name is malformed — drives the inline hint. */
  nameInvalid(): boolean {
    const n = this.form.name.trim();
    return n.length > 0 && !ClusterEnroll.nameRe.test(n);
  }

  toggleTls(): void {
    this.showTls.update((v) => !v);
  }

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      // Re-enroll an existing cluster: jump straight to agent mode.
      this.mode = 'agent';
      this.clusterId.set(id);
      this.api.get(id).subscribe({
        next: (c) => {
          this.clusterName.set(c.name);
          this.form.name = c.name;
          this.agentStatus.set(c.agent_status ?? '');
        },
      });
    }
  }

  /** Direct mode: create the cluster and return to the list. */
  createDirect(): void {
    if (!this.form.name.trim()) {
      this.warn('Le nom est obligatoire');
      return;
    }
    this.saving.set(true);
    this.api
      .create({
        name: this.form.name.trim(),
        type: 'swarm',
        endpoint: this.form.endpoint.trim() || undefined,
        labels: this.parseLabels(),
        ca_cert: this.form.caCert || undefined,
        client_cert: this.form.clientCert || undefined,
        client_key: this.form.clientKey || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.add({ severity: 'success', summary: 'Créé', detail: this.form.name });
          this.router.navigate(['/clusters']);
        },
        error: (err) => this.fail(err),
      });
  }

  /** Agent mode: ensure the cluster exists, then issue the enrollment token. */
  generateToken(): void {
    const existing = this.clusterId();
    if (existing) {
      this.runEnroll(existing);
      return;
    }
    if (!this.form.name.trim()) {
      this.warn('Le nom est obligatoire');
      return;
    }
    this.saving.set(true);
    this.api
      .create({ name: this.form.name.trim(), type: 'swarm', labels: this.parseLabels() })
      .subscribe({
        next: (c) => {
          this.clusterId.set(c.id);
          this.clusterName.set(c.name);
          this.runEnroll(c.id);
        },
        error: (err) => this.fail(err),
      });
  }

  private runEnroll(id: string): void {
    this.saving.set(true);
    this.api.enroll(id).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.enrollment.set(res);
        this.toast.add({ severity: 'success', summary: 'Token généré', detail: res.cluster_name });
        this.pollStatus(id);
      },
      error: (err) => this.fail(err),
    });
  }

  /** Polls the cluster's agent status until it comes online. */
  private pollStatus(id: string): void {
    interval(STATUS_POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.api.get(id).subscribe({
          next: (c) => this.agentStatus.set(c.agent_status ?? ''),
        });
      });
  }

  copy(text?: string): void {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => this.toast.add({ severity: 'success', summary: 'Copié', detail: '' }),
      () => this.warn('Copie impossible'),
    );
  }

  agentSeverity(): 'success' | 'warn' | 'secondary' {
    switch (this.agentStatus()) {
      case 'online':
        return 'success';
      case 'pending':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  private parseLabels(): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const line of this.form.labels.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return Object.keys(out).length ? out : undefined;
  }

  private warn(detail: string): void {
    this.toast.add({ severity: 'warn', summary: 'Champ requis', detail });
  }

  private fail(err: unknown): void {
    this.saving.set(false);
    this.toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: (err as { error?: { message?: string } })?.error?.message ?? 'Opération impossible',
    });
  }
}
