import {
  ApplicationConfig,
  importProvidersFrom,
  PLATFORM_ID,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { APP_INITIALIZER } from '@angular/core';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { NzConfig, NZ_CONFIG } from 'ng-zorro-antd/core/config';
import { isPlatformBrowser } from '@angular/common';
import { NzModalService } from 'ng-zorro-antd/modal';
import { AuthInterceptor } from './shared/Auth/auth.interceptor';
import { PerformanceInterceptor } from 'app/shared/interceptors/performance.interceptor';
import { NgxUiLoaderConfig, NgxUiLoaderHttpModule, NgxUiLoaderModule } from 'ngx-ui-loader';
import { NgxStripeModule } from 'ngx-stripe';
import { environment } from 'environments/environment';

registerLocaleData(en);

const ngZorroConfig: NzConfig = {
  theme: {
    primaryColor: '#0284c7',
  },
  notification:{
    nzPlacement: 'bottomRight'
  }
};

const ngxUiLoaderConfig: NgxUiLoaderConfig = {
  fgsType: 'ball-spin-clockwise',
  fgsSize: 60,
  fgsColor: '#007bff',
  hasProgressBar: false,
};

export function appInitializer(platformId: Object): () => Promise<void> {
  return () =>
    new Promise<void>((resolve) => {
      if (isPlatformBrowser(platformId)) {
        const globalLoader = document.getElementById('page-loading');
        if (globalLoader) {
          globalLoader.style.display = 'none';
        }

        if (typeof window !== 'undefined' && (window as any)._WebSocket) {

          const nativeWebSocket = (window as any)._WebSocket;
          if (nativeWebSocket !== window.WebSocket) {
            window.WebSocket = nativeWebSocket;
            console.log('AppConfig: Restored native WebSocket after pace.js conflict');
          }
        }

        const preloadLinks = [
          { rel: 'preload', href: '/assets/img/impact-health-logo-dark.png', as: 'image' }
        ];

        preloadLinks.forEach(link => {
          const linkElement = document.createElement('link');
          Object.assign(linkElement, link);
          document.head.appendChild(linkElement);
        });
      }
      resolve();
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    NzModalService,
    provideRouter(routes),
    provideClientHydration(),
    provideNzI18n(en_US),
    importProvidersFrom(FormsModule,
      NgxStripeModule.forRoot(environment.stripePublishableKey),
      NgxUiLoaderModule.forRoot(ngxUiLoaderConfig),
      NgxUiLoaderHttpModule.forRoot({
        showForeground: true,
        exclude: [

          'https://localhost:7039/api/Notifications/getAllNotifications',
          'https://localhost:7039/api/Subscriptions/getSubscriptionByFacilityId',
          'https://localhost:7039/api/Dropdowns/getAllUSCities',

          'https://crmxo.bitzage.com/api/Notifications/getAllNotifications',
          'https://crmxo.bitzage.com/api/Subscriptions/getSubscriptionByFacilityId'
        ]
      })
    ),
    provideAnimationsAsync(),
    provideHttpClient(
      withFetch(),
      withInterceptors([
        AuthInterceptor,
        PerformanceInterceptor
      ]),
      withInterceptorsFromDi()
    ),
    { provide: NZ_CONFIG, useValue: ngZorroConfig },
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializer,
      deps: [PLATFORM_ID],
      multi: true,
    },
  ],
};
