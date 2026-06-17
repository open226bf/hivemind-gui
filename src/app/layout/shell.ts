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
  template: `
    <p-toast position="bottom-right" />
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <img src="/brand/hivemind-mark.svg" alt="" class="logo" width="22" height="22" />
          <span class="name">Hivemind</span>
          <span class="env">dev</span>
        </div>
        <div class="spacer"></div>
        <div class="user">
          <i class="pi pi-user"></i>
          <span class="email">{{ email() }}</span>
          <button class="logout" (click)="logout()" title="Se déconnecter">
            <i class="pi pi-sign-out"></i>
          </button>
        </div>
      </header>

      <aside class="sidebar">
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <i class="pi pi-th-large"></i>
            <span>Tableau de bord</span>
          </a>
        </nav>
        <div class="nav-group-label">Ressources</div>
        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
              <i class="pi" [class]="item.icon"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        @if (isAdmin()) {
          <div class="nav-group-label">Administration</div>
          <nav>
            @for (item of adminNav; track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" class="nav-item">
                <i class="pi" [class]="item.icon"></i>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        }

        @if (ctx.clusters().length > 0) {
          <div class="cluster-picker">
            <div class="nav-group-label">Cluster actif</div>
            <p-select
              [options]="clusterPickerOptions()"
              [ngModel]="ctx.selectedId()"
              (ngModelChange)="ctx.select($event)"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              styleClass="cluster-select"
            >
              <ng-template #selectedItem let-opt>
                <span class="cluster-trigger"><i class="pi pi-server"></i>{{ opt.label }}</span>
              </ng-template>
            </p-select>
          </div>
        }
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        display: grid;
        grid-template-columns: var(--hm-sidebar-w) 1fr;
        grid-template-rows: var(--hm-header-h) 1fr;
        grid-template-areas:
          'top top'
          'side main';
        height: 100vh;
      }
      .topbar {
        grid-area: top;
        background: var(--hm-header-bg);
        color: #fff;
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 10px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .brand .logo {
        width: 22px;
        height: 22px;
        display: block;
      }
      .brand .name {
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .brand .env {
        font-size: 10px;
        text-transform: uppercase;
        background: #c8790a;
        color: #fff;
        padding: 2px 6px;
        border-radius: 3px;
        letter-spacing: 0.06em;
      }
      .spacer {
        flex: 1;
      }
      .cluster-picker {
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid var(--hm-border);
      }
      .cluster-picker ::ng-deep .cluster-select {
        width: 100%;
      }
      .cluster-trigger {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cluster-trigger .pi {
        font-size: 13px;
        color: var(--hm-text-muted);
      }
      .user {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #cdd0da;
      }
      .user .logout {
        background: transparent;
        border: 0;
        color: #cdd0da;
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
      }
      .user .logout:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      .sidebar {
        grid-area: side;
        background: var(--hm-surface);
        border-right: 1px solid var(--hm-border);
        padding: 14px 10px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .nav-group-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--hm-text-muted);
        padding: 6px 10px;
      }
      .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 5px;
        color: var(--hm-text);
        font-size: 14px;
        margin-bottom: 2px;
        border-left: 3px solid transparent;
      }
      .nav-item:hover {
        background: var(--hm-bg);
      }
      .nav-item.active {
        background: var(--hm-primary);
        color: black;
        border-left-color: var(--hm-primary);
        font-weight: 600;
      }
      .nav-item .pi {
        font-size: 15px;
      }
      .content {
        grid-area: main;
        overflow-y: auto;
        background: var(--hm-bg);
      }
    `,
  ],
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly ctx = inject(ClusterContextService);

  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly isAdmin = this.auth.isAdmin;

  /** "All clusters" plus one entry per cluster, for the header picker. */
  readonly clusterPickerOptions = computed(() => [
    { label: 'Tous les clusters', value: null },
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
