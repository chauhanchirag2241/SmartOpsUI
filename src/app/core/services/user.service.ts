import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface SchoolUserDto {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  lockoutEnabled?: boolean;
  userTypeId?: string;
  userTypeCode?: string;
  userTypeName?: string;
  roles: string[];
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password?: string;
  isActive: boolean;
  lockoutEnabled: boolean;
  userTypeId?: string;
  roleNames: string[];
}

export interface UpdateUserPayload {
  username: string;
  email: string;
  isActive: boolean;
  lockoutEnabled: boolean;
  userTypeId?: string;
}

/** Platform / SmartOps bootstrap accounts — never show in school portal user lists. */
const HIDDEN_PORTAL_USER_EMAILS = new Set(['admin@smartops.com']);
const HIDDEN_PORTAL_USERNAMES = new Set(['platform.admin']);

export function isHiddenPortalUser(user: {
  email?: string | null;
  username?: string | null;
  roles?: string[] | null;
  userTypeCode?: string | null;
}): boolean {
  const email = String(user.email ?? '').trim().toLowerCase();
  const username = String(user.username ?? '').trim().toLowerCase();
  if (HIDDEN_PORTAL_USER_EMAILS.has(email) || HIDDEN_PORTAL_USERNAMES.has(username)) {
    return true;
  }
  if (String(user.userTypeCode ?? '').trim().toLowerCase() === 'admin') {
    return true;
  }
  const roles = user.roles ?? [];
  return roles.some((r) => String(r).trim().toLowerCase() === 'smartopsadmin');
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  getUsers(): Observable<SchoolUserDto[]> {
    return this.api
      .get<SchoolUserDto[]>('users')
      .pipe(map((users) => (users ?? []).filter((u) => !isHiddenPortalUser(u))));
  }

  getUser(id: string): Observable<SchoolUserDto> {
    return this.api.get<SchoolUserDto>(`users/${id}`);
  }

  createUser(payload: CreateUserPayload): Observable<SchoolUserDto> {
    return this.api.post<SchoolUserDto>('users', payload);
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<void> {
    return this.api.put<void>(`users/${id}`, payload);
  }

  updateUserRoles(id: string, roleNames: string[]): Observable<void> {
    return this.api.put<void>(`users/${id}/roles`, { roleNames });
  }

  resetPassword(id: string, password: string): Observable<void> {
    return this.api.put<void>(`users/${id}/password`, { password });
  }
}
