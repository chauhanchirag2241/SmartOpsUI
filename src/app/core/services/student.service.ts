import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly api = inject(ApiService);

  createStudent(studentData: any): Observable<any> {
    // Map frontend form data to the backend CreateStudentDto structure
    const payload = {
      admissionNo: studentData.admissionNo,
      firstName: studentData.firstName,
      middleName: studentData.middleName,
      lastName: studentData.lastName,
      dob: studentData.dob,
      gender: studentData.gender,
      bloodGroup: studentData.bloodGroup,
      mobile: studentData.mobile,
      email: studentData.email,
      aadhaarNo: studentData.aadhaar,
      address: studentData.address,
      remarks: studentData.remarks,
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
          admissionDate: studentData.admissionDate,
          academicYear: studentData.academicYear,
          class: studentData.class,
          section: studentData.section
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
          firstDueDate: studentData.firstDueDate
        }
      ]
    };

    console.log('Sending student payload:', payload);
    return this.api.post('students', payload);
  }
}
