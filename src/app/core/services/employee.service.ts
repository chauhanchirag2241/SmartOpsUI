import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { stripAadhaarDigits } from '../../shared/utils/form-validators.util';

export interface EmployeeDropdownItem {
  id: string;
  name: string;
  employeeId?: string;
  designation?: string;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeService {
  private readonly api = inject(ApiService);

  getEmployees(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: unknown = null,
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('searchQuery', searchQuery);

    if (sortColumn) params = params.set('sortColumn', sortColumn);
    if (sortDirection) params = params.set('sortDirection', sortDirection);
    if (filter !== null && filter !== undefined) params = params.set('filter', filter.toString());

    return this.api.get<any>('employees', params);
  }

  getEmployeeDropdown(): Observable<EmployeeDropdownItem[]> {
    return this.api.get<EmployeeDropdownItem[]>('employees/reporting-manager-dropdown').pipe(
      map((items) => this.normalizeDropdownItems(items)),
    );
  }

  getClassTeacherDropdown(): Observable<EmployeeDropdownItem[]> {
    return this.api.get<EmployeeDropdownItem[]>('employee/class-teacher-dropdown').pipe(
      map((items) => this.normalizeDropdownItems(items)),
    );
  }

  private normalizeDropdownItems(raw: unknown): EmployeeDropdownItem[] {
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: String(row['id'] ?? row['Id'] ?? ''),
          name: String(row['name'] ?? row['Name'] ?? '').trim(),
          employeeId: row['employeeId'] ?? row['EmployeeId'] ? String(row['employeeId'] ?? row['EmployeeId']) : undefined,
          designation: row['designation'] ?? row['Designation'] ? String(row['designation'] ?? row['Designation']) : undefined,
        };
      })
      .filter((item) => !!item.id && !!item.name);
  }

  getEmployeeById(id: string): Observable<any> {
    return this.api.get<any>(`employees/${id}`);
  }

  createEmployee(
    employee: any,
    lookups?: { userTypes?: { id: string; code: string; name: string }[]; roles?: { id: string; name: string; code: string }[] },
  ): Observable<any> {
    return this.api.post<any>('employees', this.toEmployeeCreatePayload(employee, lookups));
  }

  updateEmployee(id: string, employee: any): Observable<any> {
    return this.api.put<any>(`employees/${id}`, this.toEmployeeUpdatePayload(id, employee));
  }

  deleteEmployee(id: string): Observable<any> {
    return this.api.delete<any>(`employees/${id}`);
  }

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

  private toEmployeeCreatePayload(
    employee: any,
    lookups?: { userTypes?: { id: string; code: string; name: string }[]; roles?: { id: string; name: string; code: string }[] },
  ): any {
    const organization = employee.organization ?? {};
    const schedule = employee.schedule ?? {};

    const userType = lookups?.userTypes?.find((t) => t.id === organization.employeeTypeId);
    const role = lookups?.roles?.find((r) => r.id === organization.portalRoleId);

    return {
      personal: {
        firstName: employee.personal.firstName,
        lastName: employee.personal.lastName,
        dob: this.formatDate(employee.personal.dob),
        gender: employee.personal.gender,
        bloodGroup: employee.personal.bloodGroup,
        aadhaarNumber: stripAadhaarDigits(String(employee.personal.aadhaarNumber ?? '')) || null,
        panNumber: employee.personal.panNumber?.toUpperCase?.() ?? employee.personal.panNumber,
        mobile: employee.personal.mobile,
        alternateMobile: employee.personal.alternateMobile,
        email: employee.personal.email,
        address: employee.personal.address,
      },
      professional: {
        joiningDate: this.formatDate(employee.professional.joiningDate),
        designation: employee.professional.designation || null,
        experience: Number(employee.professional.experience || 0),
        salaryGrade: employee.professional.salaryGrade,
        employmentType: employee.professional.employmentType,
        qualifications: this.mapQualifications(employee.professional.qualifications),
        bankDetails: {
          accountNumber: employee.professional.bankDetails?.accountNumber,
          ifscCode: employee.professional.bankDetails?.ifscCode,
          bankName: employee.professional.bankDetails?.bankName,
        },
      },
      access: {
        userTypeCode: userType?.code ?? organization.userTypeCode ?? 'TEACHER',
        portalRoleName: role?.name ?? organization.portalRoleName ?? 'Teacher',
        portalAccess: organization.portalAccess || 'Enabled',
        username: organization.username || null,
      },
      organization: {
        departmentId: this.emptyGuidToNull(organization.departmentId),
        reportingManagerId: this.emptyGuidToNull(organization.reportingManagerId),
      },
      schedule: {
        shiftStartTime: schedule.shiftStartTime || null,
        shiftEndTime: schedule.shiftEndTime || null,
      },
    };
  }

  private toEmployeeUpdatePayload(id: string, employee: any): any {
    if (!employee?.personal || !employee?.professional) {
      return { ...employee, id };
    }

    const organization = employee.organization ?? {};
    const schedule = employee.schedule ?? {};

    return {
      id,
      userId: employee.userId,
      firstName: employee.personal.firstName,
      lastName: employee.personal.lastName,
      dob: this.formatDate(employee.personal.dob),
      gender: employee.personal.gender,
      bloodGroup: employee.personal.bloodGroup,
      aadhaarNo: stripAadhaarDigits(String(employee.personal.aadhaarNumber ?? '')) || null,
      panNo: employee.personal.panNumber?.toUpperCase?.() ?? employee.personal.panNumber,
      mobile: employee.personal.mobile,
      alternateMobile: employee.personal.alternateMobile,
      email: employee.personal.email,
      address: employee.personal.address,
      employeeId: employee.professional.employeeId === 'Auto-generated' ? null : employee.professional.employeeId,
      joiningDate: this.formatDate(employee.professional.joiningDate),
      designation: employee.professional.designation || null,
      experience: Number(employee.professional.experience || 0),
      salaryGrade: employee.professional.salaryGrade,
      employmentType: employee.professional.employmentType,
      qualifications: this.mapQualifications(employee.professional.qualifications).join('; '),
      bankAccountNumber: employee.professional.bankDetails?.accountNumber,
      bankIfscCode: employee.professional.bankDetails?.ifscCode,
      bankName: employee.professional.bankDetails?.bankName,
      employeeTypeId: organization.employeeTypeId || null,
      portalRoleId: organization.portalRoleId || null,
      departmentId: organization.departmentId || null,
      reportingManagerId: organization.reportingManagerId || null,
      shiftStartTime: schedule.shiftStartTime || null,
      shiftEndTime: schedule.shiftEndTime || null,
      portalAccess: organization.portalAccess === 'Enabled' || organization.portalAccess === true,
      username: organization.username,
      isActive: true,
    };
  }
}
