import { HttpContextToken } from '@angular/common/http';

/** Set on a request to skip the global SmartOps loader overlay. */
export const SKIP_GLOBAL_LOADER = new HttpContextToken<boolean>(() => false);
