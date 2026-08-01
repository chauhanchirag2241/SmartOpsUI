import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AcademicYearContextService } from '../services/academic-year-context.service';

export const academicYearInterceptor: HttpInterceptorFn = (req, next) => {
  // Allow callers (e.g. promote-students) to scope a request to a specific year.
  if (req.headers.has('X-Academic-Year-Id')) {
    return next(req);
  }

  const ctx = inject(AcademicYearContextService);
  const yearId = ctx.effectiveYearId();

  if (!yearId) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { 'X-Academic-Year-Id': yearId },
    }),
  );
};
