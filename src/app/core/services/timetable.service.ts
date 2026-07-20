import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export interface TimetableVersion {
  id: string;
  academicYearId: string;
  classId: string;
  className?: string;
  effectiveFrom: string;
  notes?: string;
  isActive: boolean;
}

export interface PeriodGridRow {
  id: string;
  name: string;
  shortName: string;
  periodOrder: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface TimetableSlotCell {
  id?: string;
  dayOfWeek: number;
  periodId: string;
  subjectId?: string | null;
  subjectName?: string | null;
  subjectCode?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  roomNo?: string | null;
  classId?: string | null;
  className?: string | null;
  hasTeacherConflict?: boolean;
  hasRoomConflict?: boolean;
}

export interface TimetableConflict {
  type: string;
  dayOfWeek: number;
  periodId: string;
  periodName?: string;
  employeeId?: string;
  employeeName?: string;
  roomNo?: string;
  classId: string;
  className?: string;
  effectiveFrom: string;
  message: string;
}

export interface TimetableGrid {
  version?: TimetableVersion | null;
  periods: PeriodGridRow[];
  slots: TimetableSlotCell[];
  conflicts?: TimetableConflict[];
}

export interface MyTimetableResponse {
  persona: 'teacher' | 'student' | 'none' | string;
  employeeId?: string;
  studentId?: string;
  classId?: string;
  className?: string;
  grid: TimetableGrid;
}

export interface TimetableSlotInput {
  dayOfWeek: number;
  periodId: string;
  subjectId?: string | null;
  employeeId?: string | null;
  roomNo?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TimetableService {
  private readonly api = inject(ApiService);

  getVersions(classId: string, academicYearId: string): Observable<TimetableVersion[]> {
    const params = new HttpParams()
      .set('classId', classId)
      .set('academicYearId', academicYearId);
    return this.api.get<TimetableVersion[]>('timetables/versions', params);
  }

  createVersion(body: {
    academicYearId: string;
    classId: string;
    effectiveFrom: string;
    notes?: string;
    copyFromPrevious?: boolean;
  }): Observable<{ message: string; timetableId: string }> {
    return this.api.post<{ message: string; timetableId: string }>('timetables/versions', body);
  }

  getGrid(timetableId: string): Observable<TimetableGrid> {
    return this.api.get<TimetableGrid>(`timetables/${timetableId}/grid`);
  }

  getClassGrid(classId: string, academicYearId: string, asOf?: string): Observable<TimetableGrid> {
    let params = new HttpParams()
      .set('classId', classId)
      .set('academicYearId', academicYearId);
    if (asOf) params = params.set('asOf', asOf);
    return this.api.get<TimetableGrid>('timetables/class-grid', params);
  }

  getTeacherGrid(employeeId: string, academicYearId: string, asOf?: string): Observable<TimetableGrid> {
    let params = new HttpParams()
      .set('employeeId', employeeId)
      .set('academicYearId', academicYearId);
    if (asOf) params = params.set('asOf', asOf);
    return this.api.get<TimetableGrid>('timetables/teacher-grid', params);
  }

  saveSlots(timetableId: string, slots: TimetableSlotInput[]): Observable<void> {
    return this.api.put<void>(`timetables/${timetableId}/slots`, { slots });
  }

  validateConflicts(body: {
    academicYearId: string;
    classId: string;
    timetableId?: string | null;
    effectiveFrom: string;
    slots: TimetableSlotInput[];
  }): Observable<{ hasConflicts: boolean; conflicts: TimetableConflict[] }> {
    return this.api.post<{ hasConflicts: boolean; conflicts: TimetableConflict[] }>(
      'timetables/validate-conflicts',
      body,
    );
  }

  deleteVersion(timetableId: string): Observable<void> {
    return this.api.delete<void>(`timetables/${timetableId}`);
  }

  getMyTimetable(academicYearId: string, asOf?: string): Observable<MyTimetableResponse> {
    let params = new HttpParams().set('academicYearId', academicYearId);
    if (asOf) params = params.set('asOf', asOf);
    return this.api.get<MyTimetableResponse>('timetables/my', params);
  }
}
