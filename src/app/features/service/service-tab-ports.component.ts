import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';

import { ServicesApi } from '../../core/api';
import { PortDTO, PortProtocol, PublishMode } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';

interface PortRow {
  published_port: number | null;
  target_port: number | null;
  protocol: PortProtocol;
  mode: PublishMode;
}

@Component({
  selector: 'hm-service-tab-ports',
  imports: [FormsModule, TableModule, TagModule, ButtonModule, InputNumberModule, SelectModule],
  templateUrl: './service-tab-ports.component.html',
  styleUrl: './service-tab-ports.component.scss',
})
export class ServiceTabPorts implements OnInit {
  private readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly toast = inject(MessageService);

  /** Operator or Admin may edit published ports. */
  readonly canManage = this.store.canManage;

  readonly ports = signal<PortDTO[]>([]);
  readonly rows = signal<PortRow[]>([]);
  readonly editing = signal(false);
  readonly saving = signal(false);

  readonly protocolOptions = [
    { label: 'TCP', value: 'tcp' as PortProtocol },
    { label: 'UDP', value: 'udp' as PortProtocol },
    { label: 'SCTP', value: 'sctp' as PortProtocol },
  ];
  readonly modeOptions = [
    { label: 'Ingress (routing mesh)', value: 'ingress' as PublishMode },
    { label: 'Host (nœud local)', value: 'host' as PublishMode },
  ];

  /** Each row needs a valid container port; published-port/protocol pairs must be unique. */
  readonly valid = computed(() => {
    const rows = this.rows();
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.target_port || r.target_port < 1 || r.target_port > 65535) return false;
      if (r.published_port != null && (r.published_port < 0 || r.published_port > 65535))
        return false;
      if (r.published_port) {
        const key = `${r.protocol}/${r.published_port}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
    }
    return true;
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.api.ports(this.store.serviceId()).subscribe((res) => this.ports.set(res.ports));
  }

  modeLabel(m: PublishMode): string {
    return m === 'host' ? 'Host' : 'Ingress';
  }

  startEdit(): void {
    this.rows.set(
      this.ports().map((p) => ({
        published_port: p.published_port || null,
        target_port: p.target_port,
        protocol: p.protocol,
        mode: p.mode,
      })),
    );
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
    this.rows.set([]);
  }

  addRow(): void {
    this.rows.update((rs) => [
      ...rs,
      { published_port: null, target_port: null, protocol: 'tcp', mode: 'ingress' },
    ]);
  }

  removeRow(index: number): void {
    this.rows.update((rs) => rs.filter((_, i) => i !== index));
  }

  save(): void {
    if (!this.valid()) return;
    this.saving.set(true);
    const payload = {
      ports: this.rows().map((r) => ({
        published_port: r.published_port ?? 0,
        target_port: r.target_port ?? 0,
        protocol: r.protocol,
        mode: r.mode,
      })),
    };
    this.api.setPorts(this.store.serviceId(), payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.editing.set(false);
        this.ports.set(res.ports);
        this.toast.add({
          severity: 'success',
          summary: 'Enregistré',
          detail: `${res.ports.length} port(s) — appliqué au prochain déploiement.`,
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
