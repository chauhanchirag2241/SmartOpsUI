import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import { AcademicYearFilter } from '../../shared/enums/table-filters.enum';

export interface CurrentAcademicYear {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface AcademicYearDropdownItem {
  id: string;
  name: string;
  isCurrent: boolean;
}

function resolveFilter(label: string): AcademicYearFilter {
  switch (label) {
    case 'Active':
      return AcademicYearFilter.Active;
    case 'Inactive':
      return AcademicYearFilter.Inactive;
    case 'Current':
      return AcademicYearFilter.Current;
    default:
      return AcademicYearFilter.All;
  }
}

@Injectable({ providedIn: 'root' })
export class AcademicYearService {
  private readonly api = inject(ApiService);

  getAcademicYears(
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = 'All',
  ): Observable<unknown> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('filter', resolveFilter(filter).toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }

    return this.api.get('academicYears', params);
  }

  getCurrentAcademicYear(): Observable<CurrentAcademicYear> {
    return this.api.get<CurrentAcademicYear>('academic-year/current');
  }

  getAcademicYearDropdown(): Observable<AcademicYearDropdownItem[]> {
    return this.api.get<AcademicYearDropdownItem[]>('academic-year/dropdown');
  }

  setCurrentAcademicYear(id: string): Observable<void> {
    return this.api.put(`academicYears/${id}/set-current`, {});
  }

  createAcademicYear(data: unknown): Observable<unknown> {
    return this.api.post('academicYears', data);
  }

  getAcademicYearById(id: string): Observable<unknown> {
    return this.api.get(`academicYears/${id}`);
  }

  updateAcademicYear(id: string, data: unknown): Observable<unknown> {
    return this.api.put(`academicYears/${id}`, { ...(data as object), id });
  }

  deleteAcademicYear(id: string): Observable<unknown> {
    return this.api.delete(`academicYears/${id}`);
  }

  getSemesters(academicYearId: string): Observable<unknown[]> {
    return this.api.get<unknown[]>(`academicYears/${academicYearId}/semesters`);
  }

  saveSemesters(academicYearId: string, semesters: unknown[]): Observable<void> {
    return this.api.put(`academicYears/${academicYearId}/semesters`, { semesters });
  }
}
