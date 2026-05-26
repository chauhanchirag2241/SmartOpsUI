import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TeacherService } from '../../../core/services/teacher.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  FileUploadComponent,
  SelectedUploadFile,
} from '../../../shared/components/file-upload/file-upload.component';
import { DigitsOnlyDirective } from '../../../shared/directives/digits-only.directive';
import { LettersOnlyDirective } from '../../../shared/directives/letters-only.directive';
import { BloodGroup, enumToOptions, Gender } from '../../../shared/enums/field-options.enum';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  BANK_NAME_MAX_LENGTH,
  PERSON_NAME_MAX_LENGTH,
  SELECT_PLACEHOLDER,
} from '../../../shared/constants/form.constants';
import {
  aadhaarValidationConfig,
  aadhaarValidator,
  formatAadhaarDisplay,
  nameValidationConfig,
  dateOfBirthValidationConfig,
  noFutureDateValidator,
  nameValidator,
  panValidationConfig,
  panValidator,
  bankAccountValidator,
  bankNameValidator,
  clampExperienceValue,
  experienceValidator,
  ifscValidator,
  sanitizeBankAccountInput,
  sanitizeIfscInput,
  sanitizeExperienceInput,
  formatShiftRangeDisplay,
  normalizeTimeValue,
  optionalPositiveIntValidator,
  shiftEndTimeValidator,
  shiftStartTimeValidator,
  syncShiftTimeValidity,
} from '../../../shared/utils/form-validators.util';
import { validateFormControls } from '../../../shared/utils/form-validation.util';

import { FormSection, FormTab } from '../../../shared/interfaces/form-layout';

@Component({
  selector: 'app-add-teacher',
  standalone: true,
  host: { class: 'add-teacher-page form-page-shell' },
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    DynamicFieldComponent,
    ActionButtonComponent,
  ],
  templateUrl: './add-teacher.component.html',
  styleUrl: './add-teacher.component.css',
})
export class AddTeacherComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() teacherId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  teacherForm: FormGroup;
  currentStep = 0;
  selectedPhoto: SelectedUploadFile | null = null;
  readonly bloodGroupOptions = enumToOptions(BloodGroup);
  steps = [
    { title: 'Personal', icon: 'person' },
    { title: 'Professional', icon: 'work' },
    { title: 'Schedule & Access', icon: 'schedule' },
    { title: 'Review', icon: 'fact_check' },
  ];

  hints = [
    'Step 1 of 4 — Personal information',
    'Step 2 of 4 — Professional details',
    'Step 3 of 4 — Schedule and portal access',
    'Step 4 of 4 — Review & save',
  ];

  readonly configs: Record<string, FormFieldConfig> = {
    photo: {
      type: 'file',
      controlName: 'photo',
      label: '',
      fileMode: 'avatar',
      accept: 'image/png,image/jpeg',
    },
    firstName: {
      type: 'input',
      controlName: 'firstName',
      label: 'First name',
      className: 'col-3',
      placeholder: 'First Name',
      inputFormat: 'name',
      maxLength: PERSON_NAME_MAX_LENGTH,
      validations: nameValidationConfig(true, PERSON_NAME_MAX_LENGTH).validations,
    },
    lastName: {
      type: 'input',
      controlName: 'lastName',
      label: 'Last name',
      className: 'col-3',
      placeholder: 'Last Name',
      inputFormat: 'name',
      maxLength: PERSON_NAME_MAX_LENGTH,
      validations: nameValidationConfig(true, PERSON_NAME_MAX_LENGTH).validations,
    },
    dob: {
      type: 'datepicker',
      controlName: 'dob',
      label: 'Date of birth',
      className: 'col-3',
      maxDate: 'today',
      validations: dateOfBirthValidationConfig().validations,
    },
    gender: {
      type: 'badges',
      controlName: 'gender',
      label: 'Gender',
      className: 'col-3',
      options: enumToOptions(Gender),
      validations: [
        { name: 'required', message: 'Gender is required', validator: Validators.required },
      ],
    },
    bloodGroup: {
      type: 'select',
      controlName: 'bloodGroup',
      label: 'Blood group',
      className: 'col-2',
      placeholder: SELECT_PLACEHOLDER,
      options: enumToOptions(BloodGroup),
    },
    aadhaarNumber: {
      type: 'input',
      controlName: 'aadhaarNumber',
      label: 'Aadhaar number',
      className: 'col-2',
      placeholder: 'XXXX XXXX XXXX',
      inputFormat: 'aadhaar',
      validations: aadhaarValidationConfig().validations,
    },
    panNumber: {
      type: 'input',
      controlName: 'panNumber',
      label: 'PAN number',
      className: 'col-2',
      placeholder: 'ABCDE1234F',
      inputFormat: 'pan',
      validations: panValidationConfig().validations,
    },
    joiningDate: {
      type: 'datepicker',
      controlName: 'joiningDate',
      label: 'Joining date',
      validations: [
        { name: 'required', message: 'Joining date is required', validator: Validators.required },
      ],
    },
    employmentType: {
      type: 'badges',
      controlName: 'employmentType',
      label: 'Employment type',
      options: [
        { label: 'Full-time', value: 'Full-time' },
        { label: 'Part-time', value: 'Part-time' },
        { label: 'Contract', value: 'Contract' },
        { label: 'Visiting', value: 'Visiting' },
      ],
      validations: [
        {
          name: 'required',
          message: 'Employment type is required',
          validator: Validators.required,
        },
      ],
    },
    relation: {
      type: 'select',
      controlName: 'relation',
      label: 'Relation',
      placeholder: 'Select',
      options: [
        { label: 'Spouse', value: 'Spouse' },
        { label: 'Parent', value: 'Parent' },
        { label: 'Sibling', value: 'Sibling' },
        { label: 'Other', value: 'Other' },
      ],
    },
    designation: {
      type: 'select',
      controlName: 'designation',
      label: 'Designation',
      placeholder: 'Select Option',
      options: [
        { label: 'TGT', value: 'TGT' },
        { label: 'PGT', value: 'PGT' },
        { label: 'PRT', value: 'PRT' },
        { label: 'HOD', value: 'HOD' },
        { label: 'Principal', value: 'Principal' },
        { label: 'Vice Principal', value: 'Vice Principal' },
      ],
    },
    salaryGrade: {
      type: 'select',
      controlName: 'salaryGrade',
      label: 'Salary grade',
      placeholder: 'Select',
      options: [
        { label: 'Grade 1', value: 'Grade 1' },
        { label: 'Grade 2', value: 'Grade 2' },
        { label: 'Grade 3', value: 'Grade 3' },
        { label: 'Grade 4', value: 'Grade 4' },
      ],
    },
    role: {
      type: 'select',
      controlName: 'role',
      label: 'Role',
      options: [
        { label: 'Teacher', value: 'Teacher' },
        { label: 'HOD', value: 'HOD' },
        { label: 'Class Teacher', value: 'Class Teacher' },
        { label: 'Admin', value: 'Admin' },
      ],
      validations: [
        { name: 'required', message: 'Role is required', validator: Validators.required },
      ],
    },
    portalAccess: {
      type: 'select',
      controlName: 'portalAccess',
      label: 'Portal access',
      options: [
        { label: 'Enabled', value: 'Enabled' },
        { label: 'Disabled', value: 'Disabled' },
      ],
    },
    sendWelcomeEmail: {
      type: 'select',
      controlName: 'sendWelcomeEmail',
      label: 'Send welcome email',
      options: [
        { label: 'Yes — send credentials', value: 'Yes — send credentials' },
        { label: 'No', value: 'No' },
      ],
    },
    mobile: {
      type: 'input',
      controlName: 'mobile',
      label: 'Mobile',
      placeholder: '10-digit',
      inputType: 'tel',
      maxLength: 10,
      validations: [
        { name: 'required', message: 'Mobile is required', validator: Validators.required },
        {
          name: 'pattern',
          message: 'Enter a valid 10-digit number',
          validator: Validators.pattern('^[0-9]{10}$'),
        },
      ],
    },
    alternateMobile: {
      type: 'input',
      controlName: 'alternateMobile',
      label: 'Alternate mobile',
      placeholder: '10-digit',
      inputType: 'tel',
      maxLength: 10,
      validations: [
        {
          name: 'pattern',
          message: 'Enter a valid 10-digit number',
          validator: Validators.pattern('^[0-9]{10}$'),
        },
      ],
    },
    email: {
      type: 'input',
      controlName: 'email',
      label: 'Email',
      placeholder: 'Email Address',
      inputType: 'email',
      validations: [
        { name: 'required', message: 'Email is required', validator: Validators.required },
        { name: 'email', message: 'Enter a valid email address', validator: Validators.email },
      ],
    },
    address: {
      type: 'textarea',
      controlName: 'address',
      label: 'Residential address',
      placeholder: 'Full address...',
      className: 'full',
    },
    emergencyContactName: {
      type: 'input',
      controlName: 'name',
      label: 'Contact name',
      placeholder: 'Contact Name',
      inputFormat: 'name',
      maxLength: PERSON_NAME_MAX_LENGTH,
      validations: nameValidationConfig(false, PERSON_NAME_MAX_LENGTH).validations,
    },
    emergencyContactMobile: {
      type: 'input',
      controlName: 'mobile',
      label: 'Mobile',
      placeholder: '10-digit',
      inputType: 'tel',
      maxLength: 10,
      validations: [
        {
          name: 'pattern',
          message: 'Enter a valid 10-digit number',
          validator: Validators.pattern('^[0-9]{10}$'),
        },
      ],
    },
    employeeId: { type: 'input', controlName: 'employeeId', label: 'Employee ID', disabled: true },
    experience: {
      type: 'input',
      controlName: 'experience',
      label: 'Experience (years)',
      inputType: 'tel',
      maxLength: 2,
      placeholder: '0–99',
    },
    degree: {
      type: 'input',
      controlName: 'degree',
      label: 'Degree / qualification',
      placeholder: 'e.g. B.Ed',
      maxLength: 255,
    },
    university: {
      type: 'input',
      controlName: 'university',
      label: 'Board / university',
      placeholder: 'e.g. CBSE',
      maxLength: 255,
    },
    year: {
      type: 'input',
      controlName: 'year',
      label: 'Passing year',
      inputType: 'tel',
      maxLength: 4,
      placeholder: 'YYYY',
      validations: [
        {
          name: 'pattern',
          validator: Validators.pattern(/^\d{4}$/),
          message: 'Passing year must be exactly 4 numbers',
        },
      ],
    },
    percentage: {
      type: 'input',
      controlName: 'percentage',
      label: 'Percentage (%)',
      inputType: 'tel',
      maxLength: 3,
      placeholder: '0–100',
      validations: [
        {
          name: 'pattern',
          validator: Validators.pattern(/^(100|\d{1,2})$/),
          message: 'Enter a valid percentage (0–100)',
        },
      ],
    },
    shiftStartTime: {
      type: 'input',
      controlName: 'shiftStartTime',
      label: 'Shift start',
      inputType: 'time',
    },
    shiftEndTime: {
      type: 'input',
      controlName: 'shiftEndTime',
      label: 'Shift end',
      inputType: 'time',
    },
    weeklyPeriods: {
      type: 'input',
      controlName: 'weeklyPeriods',
      label: 'Weekly periods',
      inputType: 'tel',
      maxLength: 2,
      placeholder: 'e.g. 30',
    },
    maxPeriodsPerDay: {
      type: 'input',
      controlName: 'maxPeriodsPerDay',
      label: 'Max periods/day',
      inputType: 'tel',
      maxLength: 2,
      placeholder: 'e.g. 6',
    },
    username: {
      type: 'input',
      controlName: 'username',
      label: 'Username (auto)',
      placeholder: 'e.g. ramesh.sharma',
      disabled: true,
    },
    accountNumber: {
      type: 'input',
      controlName: 'accountNumber',
      label: 'Account number',
      inputType: 'tel',
      maxLength: 18,
      placeholder: '9–18 digits',
    },
    ifscCode: {
      type: 'input',
      controlName: 'ifscCode',
      label: 'IFSC code',
      placeholder: 'e.g. SBIN0001234',
      maxLength: 11,
      validations: [
        {
          name: 'pattern',
          message: 'Enter a valid IFSC code',
          validator: Validators.pattern('^[A-Z]{4}0[A-Z0-9]{6}$'),
        },
      ],
    },
    bankName: {
      type: 'input',
      controlName: 'bankName',
      label: 'Bank name',
      placeholder: 'e.g. State Bank of India',
      maxLength: 50,
    },
  };

  private readonly stepFieldPaths: Record<number, string[]> = {
    0: [
      'personal.firstName',
      'personal.lastName',
      'personal.dob',
      'personal.gender',
      'personal.aadhaarNumber',
      'personal.panNumber',
      'personal.mobile',
      'personal.email',
      'personal.emergencyContact.name',
      'personal.emergencyContact.mobile',
    ],
    1: ['professional.joiningDate'],
    2: ['schedule.role'],
  };

  readonly personalFields = [
    'firstName',
    'lastName',
    'dob',
    'gender',
    'bloodGroup',
    'aadhaarNumber',
    'panNumber',
  ];
  readonly contactFields = ['mobile', 'alternateMobile', 'email', 'address'];
  readonly emergencyContactFields = ['emergencyContactName', 'relation', 'emergencyContactMobile'];
  readonly employmentFields = [
    'employeeId',
    'joiningDate',
    'designation',
    'experience',
    'salaryGrade',
    'employmentType',
  ];
  readonly qualificationFields = ['degree', 'university', 'year', 'percentage'];
  readonly bankFields = ['accountNumber', 'ifscCode', 'bankName'];
  readonly scheduleFields = ['shiftStartTime', 'shiftEndTime', 'weeklyPeriods', 'maxPeriodsPerDay'];
  readonly systemAccessFields = ['role', 'portalAccess', 'username', 'sendWelcomeEmail'];

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      groupPath: 'personal',
      sections: [
        {
          title: 'Photo & basic details',
          icon: 'account_circle',
          layout: 'photo-grid',
          fields: this.personalFields,
        },
        { title: 'Contact details', icon: 'phone', layout: 'grid3', fields: this.contactFields },
        {
          title: 'Emergency contact',
          icon: 'groups',
          layout: 'grid3',
          fields: this.emergencyContactFields,
          subGroup: 'emergencyContact',
        },
      ],
    },
    {
      stepIndex: 1,
      sections: [
        {
          title: 'Employment details',
          icon: 'badge',
          layout: 'grid3',
          fields: this.employmentFields,
          groupPath: 'professional',
        },
        {
          title: 'Qualifications',
          icon: 'school',
          layout: 'form-array',
          fields: this.qualificationFields,
          groupPath: 'professional',
          formArrayName: 'qualifications',
        },
        {
          title: 'Bank details',
          icon: 'account_balance',
          layout: 'grid3',
          fields: this.bankFields,
          groupPath: 'professional',
          subGroup: 'bankDetails',
        },
      ],
    },
    {
      stepIndex: 2,
      groupPath: 'schedule',
      hint: 'Class and subject assignments are managed from the Class Mapping screen.',
      sections: [
        { title: 'Timing', icon: 'schedule', layout: 'grid3', fields: this.scheduleFields },
        {
          title: 'System access',
          icon: 'security',
          layout: 'grid2',
          fields: this.systemAccessFields,
        },
      ],
    },
    {
      stepIndex: 3,
      sections: [
        {
          title: 'Personal summary',
          icon: 'verified_user',
          layout: 'review',
          fields: [...this.personalFields, ...this.contactFields, ...this.emergencyContactFields],
          groupPath: 'personal',
          subGroupMap: {
            emergencyContactName: 'emergencyContact',
            relation: 'emergencyContact',
            emergencyContactMobile: 'emergencyContact',
          },
        },
        {
          title: 'Professional summary',
          icon: 'work_outline',
          layout: 'review',
          fields: this.employmentFields,
          groupPath: 'professional',
        },
        {
          title: 'Banking',
          icon: 'account_balance',
          layout: 'review',
          fields: this.bankFields,
          groupPath: 'professional',
          subGroup: 'bankDetails',
        },
        {
          title: 'Schedule & access',
          icon: 'schedule',
          layout: 'review',
          fields: [...this.scheduleFields, ...this.systemAccessFields],
          groupPath: 'schedule',
        },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private snackBar: MatSnackBar,
  ) {
    this.teacherForm = this.fb.group({
      personal: this.fb.group({
        photo: [null],
        firstName: ['', [Validators.required, nameValidator(PERSON_NAME_MAX_LENGTH)]],
        lastName: ['', [Validators.required, nameValidator(PERSON_NAME_MAX_LENGTH)]],
        dob: ['', [Validators.required, noFutureDateValidator()]],
        bloodGroup: [''],
        gender: ['Male', Validators.required],
        aadhaarNumber: ['', aadhaarValidator()],
        panNumber: ['', panValidator()],
        mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
        alternateMobile: ['', Validators.pattern('^[0-9]{10}$')],
        email: ['', [Validators.required, Validators.email]],
        address: [''],
        emergencyContact: this.fb.group({
          name: ['', nameValidator(PERSON_NAME_MAX_LENGTH)],
          relation: [''],
          mobile: ['', Validators.pattern('^[0-9]{10}$')],
        }),
      }),
      professional: this.fb.group({
        employeeId: [{ value: 'Auto-generated', disabled: true }],
        joiningDate: ['', Validators.required],
        designation: [null],
        experience: [0, experienceValidator()],
        salaryGrade: [''],
        employmentType: ['Full-time'],
        qualifications: this.fb.array([this.createQualificationRow()]),
        bankDetails: this.fb.group({
          accountNumber: ['', bankAccountValidator()],
          ifscCode: ['', ifscValidator()],
          bankName: ['', bankNameValidator(BANK_NAME_MAX_LENGTH)],
        }),
      }),
      schedule: this.fb.group({
        classId: [''],
        shiftStartTime: [null, shiftStartTimeValidator()],
        shiftEndTime: [null, shiftEndTimeValidator()],
        weeklyPeriods: [null, optionalPositiveIntValidator(99)],
        maxPeriodsPerDay: [null, optionalPositiveIntValidator(12)],
        role: ['Teacher', Validators.required],
        portalAccess: ['Enabled'],
        username: [{ value: '', disabled: true }],
        sendWelcomeEmail: ['Yes — send credentials'],
      }),
    });
  }

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  ngOnInit(): void {
    this.wireShiftTimeValidation();
    if (this.mode === 'add') {
      this.generateEmployeeId();
      this.setupUsernameGeneration();
      this.professionalGroup.patchValue({ joiningDate: this.today() });
    }
    if (this.mode !== 'add' && this.teacherId) {
      this.loadTeacherData();
    }
  }

  private wireShiftTimeValidation(): void {
    const start = this.scheduleGroup.get('shiftStartTime');
    const end = this.scheduleGroup.get('shiftEndTime');
    const sync = () => syncShiftTimeValidity(this.scheduleGroup);
    start?.valueChanges.subscribe(sync);
    end?.valueChanges.subscribe(sync);
  }

  private setupUsernameGeneration(): void {
    const firstControl = this.teacherForm.get('personal.firstName');
    const lastControl = this.teacherForm.get('personal.lastName');

    firstControl?.valueChanges.subscribe(() => this.updateGeneratedUsername());
    lastControl?.valueChanges.subscribe(() => this.updateGeneratedUsername());
  }

  private updateGeneratedUsername(): void {
    if (this.mode !== 'add') return;

    const first = (this.teacherForm.get('personal.firstName')?.value || '').trim().toLowerCase();
    const last = (this.teacherForm.get('personal.lastName')?.value || '').trim().toLowerCase();
    const employeeId = this.teacherForm.get('professional.employeeId')?.value || '';
    const idSuffix = employeeId.split('-').pop() || '';

    if (first || last) {
      const base = last ? `${first}.${last}` : first;
      const username = `${base}${idSuffix ? '.' + idSuffix : ''}`.replace(/[^a-z0-9.]/g, '');
      this.teacherForm.get('schedule.username')?.setValue(username);
    }
  }

  get qualifications() {
    return this.teacherForm.get('professional.qualifications') as FormArray;
  }

  get personalGroup(): FormGroup {
    return this.teacherForm.get('personal') as FormGroup;
  }

  get emergencyContactGroup(): FormGroup {
    return this.personalGroup.get('emergencyContact') as FormGroup;
  }

  getGroupForTab(tab: any): FormGroup | null {
    if (!tab.groupPath) return null;
    return this.teacherForm.get(tab.groupPath) as FormGroup;
  }

  getGroupForSection(tab: any, section: any): FormGroup {
    const basePath = section.groupPath || tab.groupPath;
    let group = this.teacherForm.get(basePath) as FormGroup;
    if (section.subGroup) {
      group = group.get(section.subGroup) as FormGroup;
    }
    return group;
  }

  getReviewValue(section: any, field: string): any {
    const basePath = section.groupPath;
    let actualPath = basePath;
    if (section.subGroup) {
      actualPath += '.' + section.subGroup;
    }
    if (section.subGroupMap && section.subGroupMap[field]) {
      actualPath += '.' + section.subGroupMap[field];
    }
    const controlName = this.configs[field].controlName;
    actualPath += '.' + controlName;
    const val = this.teacherForm.get(actualPath)?.value;
    if (val === true) return 'Yes';
    if (val === false) return 'No';
    return val || '—';
  }

  get professionalGroup(): FormGroup {
    return this.teacherForm.get('professional') as FormGroup;
  }

  get bankDetailsGroup(): FormGroup {
    return this.professionalGroup.get('bankDetails') as FormGroup;
  }

  get scheduleGroup(): FormGroup {
    return this.teacherForm.get('schedule') as FormGroup;
  }

  loadTeacherData(): void {
    this.teacherService.getTeacherById(this.teacherId!).subscribe({
      next: (data) => {
        this.teacherForm.patchValue({
          personal: {
            firstName: data.firstName,
            lastName: data.lastName,
            dob: this.toLocalDate(data.dob),
            bloodGroup: data.bloodGroup,
            gender: data.gender,
            aadhaarNumber: data.aadhaarNo ? formatAadhaarDisplay(String(data.aadhaarNo)) : '',
            panNumber: data.panNo,
            mobile: data.mobile,
            alternateMobile: data.alternateMobile,
            email: data.email,
            address: data.address,
          },
          professional: {
            employeeId: data.employeeId,
            joiningDate: this.toLocalDate(data.joiningDate),
            designation: data.designation,
            experience: clampExperienceValue(data.experience),
            salaryGrade: data.salaryGrade,
            employmentType: data.employmentType,
            bankDetails: {
              accountNumber: data.bankAccountNumber
                ? sanitizeBankAccountInput(String(data.bankAccountNumber))
                : '',
              ifscCode: data.bankIfscCode ? sanitizeIfscInput(String(data.bankIfscCode)) : '',
              bankName: data.bankName,
            },
          },
          schedule: {
            classId: data.classId,
            shiftStartTime: normalizeTimeValue(data.shiftStartTime ?? data.shiftStarttime),
            shiftEndTime: normalizeTimeValue(data.shiftEndTime ?? data.shiftEndtime),
            weeklyPeriods: data.weeklyPeriods ?? null,
            maxPeriodsPerDay: data.maxPeriodsPerDay ?? null,
            role: data.role,
            portalAccess: data.portalAccess ? 'Enabled' : 'Disabled',
            username: data.username,
          },
        });
        this.setQualificationsFromApi(data.qualifications);
        syncShiftTimeValidity(this.scheduleGroup);
        if (this.mode === 'view') {
          this.teacherForm.disable();
        }
      },
      error: () => {
        this.snackBar.open('Failed to load teacher data', 'Close', { duration: 3000 });
      },
    });
  }

  addQualification(): void {
    if (this.mode === 'view') {
      return;
    }
    this.qualifications.push(this.createQualificationRow());
  }

  removeQualification(index: number): void {
    if (this.mode === 'view') {
      return;
    }
    if (this.qualifications.length > 1) {
      this.qualifications.removeAt(index);
    }
  }

  private createQualificationRow(degree = '', university = '', year = '', percentage = ''): FormGroup {
    return this.fb.group({
      degree: [degree, [Validators.maxLength(255)]],
      university: [university, [Validators.maxLength(255)]],
      year: [year, [Validators.pattern(/^\d{4}$/)]],
      percentage: [percentage, [Validators.pattern(/^(100|\d{1,2})$/)]],
    });
  }

  private setQualificationsFromApi(raw: unknown): void {
    const arr = this.qualifications;
    arr.clear({ emitEvent: false });
    const items = raw
      ? String(raw)
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
    if (!items.length) {
      arr.push(this.createQualificationRow(), { emitEvent: false });
      return;
    }
    for (const item of items) {
      const { degree, university, year, percentage } = this.parseQualificationEntry(item);
      arr.push(this.createQualificationRow(degree, university, year, percentage), { emitEvent: false });
    }
  }

  private parseQualificationEntry(text: string): { degree: string; university: string; year: string; percentage: string } {
    const parts = text.trim().split(' — ').map(p => p.trim());
    return {
      degree: parts[0] || '',
      university: parts[1] || '',
      year: parts[2] || '',
      percentage: parts[3] || '',
    };
  }

  onPhotoSelected(file: SelectedUploadFile): void {
    this.selectedPhoto = file;
  }

  setGender(gender: string): void {
    if (this.mode === 'view') return;
    this.teacherForm.get('personal.gender')?.setValue(gender);
  }

  setEmploymentType(type: string): void {
    if (this.mode === 'view') return;
    this.teacherForm.get('professional.employmentType')?.setValue(type);
  }

  get experienceError(): string {
    const control = this.professionalGroup.get('experience');
    const detail = control?.errors?.['experience'];
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return (detail as { message: string }).message;
    }
    return 'Experience must be between 0 and 99 years';
  }

  onExperienceInput(event: Event): void {
    if (this.mode === 'view') return;
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeExperienceInput(input.value);
    const control = this.professionalGroup.get('experience');

    if (sanitized === null) {
      control?.setValue(null);
      if (input.value !== '') {
        input.value = '';
      }
      return;
    }

    control?.setValue(sanitized);
    const display = String(sanitized);
    if (input.value !== display) {
      input.value = display;
    }
  }

  onExperienceBlur(): void {
    const control = this.professionalGroup.get('experience');
    if (!control) return;
    if (control.value == null || control.value === '') {
      control.setValue(0);
    } else {
      control.setValue(clampExperienceValue(control.value));
    }
    control.markAsTouched();
  }

  get bankNameError(): string {
    return this.resolveFieldError(
      this.bankDetailsGroup.get('bankName'),
      'bankName',
      'Bank name cannot exceed 50 characters',
    );
  }

  get bankAccountError(): string {
    return this.resolveFieldError(
      this.bankDetailsGroup.get('accountNumber'),
      'bankAccount',
      'Enter a valid bank account number (9–18 digits)',
    );
  }

  get ifscError(): string {
    return this.resolveFieldError(
      this.bankDetailsGroup.get('ifscCode'),
      'ifsc',
      'Enter a valid 11-character IFSC (e.g. SBIN0001234)',
    );
  }

  get shiftTimeError(): string {
    const start = this.scheduleGroup.get('shiftStartTime');
    const end = this.scheduleGroup.get('shiftEndTime');
    const detail = start?.errors?.['shiftTime'] ?? end?.errors?.['shiftTime'];
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return (detail as { message: string }).message;
    }
    return 'Select a valid shift time range';
  }

  get weeklyPeriodsError(): string {
    return this.resolveFieldError(
      this.scheduleGroup.get('weeklyPeriods'),
      'positiveInt',
      'Enter a whole number of at least 1',
    );
  }

  get maxPeriodsPerDayError(): string {
    return this.resolveFieldError(
      this.scheduleGroup.get('maxPeriodsPerDay'),
      'positiveInt',
      'Enter a whole number of at least 1',
    );
  }

  get shiftSummary(): string {
    return formatShiftRangeDisplay(
      this.scheduleGroup.get('shiftStartTime')?.value,
      this.scheduleGroup.get('shiftEndTime')?.value,
    );
  }

  openTimePicker(event: Event): void {
    if (this.mode === 'view') return;
    const wrap = event.currentTarget as HTMLElement;
    const input = wrap.querySelector('input.time-input') as HTMLInputElement | null;
    if (!input || input.disabled) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch {
        /* showPicker may throw if not user-gesture in some browsers */
      }
    }
  }

  onShiftTimeChange(): void {
    syncShiftTimeValidity(this.scheduleGroup);
  }

  onShiftTimeBlur(): void {
    this.onShiftTimeChange();
    this.scheduleGroup.get('shiftStartTime')?.markAsTouched();
    this.scheduleGroup.get('shiftEndTime')?.markAsTouched();
  }

  onPeriodsInput(event: Event, controlName: 'weeklyPeriods' | 'maxPeriodsPerDay'): void {
    if (this.mode === 'view') return;
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 2);
    const control = this.scheduleGroup.get(controlName);
    const next = digits === '' ? null : Number(digits);
    control?.setValue(next);
    if (input.value !== digits) {
      input.value = digits;
    }
  }

  onPeriodsBlur(controlName: 'weeklyPeriods' | 'maxPeriodsPerDay'): void {
    this.scheduleGroup.get(controlName)?.markAsTouched();
  }

  onBankAccountInput(event: Event): void {
    if (this.mode === 'view') return;
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeBankAccountInput(input.value);
    const control = this.bankDetailsGroup.get('accountNumber');
    control?.setValue(sanitized);
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
  }

  onBankAccountBlur(): void {
    this.bankDetailsGroup.get('accountNumber')?.markAsTouched();
  }

  onIfscInput(event: Event): void {
    if (this.mode === 'view') return;
    const input = event.target as HTMLInputElement;
    const sanitized = sanitizeIfscInput(input.value);
    const control = this.bankDetailsGroup.get('ifscCode');
    control?.setValue(sanitized);
    if (input.value !== sanitized) {
      input.value = sanitized;
    }
  }

  onIfscBlur(): void {
    this.bankDetailsGroup.get('ifscCode')?.markAsTouched();
  }

  private resolveFieldError(
    control: ReturnType<FormGroup['get']>,
    errorKey: string,
    fallback: string,
  ): string {
    const detail = control?.errors?.[errorKey];
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return (detail as { message: string }).message;
    }
    return fallback;
  }

  goTab(step: number): void {
    if (step > this.currentStep && !this.validateStep(this.currentStep)) {
      return;
    }
    this.currentStep = step;
  }

  nextStep(): void {
    if (this.currentStep < 3) {
      if (!this.validateStep(this.currentStep)) {
        this.snackBar.open('Please fix errors on this step before continuing', 'Close', {
          duration: 3000,
        });
        return;
      }
      this.currentStep++;
    } else {
      this.saveTeacher();
    }
  }

  private validateStep(step: number): boolean {
    const paths = this.stepFieldPaths[step] ?? [];
    return validateFormControls(this.teacherForm, paths);
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  saveTeacher(): void {
    if (this.teacherForm.invalid) {
      this.teacherForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const data = this.teacherForm.getRawValue();
    data.schedule.classId = data.schedule.classId || null;
    data.schedule.classAssignments = [];

    const action =
      this.mode === 'edit'
        ? this.teacherService.updateTeacher(this.teacherId!, data)
        : this.teacherService.createTeacher(data);

    action.subscribe({
      next: () => {
        if (this.mode === 'add') {
          this.persistEmployeeSequence();
        }
        this.snackBar.open(
          `Teacher ${this.mode === 'edit' ? 'updated' : 'added'} successfully`,
          'Close',
          { duration: 3000 },
        );
        this.saved.emit();
      },
      error: (err) => {
        const apiErrors = err?.error?.errors;
        let message = 'Failed to save teacher';
        if (apiErrors && typeof apiErrors === 'object') {
          const parts = Object.values(apiErrors).flat().filter(Boolean);
          if (parts.length) {
            message = parts.join(' ');
          }
        } else if (err?.error?.detail) {
          message = String(err.error.detail);
        } else if (err?.error?.message) {
          message = String(err.error.message);
        } else if (err?.error?.title) {
          message = err.error.title;
        }
        this.snackBar.open(message, 'Close', { duration: 5000, panelClass: 'snack-error' });
      },
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  formatDate(value: unknown): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
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

  private generateEmployeeId(): void {
    const year = new Date().getFullYear();
    const storageKey = `smartops-emp-sequence-${year}`;
    const next = Number(localStorage.getItem(storageKey) || '0') + 1;
    const employeeId = `EMP-${year}-${String(next).padStart(4, '0')}`;
    this.teacherForm.get('professional.employeeId')?.setValue(employeeId);
  }

  private persistEmployeeSequence(): void {
    const employeeId = String(this.teacherForm.get('professional.employeeId')?.value || '');
    const match = employeeId.match(/^EMP-(\d{4})-(\d{4})$/);
    if (!match) return;
    localStorage.setItem(`smartops-emp-sequence-${match[1]}`, String(Number(match[2])));
  }
}
