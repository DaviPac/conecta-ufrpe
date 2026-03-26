import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
// 1. Adicione o withInMemoryScrolling na importação do router
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { provideMarkdown } from 'ngx-markdown';

export const appConfig: ApplicationConfig = {
  providers: [
    provideMarkdown(),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),

    // 2. Adicione a configuração dentro do provideRouter
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    providePrimeNG({
      theme: {
        preset: Aura,
      },
    }),
  ],
};
