import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, map, tap } from 'rxjs';
import { IMenu } from '../models/menu.model';
import { IMenuPermission, IUserPermissionResponse } from '../models/permission.model';
import { APP_MENU_APPLICATION } from '../constants/app.constants';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

const PERMISSIONS_KEY = 'erp_permissions';
const MENUS_KEY = 'erp_menus';
const APP_QUERY = `app=${APP_MENU_APPLICATION}`;

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);

  private readonly permissionsSubject = new BehaviorSubject<IMenuPermission[]>(
    this.storage.get<IMenuPermission[]>(PERMISSIONS_KEY) ?? [],
  );
  private readonly menusSubject = new BehaviorSubject<IMenu[]>(this.storage.get<IMenu[]>(MENUS_KEY) ?? []);

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
        this.setSession(permissions.permissions, menus);
      }),
      map(() => void 0),
    );
  }

  setSession(permissions: IMenuPermission[], menus: IMenu[]): void {
    this.storage.set(PERMISSIONS_KEY, permissions);
    this.storage.set(MENUS_KEY, menus);
    this.permissionsSubject.next(permissions);
    this.menusSubject.next(menus);
  }

  clear(): void {
    this.storage.remove(PERMISSIONS_KEY);
    this.storage.remove(MENUS_KEY);
    this.permissionsSubject.next([]);
    this.menusSubject.next([]);
  }

  getPermission(menuCode: string): IMenuPermission | undefined {
    return this.permissions.find((p) => p.menuCode === menuCode);
  }

  canView(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canView ?? false;
  }

  canAdd(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canAdd ?? false;
  }

  canEdit(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canEdit ?? false;
  }

  canDelete(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canDelete ?? false;
  }

  canExport(menuCode: string): boolean {
    return this.getPermission(menuCode)?.canExport ?? false;
  }
}
