import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly api = inject(ApiService);

  getPayroll(year: number, month: number): Observable<any> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.api.get<any>('salary/payroll', params);
  }

  previewPayroll(body: {
    payYear: number;
    payMonth: number;
    useAttendanceWiseSalary: boolean;
    fullSalaryEmployeeIds?: string[];
  }): Observable<any> {
    return this.api.post<any>('salary/payroll/preview', {
      payYear: body.payYear,
      payMonth: body.payMonth,
      useAttendanceWiseSalary: body.useAttendanceWiseSalary,
      fullSalaryEmployeeIds: body.fullSalaryEmployeeIds?.length ? body.fullSalaryEmployeeIds : null,
    });
  }

  processPayroll(body: {
    payYear: number;
    payMonth: number;
    useAttendanceWiseSalary: boolean;
    fullSalaryEmployeeIds?: string[];
  }): Observable<any> {
    return this.api.post<any>('salary/payroll/process', {
      payYear: body.payYear,
      payMonth: body.payMonth,
      useAttendanceWiseSalary: body.useAttendanceWiseSalary,
      fullSalaryEmployeeIds: body.fullSalaryEmployeeIds?.length ? body.fullSalaryEmployeeIds : null,
    });
  }

  markPaid(runId: string, entryIds?: string[]): Observable<void> {
    return this.api.post<void>(`salary/payroll/${runId}/mark-paid`, { entryIds: entryIds ?? null });
  }

  getPayslip(entryId: string): Observable<any> {
    return this.api.get<any>(`salary/payroll/entries/${entryId}/payslip`);
  }
}
