import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AcademicYearService, CurrentAcademicYear, AcademicYearDropdownItem } from './academic-year.service';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

const SELECTED_YEAR_KEY = 'erp_selected_academic_year';

@Injectable({ providedIn: 'root' })
export class AcademicYearContextService {
  private readonly ayService = inject(AcademicYearService);
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);

  private readonly _currentYear = signal<CurrentAcademicYear | null>(null);
  private readonly _selectedYearId = signal<string | null>(this.readStoredYearId());
  private readonly _dropdownYears = signal<AcademicYearDropdownItem[]>([]);

  readonly currentYear = this._currentYear.asReadonly();
  readonly selectedYearId = this._selectedYearId.asReadonly();
  readonly dropdownYears = this._dropdownYears.asReadonly();

  effectiveYearId(): string | null {
    if (this.canSwitchYear() && this._selectedYearId()) {
      return this._selectedYearId();
    }
    return this._currentYear()?.id ?? this._selectedYearId();
  }

  /** Viewing a past/future year in the header — no add/edit/delete (API enforces too). */
  isReadOnlyScope(): boolean {
    const currentId = this._currentYear()?.id;
    const effectiveId = this.effectiveYearId();
    if (!currentId || !effectiveId) {
      return false;
    }
    return effectiveId !== currentId;
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

  loadDropdown(): Observable<AcademicYearDropdownItem[]> {
    return this.ayService.getAcademicYearDropdown().pipe(
      tap((items) => this._dropdownYears.set(items ?? [])),
    );
  }

  setSelectedYearId(yearId: string): void {
    if (!this.canSwitchYear()) {
      return;
    }
    this._selectedYearId.set(yearId);
    this.persistYearId(yearId);
  }

  clear(): void {
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
