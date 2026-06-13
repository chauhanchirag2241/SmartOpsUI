import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, map, switchMap, tap } from 'rxjs';
import { ScopeService } from './scope.service';
import { IMenu } from '../models/menu.model';
import { IMenuPermission, IUserPermissionResponse } from '../models/permission.model';
import { APP_MENU_APPLICATION } from '../constants/app.constants';
import { canonicalMenuCode } from '../constants/menu-code-aliases';
import { resolveMenuRoute } from '../constants/menu-routes';
import { isUsableAccessToken } from '../utils/token.util';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

const PERMISSIONS_KEY = 'erp_permissions';
const MENUS_KEY = 'erp_menus';
const APP_QUERY = `app=${APP_MENU_APPLICATION}`;

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly scopeService = inject(ScopeService);
  private static readonly tokenKey = 'erp_token';

  private readonly permissionsSubject = new BehaviorSubject<IMenuPermission[]>(
    this.readCachedPermissions(),
  );
  private readonly menusSubject = new BehaviorSubject<IMenu[]>(this.readCachedMenus());

  readonly permissions$ = this.permissionsSubject.asObservable();
  readonly menus$ = this.menusSubject.asObservable();

  get permissions(): IMenuPermission[] {
    return this.permissionsSubject.value;
  }

  get menus(): IMenu[] {
    return this.menusSubject.value;
  }

  loadSession(): Observable<void> {
    return forkJoin({
      permissions: this.api.get<IUserPermissionResponse>(`auth/permissions?${APP_QUERY}`),
      menus: this.api.get<IMenu[]>(`menus/my?${APP_QUERY}`),
    }).pipe(
      tap(({ permissions, menus }) => {
        this.setSession(
          this.normalizePermissions(permissions),
          this.normalizeMenus(menus),
        );
      }),
      switchMap(() => this.scopeService.loadScopes()),
      map(() => void 0),
    );
  }

  setSession(permissions: IMenuPermission[], menus: IMenu[]): void {
    const normalizedPermissions = this.normalizePermissions(permissions);
    const normalizedMenus = this.normalizeMenus(menus);
    this.storage.set(PERMISSIONS_KEY, normalizedPermissions);
    this.storage.set(MENUS_KEY, normalizedMenus);
    this.permissionsSubject.next(normalizedPermissions);
    this.menusSubject.next(normalizedMenus);
  }

  /** Absolute app route for sidebar / deep links. */
  resolveRoute(menu: IMenu): string | null {
    return resolveMenuRoute(menu.code, menu.route);
  }

  clear(): void {
    this.storage.remove(PERMISSIONS_KEY);
    this.storage.remove(MENUS_KEY);
    this.scopeService.clear();
    this.permissionsSubject.next([]);
    this.menusSubject.next([]);
  }

  getPermission(menuCode: string): IMenuPermission | undefined {
    const code = canonicalMenuCode(menuCode);
    return this.permissions.find((p) => canonicalMenuCode(p.menuCode) === code);
  }

  canView(menuCode: string): boolean {
    const code = canonicalMenuCode(menuCode);
    if (this.getPermission(code)?.canView) {
      return true;
    }
    // menus/my already requires canview in the API; use the tree when the permissions payload is stale.
    return this.hasMenuInTree(code);
  }

  private hasMenuInTree(menuCode: string): boolean {
    const code = canonicalMenuCode(menuCode);
    const walk = (items: IMenu[]): boolean =>
      items.some((item) => {
        if (canonicalMenuCode(item.code) === code) {
          return true;
        }
        return walk(item.children ?? []);
      });
    return walk(this.menus);
  }

  canAdd(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canAdd ?? false;
  }

  canEdit(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canEdit ?? false;
  }

  private hasStoredToken(): boolean {
    return isUsableAccessToken(this.storage.get<string>(PermissionService.tokenKey));
  }

  private readCachedPermissions(): IMenuPermission[] {
    const raw = this.hasStoredToken() ? (this.storage.get<IMenuPermission[]>(PERMISSIONS_KEY) ?? []) : [];
    return this.normalizePermissions(raw);
  }

  private readCachedMenus(): IMenu[] {
    const raw = this.hasStoredToken() ? (this.storage.get<IMenu[]>(MENUS_KEY) ?? []) : [];
    return this.normalizeMenus(raw);
  }

  private normalizePermissions(raw: IUserPermissionResponse | IMenuPermission[]): IMenuPermission[] {
    const list = Array.isArray(raw)
      ? raw
      : ((raw as IUserPermissionResponse).permissions
          ?? (raw as unknown as Record<string, unknown>)['Permissions']
          ?? []);
    const merged = new Map<string, IMenuPermission>();

    for (const p of list as unknown as Record<string, unknown>[]) {
      const menuCode = canonicalMenuCode(String(p['menuCode'] ?? p['MenuCode'] ?? ''));
      if (!menuCode) {
        continue;
      }

      const existing = merged.get(menuCode);
      const next: IMenuPermission = {
        menuCode,
        canView: !!(p['canView'] ?? p['CanView']),
        canAdd: !!(p['canAdd'] ?? p['CanAdd']),
        canEdit: !!(p['canEdit'] ?? p['CanEdit']),
        canDelete: !!(p['canDelete'] ?? p['CanDelete']),
        canExport: !!(p['canExport'] ?? p['CanExport']),
      };

      if (!existing) {
        merged.set(menuCode, next);
        continue;
      }

      merged.set(menuCode, {
        menuCode,
        canView: existing.canView || next.canView,
        canAdd: existing.canAdd || next.canAdd,
        canEdit: existing.canEdit || next.canEdit,
        canDelete: existing.canDelete || next.canDelete,
        canExport: existing.canExport || next.canExport,
      });
    }

    return Array.from(merged.values());
  }

  private normalizeMenus(raw: unknown): IMenu[] {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item) => this.normalizeMenu(item as Record<string, unknown>));
  }

  private normalizeMenu(raw: Record<string, unknown>): IMenu {
    const children = (raw['children'] ?? raw['Children'] ?? []) as Record<string, unknown>[];
    const code = canonicalMenuCode(String(raw['code'] ?? raw['Code'] ?? ''));
    const routeRaw = (raw['route'] ?? raw['Route']) as string | null | undefined;
    return {
      id: String(raw['id'] ?? raw['Id'] ?? ''),
      name: String(raw['name'] ?? raw['Name'] ?? ''),
      code,
      route: resolveMenuRoute(code, routeRaw),
      icon: (raw['icon'] ?? raw['Icon']) as string | null,
      displayOrder: Number(raw['displayOrder'] ?? raw['DisplayOrder'] ?? 0),
      children: children.map((c) => this.normalizeMenu(c)),
    };
  }

  canDelete(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canDelete ?? false;
  }

  canExport(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canExport ?? false;
  }
}
