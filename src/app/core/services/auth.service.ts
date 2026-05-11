import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
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
}
