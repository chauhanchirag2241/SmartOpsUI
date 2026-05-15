import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

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

  private formatDate(date: any): string | null {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return date; // Return original if not a valid date object
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toTeacherCreatePayload(teacher: any): any {
    return {
      personal: {
        firstName: teacher.personal.firstName,
        lastName: teacher.personal.lastName,
        dob: this.formatDate(teacher.personal.dob),
        gender: teacher.personal.gender,
        bloodGroup: teacher.personal.bloodGroup,
        aadhaarNumber: teacher.personal.aadhaarNumber,
        panNumber: teacher.personal.panNumber,
        mobile: teacher.personal.mobile,
        alternateMobile: teacher.personal.alternateMobile,
        email: teacher.personal.email,
        address: teacher.personal.address
      },
      professional: {
        joiningDate: this.formatDate(teacher.professional.joiningDate),
        department: teacher.professional.department,
        designation: teacher.professional.designation,
        experience: Number(teacher.professional.experience || 0),
        salaryGrade: teacher.professional.salaryGrade,
        employmentType: teacher.professional.employmentType,
        qualifications: (teacher.professional.qualifications || []).filter((q: any) => !!q),
        bankDetails: {
          accountNumber: teacher.professional.bankDetails?.accountNumber,
          ifscCode: teacher.professional.bankDetails?.ifscCode,
          bankName: teacher.professional.bankDetails?.bankName
        }
      },
      schedule: {
        classId: teacher.schedule.classId || teacher.schedule.subjectAssignments?.[0]?.classId || null,
        shift: teacher.schedule.shift,
        weeklyPeriods: Number(teacher.schedule.weeklyPeriods || 30),
        maxPeriodsPerDay: Number(teacher.schedule.maxPeriodsPerDay || 6),
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
      firstName: teacher.personal.firstName,
      lastName: teacher.personal.lastName,
      dob: this.formatDate(teacher.personal.dob),
      gender: teacher.personal.gender,
      bloodGroup: teacher.personal.bloodGroup,
      aadhaarNo: teacher.personal.aadhaarNumber,
      panNo: teacher.personal.panNumber,
      mobile: teacher.personal.mobile,
      alternateMobile: teacher.personal.alternateMobile,
      email: teacher.personal.email,
      address: teacher.personal.address,
      employeeId: teacher.professional.employeeId === 'Auto-generated' ? null : teacher.professional.employeeId,
      joiningDate: this.formatDate(teacher.professional.joiningDate),
      department: teacher.professional.department,
      designation: teacher.professional.designation,
      experience: Number(teacher.professional.experience || 0),
      salaryGrade: teacher.professional.salaryGrade,
      employmentType: teacher.professional.employmentType,
      qualifications: (teacher.professional.qualifications || []).filter(Boolean).join('; '),
      bankAccountNumber: teacher.professional.bankDetails?.accountNumber,
      bankIfscCode: teacher.professional.bankDetails?.ifscCode,
      bankName: teacher.professional.bankDetails?.bankName,
      classId: teacher.schedule.classId || teacher.schedule.subjectAssignments?.[0]?.classId || null,
      shift: teacher.schedule.shift,
      weeklyPeriods: Number(teacher.schedule.weeklyPeriods || 30),
      maxPeriodsPerDay: Number(teacher.schedule.maxPeriodsPerDay || 6),
      role: teacher.schedule.role,
      portalAccess: teacher.schedule.portalAccess === 'Enabled' || teacher.schedule.portalAccess === true,
      username: teacher.schedule.username,
      isActive: true
    };
  }
}
