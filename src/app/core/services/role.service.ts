import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface RoleDto {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface PermissionDto {
  id: string;
  name: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiService);

  getRoles(): Observable<RoleDto[]> {
    return this.api.get<RoleDto[]>('roles');
  }

  getRole(id: string): Observable<RoleDto> {
    return this.api.get<RoleDto>(`roles/${id}`);
  }

  getPermissions(): Observable<PermissionDto[]> {
    return this.api.get<PermissionDto[]>('permissions');
  }

  updateRolePermissions(roleId: string, permissionNames: string[]): Observable<void> {
    return this.api.put<void>(`roles/${roleId}/permissions`, { permissionNames });
  }
}
