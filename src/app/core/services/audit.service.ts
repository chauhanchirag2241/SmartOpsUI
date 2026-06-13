import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLogPagedResponse } from '../models/audit-history.model';
import { ApiService } from './api.service';

export type AuditHistoryEntityType = 'student' | 'employee' | 'class' | 'subject';

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private api: ApiService) {}

  getEntityHistory(
    entityType: AuditHistoryEntityType,
    entityId: string,
    page = 1,
    pageSize = 20,
  ): Observable<AuditLogPagedResponse> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    const path = `${entityType === 'class' ? 'classes' : `${entityType}s`}/${entityId}/history`;
    return this.api.get<AuditLogPagedResponse>(path, params);
  }

  getStudentHistory(
    studentId: string,
    page = 1,
    pageSize = 20,
  ): Observable<AuditLogPagedResponse> {
    return this.getEntityHistory('student', studentId, page, pageSize);
  }
}
