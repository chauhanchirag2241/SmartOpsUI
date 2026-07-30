import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLogPagedResponse } from '../models/audit-history.model';
import { ApiService } from './api.service';

export type AuditHistoryEntityType =
  | 'student'
  | 'employee'
  | 'class'
  | 'subject'
  | 'shift'
  | 'period'
  | 'academic-period'
  | 'academic-year'
  | 'visitor'
  | 'phone-log'
  | 'complaint'
  | 'admission-inquiry'
  | 'fee-master'
  | 'fee-head';

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
    const path = this.resolveHistoryPath(entityType, entityId);
    return this.api.get<AuditLogPagedResponse>(path, params);
  }

  getStudentHistory(
    studentId: string,
    page = 1,
    pageSize = 20,
  ): Observable<AuditLogPagedResponse> {
    return this.getEntityHistory('student', studentId, page, pageSize);
  }

  private resolveHistoryPath(entityType: AuditHistoryEntityType, entityId: string): string {
    switch (entityType) {
      case 'class':
        return `classes/${entityId}/history`;
      case 'period':
        return `period-templates/${entityId}/history`;
      case 'academic-period':
        return `academic-periods/${entityId}/history`;
      case 'academic-year':
        return `academicYears/${entityId}/history`;
      case 'visitor':
        return `front-office/visitors/${entityId}/history`;
      case 'phone-log':
        return `front-office/phone-logs/${entityId}/history`;
      case 'complaint':
        return `front-office/complaints/${entityId}/history`;
      case 'admission-inquiry':
        return `front-office/admission-inquiries/${entityId}/history`;
      case 'fee-master':
        return `fees/master/${entityId}/history`;
      case 'fee-head':
        return `fees/master/heads/${entityId}/history`;
      default:
        return `${entityType}s/${entityId}/history`;
    }
  }
}
