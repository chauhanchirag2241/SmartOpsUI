import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { IDashboardSummary, IUserScope } from '../models/scope.model';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

const SCOPES_KEY = 'erp_scopes';

@Injectable({ providedIn: 'root' })
export class ScopeService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);

  private readonly scopeSubject = new BehaviorSubject<IUserScope | null>(
    this.storage.get<IUserScope>(SCOPES_KEY),
  );

  readonly scope$ = this.scopeSubject.asObservable();

  get scope(): IUserScope | null {
    return this.scopeSubject.value;
  }

  get isGlobalScope(): boolean {
    return this.scope?.isGlobalScope ?? false;
  }

  loadScopes(): Observable<IUserScope> {
    return this.api.get<IUserScope>('auth/scopes').pipe(
      tap((scopes) => this.setScope(scopes)),
    );
  }

  loadDashboardSummary(): Observable<IDashboardSummary> {
    return this.api.get<IDashboardSummary>('dashboard/summary');
  }

  setScope(scope: IUserScope): void {
    this.storage.set(SCOPES_KEY, scope);
    this.scopeSubject.next(scope);
  }

  clear(): void {
    this.storage.remove(SCOPES_KEY);
    this.scopeSubject.next(null);
  }

  hasClassAccess(classId: string): boolean {
    if (this.isGlobalScope) {
      return true;
    }
    return this.scope?.allowedClassIds.includes(classId) ?? false;
  }

  allowedClassIds(): string[] {
    return this.scope?.allowedClassIds ?? [];
  }
}
