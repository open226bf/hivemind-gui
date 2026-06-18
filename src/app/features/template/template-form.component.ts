import { Component, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';

import { NetworksApi, TemplatesApi } from '../../core/api';
import {
  DEFAULT_UPDATE_CONFIG,
  LockableField,
  TemplateResponse,
  TemplateSpecDTO,
} from '../../core/models';

const MIB = 1024 * 1024;

@Component({
  selector: 'hm-template-form',
  imports: [
    FormsModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    InputNumberModule,
    MultiSelectModule,
  ],
  templateUrl: './template-form.component.html',
  styleUrl: './template-form.component.scss',
})
export class TemplateFormComponent {
  private readonly api = inject(TemplatesApi);
  private readonly networksApi = inject(NetworksApi);
  private readonly toast = inject(MessageService);

  readonly visible = model(false);
  readonly saved = output<void>();
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly networkOptions = signal<{ label: string; value: string }[]>([]);
  readonly lockOptions: { label: string; value: LockableField }[] = [
    { label: 'Image', value: 'image' },
    { label: 'Tag', value: 'tag' },
    { label: 'Réplicas', value: 'replicas' },
    { label: 'Ressources', value: 'resources' },
    { label: 'Stratégie', value: 'update_config' },
    { label: 'Placement', value: 'placement' },
    { label: 'Réseaux', value: 'networks' },
  ];

  form = this.empty();

  constructor() {
    this.networksApi.list(1, 200).subscribe({
      next: (res) =>
        this.networkOptions.set(res.items.map((n) => ({ label: n.name, value: n.id }))),
    });
  }

  open(t: TemplateResponse | null): void {
    if (t) {
      this.editingId.set(t.id);
      this.form = {
        name: t.name,
        description: t.description,
        image: t.spec.image,
        tag: t.spec.tag,
        replicas: t.spec.replicas,
        cpuRes: t.spec.resources.cpu_reservation,
        cpuLim: t.spec.resources.cpu_limit,
        memResMib: Math.round(t.spec.resources.mem_reservation / MIB),
        memLimMib: Math.round(t.spec.resources.mem_limit / MIB),
        networkIds: [...t.spec.network_ids],
        lockedFields: [...t.locked_fields],
      };
    } else {
      this.editingId.set(null);
      this.form = this.empty();
    }
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }

  save(): void {
    const id = this.editingId();
    if (!id && !this.form.name) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: 'Le nom est obligatoire',
      });
      return;
    }
    if (!this.form.image) {
      this.toast.add({
        severity: 'warn',
        summary: 'Champ requis',
        detail: "L'image est obligatoire",
      });
      return;
    }
    this.saving.set(true);

    const spec: TemplateSpecDTO = {
      image: this.form.image,
      tag: this.form.tag,
      replicas: this.form.replicas || 0,
      resources: {
        cpu_reservation: this.form.cpuRes || 0,
        cpu_limit: this.form.cpuLim || 0,
        mem_reservation: Math.round((this.form.memResMib || 0) * MIB),
        mem_limit: Math.round((this.form.memLimMib || 0) * MIB),
      },
      update_config: { ...DEFAULT_UPDATE_CONFIG },
      placement: { constraints: [], preferences: [], max_replicas_per_node: 0 },
      network_ids: this.form.networkIds,
    };

    const done = {
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.toast.add({
          severity: 'success',
          summary: id ? 'Modifié' : 'Créé',
          detail: `Template ${this.form.name}`,
        });
        this.saved.emit();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.message ?? 'Opération impossible',
        });
      },
    };

    if (id) {
      this.api
        .update(id, {
          description: this.form.description,
          spec,
          locked_fields: this.form.lockedFields,
        })
        .subscribe(done);
    } else {
      this.api
        .create({
          name: this.form.name,
          description: this.form.description,
          spec,
          locked_fields: this.form.lockedFields,
        })
        .subscribe(done);
    }
  }

  private empty() {
    return {
      name: '',
      description: '',
      image: '',
      tag: '',
      replicas: 1,
      cpuRes: 0,
      cpuLim: 0,
      memResMib: 0,
      memLimMib: 0,
      networkIds: [] as string[],
      lockedFields: [] as LockableField[],
    };
  }
}
