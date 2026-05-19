import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import {
  ClassMappingPayload,
  SubjectMappingPayload,
  TeacherMappingPayload,
} from '../../shared/mapping/mapping.types';

@Injectable({ providedIn: 'root' })
export class MappingService {
  private readonly api = inject(ApiService);

  getByClass(classId: string, academicYearId?: string): Observable<any[]> {
    const params = academicYearId ? new HttpParams().set('academicYearId', academicYearId) : undefined;
    return this.api.get<any[]>(`mappings/by-class/${classId}`, params);
  }

  getByTeacher(teacherId: string): Observable<any> {
    return this.api.get<any>(`mappings/by-teacher/${teacherId}`);
  }

  getBySubject(subjectId: string, academicYearId?: string): Observable<any[]> {
    const params = academicYearId ? new HttpParams().set('academicYearId', academicYearId) : undefined;
    return this.api.get<any[]>(`mappings/by-subject/${subjectId}`, params);
  }

  saveClassMappings(classId: string, payload: ClassMappingPayload): Observable<void> {
    return this.api.put<void>(`mappings/by-class/${classId}`, payload);
  }

  saveSubjectMappings(subjectId: string, payload: SubjectMappingPayload): Observable<void> {
    return this.api.put<void>(`mappings/by-subject/${subjectId}`, payload);
  }

  saveTeacherMappings(teacherId: string, payload: TeacherMappingPayload): Observable<void> {
    return this.api.put<void>(`mappings/by-teacher/${teacherId}`, payload);
  }
}
