import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface AcademicPeriodRow {
  id?: string;
  periodIndex: number;
  name: string;
}

export interface AcademicPeriodSetup {
  classId: string;
  periods: AcademicPeriodRow[];
}

@Injectable({ providedIn: 'root' })
export class AcademicPeriodService {
  private readonly api = inject(ApiService);

  getClassSetup(classId: string): Observable<AcademicPeriodSetup> {
    return this.api.get<AcademicPeriodSetup>(`academic-periods/classes/${classId}`);
  }

  getPeriod(id: string): Observable<AcademicPeriodRow> {
    return this.api.get<AcademicPeriodRow>(`academic-periods/${id}`);
  }

  saveClassSetup(
    classId: string,
    payload: { periods: AcademicPeriodRow[] },
  ): Observable<AcademicPeriodSetup> {
    return this.api.put<AcademicPeriodSetup>(`academic-periods/classes/${classId}`, payload);
  }
}
