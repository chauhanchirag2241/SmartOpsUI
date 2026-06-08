import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  getUsers(): Observable<SchoolUserDto[]> {
    return this.api.get<SchoolUserDto[]>('users');
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
