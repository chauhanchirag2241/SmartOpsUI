import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { SKIP_GLOBAL_LOADER } from '../http/loader-http.context';
import { LoaderService } from '../services/loader.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_GLOBAL_LOADER) || req.method === 'HEAD' || isAssetRequest(req.url)) {
    return next(req);
  }

  const loader = inject(LoaderService);
  loader.onRequestStart();

  return next(req).pipe(finalize(() => loader.onRequestEnd()));
};

function isAssetRequest(url: string): boolean {
  return url.includes('/assets/');
}
