import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { clusterInterceptor } from './core/cluster.interceptor';
import { HivemindPreset } from './theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, clusterInterceptor])),
    providePrimeNG({
      theme: {
        preset: HivemindPreset,
        options: { darkModeSelector: '.dark-mode' },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
