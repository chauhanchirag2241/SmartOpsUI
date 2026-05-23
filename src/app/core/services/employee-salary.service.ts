import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class EmployeeSalaryService {
  private readonly api = inject(ApiService);

  getEmployees(search?: string, departmentId?: string, designation?: string): Observable<any[]> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    if (departmentId) params = params.set('departmentId', departmentId);
    if (designation && designation !== 'All') params = params.set('designation', designation);
    return this.api.get<any[]>('salary/employees', params);
  }

  getEmployeeDetail(teacherId: string): Observable<any> {
    return this.api.get<any>(`salary/employees/${teacherId}`);
  }

  assignOrUpdate(teacherId: string, body: unknown): Observable<any> {
    return this.api.put<any>(`salary/employees/${teacherId}`, body);
  }
}
