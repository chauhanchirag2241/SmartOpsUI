import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, switchMap, tap, throwError } from 'rxjs';
import { User, UserRole } from '../models/user.model';
import { LoginResponse, UserProfile } from '../models/login-response.model';
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
  private readonly currentUserSubject = new BehaviorSubject<User | null>(
    this.storage.get<User>(this.userKey),
  );

  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.storage.get<string>(this.tokenKey);
  }

  get userRole(): string {
    return this.currentUser?.role ?? '';
  }

  loginWithApi(email: string, password: string): Observable<void> {
    return this.api.post<LoginResponse>('auth/login', { email, password }).pipe(
      switchMap((tokens) => {
        this.storage.set(this.tokenKey, tokens.accessToken);
        return this.api.get<UserProfile>('auth/me').pipe(map((profile) => ({ tokens, profile })));
      }),
      tap(({ tokens, profile }) => {
        const user = this.mapProfileToUser(profile);
        this.login(user, tokens.accessToken);
      }),
      switchMap(() => this.permissionService.loadSession()),
      map(() => undefined),
      catchError((err) => throwError(() => err)),
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

  getToken(): string | null {
    return this.storage.get<string>(this.tokenKey);
  }

  hasRole(role: string): boolean {
    const roles = this.currentUser?.roles ?? [];
    return roles.includes(role) || this.currentUser?.role === role;
  }

  private mapProfileToUser(profile: UserProfile): User {
    const roles = profile.roles ?? [];
    const primaryRole = roles[0] ?? 'Admin';
    return {
      id: profile.id,
      name: profile.username || profile.email,
      email: profile.email,
      role: this.mapRole(primaryRole),
      roles,
      roleId: profile.roleId,
      roleCode: profile.roleCode,
    };
  }

  private mapRole(role?: string): UserRole {
    const normalized = role ?? '';
    const known: UserRole[] = ['teacher', 'student', 'parent', 'admin', 'Admin', 'Accountant'];
    if (known.includes(normalized as UserRole)) {
      return normalized as UserRole;
    }
    return 'admin';
  }
}
