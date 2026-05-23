import { Component, EventEmitter, Output, Input, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PERSON_NAME_MAX_LENGTH,
  PREV_CLASS_MAX_LENGTH,
  PREV_SCHOOL_MAX_LENGTH,
  SELECT_PLACEHOLDER,
  TC_NUMBER_MAX_LENGTH,
} from '../../../shared/constants/form.constants';
import { DynamicArrayFieldComponent } from '../../../shared/form-controls/dynamic-array-field/dynamic-array-field.component';
import {
  aadhaarValidationConfig,
  aadhaarValidator,
  discountValidationConfig,
  discountValueValidator,
  sanitizeDiscountValueInput,
  formatAadhaarDisplay,
  nameValidationConfig,
  alphanumericValidator,
  alphanumericValidationConfig,
  maxLengthValidator,
  nameValidator,
  stripAadhaarDigits,
  textMaxLengthValidationConfig,
} from '../../../shared/utils/form-validators.util';
import {
  controlNamesFromFieldKeys,
  validateFormControls,
} from '../../../shared/utils/form-validation.util';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import {
  FileUploadComponent,
  SelectedUploadFile,
} from '../../../shared/components/file-upload/file-upload.component';
import { FormTab } from '../../../shared/interfaces/form-layout';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  enumToOptions,
  Gender,
  BloodGroup,
  PaymentMode,
} from '../../../shared/enums/field-options.enum';
import { StudentService } from '../../../core/services/student.service';
import { ClassService } from '../../../core/services/class.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { ClassFeeAmountService } from '../../../core/services/class-fee-amount.service';
import { formatInr, normalizeClassAmounts } from '../../fees/fees.shared';

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
  host: { class: 'add-student-page form-page-shell' },
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DynamicFieldComponent,
    DynamicArrayFieldComponent,
    FileUploadComponent,
    ActionButtonComponent,
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
  selectedPhoto: SelectedUploadFile | null = null;
  selectedDocuments: Record<string, SelectedUploadFile> = {};

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
    photo: {
      type: 'file',
      controlName: 'photo',
      label: '',
      fileMode: 'avatar',
      accept: 'image/png,image/jpeg',
    },
    admissionNo: {
      type: 'input',
      controlName: 'admissionNo',
      label: 'Admission number',
      placeholder: 'Auto generated admission number',
      disabled: true,
    },
    firstName: {
      type: 'input',
      controlName: 'firstName',
      label: 'First name',
      placeholder: 'First Name',
      inputFormat: 'name',
      maxLength: PERSON_NAME_MAX_LENGTH,
      validations: nameValidationConfig(true, PERSON_NAME_MAX_LENGTH).validations,
    },
    middleName: {
      type: 'input',
      controlName: 'middleName',
      label: 'Middle name',
      placeholder: 'Middle Name',
      inputFormat: 'name',
      maxLength: PERSON_NAME_MAX_LENGTH,
      validations: nameValidationConfig(false, PERSON_NAME_MAX_LENGTH).validations,
    },
    lastName: {
      type: 'input',
      controlName: 'lastName',
      label: 'Last name',
      placeholder: 'Last Name',
      inputFormat: 'name',
      maxLength: PERSON_NAME_MAX_LENGTH,
      validations: nameValidationConfig(true, PERSON_NAME_MAX_LENGTH).validations,
    },
    dob: {
      type: 'datepicker',
      controlName: 'dob',
      label: 'Date of birth',
      validations: [
        { name: 'required', message: 'DOB is required', validator: Validators.required },
      ],
    },
    gender: {
      type: 'badges',
      controlName: 'gender',
      label: 'Gender',
      options: enumToOptions(Gender),
      validations: [
        { name: 'required', message: 'Gender is required', validator: Validators.required },
      ],
    },
    bloodGroup: {
      type: 'select',
      controlName: 'bloodGroup',
      label: 'Blood group',
      placeholder: SELECT_PLACEHOLDER,
      options: enumToOptions(BloodGroup),
    },
    cast: {
      type: 'input',
      controlName: 'cast',
      label: 'Cast',
      placeholder: 'Cast',
      inputFormat: 'name',
      validations: nameValidationConfig().validations,
    },
    category: {
      type: 'select',
      controlName: 'category',
      label: 'Category',
      placeholder: SELECT_PLACEHOLDER,
      options: [
        { label: 'ST', value: 'ST' },
        { label: 'SC', value: 'SC' },
        { label: 'OBC(SEBC)', value: 'OBC(SEBC)' },
        { label: 'General', value: 'General' },
      ],
    },
    mobile: {
      type: 'input',
      inputType: 'tel',
      controlName: 'mobile',
      label: 'Mobile number',
      placeholder: '10-digit number',
      validations: [
        { name: 'required', message: 'Mobile is required', validator: Validators.required },
        {
          name: 'pattern',
          message: 'Invalid mobile',
          validator: Validators.pattern('^[0-9]{10}$'),
        },
      ],
    },
    email: {
      type: 'input',
      inputType: 'email',
      controlName: 'email',
      label: 'Email',
      placeholder: 'Email Address',
      validations: [{ name: 'email', message: 'Invalid email', validator: Validators.email }],
    },
    aadhaar: {
      type: 'input',
      controlName: 'aadhaar',
      label: 'Aadhaar number',
      placeholder: 'XXXX XXXX XXXX',
      inputFormat: 'aadhaar',
      validations: aadhaarValidationConfig().validations,
    },
    address: {
      type: 'textarea',
      controlName: 'address',
      label: 'Address',
      placeholder: 'Full residential address',
      validations: [
        { name: 'required', message: 'Address is required', validator: Validators.required },
      ],
    },

    fatherName: {
      type: 'input',
      controlName: 'fatherName',
      label: "Father's name",
      placeholder: 'Father Name',
      inputFormat: 'name',
      validations: nameValidationConfig(true).validations,
    },
    fatherMobile: {
      type: 'input',
      inputType: 'tel',
      controlName: 'fatherMobile',
      label: "Father's mobile",
      placeholder: '10-digit number',
      validations: [
        { name: 'required', message: 'Mobile is required', validator: Validators.required },
        {
          name: 'pattern',
          message: 'Invalid mobile',
          validator: Validators.pattern('^[0-9]{10}$'),
        },
      ],
    },
    fatherOcc: {
      type: 'input',
      controlName: 'fatherOcc',
      label: "Father's occupation",
      placeholder: 'Father Occupation',
      inputFormat: 'name',
      validations: nameValidationConfig().validations,
    },
    motherName: {
      type: 'input',
      controlName: 'motherName',
      label: "Mother's name",
      placeholder: 'Mother Name',
      inputFormat: 'name',
      validations: nameValidationConfig().validations,
    },
    motherMobile: {
      type: 'input',
      inputType: 'tel',
      controlName: 'motherMobile',
      label: "Mother's mobile",
      placeholder: '10-digit number',
      validations: [
        {
          name: 'pattern',
          message: 'Invalid mobile',
          validator: Validators.pattern('^[0-9]{10}$'),
        },
      ],
    },
    motherOcc: {
      type: 'input',
      controlName: 'motherOcc',
      label: "Mother's occupation",
      placeholder: 'Mother Occupation',
      inputFormat: 'name',
      validations: nameValidationConfig().validations,
    },

    admissionDate: {
      type: 'datepicker',
      controlName: 'admissionDate',
      label: 'Admission date',
      validations: [
        { name: 'required', message: 'Admission date is required', validator: Validators.required },
      ],
    },
    academicYear: {
      type: 'select',
      controlName: 'academicYearId',
      label: 'Academic year',
      options: [],
      validations: [
        { name: 'required', message: 'Academic year is required', validator: Validators.required },
      ],
    },
    class: {
      type: 'select',
      controlName: 'classId',
      label: 'Class',
      placeholder: 'Select class',
      options: [],
      validations: [
        { name: 'required', message: 'Class is required', validator: Validators.required },
      ],
    },
    rollNumber: {
      type: 'input',
      controlName: 'rollNumber',
      label: 'Roll number',
      placeholder: 'Auto generated',
      disabled: true,
    },
    prevSchool: {
      type: 'input',
      controlName: 'prevSchool',
      label: 'Previous school name',
      placeholder: 'Previous School Name',
      maxLength: PREV_SCHOOL_MAX_LENGTH,
      validations: textMaxLengthValidationConfig(PREV_SCHOOL_MAX_LENGTH).validations,
    },
    prevClass: {
      type: 'input',
      controlName: 'prevClass',
      label: 'Previous class passed',
      placeholder: 'e.g. 10, XII, Class 10',
      inputFormat: 'alphanumeric',
      maxLength: PREV_CLASS_MAX_LENGTH,
      validations: alphanumericValidationConfig(PREV_CLASS_MAX_LENGTH).validations,
    },
    percentage: {
      type: 'input',
      controlName: 'percentage',
      label: 'Percentage / CGPA',
      placeholder: 'e.g. 85% / 8.5 CGPA',
    },
    tcNo: {
      type: 'input',
      controlName: 'tcNo',
      label: 'TC number',
      placeholder: 'TC Number',
      inputFormat: 'alphanumeric',
      maxLength: TC_NUMBER_MAX_LENGTH,
      validations: alphanumericValidationConfig(TC_NUMBER_MAX_LENGTH).validations,
    },

    discountType: {
      type: 'select',
      controlName: 'discountType',
      label: 'Discount type',
      placeholder: SELECT_PLACEHOLDER,
      options: [
        { label: 'Merit scholarship', value: 'merit' },
        { label: 'Staff ward', value: 'staff' },
        { label: 'Sibling discount', value: 'sibling' },
        { label: 'RTE', value: 'rte' },
        { label: 'Custom', value: 'custom' },
      ],
    },
    discountUnit: {
      type: 'select',
      controlName: 'discountUnit',
      label: 'Discount unit',
      placeholder: SELECT_PLACEHOLDER,
      options: [
        { label: '%', value: '%' },
        { label: 'Rs', value: 'amount' },
      ],
    },
    discountValue: {
      type: 'input',
      inputType: 'tel',
      inputFormat: 'discount',
      controlName: 'discountValue',
      label: 'Discount value',
      placeholder: 'Enter value',
      validations: discountValidationConfig(() => null).validations,
    },
    discountRemarks: {
      type: 'input',
      controlName: 'discountRemarks',
      label: 'Discount remarks',
      placeholder: 'Reason for discount',
    },
    paymentMode: {
      type: 'select',
      controlName: 'paymentMode',
      label: 'Payment mode',
      options: enumToOptions(PaymentMode, (value) =>
        value === PaymentMode.OneTime ? 'One-time' : value.charAt(0).toUpperCase() + value.slice(1),
      ),
      validations: [
        { name: 'required', message: 'Payment mode is required', validator: Validators.required },
      ],
    },
    firstDueDate: {
      type: 'datepicker',
      controlName: 'firstDueDate',
      label: 'First due date',
      validations: [
        { name: 'required', message: 'First due date is required', validator: Validators.required },
      ],
    },

    remarks: {
      type: 'textarea',
      controlName: 'remarks',
      label: 'Remarks (optional)',
      placeholder: 'Any special notes about the student...',
    },
  };

  readonly formTabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Photo & basic details',
          icon: 'account_circle',
          layout: 'photo-grid',
          fields: [
            'photo',
            'firstName',
            'middleName',
            'lastName',
            'dob',
            'gender',
            'bloodGroup',
            'cast',
            'category',
            'aadhaar',
            'mobile',
            'email',
            'address',
          ],
        },
        {
          title: 'Parent / Guardian details',
          icon: 'group',
          layout: 'grid3',
          fields: [
            'fatherName',
            'fatherMobile',
            'fatherOcc',
            'motherName',
            'motherMobile',
            'motherOcc',
          ],
        },
      ],
    },
    {
      stepIndex: 1,
      sections: [
        {
          title: 'Admission details',
          icon: 'school',
          layout: 'grid3',
          fields: ['academicYear', 'admissionDate', 'admissionNo'],
        },
        {
          title: 'Class & section',
          icon: 'co_present',
          layout: 'grid3',
          fields: ['class', 'rollNumber'],
        },
        {
          title: 'Previous school',
          icon: 'domain',
          layout: 'grid2',
          fields: ['prevSchool', 'prevClass', 'percentage', 'tcNo'],
        },
      ],
    },
    {
      stepIndex: 2,
      sections: [
        {
          title: 'Fee structure',
          icon: 'payments',
          layout: 'fee-structure',
          fields: [],
        },
        {
          title: 'Discount / Concession',
          icon: 'local_offer',
          layout: 'grid3',
          fields: ['discountType', 'discountUnit', 'discountValue', 'discountRemarks'],
        },
        {
          title: 'Payment schedule',
          icon: 'event',
          layout: 'grid2',
          fields: ['paymentMode', 'firstDueDate'],
        },
      ],
    },
    {
      stepIndex: 3,
      sections: [
        { title: 'Required documents', icon: 'folder', layout: 'document-grid', fields: [] },
        { title: 'Custom fields', icon: 'tune', layout: 'custom-fields', fields: [] },
        { title: 'Additional notes', icon: 'notes', layout: 'grid2', fields: ['remarks'] },
      ],
    },
    {
      stepIndex: 4,
      sections: [{ title: 'Review', icon: 'checklist', layout: 'review', fields: [] }],
    },
  ];

  feeStructureRows: FeeStructureRow[] = [];
  feeStructureLoading = false;
  hasActiveFeeStructure = false;
  /** Version locked at student admission — used in edit/view (not latest published). */
  private assignedFeeStructureVersionId = '';
  assignedFeeStructureVersionLabel = '';
  private feeStructureTotal = 0;

  readonly feeTotalLabel = 'Total fees';

  readonly documentChecklist: ReadonlyArray<DocumentChecklistItem> = [
    { icon: 'badge', name: 'Aadhaar card', sub: '', uploaded: false },
    { icon: 'verified', name: 'Birth certificate', sub: '', uploaded: false },
    { icon: 'description', name: 'Transfer certificate', sub: '', uploaded: false },
    { icon: 'image', name: 'Passport photo', sub: '', uploaded: false },
    { icon: 'article', name: 'Previous marksheet', sub: '', uploaded: false },
    { icon: 'home', name: 'Address proof', sub: '', uploaded: false },
  ];

  private readonly tabFieldKeys: Record<number, string[]> = {
    0: [
      'firstName',
      'middleName',
      'lastName',
      'dob',
      'gender',
      'bloodGroup',
      'cast',
      'category',
      'aadhaar',
      'mobile',
      'email',
      'address',
      'fatherName',
      'fatherMobile',
      'fatherOcc',
      'motherName',
      'motherMobile',
      'motherOcc',
    ],
    1: ['admissionDate', 'academicYear', 'class', 'prevSchool', 'prevClass', 'percentage', 'tcNo'],
    2: [
      'discountType',
      'discountUnit',
      'discountValue',
      'discountRemarks',
      'paymentMode',
      'firstDueDate',
    ],
    3: ['remarks', 'customFields'],
  };

  readonly genderOptions = enumToOptions(Gender);

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
    {
      title: 'Custom fields',
      icon: 'tune',
      items: [
        { label: 'Additional information', key: 'customFields', full: true, emptyText: 'None' },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private studentService: StudentService,
    private classService: ClassService,
    private academicYearService: AcademicYearService,
    private classFeeAmountService: ClassFeeAmountService,
    private cdr: ChangeDetectorRef,
  ) {
    this.studentForm = this.fb.group({
      photo: [null],
      admissionNo: [{ value: '', disabled: true }],
      firstName: ['', [Validators.required, nameValidator(PERSON_NAME_MAX_LENGTH)]],
      middleName: ['', nameValidator(PERSON_NAME_MAX_LENGTH)],
      lastName: ['', [Validators.required, nameValidator(PERSON_NAME_MAX_LENGTH)]],
      dob: ['', Validators.required],
      gender: ['Male', Validators.required],
      bloodGroup: [null],
      cast: ['', nameValidator()],
      category: [null],
      mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      email: ['', Validators.email],
      aadhaar: ['', aadhaarValidator()],
      address: ['', Validators.required],
      fatherName: ['', [Validators.required, nameValidator()]],
      fatherMobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      fatherOcc: ['', nameValidator()],
      motherName: ['', nameValidator()],
      motherMobile: ['', Validators.pattern('^[0-9]{10}$')],
      motherOcc: ['', nameValidator()],
      customFields: [[]],

      admissionDate: ['', Validators.required],
      academicYearId: ['', Validators.required],
      classId: ['', Validators.required],
      rollNumber: [{ value: '', disabled: true }],
      prevSchool: ['', maxLengthValidator(PREV_SCHOOL_MAX_LENGTH)],
      prevClass: ['', alphanumericValidator(PREV_CLASS_MAX_LENGTH)],
      percentage: [''],
      tcNo: ['', alphanumericValidator(TC_NUMBER_MAX_LENGTH)],

      discountType: [null],
      discountUnit: [null],
      discountValue: [null],
      discountRemarks: [''],
      paymentMode: ['', Validators.required],
      firstDueDate: ['', Validators.required],

      remarks: [''],
      status: ['Active'],
    });
  }

  ngOnInit() {
    this.setupDiscountValueValidation();
    this.loadAcademicYears();
    this.loadClasses();
    if (this.studentId && this.mode !== 'add') {
      this.loadStudentData(this.studentId);
    }

    if (this.mode === 'add') {
      this.setupAutoGeneration();
      this.studentForm.patchValue({
        gender: 'Male',
        admissionDate: this.today(),
      });
    }
  }

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private setupDiscountValueValidation(): void {
    const unitControl = this.studentForm.get('discountUnit');
    const valueControl = this.studentForm.get('discountValue');
    if (!unitControl || !valueControl) {
      return;
    }

    const applyValidators = () => {
      valueControl.setValidators([discountValueValidator(() => unitControl.value)]);
      valueControl.updateValueAndValidity({ emitEvent: false });
    };

    applyValidators();

    unitControl.valueChanges.subscribe((unit) => {
      const sanitized = sanitizeDiscountValueInput(String(valueControl.value ?? ''), unit);
      const next = sanitized === '' ? null : sanitized;
      if (valueControl.value !== next) {
        valueControl.setValue(next);
      }
      applyValidators();
      valueControl.updateValueAndValidity();
    });
  }

  private setupAutoGeneration() {
    // Admission No generation
    this.studentForm.get('academicYearId')?.valueChanges.subscribe((yearId) => {
      if (yearId) {
        this.generateAdmissionNo(yearId);
        const classId = this.studentForm.get('classId')?.value;
        if (classId) {
          this.generateRollNumber(yearId, classId);
          this.loadFeeStructure(classId, yearId);
        } else {
          this.clearFeeStructure();
        }
      } else {
        this.clearFeeStructure();
      }
    });

    this.studentForm.get('classId')?.valueChanges.subscribe((classId) => {
      const yearId = this.studentForm.get('academicYearId')?.value;
      if (classId && yearId) {
        this.generateRollNumber(yearId, classId);
        this.loadFeeStructure(classId, yearId);
      } else {
        this.clearFeeStructure();
      }
    });
  }

  get feeStructureTitle(): string {
    const classId = this.studentForm.get('classId')?.value;
    const className = this.classes.find((c) => String(c.id) === String(classId))?.name;
    let title = className ? `Fee structure — ${className}` : 'Fee structure';
    if (this.mode !== 'add' && this.assignedFeeStructureVersionLabel) {
      title += ` (${this.assignedFeeStructureVersionLabel})`;
    }
    return title;
  }

  get feeTotalAmount(): string {
    return formatInr(this.feeStructureTotal);
  }

  get feeStructureEmptyHint(): string {
    const classId = this.studentForm.get('classId')?.value;
    const yearId = this.studentForm.get('academicYearId')?.value;
    if (!classId || !yearId) {
      return 'Select academic year and class to view fee structure';
    }
    return 'No published fee structure for this academic year. Publish fees in Fee Structure before admitting students.';
  }

  private isAdmissionFeeStructureReady(statusLabel: string): boolean {
    return statusLabel === 'Active' || statusLabel === 'Published';
  }

  private loadFeeStructure(classId: string, academicYearId: string): void {
    if (this.mode !== 'add') {
      this.loadFeeStructureForEdit(classId, academicYearId);
      return;
    }

    this.feeStructureLoading = true;
    this.hasActiveFeeStructure = false;
    this.feeStructureRows = [];
    this.feeStructureTotal = 0;
    this.cdr.detectChanges();

    this.classFeeAmountService.getClassAmountsForAdmission(classId, academicYearId).subscribe({
      next: (data) => {
        const normalized = normalizeClassAmounts(data);
        if (!this.isAdmissionFeeStructureReady(normalized.versionStatusLabel) || !normalized.items.length) {
          this.clearFeeStructure();
          this.cdr.detectChanges();
          return;
        }
        this.hasActiveFeeStructure = true;
        this.feeStructureRows = normalized.items.map((item) => ({
          name: item.feeTypeName,
          amount: formatInr(item.amount),
        }));
        this.feeStructureTotal = normalized.totalAmount;
        this.feeStructureLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.clearFeeStructure();
        this.feeStructureLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadFeeStructureForEdit(classId: string, academicYearId: string): void {
    this.feeStructureLoading = true;
    this.feeStructureRows = [];
    this.feeStructureTotal = 0;
    this.cdr.detectChanges();

    const versionId = this.assignedFeeStructureVersionId;
    const request$ = versionId
      ? this.classFeeAmountService.getClassAmounts(classId, academicYearId, versionId)
      : this.classFeeAmountService.getClassAmountsForAdmission(classId, academicYearId);

    request$.subscribe({
      next: (data) => {
        const normalized = normalizeClassAmounts(data);
        this.assignedFeeStructureVersionLabel =
          normalized.versionNumber > 0
            ? `V${normalized.versionNumber} · ${normalized.versionStatusLabel}`
            : normalized.versionStatusLabel;
        this.feeStructureRows = normalized.items.map((item) => ({
          name: item.feeTypeName,
          amount: formatInr(item.amount),
        }));
        this.feeStructureTotal = normalized.totalAmount;
        this.hasActiveFeeStructure = normalized.items.length > 0;
        this.feeStructureLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.clearFeeStructure();
        this.feeStructureLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private clearFeeStructure(): void {
    this.feeStructureRows = [];
    this.feeStructureTotal = 0;
    this.feeStructureLoading = false;
    this.hasActiveFeeStructure = false;
    if (this.mode === 'add') {
      this.assignedFeeStructureVersionLabel = '';
    }
  }

  private generateAdmissionNo(academicYearId: string) {
    this.studentService.getNextAdmissionNo(academicYearId).subscribe({
      next: (res) => {
        this.studentForm.patchValue({ admissionNo: res.admissionNo });
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Error generating admission number', 'Close', { duration: 3000 }),
    });
  }

  private generateRollNumber(academicYearId: string, classId: string) {
    this.studentService.getNextRollNumber(academicYearId, classId).subscribe({
      next: (res) => {
        this.studentForm.patchValue({ rollNumber: res.rollNumber });
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error generating roll number', 'Close', { duration: 3000 }),
    });
  }

  loadAcademicYears() {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        this.academicYears = years || [];
        this.configs['academicYear'].options = this.academicYears.map((year: any) => ({
          label: year.name,
          value: year.id,
        }));
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading academic years', 'Close', { duration: 3000 }),
    });
  }

  loadClasses() {
    this.classService.getClassDropdown().subscribe({
      next: (classes) => {
        this.classes = classes || [];
        this.configs['class'].options = this.classes.map((c: any) => ({
          label: c.name,
          value: c.id,
        }));
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading classes', 'Close', { duration: 3000 }),
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

  /** Read-only rows for view mode (API-loaded custom fields). */
  get customFieldsForDisplay(): { label: string; value: string }[] {
    const raw = this.studentForm.get('customFields')?.value;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((r: { label?: string; value?: string }) => ({
        label: String(r?.label ?? '').trim(),
        value: String(r?.value ?? '').trim(),
      }))
      .filter((r) => r.label || r.value);
  }

  loadStudentData(id: string) {
    this.studentService.getStudentById(id).subscribe({
      next: (data: any) => {
        this.patchForm(data);
        if (this.mode === 'view') {
          this.studentForm.disable({ emitEvent: false });
        }
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading student data', 'Close', { duration: 3000 }),
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
      aadhaar: data.aadhaarNo ? formatAadhaarDisplay(String(data.aadhaarNo)) : '',
      cast: data.caste ?? data.cast,
      category: data.category,
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
      status: data.status,
      customFields: (data.customFields ?? []).map(
        (f: { label?: string; value?: string; fieldLabel?: string; fieldValue?: string }) => ({
          label: f.label ?? f.fieldLabel ?? '',
          value: f.value ?? f.fieldValue ?? '',
        }),
      ),
    });

    this.assignedFeeStructureVersionId = String(
      academic?.feeStructureVersionId ?? academic?.FeeStructureVersionId ?? '',
    );

    const classId = academic?.classId;
    const yearId = academic?.academicYearId;
    if (classId && yearId) {
      this.loadFeeStructure(classId, yearId);
    }
  }

  // ════════════════════════════════════════
  // TAB NAVIGATION
  // ════════════════════════════════════════
  goTab(index: number) {
    if (index > this.currentTab && !this.validateTab(this.currentTab)) {
      return;
    }
    this.currentTab = index;
    if (index === 2) {
      this.refreshFeeStructureForCurrentSelection();
    }
  }

  nextTab() {
    if (this.currentTab === this.finalTabIndex) {
      this.saveStudent();
      return;
    }

    if (!this.validateTab(this.currentTab)) {
      const feesTabBlocked =
        this.mode === 'add' && this.currentTab === 2 && !this.hasActiveFeeStructure;
      if (!feesTabBlocked) {
        this.snackBar.open('Please fix errors on this step before continuing', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      }
      return;
    }

    this.currentTab++;
    if (this.mode === 'add' && this.currentTab === 2) {
      this.refreshFeeStructureForCurrentSelection();
    }
  }

  private validateTab(tab: number): boolean {
    const keys = this.tabFieldKeys[tab] ?? [];
    const controlNames = controlNamesFromFieldKeys(keys, this.configs);
    if (tab === 3) {
      controlNames.push('customFields');
    }
    if (this.mode === 'add' && tab === 2 && !this.hasActiveFeeStructure) {
      return false;
    }

    if (!validateFormControls(this.studentForm, controlNames)) {
      return false;
    }

    return true;
  }

  private refreshFeeStructureForCurrentSelection(): void {
    const classId = this.studentForm.get('classId')?.value;
    const yearId = this.studentForm.get('academicYearId')?.value;
    if (classId && yearId) {
      this.loadFeeStructure(classId, yearId);
    } else {
      this.clearFeeStructure();
    }
  }

  get feesTabFooterHint(): string {
    if (this.mode === 'add' && this.currentTab === 2 && !this.hasActiveFeeStructure && !this.feeStructureLoading) {
      return 'Publish fee structure before continuing';
    }
    return this.footerHints[this.currentTab] ?? '';
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

    if (this.mode === 'add' && !this.hasActiveFeeStructure) {
      this.snackBar.open(
        'Cannot add student without a published fee structure. Publish fees first.',
        'Close',
        { duration: 4000, panelClass: 'snack-error' },
      );
      return;
    }

    this.isSaving = true;

    // Prepare payload by mapping class selection to classId
    const rawValue = this.studentForm.getRawValue();

    const payload = {
      ...rawValue,
      academics: [
        {
          admissionDate: rawValue.admissionDate,
          academicYearId: rawValue.academicYearId,
          classId: rawValue.classId,
          rollNumber: rawValue.rollNumber,
        },
      ],
    };

    try {
      const saveObs =
        this.mode === 'edit' && this.studentId
          ? this.studentService.updateStudent(this.studentId, payload)
          : this.studentService.createStudent(payload);

      saveObs
        .pipe(
          finalize(() => {
            this.isSaving = false;
            this.cdr.detectChanges();
          }),
        )
        .subscribe({
          next: () => {
            this.snackBar.open(
              `Student ${this.mode === 'edit' ? 'updated' : 'saved'} successfully`,
              'Close',
              {
                duration: 3000,
                panelClass: 'snack-success',
              },
            );
            this.saved.emit();
          },
          error: (err) => {
            const errorMsg = err?.error?.message || err?.message || 'Error saving student';
            this.snackBar.open(errorMsg, 'Close', {
              duration: 4000,
              panelClass: 'snack-error',
            });
          },
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
    if (item.key === 'customFields' && Array.isArray(raw)) {
      const rows = raw as { label?: string; value?: string }[];
      if (!rows.length) {
        return item.emptyText ?? '-';
      }
      return rows
        .filter((r) => (r.label ?? '').trim() || (r.value ?? '').trim())
        .map((r) => `${(r.label ?? '').trim() || 'Field'}: ${(r.value ?? '').trim() || '—'}`)
        .join(' · ');
    }
    const displayValue = this.lookupDisplayValue(item.key, raw);
    if (displayValue) {
      return displayValue;
    }
    if (raw instanceof Date) {
      return this.formatDisplayDate(raw);
    }
    if (raw != null && String(raw).trim() !== '') {
      return String(raw);
    }
    return item.emptyText ?? '-';
  }

  onPhotoSelected(file: SelectedUploadFile): void {
    this.selectedPhoto = file;
  }

  onDocumentSelected(docName: string, file: SelectedUploadFile): void {
    this.selectedDocuments = {
      ...this.selectedDocuments,
      [docName]: file,
    };
  }

  setGender(gender: string): void {
    if (this.mode === 'view') return;
    this.studentForm.get('gender')?.setValue(gender);
    this.studentForm.get('gender')?.markAsTouched();
  }

  private lookupDisplayValue(key: string, raw: unknown): string {
    if (raw == null || String(raw).trim() === '') {
      return '';
    }

    if (key === 'classId') {
      return this.classes.find((item) => String(item.id) === String(raw))?.name ?? '';
    }

    if (key === 'academicYearId') {
      return this.academicYears.find((item) => String(item.id) === String(raw))?.name ?? '';
    }

    return '';
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
