import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

/** One mapping row = one class group + one subject. */
export interface TeacherClassSubjectMapping {
  id: string;
  classGroupId: string;
  classGroupName: string;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  employeeId?: string;
  employeeName?: string;
  academicYearId: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class TeacherMappingService {
  private readonly api = inject(ApiService);

  getByEmployee(
    employeeId: string,
    academicYearId?: string,
  ): Observable<TeacherClassSubjectMapping[]> {
    let params = new HttpParams();
    if (academicYearId) {
      params = params.set('academicYearId', academicYearId);
    }
    return this.api
      .get<TeacherClassSubjectMapping[]>(
        `mappings/by-employee/${employeeId}`,
        params.keys().length ? params : undefined,
      )
      .pipe(map((rows) => this.normalizeList(rows)));
  }

  /** Class group id — returns CST rows (subject + teacher) for that group. */
  getByClassGroup(
    classGroupId: string,
    academicYearId?: string,
  ): Observable<TeacherClassSubjectMapping[]> {
    let params = new HttpParams();
    if (academicYearId) {
      params = params.set('academicYearId', academicYearId);
    }
    return this.api
      .get<TeacherClassSubjectMapping[]>(
        `mappings/by-class-group/${classGroupId}`,
        params.keys().length ? params : undefined,
      )
      .pipe(map((rows) => this.normalizeList(rows)));
  }

  create(payload: {
    classGroupId: string;
    subjectId?: string;
    subjectIds?: string[];
    employeeId: string;
    academicYearId: string;
  }): Observable<TeacherClassSubjectMapping> {
    return this.api.post<TeacherClassSubjectMapping>('mappings', payload);
  }

  bulkCreate(payload: {
    employeeId: string;
    academicYearId: string;
    mappings: {
      classGroupId: string;
      subjectIds: string[];
    }[];
    classTeacherClassIds?: string[];
  }): Observable<{ createdCount: number; created: TeacherClassSubjectMapping[] }> {
    return this.api.post<{ createdCount: number; created: TeacherClassSubjectMapping[] }>(
      'mappings/bulk',
      payload,
    );
  }

  update(
    id: string,
    payload: { subjectId?: string; isActive?: boolean },
  ): Observable<TeacherClassSubjectMapping> {
    return this.api.put<TeacherClassSubjectMapping>(`mappings/${id}`, payload);
  }

  /** Soft-delete (isactive = false). */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(`mappings/${id}`);
  }

  private normalizeList(raw: unknown): TeacherClassSubjectMapping[] {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item) => this.normalizeOne(item));
  }

  private normalizeOne(item: unknown): TeacherClassSubjectMapping {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(row['id'] ?? row['Id'] ?? ''),
      classGroupId: String(row['classGroupId'] ?? row['ClassGroupId'] ?? ''),
      classGroupName: String(
        row['classGroupName'] ??
          row['ClassGroupName'] ??
          row['className'] ??
          row['ClassName'] ??
          '',
      ),
      subjectId: String(row['subjectId'] ?? row['SubjectId'] ?? ''),
      subjectName: String(row['subjectName'] ?? row['SubjectName'] ?? ''),
      subjectCode: row['subjectCode'] ?? row['SubjectCode']
        ? String(row['subjectCode'] ?? row['SubjectCode'])
        : undefined,
      employeeId: row['employeeId'] ?? row['EmployeeId']
        ? String(row['employeeId'] ?? row['EmployeeId'])
        : undefined,
      employeeName: row['employeeName'] ?? row['EmployeeName']
        ? String(row['employeeName'] ?? row['EmployeeName'])
        : undefined,
      academicYearId: String(row['academicYearId'] ?? row['AcademicYearId'] ?? ''),
      isActive:
        row['isActive'] !== undefined
          ? Boolean(row['isActive'])
          : row['IsActive'] !== undefined
            ? Boolean(row['IsActive'])
            : true,
    };
  }
}
