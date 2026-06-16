import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs/operators';

import { ClusterApi, ServicesApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { PlacementDTO, ResourcesDTO, ServiceResponse } from '../../core/models';
import { ServiceDetailStore } from '../service/service-detail.store';

const MIB = 1024 * 1024;

/** Editable resources + Swarm placement, kept out of the create form so it
 *  stays focused (the create drawer only covers image/replicas/strategy). */
@Component({
  selector: 'hm-service-tab-resources',
  imports: [FormsModule, ButtonModule, InputNumberModule, InputTextModule],
  templateUrl: './service-tab-resources.component.html',
  styleUrl: './service-tab-resources.component.scss',
})
export class ServiceTabResources {
  private readonly store = inject(ServiceDetailStore);
  private readonly api = inject(ServicesApi);
  private readonly clusterApi = inject(ClusterApi);
  private readonly toast = inject(MessageService);

  /** Operator or Admin may edit (F-V1-01). */
  readonly canManage = inject(AuthService).isOperator;

  readonly service = this.store.service;

  /** Capacity of the largest single node — a reservation/limit above it could
   *  never be scheduled. 0 means the cluster is unreachable (check disabled). */
  readonly maxNodeCpu = signal(0);
  readonly maxNodeMemBytes = signal(0);

  constructor() {
    this.clusterApi.overview().subscribe({
      next: (ov) => {
        let cpu = 0;
        let mem = 0;
        for (const n of ov.nodes ?? []) {
          if (n.cpus > cpu) cpu = n.cpus;
          if (n.memory_bytes > mem) mem = n.memory_bytes;
        }
        this.maxNodeCpu.set(cpu);
        this.maxNodeMemBytes.set(mem);
      },
      // Cluster unreachable: leave caps at 0 so the UI check stays disabled
      // (the server remains authoritative).
      error: () => {},
    });
  }

  maxNodeMemMib(): number {
    return Math.floor(this.maxNodeMemBytes() / MIB);
  }

  /** Whether the edited resources exceed the largest node (when capacity known).
   *  A plain method, not a computed: resForm is a mutable object (ngModel), so
   *  this must re-evaluate on every change-detection pass. */
  resExceedsCapacity(): boolean {
    const cpu = this.maxNodeCpu();
    const mem = this.maxNodeMemBytes();
    const f = this.resForm;
    const cpuOver = cpu > 0 && (f.cpu_reservation > cpu || f.cpu_limit > cpu);
    const memOver = mem > 0 && (f.mem_reservation_mib * MIB > mem || f.mem_limit_mib * MIB > mem);
    return cpuOver || memOver;
  }

  // ─── Resources ───────────────────────────────────────────────────────────
  readonly editingRes = signal(false);
  readonly savingRes = signal(false);
  resForm = this.emptyRes();

  resInvalid(): boolean {
    const f = this.resForm;
    return (
      f.cpu_reservation < 0 ||
      f.cpu_limit < 0 ||
      f.mem_reservation_mib < 0 ||
      f.mem_limit_mib < 0 ||
      (f.cpu_limit > 0 && f.cpu_limit < f.cpu_reservation) ||
      (f.mem_limit_mib > 0 && f.mem_limit_mib < f.mem_reservation_mib) ||
      this.resExceedsCapacity()
    );
  }

  // ─── Placement ───────────────────────────────────────────────────────────
  readonly editingPlace = signal(false);
  readonly savingPlace = signal(false);
  placeForm = this.emptyPlace();

  placeInvalid(): boolean {
    if (this.placeForm.maxReplicas < 0) return true;
    return this.placeForm.constraints.some((c) => c.trim() !== '' && !this.constraintValid(c));
  }

  mib(bytes: number): string {
    return bytes ? `${Math.round(bytes / MIB)} MiB` : '—';
  }

  constraintValid(c: string): boolean {
    const t = c.trim();
    if (t === '') return false;
    const m = t.match(/(==|!=)/);
    if (!m) return false;
    const [key, value] = t.split(/==|!=/);
    return key.trim() !== '' && (value ?? '').trim() !== '';
  }

  // ─── Resources actions ───────────────────────────────────────────────────
  startEditRes(): void {
    const r = this.service()?.resources;
    this.resForm = {
      cpu_reservation: r?.cpu_reservation ?? 0,
      cpu_limit: r?.cpu_limit ?? 0,
      mem_reservation_mib: r ? Math.round(r.mem_reservation / MIB) : 0,
      mem_limit_mib: r ? Math.round(r.mem_limit / MIB) : 0,
    };
    this.editingRes.set(true);
  }

  cancelRes(): void {
    this.editingRes.set(false);
  }

  saveRes(): void {
    if (this.resInvalid()) return;
    const svc = this.service();
    if (!svc) return;
    const body: ResourcesDTO = {
      cpu_reservation: this.resForm.cpu_reservation || 0,
      cpu_limit: this.resForm.cpu_limit || 0,
      mem_reservation: Math.round((this.resForm.mem_reservation_mib || 0) * MIB),
      mem_limit: Math.round((this.resForm.mem_limit_mib || 0) * MIB),
    };
    this.savingRes.set(true);
    this.api
      .setResources(svc.id, body)
      .pipe(finalize(() => this.savingRes.set(false)))
      .subscribe({
        next: (updated) => this.onSaved(updated, 'Ressources mises à jour'),
        error: (err) => this.onError(err),
      });
  }

  // ─── Placement actions ───────────────────────────────────────────────────
  startEditPlace(): void {
    const p = this.service()?.placement;
    this.placeForm = {
      constraints: [...(p?.constraints ?? [])],
      preferences: [...(p?.preferences ?? [])],
      maxReplicas: p?.max_replicas_per_node ?? 0,
    };
    this.editingPlace.set(true);
  }

  cancelPlace(): void {
    this.editingPlace.set(false);
  }

  addConstraint(): void {
    this.placeForm.constraints = [...this.placeForm.constraints, ''];
  }

  removeConstraint(i: number): void {
    this.placeForm.constraints = this.placeForm.constraints.filter((_, idx) => idx !== i);
  }

  addPreference(): void {
    this.placeForm.preferences = [...this.placeForm.preferences, ''];
  }

  removePreference(i: number): void {
    this.placeForm.preferences = this.placeForm.preferences.filter((_, idx) => idx !== i);
  }

  savePlace(): void {
    if (this.placeInvalid()) return;
    const svc = this.service();
    if (!svc) return;
    const body: PlacementDTO = {
      constraints: this.placeForm.constraints.map((c) => c.trim()).filter((c) => c !== ''),
      preferences: this.placeForm.preferences.map((p) => p.trim()).filter((p) => p !== ''),
      max_replicas_per_node: this.placeForm.maxReplicas || 0,
    };
    this.savingPlace.set(true);
    this.api
      .setPlacement(svc.id, body)
      .pipe(finalize(() => this.savingPlace.set(false)))
      .subscribe({
        next: (updated) => this.onSaved(updated, 'Placement mis à jour'),
        error: (err) => this.onError(err),
      });
  }

  // ─── Shared ──────────────────────────────────────────────────────────────
  private onSaved(updated: ServiceResponse, summary: string): void {
    this.store.service.set(updated);
    this.editingRes.set(false);
    this.editingPlace.set(false);
    this.toast.add({
      severity: 'success',
      summary,
      detail: 'Appliqué au prochain déploiement.',
    });
  }

  private onError(err: { error?: { message?: string } }): void {
    this.toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err?.error?.message ?? 'Enregistrement impossible',
    });
  }

  private emptyRes() {
    return { cpu_reservation: 0, cpu_limit: 0, mem_reservation_mib: 0, mem_limit_mib: 0 };
  }

  private emptyPlace() {
    return { constraints: [] as string[], preferences: [] as string[], maxReplicas: 0 };
  }
}
