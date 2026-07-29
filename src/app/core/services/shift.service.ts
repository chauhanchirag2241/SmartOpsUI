import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export interface ShiftDto {
  id?: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  displayOrder?: number;
}

export interface ShiftDropdownItem {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly api = inject(ApiService);

  getShifts(
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

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }

    return this.api.get<any>('shifts', params);
  }

  getShiftDropdown(): Observable<ShiftDropdownItem[]> {
    return this.api.get<ShiftDropdownItem[]>('shift/dropdown');
  }

  getShift(id: string): Observable<ShiftDto> {
    return this.api.get<ShiftDto>(`shifts/${id}`);
  }

  createShift(data: ShiftDto): Observable<{ message: string; shiftId: string }> {
    return this.api.post<{ message: string; shiftId: string }>('shifts', data);
  }

  updateShift(id: string, data: ShiftDto): Observable<void> {
    return this.api.put<void>(`shifts/${id}`, data);
  }

  deleteShift(id: string): Observable<void> {
    return this.api.delete<void>(`shifts/${id}`);
  }
}
