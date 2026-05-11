import { Component, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { InputFieldComponent } from '../../../shared/form-controls/input-field/input-field.component';
import { SelectFieldComponent } from '../../../shared/form-controls/select-field/select-field.component';
import { DatepickerFieldComponent } from '../../../shared/form-controls/datepicker-field/datepicker-field.component';
import { TextareaFieldComponent } from '../../../shared/form-controls/textarea-field/textarea-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { StudentService } from '../../../core/services/student.service';

@Component({
  selector: 'app-add-student',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    InputFieldComponent,
    SelectFieldComponent,
    DatepickerFieldComponent,
    TextareaFieldComponent,
  ],
  templateUrl: './add-student.component.html',
  styleUrl: './add-student.component.css',
})
export class AddStudentComponent {
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  studentForm: FormGroup;
  currentTab = 0;
  isSaving = false;

  readonly tabs = [
    { label: 'Personal info', hint: 'Step 1 of 4 — Personal information' },
    { label: 'Academic', hint: 'Step 2 of 5 — Academic details' },
    { label: 'Fees', hint: 'Step 3 of 5 — Fees & payment' },
    { label: 'Documents', hint: 'Step 4 of 5 — Documents' },
    { label: 'Review', hint: 'Step 5 of 5 — Review & Submit' },
  ];

  readonly footerHints = [
    'Fill all required fields to continue',
    'Select class and section',
    'Review fee structure and set payment mode',
    'Upload required documents',
    'Review all details before submitting',
  ];

  readonly configs: Record<string, FormFieldConfig> = {
    firstName: { type: 'input', controlName: 'firstName', label: 'First name', placeholder: 'e.g. Rahul', validations: [{ name: 'required', message: 'First name is required', validator: Validators.required }] },
    middleName: { type: 'input', controlName: 'middleName', label: 'Middle name', placeholder: 'e.g. Kumar' },
    lastName: { type: 'input', controlName: 'lastName', label: 'Last name', placeholder: 'e.g. Patel', validations: [{ name: 'required', message: 'Last name is required', validator: Validators.required }] },
    dob: { type: 'datepicker', controlName: 'dob', label: 'Date of birth', validations: [{ name: 'required', message: 'DOB is required', validator: Validators.required }] },
    gender: { type: 'select', controlName: 'gender', label: 'Gender', options: [{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }], validations: [{ name: 'required', message: 'Gender is required', validator: Validators.required }] },
    bloodGroup: { type: 'select', controlName: 'bloodGroup', label: 'Blood group', options: [{ label: 'A+', value: 'A+' }, { label: 'A-', value: 'A-' }, { label: 'B+', value: 'B+' }, { label: 'B-', value: 'B-' }, { label: 'O+', value: 'O+' }, { label: 'O-', value: 'O-' }, { label: 'AB+', value: 'AB+' }, { label: 'AB-', value: 'AB-' }] },
    mobile: { type: 'input', inputType: 'tel', controlName: 'mobile', label: 'Mobile number', placeholder: '10-digit number', validations: [{ name: 'required', message: 'Mobile is required', validator: Validators.required }, { name: 'pattern', message: 'Invalid mobile', validator: Validators.pattern('^[0-9]{10}$') }] },
    email: { type: 'input', inputType: 'email', controlName: 'email', label: 'Email', placeholder: 'student@email.com', validations: [{ name: 'email', message: 'Invalid email', validator: Validators.email }] },
    aadhaar: { type: 'input', controlName: 'aadhaar', label: 'Aadhaar number', placeholder: 'xxxx xxxx xxxx' },
    address: { type: 'textarea', controlName: 'address', label: 'Address', placeholder: 'Full residential address', validations: [{ name: 'required', message: 'Address is required', validator: Validators.required }] },

    fatherName: { type: 'input', controlName: 'fatherName', label: "Father's name", placeholder: 'Full name', validations: [{ name: 'required', message: 'Father name is required', validator: Validators.required }] },
    fatherMobile: { type: 'input', inputType: 'tel', controlName: 'fatherMobile', label: "Father's mobile", placeholder: '10-digit number', validations: [{ name: 'required', message: 'Mobile is required', validator: Validators.required }] },
    fatherOcc: { type: 'input', controlName: 'fatherOcc', label: "Father's occupation", placeholder: 'e.g. Engineer' },
    motherName: { type: 'input', controlName: 'motherName', label: "Mother's name", placeholder: 'Full name' },
    motherMobile: { type: 'input', inputType: 'tel', controlName: 'motherMobile', label: "Mother's mobile", placeholder: '10-digit number' },
    motherOcc: { type: 'input', controlName: 'motherOcc', label: "Mother's occupation", placeholder: 'e.g. Teacher' },

    admissionDate: { type: 'datepicker', controlName: 'admissionDate', label: 'Admission date', validations: [{ name: 'required', message: 'Admission date is required', validator: Validators.required }] },
    academicYear: { type: 'select', controlName: 'academicYear', label: 'Academic year', options: [{ label: '2024-25', value: '2024-25' }, { label: '2025-26', value: '2025-26' }], validations: [{ name: 'required', message: 'Academic year is required', validator: Validators.required }] },
    class: { type: 'select', controlName: 'class', label: 'Class', placeholder: 'Select class', options: [{ label: 'Class 1', value: '1' }, { label: 'Class 2', value: '2' }, { label: 'Class 8', value: '8' }, { label: 'Class 9', value: '9' }, { label: 'Class 10', value: '10' }], validations: [{ name: 'required', message: 'Class is required', validator: Validators.required }] },
    section: { type: 'select', controlName: 'section', label: 'Section', placeholder: 'Select section', options: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }, { label: 'C', value: 'C' }, { label: 'D', value: 'D' }], validations: [{ name: 'required', message: 'Section is required', validator: Validators.required }] },
    prevSchool: { type: 'input', controlName: 'prevSchool', label: 'Previous school name', placeholder: 'School name' },
    prevClass: { type: 'input', controlName: 'prevClass', label: 'Previous class passed', placeholder: 'e.g. Class 9' },
    percentage: { type: 'input', controlName: 'percentage', label: 'Percentage / CGPA', placeholder: 'e.g. 85% / 8.5 CGPA' },
    tcNo: { type: 'input', controlName: 'tcNo', label: 'TC number', placeholder: 'Transfer certificate no.' },

    discountType: { type: 'select', controlName: 'discountType', label: 'Discount type', placeholder: 'None', options: [{ label: 'Merit scholarship', value: 'merit' }, { label: 'Staff ward', value: 'staff' }, { label: 'Sibling discount', value: 'sibling' }, { label: 'RTE', value: 'rte' }, { label: 'Custom', value: 'custom' }] },
    discountRemarks: { type: 'input', controlName: 'discountRemarks', label: 'Discount remarks', placeholder: 'Reason for discount' },
    paymentMode: { type: 'select', controlName: 'paymentMode', label: 'Payment mode', options: [{ label: 'One-time', value: 'one-time' }, { label: 'Quarterly', value: 'quarterly' }, { label: 'Monthly', value: 'monthly' }], validations: [{ name: 'required', message: 'Payment mode is required', validator: Validators.required }] },
    firstDueDate: { type: 'datepicker', controlName: 'firstDueDate', label: 'First due date', validations: [{ name: 'required', message: 'First due date is required', validator: Validators.required }] },

    remarks: { type: 'textarea', controlName: 'remarks', label: 'Remarks (optional)', placeholder: 'Any special notes about the student...' },
  };

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private studentService: StudentService,
    private cdr: ChangeDetectorRef,
  ) {
    this.studentForm = this.fb.group({
      firstName: ['', Validators.required],
      middleName: [''],
      lastName: ['', Validators.required],
      dob: ['', Validators.required],
      gender: ['', Validators.required],
      bloodGroup: [''],
      mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      email: ['', Validators.email],
      aadhaar: [''],
      address: ['', Validators.required],
      fatherName: ['', Validators.required],
      fatherMobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      fatherOcc: [''],
      motherName: [''],
      motherMobile: [''],
      motherOcc: [''],

      admissionDate: ['', Validators.required],
      academicYear: ['', Validators.required],
      class: ['', Validators.required],
      section: ['', Validators.required],
      prevSchool: [''],
      prevClass: [''],
      percentage: [''],
      tcNo: [''],

      discountType: [''],
      discountValue: [''],
      discountUnit: ['%'],
      discountRemarks: [''],
      paymentMode: ['', Validators.required],
      firstDueDate: ['', Validators.required],

      remarks: [''],
    });
  }


  // ════════════════════════════════════════
  // TAB NAVIGATION
  // ════════════════════════════════════════
  goTab(index: number) {
    this.currentTab = index;
  }

  nextTab() {
    if (this.currentTab === 4) {
      this.saveStudent();
      return;
    }

    // Validate current section before proceeding (Optional enhancement)
    this.currentTab++;
  }

  prevTab() {
    if (this.currentTab > 0) {
      this.currentTab--;
    }
  }

  // ════════════════════════════════════════
  // API CALL SIMULATION
  // ════════════════════════════════════════
  saveStudent() {
    if (this.studentForm.invalid) {
      this.studentForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields correctly', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.isSaving = true;
    try {
      this.studentService.createStudent(this.studentForm.value)
        .pipe(finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }))
        .subscribe({
          next: (res) => {
            this.snackBar.open('Student saved successfully', 'Close', {
              duration: 3000,
              panelClass: 'snack-success',
            });
            this.saved.emit();
          },
          error: (err) => {
            const errorMsg = err?.error?.message || err?.message || 'Error saving student';
            this.snackBar.open(errorMsg, 'Close', {
              duration: 4000,
              panelClass: 'snack-error',
            });
          }
        });
    } catch (e) {
      this.isSaving = false;
      this.snackBar.open('Unexpected error occurred', 'Close', { duration: 3000 });
    }
  }

  getControlLabel(key: string): string {
    return this.configs[key]?.label || key;
  }

  getControlValue(key: string): any {
    const val = this.studentForm.get(key)?.value;
    if (val instanceof Date) {
      return val.toLocaleDateString();
    }
    return val || '-';
  }
}
