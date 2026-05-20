import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export interface MappingLookupOption {
  id: string;
  name: string;
  code?: string;
  subLabel?: string;
}

export interface ClassMappingSummary {
  classId: string;
  className: string;
  section?: string;
  subjectCount: number;
  teachersAssignedCount: number;
  classTeacherCount: number;
}

export interface MappingLookups {
  activeAcademicYearId?: string;
  academicYears: MappingLookupOption[];
  classes: MappingLookupOption[];
  subjects: MappingLookupOption[];
  teachers: MappingLookupOption[];
  classSummaries: ClassMappingSummary[];
}

export interface ClassSubjectTeacherMapping {
  id: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  subjectCode?: string;
  teacherId?: string | null;
  teacherName?: string | null;
  academicYearId: string;
  isClassTeacher: boolean;
}

export interface CreateMappingRequest {
  classId: string;
  subjectId: string;
  teacherId?: string | null;
  academicYearId?: string;
  isClassTeacher?: boolean;
}

export interface UpdateMappingRequest {
  teacherId?: string | null;
  isClassTeacher?: boolean;
  assignLater?: boolean;
}

export interface AssignTeacherRequest {
  assignLater: boolean;
  teacherId?: string | null;
}

/** Reserved for future student-class mapping APIs. */
export interface StudentMappingPlaceholder {
  studentId: string;
  classId: string;
}

@Injectable({ providedIn: 'root' })
export class MappingService {
  private readonly api = inject(ApiService);

  getLookups(academicYearId?: string): Observable<MappingLookups> {
    const params = academicYearId ? new HttpParams().set('academicYearId', academicYearId) : undefined;
    return this.api.get<MappingLookups>('mappings/lookups', params);
  }

  getByClass(classId: string, academicYearId?: string): Observable<ClassSubjectTeacherMapping[]> {
    const params = academicYearId ? new HttpParams().set('academicYearId', academicYearId) : undefined;
    return this.api.get<ClassSubjectTeacherMapping[]>(`mappings/by-class/${classId}`, params);
  }

  createMapping(payload: CreateMappingRequest): Observable<ClassSubjectTeacherMapping> {
    return this.api.post<ClassSubjectTeacherMapping>('mappings', payload);
  }

  updateMapping(id: string, payload: UpdateMappingRequest): Observable<ClassSubjectTeacherMapping> {
    return this.api.put<ClassSubjectTeacherMapping>(`mappings/${id}`, payload);
  }

  assignTeacher(id: string, payload: AssignTeacherRequest): Observable<ClassSubjectTeacherMapping> {
    return this.api.patch<ClassSubjectTeacherMapping>(`mappings/${id}/assign-teacher`, payload);
  }

  setClassTeacher(id: string, isClassTeacher: boolean): Observable<ClassSubjectTeacherMapping> {
    return this.api.patch<ClassSubjectTeacherMapping>(`mappings/${id}/class-teacher`, { isClassTeacher });
  }

  deleteMapping(id: string): Observable<void> {
    return this.api.delete<void>(`mappings/${id}`);
  }
}
