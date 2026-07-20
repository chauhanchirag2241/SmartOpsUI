import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export interface PeriodDto {
  id?: string;
  name: string;
  shortName: string;
  periodOrder: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PeriodService {
  private readonly api = inject(ApiService);

  createPeriod(data: PeriodDto): Observable<{ message: string; periodId: string }> {
    return this.api.post<{ message: string; periodId: string }>('periods', data);
  }

  updatePeriod(id: string, data: PeriodDto): Observable<void> {
    return this.api.put<void>(`periods/${id}`, data);
  }

  getPeriod(id: string): Observable<PeriodDto> {
    return this.api.get<PeriodDto>(`periods/${id}`);
  }

  getPeriods(
    pageIndex = 1,
    pageSize = 10,
    searchTerm = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = 'All',
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('filter', filter);

    if (searchTerm) params = params.set('searchTerm', searchTerm);
    if (sortColumn) params = params.set('sortColumn', sortColumn);
    if (sortDirection) params = params.set('sortDirection', sortDirection);

    return this.api.get<any>('periods', params);
  }

  getPeriodDropdown(): Observable<{ id: string; name: string }[]> {
    return this.api.get<{ id: string; name: string }[]>('period/dropdown');
  }

  deletePeriod(id: string): Observable<void> {
    return this.api.delete<void>(`periods/${id}`);
  }
}
