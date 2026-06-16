import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.Dashboard),
      },
      {
        path: 'hives',
        loadComponent: () => import('./features/hive/hives.component').then((m) => m.Hives),
      },
      {
        path: 'hives/:id',
        loadComponent: () => import('./features/hive/hive-detail.component').then((m) => m.HiveDetail),
      },
      {
        path: 'services',
        loadComponent: () => import('./features/service/services.component').then((m) => m.Services),
      },
      {
        path: 'services/:id',
        loadComponent: () => import('./features/service/service-detail.component').then((m) => m.ServiceDetail),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'general' },
          {
            path: 'general',
            loadComponent: () => import('./features/service/service-tab-general.component').then((m) => m.ServiceTabGeneral),
          },
          {
            path: 'supervision',
            loadComponent: () => import('./features/service/service-tab-supervision.component').then((m) => m.ServiceTabSupervision),
          },
          {
            path: 'deployments',
            loadComponent: () => import('./features/service/service-tab-deployments.component').then((m) => m.ServiceTabDeployments),
          },
          {
            path: 'logs',
            loadComponent: () => import('./features/service/service-tab-logs.component').then((m) => m.ServiceTabLogs),
          },
          {
            path: 'variables',
            loadComponent: () => import('./features/service/service-tab-variables.component').then((m) => m.ServiceTabVariables),
          },
          {
            path: 'resources',
            loadComponent: () => import('./features/service/service-tab-resources.component').then((m) => m.ServiceTabResources),
          },
          {
            path: 'mounts',
            loadComponent: () => import('./features/service/service-tab-mounts.component').then((m) => m.ServiceTabMounts),
          },
          {
            path: 'snapshots',
            loadComponent: () => import('./features/service/service-tab-snapshots.component').then((m) => m.ServiceTabSnapshots),
          },
        ],
      },
      {
        path: 'networks',
        loadComponent: () => import('./features/network/networks.component').then((m) => m.Networks),
      },
      {
        path: 'volumes',
        loadComponent: () => import('./features/volume/volumes.component').then((m) => m.Volumes),
      },
      {
        path: 'secrets',
        loadComponent: () => import('./features/secret/secrets.component').then((m) => m.Secrets),
      },
      {
        path: 'configs',
        loadComponent: () => import('./features/config/configs.component').then((m) => m.Configs),
      },
      {
        path: 'templates',
        loadComponent: () => import('./features/template/templates.component').then((m) => m.Templates),
      },
      {
        path: 'deployments',
        loadComponent: () => import('./features/deployment/deployments.component').then((m) => m.Deployments),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/user/users.component').then((m) => m.Users),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
