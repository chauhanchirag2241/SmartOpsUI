import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';

import { StudentFilter } from '../../shared/enums/table-filters.enum';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly api = inject(ApiService);

  getStudents(
    pageIndex = 1, 
    pageSize = 10, 
    searchTerm = '', 
    sortColumn: string | null = null, 
    sortDirection: string | null = null,
    filter: StudentFilter = StudentFilter.All,
    classId: string | null = null
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString())
      .set('filter', filter.toString());
    
    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    if (sortColumn) {
      params = params.set('sortColumn', sortColumn);
    }
    if (sortDirection) {
      params = params.set('sortDirection', sortDirection);
    }
    if (classId) {
      params = params.set('classId', classId);
    }

    return this.api.get('students', params);
  }

  createStudent(studentData: any): Observable<any> {
    // Map frontend form data to the backend CreateStudentDto structure
    const payload = {
      admissionNo: studentData.admissionNo,
      firstName: studentData.firstName,
      middleName: studentData.middleName,
      lastName: studentData.lastName,
      dob: this.toDateOnlyString(studentData.dob),
      gender: studentData.gender,
      bloodGroup: studentData.bloodGroup,
      mobile: studentData.mobile,
      email: studentData.email,
      aadhaarNo: studentData.aadhaar,
      address: studentData.address,
      remarks: studentData.remarks,
      status: studentData.status,
      parents: [
        {
          relationType: 'Father',
          name: studentData.fatherName,
          mobile: studentData.fatherMobile,
          occupation: studentData.fatherOcc
        },
        {
          relationType: 'Mother',
          name: studentData.motherName,
          mobile: studentData.motherMobile,
          occupation: studentData.motherOcc
        }
      ],
      academics: [
        {
          admissionDate: this.toDateOnlyString(studentData.admissionDate),
          academicYearId: studentData.academicYearId,
          classId: studentData.classId,
          rollNumber: studentData.rollNumber
        }
      ],
      previousSchools: studentData.prevSchool ? [
        {
          schoolName: studentData.prevSchool,
          lastClassPassed: studentData.prevClass,
          percentageOrCgpa: studentData.percentage,
          tcNumber: studentData.tcNo
        }
      ] : [],
      feeConfigs: [
        {
          discountType: studentData.discountType,
          discountValue: (studentData.discountValue && !isNaN(studentData.discountValue)) ? Number(studentData.discountValue) : null,
          isPercentage: studentData.discountUnit === '%',
          discountRemarks: studentData.discountRemarks,
          paymentMode: studentData.paymentMode,
          firstDueDate: this.toDateOnlyString(studentData.firstDueDate)
        }
      ]
    };

    console.log('Sending student payload:', payload);
    return this.api.post('students', payload);
  }

  getStudentById(id: string): Observable<any> {
    return this.api.get(`students/${id}`);
  }

  updateStudent(id: string, studentData: any): Observable<any> {
    const payload = {
      id: id,
      admissionNo: studentData.admissionNo,
      firstName: studentData.firstName,
      middleName: studentData.middleName,
      lastName: studentData.lastName,
      dob: this.toDateOnlyString(studentData.dob),
      gender: studentData.gender,
      bloodGroup: studentData.bloodGroup,
      mobile: studentData.mobile,
      email: studentData.email,
      aadhaarNo: studentData.aadhaar,
      address: studentData.address,
      remarks: studentData.remarks,
      status: studentData.status,
      parents: [
        {
          relationType: 'Father',
          name: studentData.fatherName,
          mobile: studentData.fatherMobile,
          occupation: studentData.fatherOcc
        },
        {
          relationType: 'Mother',
          name: studentData.motherName,
          mobile: studentData.motherMobile,
          occupation: studentData.motherOcc
        }
      ],
      academics: [
        {
          admissionDate: this.toDateOnlyString(studentData.admissionDate),
          academicYearId: studentData.academicYearId,
          classId: studentData.classId,
          rollNumber: studentData.rollNumber
        }
      ],
      previousSchools: studentData.prevSchool ? [
        {
          schoolName: studentData.prevSchool,
          lastClassPassed: studentData.prevClass,
          percentageOrCgpa: studentData.percentage,
          tcNumber: studentData.tcNo
        }
      ] : [],
      feeConfigs: [
        {
          discountType: studentData.discountType,
          discountValue: (studentData.discountValue && !isNaN(studentData.discountValue)) ? Number(studentData.discountValue) : null,
          isPercentage: studentData.discountUnit === '%',
          discountRemarks: studentData.discountRemarks,
          paymentMode: studentData.paymentMode,
          firstDueDate: this.toDateOnlyString(studentData.firstDueDate)
        }
      ]
    };
    return this.api.put(`students/${id}`, payload);
  }

  deleteStudent(id: string): Observable<any> {
    return this.api.delete(`students/${id}`);
  }

  getNextAdmissionNo(academicYearId?: string): Observable<any> {
    let params = new HttpParams();
    if (academicYearId) {
      params = params.set('academicYearId', academicYearId);
    }
    return this.api.get('students/next-admission-no', params);
  }

  getNextRollNumber(academicYearId: string, classId: string): Observable<any> {
    const params = new HttpParams()
      .set('academicYearId', academicYearId)
      .set('classId', classId);
    return this.api.get('students/next-roll-number', params);
  }



  private toDateOnlyString(value: unknown): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return text.substring(0, 10);
    }

    const parts = text.split(/[-/]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}
