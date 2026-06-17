import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '../core/auth.service';
import { ClusterContextService } from '../core/cluster-context.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'hm-shell',
  imports: [FormsModule, RouterLink, RouterLinkActive, RouterOutlet, SelectModule, ToastModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly ctx = inject(ClusterContextService);

  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly isAdmin = this.auth.isAdmin;

  /** "All clusters" plus one entry per cluster, for the header picker. */
  readonly clusterPickerOptions = computed(() => [
    ...this.ctx.clusters().map((c) => ({ label: c.name, value: c.id })),
  ]);

  constructor() {
    this.ctx.load();
  }

  readonly nav: NavItem[] = [
    { label: 'Ruches', icon: 'pi-box', path: '/hives' },
    { label: 'Services', icon: 'pi-server', path: '/services' },
    { label: 'Réseaux', icon: 'pi-sitemap', path: '/networks' },
    { label: 'Volumes', icon: 'pi-database', path: '/volumes' },
    { label: 'Secrets', icon: 'pi-lock', path: '/secrets' },
    { label: 'Configs', icon: 'pi-file', path: '/configs' },
    { label: 'Templates', icon: 'pi-clone', path: '/templates' },
    { label: 'Déploiements', icon: 'pi-cloud-upload', path: '/deployments' },
  ];

  readonly adminNav: NavItem[] = [
    { label: 'Clusters', icon: 'pi-server', path: '/clusters' },
    { label: 'Utilisateurs', icon: 'pi-users', path: '/users' },
  ];

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
