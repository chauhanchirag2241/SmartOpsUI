import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BranchContextService } from '../services/branch-context.service';

export const branchInterceptor: HttpInterceptorFn = (req, next) => {
  const ctx = inject(BranchContextService);
  const activeBranchId = ctx.activeBranchId();
  const selectedBranchIds = ctx.selectedBranchIds();

  const headers: Record<string, string> = {};

  if (activeBranchId) {
    headers['X-Branch-Id'] = activeBranchId;
  }

  if (selectedBranchIds.length > 0) {
    headers['X-Branch-Ids'] = selectedBranchIds.join(',');
  }

  if (Object.keys(headers).length === 0) {
    return next(req);
  }

  return next(req.clone({ setHeaders: headers }));
};
