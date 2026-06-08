import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { IRoleDashboardWidgetPermission, IRoleMenuPermission } from '../models/permission.model';
import type { SchoolUserDto } from './user.service';

export interface RoleDto {
  id: string;
  name: string;
  code: string;
  description?: string;
  menuPermissions: IRoleMenuPermission[];
  dashboardWidgetPermissions?: IRoleDashboardWidgetPermission[];
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiService);

  getRoles(): Observable<RoleDto[]> {
    return this.api.get<RoleDto[]>('roles');
  }

  createRole(payload: {
    name: string;
    code: string;
    description?: string;
    menuPermissions: IRoleMenuPermission[];
    dashboardWidgetPermissions?: IRoleDashboardWidgetPermission[];
  }): Observable<RoleDto> {
    return this.api.post<RoleDto>('roles', payload);
  }

  updateRole(
    id: string,
    payload: { name: string; code: string; description?: string; isActive: boolean },
  ): Observable<void> {
    return this.api.put<void>(`roles/${id}`, payload);
  }

  getRole(id: string): Observable<RoleDto> {
    return this.api.get<RoleDto>(`roles/${id}`);
  }

  getMenuTemplates(): Observable<IRoleMenuPermission[]> {
    return this.api.get<IRoleMenuPermission[]>('menus/all');
  }

  updateRolePermissions(roleId: string, permissions: IRoleMenuPermission[]): Observable<void> {
    return this.api.put<void>(`roles/${roleId}/permissions`, { permissions });
  }

  getDashboardWidgetTemplates(): Observable<IRoleDashboardWidgetPermission[]> {
    return this.api.get<IRoleDashboardWidgetPermission[]>('menus/dashboard-widgets');
  }

  updateRoleDashboardWidgets(
    roleId: string,
    permissions: IRoleDashboardWidgetPermission[],
  ): Observable<void> {
    return this.api.put<void>(`roles/${roleId}/dashboard-widgets`, { permissions });
  }

  getUsersInRole(roleId: string): Observable<SchoolUserDto[]> {
    return this.api.get<SchoolUserDto[]>(`roles/${roleId}/users`);
  }

  assignUsersToRole(roleId: string, userIds: string[]): Observable<void> {
    return this.api.put<void>(`roles/${roleId}/users`, { userIds });
  }
}
