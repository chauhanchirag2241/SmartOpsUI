import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { IRoleDashboardWidgetPermission, IRoleMenuPermission } from '../models/permission.model';
import type { SchoolUserDto } from './user.service';
import { isHiddenPortalUser } from './user.service';

/** Platform role — never shown or assignable in the school portal UI. */
const HIDDEN_PORTAL_ROLES = new Set(['smartopsadmin']);

/** ConfigUI-only menus must not appear in school portal role screens. */
function isSchoolPortalMenu(p: IRoleMenuPermission): boolean {
  const app = String(p.application ?? '').trim().toUpperCase();
  return !app || app === 'SCHOOL' || app === 'COMMON';
}

function stripConfigMenus(role: RoleDto): RoleDto {
  return {
    ...role,
    menuPermissions: (role.menuPermissions ?? []).filter(isSchoolPortalMenu),
  };
}

export interface RoleDto {
  id: string;
  name: string;
  description?: string;
  menuPermissions: IRoleMenuPermission[];
  dashboardWidgetPermissions?: IRoleDashboardWidgetPermission[];
}

function isHiddenPortalRole(name: string | null | undefined): boolean {
  return HIDDEN_PORTAL_ROLES.has(String(name ?? '').trim().toLowerCase());
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiService);

  getRoles(): Observable<RoleDto[]> {
    return this.api.get<RoleDto[]>('roles').pipe(
      map((roles) =>
        (roles ?? []).filter((r) => !isHiddenPortalRole(r.name)).map(stripConfigMenus),
      ),
    );
  }

  createRole(payload: {
    name: string;
    description?: string;
    menuPermissions: IRoleMenuPermission[];
    dashboardWidgetPermissions?: IRoleDashboardWidgetPermission[];
  }): Observable<RoleDto> {
    return this.api.post<RoleDto>('roles', payload);
  }

  updateRole(
    id: string,
    payload: { name: string; description?: string; isActive: boolean },
  ): Observable<void> {
    return this.api.put<void>(`roles/${id}`, payload);
  }

  getRole(id: string): Observable<RoleDto> {
    return this.api.get<RoleDto>(`roles/${id}`).pipe(map((role) => stripConfigMenus(role)));
  }

  getMenuTemplates(): Observable<IRoleMenuPermission[]> {
    return this.api.get<IRoleMenuPermission[]>('menus/all', new HttpParams().set('app', 'SCHOOL'));
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
    return this.api
      .get<SchoolUserDto[]>(`roles/${roleId}/users`)
      .pipe(map((users) => (users ?? []).filter((u) => !isHiddenPortalUser(u))));
  }

  assignUsersToRole(roleId: string, userIds: string[]): Observable<void> {
    return this.api.put<void>(`roles/${roleId}/users`, { userIds });
  }
}
