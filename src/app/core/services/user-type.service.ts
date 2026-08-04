import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface UserTypeDto {
  id: string;
  code: string;
  name: string;
}

/** Platform-only type for SmartOpsAdmin — never listed in portal dropdowns. */
const HIDDEN_USER_TYPE_NAMES = new Set(['admin']);
const HIDDEN_USER_TYPE_IDS = new Set(['30000000-0000-0000-0000-000000000001']);

export function isHiddenPortalUserType(type: {
  id?: string | null;
  code?: string | null;
  name?: string | null;
}): boolean {
  const id = String(type.id ?? '').trim().toLowerCase();
  if (HIDDEN_USER_TYPE_IDS.has(id)) {
    return true;
  }
  const label = String(type.code ?? type.name ?? '')
    .trim()
    .toLowerCase();
  return HIDDEN_USER_TYPE_NAMES.has(label);
}

@Injectable({ providedIn: 'root' })
export class UserTypeService {
  private readonly api = inject(ApiService);

  getUserTypes(): Observable<UserTypeDto[]> {
    return this.api
      .get<UserTypeDto[]>('user-types')
      .pipe(map((types) => (types ?? []).filter((t) => !isHiddenPortalUserType(t))));
  }
}
