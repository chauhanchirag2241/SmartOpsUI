import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      const isAuthEndpoint =
        req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

      if ((err.status === 401 || err.status === 403) && !isAuthEndpoint && auth.isLoggedIn) {
        auth.logout();
        void router.navigate(['/auth/login'], {
          queryParams: { sessionExpired: '1' },
        });
      }

      return throwError(() => err);
    }),
  );
};
