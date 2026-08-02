import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class EmployeeSalaryService {
  private readonly api = inject(ApiService);

  getEmployees(search?: string, userTypeIds?: string[]): Observable<any[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    for (const id of userTypeIds ?? []) {
      if (id) params = params.append('userTypeIds', id);
    }
    return this.api.get<any[]>('salary/employees', params);
  }

  getEmployeeDetail(employeeId: string): Observable<any> {
    return this.api.get<any>(`salary/employees/${employeeId}`);
  }

  assignOrUpdate(employeeId: string, body: unknown): Observable<any> {
    return this.api.put<any>(`salary/employees/${employeeId}`, body);
  }
}
