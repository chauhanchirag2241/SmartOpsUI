import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { tenantInitializer } from './core/initializers/tenant.initializer';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { tenantInterceptor } from './core/interceptors/tenant.interceptor';
import { DD_MM_YYYY_DATE_FORMATS, DdMmYyyyDateAdapter } from './shared/date/dd-mm-yyyy-date-adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideHttpClient(withInterceptors([tenantInterceptor, authTokenInterceptor])),
    provideRouter(routes),
    { provide: APP_INITIALIZER, useFactory: tenantInitializer, multi: true },
    { provide: DateAdapter, useClass: DdMmYyyyDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_DATE_FORMATS },
  ]
};
