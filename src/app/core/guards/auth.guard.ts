import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn) {
    return router.createUrlTree(['/auth/login']);
  }

  const requiredRoles = (route.data['roles'] as string[] | undefined) ?? [];
  if (requiredRoles.length && !requiredRoles.includes(auth.userRole)) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
