import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SchoolConfigService } from '../services/school-config.service';
import { TenantService } from '../services/tenant.service';

export const tenantGuard: CanActivateFn = async () => {
  const tenant = inject(TenantService);
  const schoolConfig = inject(SchoolConfigService);
  const router = inject(Router);

  if (tenant.isReady) {
    return true;
  }

  if (tenant.loadError) {
    return router.createUrlTree(['/auth/login']);
  }

  await schoolConfig.loadForCurrentHost();

  if (tenant.isReady) {
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
