import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const academicYearReadOnlyInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(NotificationService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 403) {
        const body = err.error as { code?: string; message?: string } | string | null;
        const code = typeof body === 'object' && body && 'code' in body ? body.code : undefined;
        if (code === 'ACADEMIC_YEAR_READ_ONLY') {
          const msg =
            typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
              ? body.message
              : 'Changes are not allowed for past academic years.';
          snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'snack-warning' });
        }
      }
      return throwError(() => err);
    }),
  );
};
