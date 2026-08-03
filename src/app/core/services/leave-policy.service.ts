import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface LeavePolicyDto {
  id: string;
  userTypeId: string;
  userTypeName?: string | null;
  userTypeCode?: string | null;
  leaveTypeId: string;
  leaveTypeName?: string | null;
  leaveTypeCode?: string | null;
  monthlyLeave: number;
}

export interface UpdateLeavePolicyRequest {
  monthlyLeave: number;
}

@Injectable({ providedIn: 'root' })
export class LeavePolicyService {
  private readonly api = inject(ApiService);

  getAll(): Observable<LeavePolicyDto[]> {
    return this.api.get<LeavePolicyDto[]>('leave/policies');
  }

  update(id: string, body: UpdateLeavePolicyRequest): Observable<LeavePolicyDto> {
    return this.api.put<LeavePolicyDto>(`leave/policies/${id}`, body);
  }
}
