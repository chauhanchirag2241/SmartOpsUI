import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AcademicYearContextService } from '../services/academic-year-context.service';

export const academicYearInterceptor: HttpInterceptorFn = (req, next) => {
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
