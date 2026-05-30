import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { AcademicYearContextService } from '../services/academic-year-context.service';

export const academicYearScopeTransitionInterceptor: HttpInterceptorFn = (req, next) => {
  const ayContext = inject(AcademicYearContextService);
  if (!ayContext.scopeTransitioning() || req.method === 'HEAD' || isAssetRequest(req.url)) {
    return next(req);
  }

  ayContext.trackScopeTransitionRequestStart();
  return next(req).pipe(finalize(() => ayContext.trackScopeTransitionRequestEnd()));
};

function isAssetRequest(url: string): boolean {
  return url.includes('/assets/');
}
