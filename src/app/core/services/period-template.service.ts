import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export interface PeriodLineDto {
  id?: string;
  name: string;
  shortName: string;
  periodOrder: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface PeriodTemplateDto {
  id?: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  periods: PeriodLineDto[];
}

@Injectable({ providedIn: 'root' })
export class PeriodTemplateService {
  private readonly api = inject(ApiService);

  create(data: PeriodTemplateDto): Observable<{ message: string; templateId: string }> {
    return this.api.post<{ message: string; templateId: string }>('period-templates', data);
  }

  update(id: string, data: PeriodTemplateDto): Observable<void> {
    return this.api.put<void>(`period-templates/${id}`, data);
  }

  get(id: string): Observable<PeriodTemplateDto> {
    return this.api.get<PeriodTemplateDto>(`period-templates/${id}`);
  }

  getList(
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
    return this.api.get<any>('period-templates', params);
  }

  getDropdown(): Observable<{ id: string; name: string }[]> {
    return this.api.get<{ id: string; name: string }[]>('period-template/dropdown');
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`period-templates/${id}`);
  }
}
