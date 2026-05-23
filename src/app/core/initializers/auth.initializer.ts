import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Drop stale cached user/menus when there is no valid access token. */
export function authInitializer(): () => void {
  const auth = inject(AuthService);
  return () => auth.ensureValidSessionOrClear();
}
