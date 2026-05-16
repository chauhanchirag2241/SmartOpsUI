import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { User, UserRole } from '../models/user.model';
import { LoginResponse, UserProfile } from '../models/login-response.model';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly tokenKey = 'erp_token';
  private readonly userKey = 'erp_user';
  private readonly currentUserSubject = new BehaviorSubject<User | null>(
    this.storage.get<User>(this.userKey),
  );

  readonly currentUser$ = this.currentUserSubject.asObservable();

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
      map(({ tokens, profile }) => {
        const user = this.mapProfileToUser(profile);
        this.login(user, tokens.accessToken);
      }),
      catchError((err) => throwError(() => err)),
    );
  }

  login(user: User, token: string): void {
    this.storage.set(this.tokenKey, token);
    this.storage.set(this.userKey, { ...user, token });
    this.currentUserSubject.next({ ...user, token });
  }

  logout(): void {
    this.storage.clear();
    this.currentUserSubject.next(null);
    void this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this.storage.get<string>(this.tokenKey);
  }

  hasPermission(permission?: string): boolean {
    if (!permission) {
      return true;
    }
    const roles = this.currentUser?.roles ?? [];
    if (roles.includes('SchoolAdmin') || roles.includes('PlatformAdmin')) {
      return true;
    }
    const permissions = this.currentUser?.permissions ?? [];
    if (permissions.includes('admin.full')) {
      return true;
    }
    return permissions.includes(permission);
  }

  hasAnyPermission(...permissions: string[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  hasRole(role: string): boolean {
    const roles = this.currentUser?.roles ?? [];
    return roles.includes(role) || this.currentUser?.role === role;
  }

  private mapProfileToUser(profile: UserProfile): User {
    const roles = profile.roles ?? [];
    const permissions = profile.permissions ?? [];
    const primaryRole = roles[0] ?? 'SchoolAdmin';
    return {
      id: profile.id,
      name: profile.username || profile.email,
      email: profile.email,
      role: this.mapRole(primaryRole),
      roles,
      permissions,
    };
  }

  private mapRole(role?: string): UserRole {
    const normalized = role ?? '';
    const known: UserRole[] = ['teacher', 'student', 'parent', 'admin', 'SchoolAdmin', 'PlatformAdmin', 'Accountant'];
    if (known.includes(normalized as UserRole)) {
      return normalized as UserRole;
    }
    if (normalized === 'SchoolAdmin' || normalized === 'PlatformAdmin') {
      return normalized as UserRole;
    }
    return 'SchoolAdmin';
  }
}
