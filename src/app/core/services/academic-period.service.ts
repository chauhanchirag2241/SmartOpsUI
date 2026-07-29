import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

export enum AcademicPeriodType {
  Semester = 1,
  Term = 2,
  Quarter = 3,
  Custom = 4,
}

export interface AcademicPeriodClassSummary {
  classId: string;
  className: string;
  academicYearId: string;
  periodCount: number;
  periodType: AcademicPeriodType | null;
}

export interface AcademicPeriodRow {
  id?: string;
  periodIndex: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface AcademicPeriodSetup {
  classId: string;
  academicYearId: string;
  periodType: AcademicPeriodType | null;
  periods: AcademicPeriodRow[];
}

function normalizePeriodType(value: unknown): AcademicPeriodType | null {
  if (typeof value === 'number' && value >= 1 && value <= 4) {
    return value as AcademicPeriodType;
  }
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    const types: Record<string, AcademicPeriodType> = {
      semester: AcademicPeriodType.Semester,
      term: AcademicPeriodType.Term,
      quarter: AcademicPeriodType.Quarter,
      custom: AcademicPeriodType.Custom,
    };
    return types[key] ?? null;
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class AcademicPeriodService {
  private readonly api = inject(ApiService);

  getClasses(academicYearId: string): Observable<AcademicPeriodClassSummary[]> {
    const params = new HttpParams().set('academicYearId', academicYearId);
    return this.api.get<AcademicPeriodClassSummary[]>('academic-periods/classes', params).pipe(
      map((items) => (items ?? []).map((item) => ({
        ...item,
        periodType: normalizePeriodType(item.periodType),
      }))),
    );
  }

  getClassSetup(classId: string, academicYearId: string): Observable<AcademicPeriodSetup> {
    const params = new HttpParams().set('academicYearId', academicYearId);
    return this.api.get<AcademicPeriodSetup>(`academic-periods/classes/${classId}`, params).pipe(
      map((setup) => ({ ...setup, periodType: normalizePeriodType(setup.periodType) })),
    );
  }

  saveClassSetup(
    classId: string,
    payload: {
      academicYearId: string;
      periodType: AcademicPeriodType;
      periods: AcademicPeriodRow[];
    },
  ): Observable<AcademicPeriodSetup> {
    return this.api.put<AcademicPeriodSetup>(`academic-periods/classes/${classId}`, payload).pipe(
      map((setup) => ({ ...setup, periodType: normalizePeriodType(setup.periodType) })),
    );
  }
}
