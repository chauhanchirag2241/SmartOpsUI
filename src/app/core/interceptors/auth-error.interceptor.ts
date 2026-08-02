import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function isAuthApiUrl(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

/**
 * Only unauthenticated (401) responses end the session.
 * 403 Forbidden means the user is signed in but lacks a permission —
 * logging out was kicking teachers to the login page on Students / Exams.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      if (err.status === 401 && !isAuthApiUrl(req.url)) {
        auth.expireSession();
        return EMPTY;
      }

      return throwError(() => err);
    }),
  );
};
