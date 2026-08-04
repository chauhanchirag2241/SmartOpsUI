import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { User, UserRole } from '../models/user.model';
import { LoginResponse, UserProfile } from '../models/login-response.model';
import { isUsableAccessToken } from '../utils/token.util';
import { ApiService } from './api.service';
import { PermissionService } from './permission.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly permissionService = inject(PermissionService);
  private readonly tokenKey = 'erp_token';
  private readonly userKey = 'erp_user';
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
  private sessionExpireInProgress = false;

  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor() {
    this.ensureValidSessionOrClear();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return isUsableAccessToken(this.getToken());
  }

  get mustChangePassword(): boolean {
    return !!this.currentUser?.mustChangePassword;
  }

  /** Clear cached session when token is missing, expired, or corrupt. */
  ensureValidSessionOrClear(): void {
    const token = this.getToken();
    if (!isUsableAccessToken(token)) {
      this.permissionService.clear();
      this.clearSessionStorage();
      this.currentUserSubject.next(null);
      return;
    }

    const user = this.storage.get<User>(this.userKey);
    this.currentUserSubject.next(user ? { ...user, token } : null);
  }

  get userRole(): string {
    return this.currentUser?.role ?? '';
  }

  loginWithApi(email: string, password: string): Observable<{ mustChangePassword: boolean }> {
    return this.api.post<LoginResponse>('auth/login', { email, password }).pipe(
      switchMap((raw) => {
        const accessToken = this.resolveAccessToken(raw);
        if (!isUsableAccessToken(accessToken)) {
          return throwError(() => new Error('Login succeeded but no access token was returned.'));
        }
        this.storage.set(this.tokenKey, accessToken);
        return this.api.get<UserProfile>('auth/me').pipe(
          map((profile) => ({
            accessToken,
            profile,
            mustChangePassword: !!(raw.mustChangePassword ?? profile.mustChangePassword),
          })),
        );
      }),
      tap(({ accessToken, profile, mustChangePassword }) => {
        const user = this.mapProfileToUser(profile, mustChangePassword);
        this.login(user, accessToken);
      }),
      switchMap(({ mustChangePassword }) =>
        this.permissionService.loadSession().pipe(
          map(() => ({ mustChangePassword })),
          catchError(() => of({ mustChangePassword })),
        ),
      ),
      catchError((err) => throwError(() => err)),
    );
  }

  changePassword(oldPassword: string, newPassword: string, confirmNewPassword: string): Observable<void> {
    return this.api
      .post<void>('auth/change-password', { oldPassword, newPassword, confirmNewPassword })
      .pipe(
        tap(() => {
          const user = this.currentUser;
          if (user) {
            const updated = { ...user, mustChangePassword: false };
            this.storage.set(this.userKey, updated);
            this.currentUserSubject.next(updated);
          }
        }),
        switchMap(() => this.permissionService.loadSession()),
        map(() => undefined),
      );
  }

  login(user: User, token: string): void {
    this.storage.set(this.tokenKey, token);
    this.storage.set(this.userKey, { ...user, token });
    this.currentUserSubject.next({ ...user, token });
  }

  logout(): void {
    this.permissionService.clear();
    this.storage.clear();
    this.currentUserSubject.next(null);
    void this.router.navigate(['/auth/login']);
  }

  /** Clear session and go to login (e.g. expired or invalid token). */
  expireSession(): void {
    if (this.sessionExpireInProgress) {
      return;
    }
    this.sessionExpireInProgress = true;
    this.permissionService.clear();
    this.clearSessionStorage();
    this.currentUserSubject.next(null);
    void this.router
      .navigate(['/auth/login'], {
        queryParams: { sessionExpired: '1' },
        replaceUrl: true,
      })
      .finally(() => {
        this.sessionExpireInProgress = false;
      });
  }

  getToken(): string | null {
    const token = this.storage.get<string>(this.tokenKey);
    return typeof token === 'string' ? token.trim() : null;
  }

  private clearSessionStorage(): void {
    this.storage.remove(this.tokenKey);
    this.storage.remove(this.userKey);
  }

  private resolveAccessToken(raw: LoginResponse | Record<string, unknown>): string {
    const record = raw as Record<string, unknown>;
    const candidate = record['accessToken'] ?? record['AccessToken'];
    return typeof candidate === 'string' ? candidate : '';
  }

  hasRole(role: string): boolean {
    const roles = this.currentUser?.roles ?? [];
    return roles.includes(role) || this.currentUser?.role === role;
  }

  private mapProfileToUser(profile: UserProfile, mustChangePassword = false): User {
    const roles = profile.roles ?? [];
    const primaryRole = roles[0] ?? 'School Admin';
    return {
      id: profile.id,
      name: profile.username || profile.email,
      email: profile.email,
      role: this.mapRole(primaryRole),
      roles,
      roleId: profile.roleId,
      mustChangePassword: mustChangePassword || !!profile.mustChangePassword,
    };
  }

  private mapRole(role?: string): UserRole {
    const normalized = role ?? '';
    const known: UserRole[] = ['teacher', 'admin', 'Admin', 'Accountant', 'SmartOpsAdmin', 'School Admin'];
    if (known.includes(normalized as UserRole)) {
      return normalized as UserRole;
    }
    return 'admin';
  }
}
