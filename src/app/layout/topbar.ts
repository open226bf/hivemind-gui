import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { ClusterContextService } from '../core/cluster-context.service';

/** Top application bar: brand, active-cluster badge and the signed-in user menu. */
@Component({
  selector: 'hm-topbar',
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly ctx = inject(ClusterContextService);
  private readonly router = inject(Router);

  readonly email = computed(() => this.auth.user()?.email ?? '');

  /** Name of the cluster every request is scoped to. Empty until the cluster
   *  list has loaded, which hides the badge rather than showing a stale value. */
  readonly clusterName = computed(() => {
    const id = this.ctx.selectedId();
    return this.ctx.clusters().find((c) => c.id === id)?.name ?? '';
  });

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
