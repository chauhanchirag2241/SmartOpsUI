import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface LeaveBalanceDto {
  id: string;
  employeeId: string;
  employeeName?: string | null;
  leaveTypeId: string;
  leaveTypeName?: string | null;
  leaveTypeCode?: string | null;
  academicYearId: string;
  openingBalance: number;
  accrued: number;
  used: number;
  adjusted: number;
  closingBalance: number;
}

export interface LeaveLedgerDto {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName?: string | null;
  txnType: number | string;
  txnTypeLabel?: string | null;
  days: number;
  balanceAfter: number;
  remark?: string | null;
  txnDate: string;
  createdOn?: string;
}

export interface AddLeaveBalanceRequest {
  employeeId: string;
  leaveTypeId: string;
  days: number;
  remark?: string | null;
}

@Injectable({ providedIn: 'root' })
export class LeaveBalanceService {
  private readonly api = inject(ApiService);

  getBalances(employeeId?: string, academicYearId?: string): Observable<LeaveBalanceDto[]> {
    if (!employeeId) {
      return this.getMine();
    }
    let params = new HttpParams();
    if (academicYearId) params = params.set('academicYearId', academicYearId);
    return this.api.get<LeaveBalanceDto[]>(`leave/balances/employee/${employeeId}`, params);
  }

  getMine(): Observable<LeaveBalanceDto[]> {
    return this.api.get<LeaveBalanceDto[]>('leave/balances/mine');
  }

  addLeave(body: AddLeaveBalanceRequest): Observable<LeaveBalanceDto> {
    return this.api.post<LeaveBalanceDto>('leave/balances/credit/manual', body);
  }

  getLedger(employeeId: string, leaveTypeId?: string): Observable<LeaveLedgerDto[]> {
    let params = new HttpParams();
    if (leaveTypeId) params = params.set('leaveTypeId', leaveTypeId);
    return this.api.get<LeaveLedgerDto[]>(`leave/balances/employee/${employeeId}/ledger`, params);
  }
}
