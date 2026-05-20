import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export enum HomeworkSubmissionStatus {
  Pending = 0,
  Submitted = 1,
  Late = 2,
}

export enum HomeworkPriority {
  Normal = 0,
  High = 1,
  Low = 2,
}

export enum HomeworkSubmissionType {
  Physical = 0,
  Online = 1,
  Both = 2,
}

export interface CreateHomeworkRequest {
  classId: string;
  subjectId: string;
  title: string;
  description?: string | null;
  assignDate: string;
  dueDate: string;
  priority: HomeworkPriority;
  marks?: number | null;
  submissionType: HomeworkSubmissionType;
}

export interface StudentHomeworkSubmissionItem {
  studentId: string;
  status: HomeworkSubmissionStatus;
  submittedOn?: string | null;
  marks?: number | null;
  remark?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HomeworkService {
  private readonly api = inject(ApiService);

  getList(classId?: string, subjectId?: string, status?: string, search?: string): Observable<any[]> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    if (subjectId) params = params.set('subjectId', subjectId);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.api.get<any[]>('homework', params);
  }

  getStats(): Observable<any> {
    return this.api.get<any>('homework/stats');
  }

  getById(id: string): Observable<any> {
    return this.api.get<any>(`homework/${id}`);
  }

  create(request: CreateHomeworkRequest): Observable<any> {
    return this.api.post<any>('homework', request);
  }

  update(id: string, request: CreateHomeworkRequest): Observable<any> {
    return this.api.put<any>(`homework/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`homework/${id}`);
  }

  submitSubmissions(id: string, students: StudentHomeworkSubmissionItem[]): Observable<any> {
    return this.api.post<any>(`homework/${id}/submit-submissions`, { students });
  }

  updateSubmissions(id: string, students: StudentHomeworkSubmissionItem[]): Observable<any> {
    return this.api.put<any>(`homework/${id}/submissions`, { students });
  }
}
