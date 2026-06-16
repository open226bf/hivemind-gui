import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'hm-placeholder',
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ title }}</h1>
      </div>
      <div class="card">
        <div class="empty-state">
          <i class="pi" [class]="icon"></i>
          Section « {{ title }} » — bientôt disponible dans l'interface.
        </div>
      </div>
    </div>
  `,
})
export class Placeholder {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] ?? 'À venir';
  readonly icon = this.route.snapshot.data['icon'] ?? 'pi-clock';
}
