import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { SelectModule } from 'primeng/select';

import { ConfigsApi, NetworksApi, SecretsApi, ServicesApi } from '../../core/api';
import {
  DEFAULT_UPDATE_CONFIG,
  SecretResponse,
  ConfigResponse,
  ServiceResponse,
  UpdateConfigDTO,
  HiveResponse,
} from '../../core/models';

@Component({
  selector: 'hm-service-form',
  imports: [
    FormsModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    InputNumberModule,
    MultiSelectModule,
    SelectModule,
  ],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss',
})
export class ServiceFormComponent {
  readonly visible = model(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly hive = input<HiveResponse | null>();
  readonly service = input<ServiceResponse | undefined>(undefined);
  readonly saved = output<void>();

  private readonly svcApi = inject(ServicesApi);
  private readonly networkApi = inject(NetworksApi);
  private readonly secretsApi = inject(SecretsApi);
  private readonly configsApi = inject(ConfigsApi);
  private readonly toast = inject(MessageService);

  readonly networkOptions = signal<{ label: string; value: string }[]>([]);
  readonly secretOptions = signal<{ label: string; value: string }[]>([]);
  readonly configOptions = signal<{ label: string; value: string }[]>([]);
  readonly saving = signal(false);
  readonly showStrategy = signal(false);

  private allSecrets: SecretResponse[] = [];
  private allConfigs: ConfigResponse[] = [];

  readonly failureActions = [
    { label: 'Rollback (revenir à la version précédente)', value: 'rollback' },
    { label: 'Pause (suspendre la mise à jour)', value: 'pause' },
    { label: "Continue (poursuivre malgré l'échec)", value: 'continue' },
  ];
  readonly orders = [
    { label: "start-first (démarrer le nouveau avant d'arrêter l'ancien)", value: 'start-first' },
    { label: "stop-first (arrêter l'ancien avant de démarrer le nouveau)", value: 'stop-first' },
  ];

  form = this.emptyForm();
  private editingNetworkIds: string[] = [];
  private editingSecretIds: string[] = [];
  private editingConfigIds: string[] = [];

  constructor() {
    // Catalog lists and the create call are scoped to the active cluster by the
    // X-Hivemind-Cluster header (clusterInterceptor) — no per-form picker.
    this.networkApi.list(1, 200).subscribe({
      next: (res) =>
        this.networkOptions.set(res.items.map((n) => ({ label: n.name, value: n.id }))),
    });
    this.secretsApi.list(1, 200).subscribe({
      next: (res) => {
        this.allSecrets = res.items;
        this.secretOptions.set(this.toPathOptions(res.items));
      },
    });
    this.configsApi.list(1, 200).subscribe({
      next: (res) => {
        this.allConfigs = res.items;
        this.configOptions.set(this.toPathOptions(res.items));
      },
    });

    effect(() => {
      if (this.visible()) {
        this.initForm();
      }
    });
  }

  /** Builds MultiSelect options, suffixing the mount path when present. */
  private toPathOptions(items: { id: string; name: string; target_path: string }[]) {
    return items.map((i) => ({
      label: i.target_path ? `${i.name}  (${i.target_path})` : i.name,
      value: i.id,
    }));
  }

  private initForm(): void {
    this.showStrategy.set(false);
    this.editingNetworkIds = [];
    this.editingSecretIds = [];
    this.editingConfigIds = [];

    const svc = this.service();
    if (this.mode() === 'edit' && svc) {
      this.form = {
        name: svc.name,
        image: svc.image,
        tag: svc.tag,
        replicas: svc.replicas,
        description: svc.description,
        networkIds: [],
        secretIds: [],
        configIds: [],
        updateConfig: { ...(svc.update_config ?? DEFAULT_UPDATE_CONFIG) },
        hive: this.hive()?.id,
      };

      forkJoin({
        nets: this.svcApi.networks(svc.id),
        secrets: this.svcApi.serviceSecrets(svc.id),
        configs: this.svcApi.serviceConfigs(svc.id),
      }).subscribe({
        next: ({ nets, secrets, configs }) => {
          this.editingNetworkIds = nets.map((n) => n.id);
          this.form.networkIds = [...this.editingNetworkIds];
          this.editingSecretIds = secrets.map((s) => s.secret_id);
          this.form.secretIds = [...this.editingSecretIds];
          this.editingConfigIds = configs.map((c) => c.config_id);
          this.form.configIds = [...this.editingConfigIds];
        },
      });
    } else {
      this.form = this.emptyForm();
    }
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    this.doSave(false);
  }

  saveAndDeploy(): void {
    this.doSave(true);
  }

  private doSave(deploy: boolean): void {
    if (!this.form.image) {
      this.toast.add({ severity: 'warn', summary: 'Champs requis', detail: 'Image obligatoire' });
      return;
    }
    const isCreate = this.mode() === 'create';
    if (isCreate && !this.form.name) {
      this.toast.add({ severity: 'warn', summary: 'Champs requis', detail: 'Nom obligatoire' });
      return;
    }
    this.saving.set(true);

    this.persist(isCreate)
      .pipe(
        switchMap((svc) => this.syncAttachments(svc.id).pipe(map(() => svc))),
        switchMap((svc) => (deploy ? this.svcApi.deploy(svc.id).pipe(map(() => svc)) : of(svc))),
      )
      .subscribe({
        next: () => this.onSuccess(isCreate, deploy),
        error: (e) => this.onError(e),
      });
  }

  /** Creates or updates the service, returning the persisted entity either way. */
  private persist(isCreate: boolean): Observable<ServiceResponse> {
    if (isCreate) {
      return this.svcApi.create({
        name: this.form.name,
        image: this.form.image,
        tag: this.form.tag || undefined,
        replicas: this.form.replicas,
        description: this.form.description || undefined,
        update_config: { ...this.form.updateConfig },
        hive: this.form.hive,
      });
    }
    return this.svcApi.update(this.service()!.id, {
      image: this.form.image,
      tag: this.form.tag,
      replicas: this.form.replicas,
      description: this.form.description,
      update_config: { ...this.form.updateConfig },
    });
  }

  /** Reconciles networks, secrets and configs against the service's current state. */
  private syncAttachments(serviceId: string): Observable<unknown> {
    const ops = [
      ...this.diffSync(
        this.editingNetworkIds,
        this.form.networkIds,
        (nid) => this.svcApi.attachNetwork(serviceId, nid),
        (nid) => this.svcApi.detachNetwork(serviceId, nid),
      ),
      ...this.diffSync(
        this.editingSecretIds,
        this.form.secretIds,
        (sid) => this.svcApi.attachSecret(serviceId, sid, this.targetPath(this.allSecrets, sid)),
        (sid) => this.svcApi.detachSecret(serviceId, sid),
      ),
      ...this.diffSync(
        this.editingConfigIds,
        this.form.configIds,
        (cid) => this.svcApi.attachConfig(serviceId, cid, this.targetPath(this.allConfigs, cid)),
        (cid) => this.svcApi.detachConfig(serviceId, cid),
      ),
    ];
    return ops.length === 0 ? of(undefined) : forkJoin(ops);
  }

  /** Emits attach ops for newly-added ids and detach ops for removed ones. */
  private diffSync(
    before: string[],
    after: string[],
    attach: (id: string) => Observable<unknown>,
    detach: (id: string) => Observable<unknown>,
  ): Observable<unknown>[] {
    return [
      ...after.filter((id) => !before.includes(id)).map(attach),
      ...before.filter((id) => !after.includes(id)).map(detach),
    ];
  }

  private targetPath(items: { id: string; target_path: string }[], id: string): string {
    return items.find((i) => i.id === id)?.target_path ?? '';
  }

  private onSuccess(isCreate: boolean, deployed: boolean): void {
    this.saving.set(false);
    this.visible.set(false);
    const summary = deployed
      ? isCreate
        ? 'Créé & déployé'
        : 'Enregistré & déployé'
      : isCreate
        ? 'Créé'
        : 'Modifié';
    this.toast.add({ severity: 'success', summary, detail: `Service ${this.form.name}` });
    this.saved.emit();
  }

  private onError(err: { error?: { message?: string } }): void {
    this.saving.set(false);
    this.toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: err?.error?.message ?? 'Opération impossible',
    });
  }

  resetStrategy(): void {
    this.form.updateConfig = { ...DEFAULT_UPDATE_CONFIG };
  }

  private emptyForm() {
    return {
      name: '',
      image: '',
      tag: '',
      replicas: 1,
      description: '',
      networkIds: [] as string[],
      secretIds: [] as string[],
      configIds: [] as string[],
      updateConfig: { ...DEFAULT_UPDATE_CONFIG } as UpdateConfigDTO,
      hive: this.hive()?.id,
    };
  }
}
