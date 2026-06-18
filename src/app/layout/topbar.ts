import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../core/auth.service';

/** Top application bar: brand, environment badge and the signed-in user menu. */
@Component({
  selector: 'hm-topbar',
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = computed(() => this.auth.user()?.email ?? '');

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
