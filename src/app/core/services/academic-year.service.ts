import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import { AcademicYearFilter } from '../../shared/enums/table-filters.enum';

function resolveFilter(label: string): AcademicYearFilter {
  switch (label) {
    case 'Active': return AcademicYearFilter.Active;
    case 'Inactive': return AcademicYearFilter.Inactive;
    default: return AcademicYearFilter.All;
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
    filter: string = 'All'
  ): Observable<any> {
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

  getAcademicYearDropdown(): Observable<any[]> {
    return this.api.get<any[]>('academic-year/dropdown');
  }

  createAcademicYear(data: any): Observable<any> {
    return this.api.post('academicYears', data);
  }

  getAcademicYearById(id: string): Observable<any> {
    return this.api.get(`academicYears/${id}`);
  }

  updateAcademicYear(id: string, data: any): Observable<any> {
    return this.api.put(`academicYears/${id}`, { ...data, id });
  }

  deleteAcademicYear(id: string): Observable<any> {
    return this.api.delete(`academicYears/${id}`);
  }
}
