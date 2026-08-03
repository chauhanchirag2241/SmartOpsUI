import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface LeaveTypeDto {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
  requiresBalance: boolean;
  allowHalfDay?: boolean;
  carryForward: boolean;
  sortOrder: number;
  isActive: boolean;
}

export type LeaveTypeUpsert = Omit<LeaveTypeDto, 'id' | 'isActive' | 'requiresBalance'> & {
  requiresBalance?: boolean;
  isActive?: boolean;
};

@Injectable({ providedIn: 'root' })
export class LeaveTypeService {
  private readonly api = inject(ApiService);

  getAll(): Observable<LeaveTypeDto[]> {
    return this.api.get<LeaveTypeDto[]>('leave/types');
  }

  /** Active types for staff leave apply (LEAVE_STAFF). */
  getActive(): Observable<LeaveTypeDto[]> {
    return this.api.get<LeaveTypeDto[]>('leave/types/active');
  }

  getById(id: string): Observable<LeaveTypeDto> {
    return this.api.get<LeaveTypeDto>(`leave/types/${id}`);
  }

  create(body: LeaveTypeUpsert): Observable<LeaveTypeDto> {
    return this.api.post<LeaveTypeDto>('leave/types', body);
  }

  update(id: string, body: LeaveTypeUpsert): Observable<LeaveTypeDto> {
    return this.api.put<LeaveTypeDto>(`leave/types/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`leave/types/${id}`);
  }
}
