import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export interface ClassTeacherAssignment {
  id: string;
  classId: string;
  className: string;
  classGroupId?: string;
  teacherId: string;
}

@Injectable({ providedIn: 'root' })
export class ClassSettingsService {
  private readonly api = inject(ApiService);

  getByTeacher(employeeId: string): Observable<ClassTeacherAssignment[]> {
    return this.api
      .get<ClassTeacherAssignment[]>(`class-settings/by-teacher/${employeeId}`)
      .pipe(map((rows) => this.normalizeList(rows)));
  }

  assignClassTeacher(payload: {
    employeeId: string;
    classId: string;
  }): Observable<ClassTeacherAssignment> {
    return this.api
      .post<ClassTeacherAssignment>('class-settings/class-teacher', payload)
      .pipe(map((row) => this.normalizeOne(row)));
  }

  clearClassTeacher(classId: string, employeeId: string): Observable<void> {
    return this.api.delete<void>(
      `class-settings/class-teacher/${classId}?employeeId=${encodeURIComponent(employeeId)}`,
    );
  }

  private normalizeList(raw: unknown): ClassTeacherAssignment[] {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item) => this.normalizeOne(item));
  }

  private normalizeOne(item: unknown): ClassTeacherAssignment {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(row['id'] ?? row['Id'] ?? ''),
      classId: String(row['classId'] ?? row['ClassId'] ?? ''),
      className: String(row['className'] ?? row['ClassName'] ?? ''),
      classGroupId: row['classGroupId'] ?? row['ClassGroupId']
        ? String(row['classGroupId'] ?? row['ClassGroupId'])
        : undefined,
      teacherId: String(row['teacherId'] ?? row['TeacherId'] ?? ''),
    };
  }
}
