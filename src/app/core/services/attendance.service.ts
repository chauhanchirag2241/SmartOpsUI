import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface StudentAttendanceItemDto {
  studentId: string;
  status: number;
  remarks?: string | null;
}

export interface SubmitAttendanceRequestDto {
  classId: string;
  attendanceDate: string;
  students: StudentAttendanceItemDto[];
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly api = inject(ApiService);

  getClassAttendance(classId: string, date: string): Observable<any> {
    const params = new HttpParams()
      .set('classId', classId)
      .set('date', date);

    return this.api.get<any>('attendance', params);
  }

  submitAttendance(request: SubmitAttendanceRequestDto): Observable<any> {
    return this.api.post<any>('attendance/submit', request);
  }
}
