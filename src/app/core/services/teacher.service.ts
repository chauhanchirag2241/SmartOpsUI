import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { stripAadhaarDigits } from '../../shared/utils/form-validators.util';

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  private readonly api = inject(ApiService);

  getTeachers(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: any = null
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('searchQuery', searchQuery);

    if (sortColumn) params = params.set('sortColumn', sortColumn);
    if (sortDirection) params = params.set('sortDirection', sortDirection);
    if (filter !== null && filter !== undefined) params = params.set('filter', filter.toString());

    return this.api.get<any>('teachers', params);
  }

  getClassTeacherDropdown(): Observable<any[]> {
    return this.api.get<any[]>('teacher/class-teacher-dropdown');
  }

  getTeacherById(id: string): Observable<any> {
    return this.api.get<any>(`teachers/${id}`);
  }

  createTeacher(teacher: any): Observable<any> {
    return this.api.post<any>('teachers', this.toTeacherCreatePayload(teacher));
  }

  updateTeacher(id: string, teacher: any): Observable<any> {
    return this.api.put<any>(`teachers/${id}`, this.toTeacherUpdatePayload(id, teacher));
  }

  deleteTeacher(id: string): Observable<any> {
    return this.api.delete<any>(`teachers/${id}`);
  }

  private optionalInt(value: unknown): number | null {
    if (value == null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  /** Each row: { degree, university, year, percentage } → "degree — university — year — percentage" for DB storage. */
  private mapQualifications(rows: unknown): string[] {
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows
      .map((row: any) => {
        if (typeof row === 'string') {
          return row.trim();
        }
        const degree = String(row?.degree ?? '').trim();
        const university = String(row?.university ?? row?.institution ?? '').trim();
        const year = String(row?.year ?? '').trim();
        const percentage = String(row?.percentage ?? '').trim();
        
        const parts = [degree, university, year, percentage].filter(Boolean);
        return parts.join(' — ');
      })
      .filter(Boolean);
  }

  private formatDate(date: unknown): string | null {
    if (!date) {
      return null;
    }
    if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        return null;
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    const d = new Date(date as string);
    if (isNaN(d.getTime())) {
      return null;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private emptyGuidToNull(value: unknown): string | null {
    if (value == null || value === '') {
      return null;
    }
    const s = String(value);
    return s === '00000000-0000-0000-0000-000000000000' ? null : s;
  }

  private toTeacherCreatePayload(teacher: any): any {
    return {
      personal: {
        firstName: teacher.personal.firstName,
        lastName: teacher.personal.lastName,
        dob: this.formatDate(teacher.personal.dob),
        gender: teacher.personal.gender,
        bloodGroup: teacher.personal.bloodGroup,
        aadhaarNumber: stripAadhaarDigits(String(teacher.personal.aadhaarNumber ?? '')) || null,
        panNumber: teacher.personal.panNumber?.toUpperCase?.() ?? teacher.personal.panNumber,
        mobile: teacher.personal.mobile,
        alternateMobile: teacher.personal.alternateMobile,
        email: teacher.personal.email,
        address: teacher.personal.address
      },
      professional: {
        joiningDate: this.formatDate(teacher.professional.joiningDate),
        designation: teacher.professional.designation || null,
        experience: Number(teacher.professional.experience || 0),
        salaryGrade: teacher.professional.salaryGrade,
        employmentType: teacher.professional.employmentType,
        qualifications: this.mapQualifications(teacher.professional.qualifications),
        bankDetails: {
          accountNumber: teacher.professional.bankDetails?.accountNumber,
          ifscCode: teacher.professional.bankDetails?.ifscCode,
          bankName: teacher.professional.bankDetails?.bankName
        }
      },
      schedule: {
        classId: this.emptyGuidToNull(
          teacher.schedule.classId || teacher.schedule.classAssignments?.[0]?.classId
        ),
        classAssignments: (teacher.schedule.classAssignments || []).map((row: any) => ({
          classId: row.classId,
          subjectIds: row.subjectIds || [],
          isClassTeacher: !!row.isClassTeacher
        })),
        shiftStartTime: teacher.schedule.shiftStartTime || null,
        shiftEndTime: teacher.schedule.shiftEndTime || null,
        weeklyPeriods: this.optionalInt(teacher.schedule.weeklyPeriods),
        maxPeriodsPerDay: this.optionalInt(teacher.schedule.maxPeriodsPerDay),
        role: teacher.schedule.role,
        portalAccess: teacher.schedule.portalAccess || 'Enabled',
        username: teacher.schedule.username
      }
    };
  }

  private toTeacherUpdatePayload(id: string, teacher: any): any {
    if (!teacher?.personal || !teacher?.professional || !teacher?.schedule) {
      return { ...teacher, id };
    }

    return {
      id,
      userId: teacher.userId,
      firstName: teacher.personal.firstName,
      lastName: teacher.personal.lastName,
      dob: this.formatDate(teacher.personal.dob),
      gender: teacher.personal.gender,
      bloodGroup: teacher.personal.bloodGroup,
      aadhaarNo: stripAadhaarDigits(String(teacher.personal.aadhaarNumber ?? '')) || null,
      panNo: teacher.personal.panNumber?.toUpperCase?.() ?? teacher.personal.panNumber,
      mobile: teacher.personal.mobile,
      alternateMobile: teacher.personal.alternateMobile,
      email: teacher.personal.email,
      address: teacher.personal.address,
      employeeId: teacher.professional.employeeId === 'Auto-generated' ? null : teacher.professional.employeeId,
      joiningDate: this.formatDate(teacher.professional.joiningDate),
      designation: teacher.professional.designation || null,
      experience: Number(teacher.professional.experience || 0),
      salaryGrade: teacher.professional.salaryGrade,
      employmentType: teacher.professional.employmentType,
      qualifications: this.mapQualifications(teacher.professional.qualifications).join('; '),
      bankAccountNumber: teacher.professional.bankDetails?.accountNumber,
      bankIfscCode: teacher.professional.bankDetails?.ifscCode,
      bankName: teacher.professional.bankDetails?.bankName,
      classId: this.emptyGuidToNull(
        teacher.schedule.classId || teacher.schedule.subjectAssignments?.[0]?.classId
      ),
      shiftStartTime: teacher.schedule.shiftStartTime || null,
      shiftEndTime: teacher.schedule.shiftEndTime || null,
      weeklyPeriods: this.optionalInt(teacher.schedule.weeklyPeriods),
      maxPeriodsPerDay: this.optionalInt(teacher.schedule.maxPeriodsPerDay),
      role: teacher.schedule.role,
      portalAccess: teacher.schedule.portalAccess === 'Enabled' || teacher.schedule.portalAccess === true,
      username: teacher.schedule.username,
      isActive: true
    };
  }
}
