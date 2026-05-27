import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn) {
    const hadStoredToken = !!auth.getToken();
    auth.ensureValidSessionOrClear();
    return router.createUrlTree(['/auth/login'], {
      queryParams: hadStoredToken ? { sessionExpired: '1' } : undefined,
    });
  }

  const requiredRoles = (route.data['roles'] as string[] | undefined) ?? [];
  if (requiredRoles.length && !requiredRoles.some((r) => auth.hasRole(r))) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
