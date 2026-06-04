import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export enum LeaveType {
  Casual = 1,
  Sick = 2,
  Other = 3,
}

export interface CreateLeaveRequest {
  fromDate: string;
  toDate: string;
  leaveType?: LeaveType | null;
  reason?: string | null;
  submitImmediately?: boolean;
}

export interface CreateStudentLeaveRequest extends CreateLeaveRequest {
  studentId: string;
}

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly api = inject(ApiService);

  getStaffList(status?: string, teacherId?: string, from?: string, to?: string): Observable<unknown[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (teacherId) params = params.set('teacherId', teacherId);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.api.get('leave/staff', params);
  }

  getStaffMine(): Observable<unknown[]> {
    return this.api.get('leave/staff/mine');
  }

  getStaffById(id: string): Observable<unknown> {
    return this.api.get(`leave/staff/${id}`);
  }

  createStaff(body: CreateLeaveRequest): Observable<unknown> {
    return this.api.post('leave/staff', body);
  }

  submitStaff(id: string): Observable<unknown> {
    return this.api.post(`leave/staff/${id}/submit`, {});
  }

  cancel(id: string): Observable<unknown> {
    return this.api.post(`leave/staff/${id}/cancel`, {});
  }

  getStudentList(status?: string, studentId?: string): Observable<unknown[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (studentId) params = params.set('studentId', studentId);
    return this.api.get('leave/students', params);
  }

  getStudentMine(): Observable<unknown[]> {
    return this.api.get('leave/students/mine');
  }

  getLinkedStudents(): Observable<unknown[]> {
    return this.api.get('leave/students/children');
  }

  createStudent(body: CreateStudentLeaveRequest): Observable<unknown> {
    return this.api.post('leave/students', body);
  }

  submitStudent(id: string): Observable<unknown> {
    return this.api.post(`leave/students/${id}/submit`, {});
  }

  cancelStudent(id: string): Observable<unknown> {
    return this.api.post(`leave/students/${id}/cancel`, {});
  }
}
