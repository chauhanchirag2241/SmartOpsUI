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
    if (filter) params = params.set('filter', filter.toString());

    return this.api.get<any>('teachers', params);
  }

  getClassTeacherDropdown(): Observable<any[]> {
    return this.api.get<any[]>('teacher/class-teacher-dropdown');
  }

  getTeacherById(id: string): Observable<any> {
    return this.api.get<any>(`teachers/${id}`);
  }

  createTeacher(teacher: any): Observable<any> {
    return this.api.post<any>('teachers', teacher);
  }

  updateTeacher(id: string, teacher: any): Observable<any> {
    return this.api.put<any>(`teachers/${id}`, this.toTeacherUpdatePayload(id, teacher));
  }

  deleteTeacher(id: string): Observable<any> {
    return this.api.delete<any>(`teachers/${id}`);
  }

  private toTeacherUpdatePayload(id: string, teacher: any): any {
    if (!teacher?.personal || !teacher?.professional || !teacher?.schedule) {
      return { ...teacher, id };
    }

    return {
      id,
      firstName: teacher.personal.firstName,
      lastName: teacher.personal.lastName,
      dob: teacher.personal.dob,
      gender: teacher.personal.gender,
      bloodGroup: teacher.personal.bloodGroup,
      aadhaarNo: teacher.personal.aadhaarNumber,
      panNo: teacher.personal.panNumber,
      mobile: teacher.personal.mobile,
      alternateMobile: teacher.personal.alternateMobile,
      email: teacher.personal.email,
      address: teacher.personal.address,
      employeeId: teacher.professional.employeeId === 'Auto-generated' ? null : teacher.professional.employeeId,
      joiningDate: teacher.professional.joiningDate,
      department: teacher.professional.department,
      designation: teacher.professional.designation,
      experience: teacher.professional.experience,
      salaryGrade: teacher.professional.salaryGrade,
      employmentType: teacher.professional.employmentType,
      qualifications: (teacher.professional.qualifications || []).filter(Boolean).join('; '),
      bankAccountNumber: teacher.professional.bankDetails?.accountNumber,
      bankIfscCode: teacher.professional.bankDetails?.ifscCode,
      bankName: teacher.professional.bankDetails?.bankName,
      classId: teacher.schedule.classId || teacher.schedule.subjectAssignments?.[0]?.classId || null,
      shift: teacher.schedule.shift,
      weeklyPeriods: teacher.schedule.weeklyPeriods,
      maxPeriodsPerDay: teacher.schedule.maxPeriodsPerDay,
      role: teacher.schedule.role,
      portalAccess: teacher.schedule.portalAccess === 'Enabled',
      username: teacher.schedule.username,
      isActive: true
    };
  }
}
