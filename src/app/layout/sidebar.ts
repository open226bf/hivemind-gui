import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { ClusterSwitcher } from './cluster-switcher';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

/** Primary navigation rail: resource links, an admin group, and the active
 *  cluster switcher pinned to the foot. */
@Component({
  selector: 'hm-sidebar',
  imports: [RouterLink, RouterLinkActive, ClusterSwitcher],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly isAdmin = inject(AuthService).isAdmin;

  readonly nav: NavItem[] = [
    { label: 'Ruches', icon: 'pi-box', path: '/hives' },
    { label: 'Services', icon: 'pi-server', path: '/services' },
    { label: 'Santé', icon: 'pi-heart', path: '/monitoring' },
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
}
