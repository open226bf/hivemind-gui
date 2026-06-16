import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

/**
 * Portainer-style confirmation dialog shown before forcing a redeploy of an
 * already-deployed service. Lets the operator opt in to re-pulling the image
 * (Swarm's QueryRegistry) so a moved tag like `:latest` is re-resolved.
 */
@Component({
  selector: 'hm-redeploy-confirm',
  imports: [FormsModule, DialogModule, ButtonModule, ToggleSwitchModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      header="Redéployer le service"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '460px' }"
    >
      <div class="confirm-body">
        <div class="icon-circle"><i class="pi pi-exclamation-triangle"></i></div>
        <div>
          <strong>Êtes-vous sûr ?</strong>
          <p class="muted">
            Toutes les tâches de <strong>{{ serviceName() }}</strong> seront recréées selon la stratégie
            de mise à jour configurée.
          </p>
        </div>
      </div>

      <div class="toggle-row">
        <div>
          <div>Re-pull image</div>
          <div class="muted small">Re-résoudre le tag depuis le registry avant déploiement.</div>
        </div>
        <p-toggleSwitch [(ngModel)]="repull" />
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" [text]="true" (onClick)="cancel()" />
        <p-button label="Redéployer" icon="pi pi-cloud-upload" (onClick)="ok()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .confirm-body { display: flex; gap: 1rem; align-items: flex-start; padding: 0.25rem 0 1rem; }
    .icon-circle {
      flex-shrink: 0;
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--p-orange-50, #fff7ed);
      color: var(--p-orange-500, #f97316);
      font-size: 1.1rem;
    }
    .muted { color: var(--p-text-muted-color, #6b7280); margin: 0.25rem 0 0; }
    .small { font-size: 0.85rem; }
    .toggle-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem 0; gap: 1rem;
      border-top: 1px solid var(--p-content-border-color, #e5e7eb);
    }
  `],
})
export class RedeployConfirm {
  readonly visible = signal(false);
  readonly serviceName = signal('');
  repull = false;

  readonly confirmed = output<{ repull: boolean }>();

  open(name: string): void {
    this.serviceName.set(name);
    this.repull = false;
    this.visible.set(true);
  }

  ok(): void {
    this.confirmed.emit({ repull: this.repull });
    this.visible.set(false);
  }

  cancel(): void {
    this.visible.set(false);
  }
}
