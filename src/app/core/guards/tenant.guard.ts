import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';

export const tenantGuard: CanActivateFn = () => {
  const tenant = inject(TenantService);
  const router = inject(Router);

  if (tenant.isReady) {
    return true;
  }

  void router.navigate(['/auth/login']);
  return false;
};
