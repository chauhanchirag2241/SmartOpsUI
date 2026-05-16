import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '../services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenant = inject(TenantService);
  const subdomain = tenant.subdomain;

  if (!subdomain) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { 'X-Tenant-ID': subdomain },
    }),
  );
};
