import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import { authInitializer } from './core/initializers/auth.initializer';
import { authErrorInterceptor } from './core/interceptors/auth-error.interceptor';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { tenantInterceptor } from './core/interceptors/tenant.interceptor';
import { academicYearInterceptor } from './core/interceptors/academic-year.interceptor';
import { academicYearReadOnlyInterceptor } from './core/interceptors/academic-year-readonly.interceptor';
import { academicYearScopeTransitionInterceptor } from './core/interceptors/academic-year-scope-transition.interceptor';
import { DD_MM_YYYY_DATE_FORMATS, DdMmYyyyDateAdapter } from './shared/date/dd-mm-yyyy-date-adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideHttpClient(
      withInterceptors([
        academicYearScopeTransitionInterceptor,
        loadingInterceptor,
        tenantInterceptor,
        academicYearInterceptor,
        academicYearReadOnlyInterceptor,
        authTokenInterceptor,
        authErrorInterceptor,
      ]),
    ),
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    { provide: APP_INITIALIZER, useFactory: authInitializer, multi: true },
    { provide: DateAdapter, useClass: DdMmYyyyDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_DATE_FORMATS },
  ],
};
