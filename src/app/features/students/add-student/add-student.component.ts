import { Component, EventEmitter, Output, Input, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { enumToOptions, Gender, BloodGroup, PaymentMode } from '../../../shared/enums/field-options.enum';
import { StudentService } from '../../../core/services/student.service';
import { ClassService } from '../../../core/services/class.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';

type FieldItem = {
  key: string;
  full?: boolean;
};

type FormCard = {
  tab: number;
  icon: string;
  title: string;
  grid: 'grid2' | 'grid3';
  fields: FieldItem[];
};

type FeeStructureRow = {
  name: string;
  amount: string;
};

type DocumentChecklistItem = {
  icon: string;
  name: string;
  sub: string;
  uploaded: boolean;
};

type ReviewItem = {
  label: string;
  key?: string;
  keys?: string[];
  full?: boolean;
  emptyText?: string;
};

type ReviewSection = {
  title: string;
  icon: string;
  items: ReviewItem[];
};

@Component({
  selector: 'app-add-student',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DynamicFieldComponent,
  ],
  templateUrl: './add-student.component.html',
  styleUrl: './add-student.component.css',
})
export class AddStudentComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() studentId?: string;

  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  /** Zero-based index of the last wizard step (review). */
  protected readonly finalTabIndex = 4;
  protected readonly totalTabs = 5;

  studentForm: FormGroup;
  currentTab = 0;
  isSaving = false;
  academicYears: any[] = [];
  classes: any[] = [];

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
    admissionNo: { type: 'input', controlName: 'admissionNo', label: 'Admission number', placeholder: 'Auto-generated', disabled: true },
    firstName: { type: 'input', controlName: 'firstName', label: 'First name', placeholder: 'e.g. Rahul', validations: [{ name: 'required', message: 'First name is required', validator: Validators.required }] },
    middleName: { type: 'input', controlName: 'middleName', label: 'Middle name', placeholder: 'e.g. Kumar' },
    lastName: { type: 'input', controlName: 'lastName', label: 'Last name', placeholder: 'e.g. Patel', validations: [{ name: 'required', message: 'Last name is required', validator: Validators.required }] },
    dob: { type: 'datepicker', controlName: 'dob', label: 'Date of birth', validations: [{ name: 'required', message: 'DOB is required', validator: Validators.required }] },
    gender: { type: 'select', controlName: 'gender', label: 'Gender', options: enumToOptions(Gender), validations: [{ name: 'required', message: 'Gender is required', validator: Validators.required }] },
    bloodGroup: { type: 'select', controlName: 'bloodGroup', label: 'Blood group', options: enumToOptions(BloodGroup) },
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
    academicYear: { type: 'select', controlName: 'academicYearId', label: 'Academic year', options: [], validations: [{ name: 'required', message: 'Academic year is required', validator: Validators.required }] },
    class: { type: 'select', controlName: 'classId', label: 'Class', placeholder: 'Select class', options: [], validations: [{ name: 'required', message: 'Class is required', validator: Validators.required }] },
    rollNumber: { type: 'input', controlName: 'rollNumber', label: 'Roll number', placeholder: 'Auto-assigned', disabled: true },
    prevSchool: { type: 'input', controlName: 'prevSchool', label: 'Previous school name', placeholder: 'School name' },
    prevClass: { type: 'input', controlName: 'prevClass', label: 'Previous class passed', placeholder: 'e.g. Class 9' },
    percentage: { type: 'input', controlName: 'percentage', label: 'Percentage / CGPA', placeholder: 'e.g. 85% / 8.5 CGPA' },
    tcNo: { type: 'input', controlName: 'tcNo', label: 'TC number', placeholder: 'Transfer certificate no.' },

    discountType: { type: 'select', controlName: 'discountType', label: 'Discount type', placeholder: 'None', options: [{ label: 'Merit scholarship', value: 'merit' }, { label: 'Staff ward', value: 'staff' }, { label: 'Sibling discount', value: 'sibling' }, { label: 'RTE', value: 'rte' }, { label: 'Custom', value: 'custom' }] },
    discountValue: { type: 'input', inputType: 'number', controlName: 'discountValue', label: 'Discount value', placeholder: '0' },
    discountUnit: { type: 'select', controlName: 'discountUnit', label: 'Discount unit', options: [{ label: '%', value: '%' }, { label: 'Rs', value: 'amount' }] },
    discountRemarks: { type: 'input', controlName: 'discountRemarks', label: 'Discount remarks', placeholder: 'Reason for discount' },
    paymentMode: { type: 'select', controlName: 'paymentMode', label: 'Payment mode', options: enumToOptions(PaymentMode, (value) => value === PaymentMode.OneTime ? 'One-time' : value.charAt(0).toUpperCase() + value.slice(1)), validations: [{ name: 'required', message: 'Payment mode is required', validator: Validators.required }] },
    firstDueDate: { type: 'datepicker', controlName: 'firstDueDate', label: 'First due date', validations: [{ name: 'required', message: 'First due date is required', validator: Validators.required }] },

    remarks: { type: 'textarea', controlName: 'remarks', label: 'Remarks (optional)', placeholder: 'Any special notes about the student...' },
  };

  readonly formCards: FormCard[] = [
    {
      tab: 0,
      icon: 'badge',
      title: 'Basic details',
      grid: 'grid3',
      fields: [
        { key: 'firstName' },
        { key: 'middleName' },
        { key: 'lastName' },
        { key: 'dob' },
        { key: 'gender' },
        { key: 'bloodGroup' },
        { key: 'mobile' },
        { key: 'email' },
        { key: 'aadhaar' },
        { key: 'address', full: true },
      ],
    },
    {
      tab: 0,
      icon: 'group',
      title: 'Parent / Guardian details',
      grid: 'grid3',
      fields: [
        { key: 'fatherName' },
        { key: 'fatherMobile' },
        { key: 'fatherOcc' },
        { key: 'motherName' },
        { key: 'motherMobile' },
        { key: 'motherOcc' },
      ],
    },
    {
      tab: 1,
      icon: 'school',
      title: 'Admission details',
      grid: 'grid3',
      fields: [{ key: 'admissionNo' }, { key: 'admissionDate' }, { key: 'academicYear' }],
    },
    {
      tab: 1,
      icon: 'co_present',
      title: 'Class & section',
      grid: 'grid3',
      fields: [{ key: 'class' }, { key: 'rollNumber' }],
    },
    {
      tab: 1,
      icon: 'domain',
      title: 'Previous school',
      grid: 'grid2',
      fields: [{ key: 'prevSchool' }, { key: 'prevClass' }, { key: 'percentage' }, { key: 'tcNo' }],
    },
    {
      tab: 2,
      icon: 'local_offer',
      title: 'Discount / Concession',
      grid: 'grid2',
      fields: [
        { key: 'discountType' },
        { key: 'discountValue' },
        { key: 'discountUnit' },
        { key: 'discountRemarks', full: true },
      ],
    },
    {
      tab: 2,
      icon: 'event',
      title: 'Payment schedule',
      grid: 'grid2',
      fields: [{ key: 'paymentMode' }, { key: 'firstDueDate' }],
    },
    {
      tab: 3,
      icon: 'notes',
      title: 'Additional notes',
      grid: 'grid2',
      fields: [{ key: 'remarks', full: true }],
    },
  ];

  readonly feeStructureRows: ReadonlyArray<FeeStructureRow> = [
    { name: 'Tuition fee', amount: 'Rs 12,000' },
    { name: 'Admission fee', amount: 'Rs 2,500' },
    { name: 'Exam fee', amount: 'Rs 1,500' },
    { name: 'Library fee', amount: 'Rs 500' },
    { name: 'Sports fee', amount: 'Rs 800' },
  ];

  readonly feeTotalLabel = 'Total fees';
  readonly feeTotalAmount = 'Rs 17,300';

  readonly documentChecklist: ReadonlyArray<DocumentChecklistItem> = [
    { icon: 'badge', name: 'Aadhaar card', sub: 'aadhaar_patel.pdf', uploaded: true },
    { icon: 'verified', name: 'Birth certificate', sub: 'Click to upload', uploaded: false },
    { icon: 'description', name: 'Transfer certificate', sub: 'Click to upload', uploaded: false },
    { icon: 'image', name: 'Passport photo', sub: 'photo_rahul.jpg', uploaded: true },
    { icon: 'article', name: 'Previous marksheet', sub: 'Click to upload', uploaded: false },
    { icon: 'home', name: 'Address proof', sub: 'Click to upload', uploaded: false },
  ];

  readonly reviewSections: ReadonlyArray<ReviewSection> = [
    {
      title: 'Personal & Parent Details',
      icon: 'person',
      items: [
        { label: 'Name', keys: ['firstName', 'middleName', 'lastName'] },
        { label: 'DOB', key: 'dob' },
        { label: 'Gender', key: 'gender' },
        { label: 'Mobile', key: 'mobile' },
        { label: 'Email', key: 'email' },
        { label: "Father's Name", key: 'fatherName' },
        { label: "Mother's Name", key: 'motherName' },
      ],
    },
    {
      title: 'Academic Details',
      icon: 'school',
      items: [
        { label: 'Academic Year', key: 'academicYearId' },
        { label: 'Class', key: 'classId' },
        { label: 'Admission Date', key: 'admissionDate' },
      ],
    },
    {
      title: 'Fee & Payment',
      icon: 'payments',
      items: [
        { label: 'Payment Mode', key: 'paymentMode' },
        { label: 'First Due Date', key: 'firstDueDate' },
        { label: 'Discount Type', key: 'discountType', emptyText: 'None' },
      ],
    },
    {
      title: 'Additional Info',
      icon: 'description',
      items: [{ label: 'Remarks', key: 'remarks', full: true, emptyText: 'No remarks provided' }],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private studentService: StudentService,
    private classService: ClassService,
    private academicYearService: AcademicYearService,
    private cdr: ChangeDetectorRef,
  ) {
    this.studentForm = this.fb.group({
      admissionNo: [{ value: '', disabled: true }],
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
      academicYearId: ['', Validators.required],
      classId: ['', Validators.required],
      rollNumber: [{ value: '', disabled: true }],
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
      status: ['Active']
    });
  }

  ngOnInit() {
    this.loadAcademicYears();
    this.loadClasses();
    if (this.studentId && this.mode !== 'add') {
      this.loadStudentData(this.studentId);
    }
  }

  loadAcademicYears() {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        this.academicYears = years || [];
        this.configs['academicYear'].options = this.academicYears.map((year: any) => ({
          label: year.name,
          value: year.id
        }));
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading academic years', 'Close', { duration: 3000 })
    });
  }

  loadClasses() {
    this.classService.getClassDropdown().subscribe({
      next: (classes) => {
        this.classes = classes || [];
        this.configs['class'].options = this.classes.map((c: any) => ({
          label: c.name,
          value: c.id
        }));
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading classes', 'Close', { duration: 3000 })
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') {
      return 'Edit student';
    }
    if (this.mode === 'view') {
      return 'View student';
    }
    return 'Add new student';
  }

  get progressWidthPercent(): number {
    return ((this.currentTab + 1) / this.totalTabs) * 100;
  }

  get cardsForCurrentTab(): FormCard[] {
    return this.formCards.filter((c) => c.tab === this.currentTab);
  }

  trackFormCard(_index: number, card: FormCard): string {
    return `${card.tab}-${card.title}`;
  }

  loadStudentData(id: string) {
    this.studentService.getStudentById(id).subscribe({
      next: (data: any) => {
        this.patchForm(data);
        if (this.mode === 'view') {
          this.studentForm.disable();
        }
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading student data', 'Close', { duration: 3000 })
    });
  }

  patchForm(data: any) {
    const father = data.parents?.find((p: any) => p.relationType === 'Father');
    const mother = data.parents?.find((p: any) => p.relationType === 'Mother');
    const academic = data.academics?.[0];
    const prevSchool = data.previousSchools?.[0];
    const feeConfig = data.feeConfigs?.[0];

    this.studentForm.patchValue({
      admissionNo: data.admissionNo,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      dob: this.toLocalDate(data.dob),
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      mobile: data.mobile,
      email: data.email,
      aadhaar: data.aadhaarNo,
      address: data.address,
      
      fatherName: father?.name,
      fatherMobile: father?.mobile,
      fatherOcc: father?.occupation,
      
      motherName: mother?.name,
      motherMobile: mother?.mobile,
      motherOcc: mother?.occupation,

      admissionDate: this.toLocalDate(academic?.admissionDate),
      academicYearId: academic?.academicYearId,
      classId: academic?.classId,
      rollNumber: academic?.rollNumber,

      prevSchool: prevSchool?.schoolName,
      prevClass: prevSchool?.lastClassPassed,
      percentage: prevSchool?.percentageOrCgpa,
      tcNo: prevSchool?.tcNumber,

      discountType: feeConfig?.discountType,
      discountValue: feeConfig?.discountValue,
      discountUnit: feeConfig?.isPercentage ? '%' : 'amount',
      discountRemarks: feeConfig?.discountRemarks,
      paymentMode: feeConfig?.paymentMode,
      firstDueDate: this.toLocalDate(feeConfig?.firstDueDate),

      remarks: data.remarks,
      status: data.status
    });
  }


  // ════════════════════════════════════════
  // TAB NAVIGATION
  // ════════════════════════════════════════
  goTab(index: number) {
    this.currentTab = index;
  }

  nextTab() {
    if (this.currentTab === this.finalTabIndex) {
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
    
    // Prepare payload by mapping class selection to classId
    const rawValue = this.studentForm.getRawValue();
    
    const payload = {
      ...rawValue,
      academics: [{
        admissionDate: rawValue.admissionDate,
        academicYearId: rawValue.academicYearId,
        classId: rawValue.classId,
        rollNumber: rawValue.rollNumber
      }]
    };

    try {
      const saveObs = (this.mode === 'edit' && this.studentId)
        ? this.studentService.updateStudent(this.studentId, payload)
        : this.studentService.createStudent(payload);

      saveObs
        .pipe(finalize(() => {
          this.isSaving = false;
          this.cdr.detectChanges();
        }))
        .subscribe({
          next: () => {
            this.snackBar.open(`Student ${this.mode === 'edit' ? 'updated' : 'saved'} successfully`, 'Close', {
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

  getReviewDisplay(item: ReviewItem): string {
    if (item.keys?.length) {
      const parts: string[] = [];
      for (const k of item.keys) {
        const raw = this.studentForm.get(k)?.value;
        if (raw instanceof Date) {
          parts.push(this.formatDisplayDate(raw));
        } else if (raw != null && String(raw).trim() !== '') {
          parts.push(String(raw));
        }
      }
      return parts.length ? parts.join(' ') : '-';
    }
    if (!item.key) {
      return '-';
    }
    const raw = this.studentForm.get(item.key)?.value;
    if (raw instanceof Date) {
      return this.formatDisplayDate(raw);
    }
    if (raw != null && String(raw).trim() !== '') {
      return String(raw);
    }
    return item.emptyText ?? '-';
  }

  private toLocalDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const [year, month, day] = String(value).substring(0, 10).split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private formatDisplayDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
  }
}
