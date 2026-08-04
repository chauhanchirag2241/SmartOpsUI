import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export type RoutePermissionAction = 'view' | 'add' | 'edit' | 'delete' | 'export';

export const permissionGuard: CanActivateFn = (route) => {
  const permissions = inject(PermissionService);
  const router = inject(Router);

  const menuCode = route.data['menuCode'] as string | undefined;
  const action = (route.data['permission'] as RoutePermissionAction | undefined) ?? 'view';

  if (!menuCode) {
    return true;
  }

  const allowed = permissions.canAccess(menuCode, action);

  return allowed ? true : router.createUrlTree(['/dashboard']);
};
