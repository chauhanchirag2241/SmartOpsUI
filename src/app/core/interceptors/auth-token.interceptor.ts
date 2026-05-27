import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { isUsableAccessToken } from '../utils/token.util';

function isAuthApiUrl(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token && !isUsableAccessToken(token) && !isAuthApiUrl(req.url)) {
    auth.expireSession();
    return EMPTY;
  }

  if (!isUsableAccessToken(token)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
