import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { AcademicYearService, CurrentAcademicYear, AcademicYearDropdownItem } from './academic-year.service';
import { AuthService } from './auth.service';
import { LoaderService } from './loader.service';
import { StorageService } from './storage.service';

const SELECTED_YEAR_KEY = 'erp_selected_academic_year';

@Injectable({ providedIn: 'root' })
export class AcademicYearContextService {
  private readonly ayService = inject(AcademicYearService);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly loader = inject(LoaderService);

  private readonly _currentYear = signal<CurrentAcademicYear | null>(null);
  private readonly _selectedYearId = signal<string | null>(this.readStoredYearId());
  private readonly _dropdownYears = signal<AcademicYearDropdownItem[]>([]);
  private readonly _scopeTransitioning = signal(false);
  private readonly _routeEpoch = signal(0);

  private transitionToken = 0;
  private transitionHttpCount = 0;
  private awaitingRouteRequests = false;
  private transitionFinishTimer: ReturnType<typeof setTimeout> | undefined;

  readonly currentYear = this._currentYear.asReadonly();
  readonly selectedYearId = this._selectedYearId.asReadonly();
  readonly dropdownYears = this._dropdownYears.asReadonly();
  readonly scopeTransitioning = this._scopeTransitioning.asReadonly();

  /** Changes when header year changes — use to ignore stale HTTP responses. */
  readonly effectiveYearKey = computed(() => {
    if (this.canSwitchYear() && this._selectedYearId()) {
      return this._selectedYearId()!;
    }
    return this._currentYear()?.id ?? this._selectedYearId() ?? 'none';
  });

  /** Bumps on header year switch so router-outlet remounts the active screen. */
  readonly routeOutletKey = computed(() => `${this.effectiveYearKey()}-${this._routeEpoch()}`);

  effectiveYearId(): string | null {
    if (this.canSwitchYear() && this._selectedYearId()) {
      return this._selectedYearId();
    }
    return this._currentYear()?.id ?? this._selectedYearId();
  }

  /** Past academic year in the header — read-only. Current and future years allow add/edit. */
  isReadOnlyScope(): boolean {
    const current = this._currentYear();
    const effectiveId = this.effectiveYearId();
    if (!current?.id || !effectiveId || !current.startDate) {
      return false;
    }
    if (effectiveId === current.id) {
      return false;
    }
    const effectiveStart = this.resolveEffectiveStartDate(effectiveId);
    if (!effectiveStart) {
      return false;
    }
    return effectiveStart < current.startDate;
  }

  private resolveEffectiveStartDate(effectiveId: string): string | null {
    const fromDropdown = this._dropdownYears().find((y) => y.id === effectiveId);
    if (fromDropdown?.startDate) {
      return fromDropdown.startDate;
    }
    if (this._currentYear()?.id === effectiveId) {
      return this._currentYear()!.startDate;
    }
    return null;
  }

  effectiveYearLabel(): string {
    const id = this.effectiveYearId();
    if (!id) {
      return '';
    }
    const fromDropdown = this._dropdownYears().find((y) => y.id === id);
    if (fromDropdown) {
      return fromDropdown.name;
    }
    if (this._currentYear()?.id === id) {
      return this._currentYear()!.title;
    }
    return '';
  }

  canSwitchYear(): boolean {
    const roles = (this.auth.currentUser?.roles ?? []).map((r) => r.toUpperCase());
    const roleCode = this.auth.currentUser?.roleCode?.toUpperCase() ?? '';
    return (
      roles.includes('ADMIN') ||
      roles.includes('SCHOOL_ADMIN') ||
      roleCode === 'ADMIN' ||
      roleCode === 'SCHOOL_ADMIN'
    );
  }

  initialize(): Observable<unknown> {
    return this.ayService.getCurrentAcademicYear().pipe(
      tap((current) => {
        this._currentYear.set(current);
        if (!this.canSwitchYear()) {
          this._selectedYearId.set(current?.id ?? null);
          this.persistYearId(this._selectedYearId());
        } else if (!this._selectedYearId() && current?.id) {
          this._selectedYearId.set(current.id);
          this.persistYearId(current.id);
        }
      }),
    );
  }

  /** Header switcher: all active years (current, future, and archived). */
  loadDropdown(): Observable<AcademicYearDropdownItem[]> {
    const loadItems = () =>
      this.ayService.getAcademicYearDropdown('all').pipe(
        tap((items) => {
          this._dropdownYears.set(items ?? []);
          this.reconcileSelectedYearWithDropdown(items ?? []);
        }),
      );

    if (this._currentYear()) {
      return loadItems();
    }

    return this.initialize().pipe(switchMap(() => loadItems()));
  }

  private reconcileSelectedYearWithDropdown(allowed: AcademicYearDropdownItem[]): void {
    if (!this.canSwitchYear()) {
      return;
    }

    const selected = this._selectedYearId();
    if (selected && allowed.some((y) => y.id === selected)) {
      return;
    }

    const fallback = this._currentYear()?.id ?? allowed[0]?.id ?? null;
    if (fallback) {
      this.setSelectedYearId(fallback);
    }
  }

  setSelectedYearId(yearId: string): void {
    if (!this.canSwitchYear()) {
      return;
    }
    this._selectedYearId.set(yearId);
    this.persistYearId(yearId);
  }

  /** Switch header year without full page reload; shows loader until route data is ready. */
  switchAcademicYear(yearId: string): void {
    if (!this.canSwitchYear() || !yearId || yearId === this.effectiveYearId()) {
      return;
    }

    const token = ++this.transitionToken;
    this.clearTransitionFinishTimer();
    this.transitionHttpCount = 0;
    this.awaitingRouteRequests = false;
    this._scopeTransitioning.set(true);
    this.loader.showManualImmediate('Switching academic year...');
    this.setSelectedYearId(yearId);
    this._routeEpoch.update((n) => n + 1);

    // Routed screen is recreated via routeOutletKey on router-outlet; wait for its HTTP.
    queueMicrotask(() => {
      if (token !== this.transitionToken) {
        return;
      }
      this.awaitingRouteRequests = true;
      this.tryFinishScopeTransition(token);
    });

    setTimeout(() => {
      if (token === this.transitionToken && this._scopeTransitioning()) {
        this.endScopeTransition(token);
      }
    }, 30_000);
  }

  trackScopeTransitionRequestStart(): void {
    if (!this._scopeTransitioning()) {
      return;
    }
    this.transitionHttpCount++;
    this.clearTransitionFinishTimer();
  }

  trackScopeTransitionRequestEnd(): void {
    if (!this._scopeTransitioning()) {
      return;
    }
    this.transitionHttpCount = Math.max(0, this.transitionHttpCount - 1);
    this.tryFinishScopeTransition(this.transitionToken);
  }

  private tryFinishScopeTransition(token: number): void {
    if (token !== this.transitionToken || !this.awaitingRouteRequests) {
      return;
    }
    if (this.transitionHttpCount > 0 || this.loader.hasPendingHttp()) {
      return;
    }

    this.clearTransitionFinishTimer();
    this.transitionFinishTimer = setTimeout(() => {
      if (token !== this.transitionToken || this.transitionHttpCount > 0 || this.loader.hasPendingHttp()) {
        return;
      }
      this.endScopeTransition(token);
    }, 120);
  }

  private endScopeTransition(token: number): void {
    if (token !== this.transitionToken) {
      return;
    }
    this.clearTransitionFinishTimer();
    this.awaitingRouteRequests = false;
    this.transitionHttpCount = 0;
    this._scopeTransitioning.set(false);
    this.loader.hideManual();
  }

  private clearTransitionFinishTimer(): void {
    if (this.transitionFinishTimer) {
      clearTimeout(this.transitionFinishTimer);
      this.transitionFinishTimer = undefined;
    }
  }

  clear(): void {
    this.transitionToken++;
    this.clearTransitionFinishTimer();
    this._scopeTransitioning.set(false);
    this.loader.hideManual();
    this._currentYear.set(null);
    this._selectedYearId.set(null);
    this._dropdownYears.set([]);
    this.storage.remove(SELECTED_YEAR_KEY);
  }

  private persistYearId(yearId: string | null): void {
    if (yearId) {
      this.storage.set(SELECTED_YEAR_KEY, yearId);
    } else {
      this.storage.remove(SELECTED_YEAR_KEY);
    }
  }

  private readStoredYearId(): string | null {
    const raw = this.storage.get<string>(SELECTED_YEAR_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  }
}
