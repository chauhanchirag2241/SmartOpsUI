import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type StaffPunchType = 'checkin' | 'checkout';

export interface StaffAttendanceSettingsDto {
  type: string;
  allowsManual: boolean;
  allowsFace: boolean;
  defaultWorkingHours?: number;
}

export interface StaffAttendanceRowDto {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  attendanceDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInSource?: string | null;
  checkOutSource?: string | null;
  status: number | string;
  statusLabel: string;
  remarks?: string | null;
  checkInConfidence?: number | null;
  checkOutConfidence?: number | null;
  isFaceEnrolled: boolean;
  photoUrl?: string | null;
  shiftStartTime?: string | null;
}

export interface ManualPunchRequestDto {
  employeeId?: string | null;
  punchType: StaffPunchType;
  attendanceDate?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  remarks?: string | null;
}

export interface UpdateStaffAttendanceRequestDto {
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status?: number | null;
  remarks?: string | null;
}

export interface StaffAttendanceReportEmployeeDto {
  employeeId: string;
  employeeName: string;
  departmentName?: string | null;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDayDays: number;
  dailyStatus: Record<string, string> | Record<number, string>;
}

export interface StaffAttendanceReportDto {
  month: number;
  year: number;
  departmentId?: string | null;
  totalWorkingDays: number;
  employees: StaffAttendanceReportEmployeeDto[];
}

@Injectable({ providedIn: 'root' })
export class StaffAttendanceService {
  private readonly api = inject(ApiService);
  private readonly base = 'staff-attendance';

  getSettings(): Observable<StaffAttendanceSettingsDto> {
    return this.api.get<StaffAttendanceSettingsDto>(`${this.base}/settings`);
  }

  listByDate(date: string): Observable<StaffAttendanceRowDto[]> {
    const params = new HttpParams().set('date', date);
    return this.api.get<StaffAttendanceRowDto[]>(this.base, params);
  }

  getMyToday(): Observable<StaffAttendanceRowDto> {
    return this.api.get<StaffAttendanceRowDto>(`${this.base}/my-today`);
  }

  manualPunch(request: ManualPunchRequestDto): Observable<StaffAttendanceRowDto> {
    return this.api.post<StaffAttendanceRowDto>(`${this.base}/manual`, request);
  }

  update(id: string, request: UpdateStaffAttendanceRequestDto): Observable<StaffAttendanceRowDto> {
    return this.api.put<StaffAttendanceRowDto>(`${this.base}/${id}`, request);
  }

  enrollFace(employeeId: string, image: File | Blob, fileName = 'face.jpg'): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('image', image, fileName);
    return this.api.post<{ message?: string }>(
      `${this.base}/face/enroll?employeeId=${encodeURIComponent(employeeId)}`,
      formData,
    );
  }

  facePunch(image: File | Blob, fileName = 'punch.jpg'): Observable<StaffAttendanceRowDto> {
    const formData = new FormData();
    formData.append('image', image, fileName);
    return this.api.post<StaffAttendanceRowDto>(`${this.base}/face/punch`, formData);
  }

  deactivateFaceEnrollment(employeeId: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/face/enroll/${employeeId}`);
  }

  getReport(month: number, year: number, departmentId?: string | null): Observable<StaffAttendanceReportDto> {
    let params = new HttpParams()
      .set('month', month.toString())
      .set('year', year.toString());
    if (departmentId) {
      params = params.set('departmentId', departmentId);
    }
    return this.api.get<StaffAttendanceReportDto>(`${this.base}/report`, params);
  }
}
