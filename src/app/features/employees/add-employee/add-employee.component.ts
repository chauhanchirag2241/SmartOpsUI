import { Component, EventEmitter, Input, OnInit, Output, inject, ChangeDetectorRef } from '@angular/core';
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
import { EmployeeService } from '../../../core/services/employee.service';
import { DepartmentService } from '../../../core/services/department.service';
import { RoleService, RoleDto } from '../../../core/services/role.service';
import { UserTypeDto, UserTypeService } from '../../../core/services/user-type.service';
import { ShiftService } from '../../../core/services/shift.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
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
  shiftEndTimeValidator,
  shiftStartTimeValidator,
  syncShiftTimeValidity,
} from '../../../shared/utils/form-validators.util';
import { validateFormControls } from '../../../shared/utils/form-validation.util';
import { BloodGroup, enumToOptions, Gender } from '../../../shared/enums/field-options.enum';
import { FormSection, FormTab } from '../../../shared/interfaces/form-layout';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../../shared/mapping/mapping.types';

const STAFF_USER_TYPE_NAMES = new Set([
  'teacher',
  'accountant',
  'non-academic staff',
  'office staff',
  'principal',
]);

@Component({
  selector: 'app-add-employee',
  standalone: true,
  host: { class: 'add-employee-page form-page-shell' },
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
    MultiSelectChipsComponent,
    PageChromeDirective,
  ],
  templateUrl: './add-employee.component.html',
  styleUrl: './add-employee.component.css',
})
export class AddEmployeeComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() employeeId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly shiftService = inject(ShiftService);

  employeeForm: FormGroup;
  currentStep = 0;
  readonly bloodGroupOptions = enumToOptions(BloodGroup);

  userTypes: UserTypeDto[] = [];
  roles: RoleDto[] = [];
  departments: { label: string; value: string }[] = [];
  reportingManagers: { label: string; value: string }[] = [];
  reportingManagerChipOptions: MappingOption[] = [];
  shiftChipOptions: MappingOption[] = [];
  private shiftTimeById = new Map<string, { startTime: string; endTime: string; name: string }>();

  steps = [
    { title: 'Personal', icon: 'person' },
    { title: 'Professional', icon: 'work' },
    { title: 'Organization & Access', icon: 'corporate_fare' },
    { title: 'Schedule', icon: 'schedule' },
    { title: 'Review', icon: 'fact_check' },
  ];

  hints = [
    'Personal information',
    'Professional details',
    'Organization and portal access',
    'Work schedule',
    'Review & save',
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
      validations: [{ name: 'required', message: 'Gender is required', validator: Validators.required }],
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
      validations: [{ name: 'required', message: 'Joining date is required', validator: Validators.required }],
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
    employeeTypeId: {
      type: 'select',
      controlName: 'employeeTypeId',
      label: 'Employee type',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
      validations: [{ name: 'required', message: 'Employee type is required', validator: Validators.required }],
    },
    portalRoleId: {
      type: 'select',
      controlName: 'portalRoleId',
      label: 'Portal role',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
      validations: [{ name: 'required', message: 'Portal role is required', validator: Validators.required }],
    },
    departmentId: {
      type: 'select',
      controlName: 'departmentId',
      label: 'Department',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
    },
    reportingManagerId: {
      type: 'select',
      controlName: 'reportingManagerId',
      label: 'Reporting manager',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
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
    mobile: {
      type: 'input',
      controlName: 'mobile',
      label: 'Mobile',
      placeholder: '10-digit',
      inputType: 'tel',
      maxLength: 10,
      validations: [
        { name: 'required', message: 'Mobile is required', validator: Validators.required },
        { name: 'pattern', message: 'Enter a valid 10-digit number', validator: Validators.pattern('^[0-9]{10}$') },
      ],
    },
    alternateMobile: {
      type: 'input',
      controlName: 'alternateMobile',
      label: 'Alternate mobile',
      placeholder: '10-digit',
      inputType: 'tel',
      maxLength: 10,
      validations: [{ name: 'pattern', message: 'Enter a valid 10-digit number', validator: Validators.pattern('^[0-9]{10}$') }],
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
      validations: [{ name: 'pattern', message: 'Enter a valid 10-digit number', validator: Validators.pattern('^[0-9]{10}$') }],
    },
    employeeCode: {
      type: 'input',
      controlName: 'employeeCode',
      label: 'Employee code',
      placeholder: 'e.g. EMP-001',
      maxLength: 50,
      validations: [
        { name: 'required', validator: Validators.required, message: 'Employee code is required' },
        {
          name: 'pattern',
          validator: Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
          message: 'Use letters, numbers, dot, hyphen or underscore',
        },
      ],
    },
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
      validations: [{ name: 'pattern', validator: Validators.pattern(/^\d{4}$/), message: 'Passing year must be exactly 4 numbers' }],
    },
    percentage: {
      type: 'input',
      controlName: 'percentage',
      label: 'Percentage (%)',
      inputType: 'tel',
      maxLength: 3,
      placeholder: '0–100',
      validations: [{ name: 'pattern', validator: Validators.pattern(/^(100|\d{1,2})$/), message: 'Enter a valid percentage (0–100)' }],
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
    scheduleSummary: {
      type: 'input',
      controlName: 'scheduleSummary',
      label: 'Work schedule',
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
      validations: [{ name: 'pattern', message: 'Enter a valid IFSC code', validator: Validators.pattern('^[A-Z]{4}0[A-Z0-9]{6}$') }],
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
    1: ['professional.employeeCode', 'professional.joiningDate'],
    2: ['organization.employeeTypeId', 'organization.portalRoleId'],
    3: [],
    4: [],
  };

  readonly personalFields = ['firstName', 'lastName', 'dob', 'gender', 'bloodGroup', 'aadhaarNumber', 'panNumber'];
  readonly contactFields = ['mobile', 'alternateMobile', 'email', 'address'];
  readonly emergencyContactFields = ['emergencyContactName', 'relation', 'emergencyContactMobile'];
  readonly employmentFields = ['employeeCode', 'joiningDate', 'designation', 'experience'];
  readonly qualificationFields = ['degree', 'university', 'year', 'percentage'];
  readonly bankFields = ['accountNumber', 'ifscCode', 'bankName'];
  readonly organizationFields = [
    'portalAccess',
    'employeeTypeId',
    'departmentId',
    'reportingManagerId',
    'portalRoleId',
    'username',
  ];
  readonly scheduleFields = ['shiftStartTime', 'shiftEndTime'];
  readonly scheduleReviewFields = ['scheduleSummary'];

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      groupPath: 'personal',
      sections: [
        { title: 'Photo & basic details', icon: 'account_circle', layout: 'photo-grid', fields: this.personalFields },
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
        { title: 'Employment details', icon: 'badge', layout: 'grid3', fields: this.employmentFields, groupPath: 'professional' },
        {
          title: 'Qualifications',
          icon: 'school',
          layout: 'form-array',
          fields: this.qualificationFields,
          groupPath: 'professional',
          formArrayName: 'qualifications',
        },
        { title: 'Bank details', icon: 'account_balance', layout: 'grid3', fields: this.bankFields, groupPath: 'professional', subGroup: 'bankDetails' },
      ],
    },
    {
      stepIndex: 2,
      groupPath: 'organization',
      sections: [{ title: 'Organization & access', icon: 'security', layout: 'grid2', fields: this.organizationFields }],
    },
    {
      stepIndex: 3,
      groupPath: 'schedule',
      hint: 'Set daily shift timings for all employees.',
      sections: [{ title: 'Work schedule', icon: 'schedule', layout: 'schedule', fields: this.scheduleFields }],
    },
    {
      stepIndex: 4,
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
        { title: 'Professional summary', icon: 'work_outline', layout: 'review', fields: this.employmentFields, groupPath: 'professional' },
        { title: 'Banking', icon: 'account_balance', layout: 'review', fields: this.bankFields, groupPath: 'professional', subGroup: 'bankDetails' },
        { title: 'Organization & access', icon: 'corporate_fare', layout: 'review', fields: this.organizationFields, groupPath: 'organization' },
        { title: 'Schedule', icon: 'schedule', layout: 'review', fields: this.scheduleReviewFields, groupPath: 'schedule' },
      ],
    },
  ];

  constructor(
    private fb: FormBuilder,
    private employeeService: EmployeeService,
    private departmentService: DepartmentService,
    private roleService: RoleService,
    private userTypeService: UserTypeService,
    private snackBar: NotificationService,
  ) {
    this.employeeForm = this.fb.group({
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
        employeeCode: [
          '',
          [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)],
        ],
        joiningDate: ['', Validators.required],
        designation: [null],
        experience: [0, experienceValidator()],
        qualifications: this.fb.array([this.createQualificationRow()]),
        bankDetails: this.fb.group({
          accountNumber: ['', bankAccountValidator()],
          ifscCode: ['', ifscValidator()],
          bankName: ['', bankNameValidator(BANK_NAME_MAX_LENGTH)],
        }),
      }),
      organization: this.fb.group({
        employeeTypeId: ['', Validators.required],
        portalRoleId: ['', Validators.required],
        departmentId: [null],
        reportingManagerId: [null],
        portalAccess: ['Enabled'],
        username: [{ value: '', disabled: true }],
      }),
      schedule: this.fb.group({
        scheduleMode: ['master'],
        shiftIds: [[] as string[]],
        shiftStartTime: [
          { value: null, disabled: true },
          shiftStartTimeValidator(() => this.isCustomScheduleMode()),
        ],
        shiftEndTime: [
          { value: null, disabled: true },
          shiftEndTimeValidator(() => this.isCustomScheduleMode()),
        ],
      }),
    });
  }

  get lastStepIndex(): number {
    return this.steps.length - 1;
  }

  get currentStepHint(): string {
    return `Step ${this.currentStep + 1} of ${this.steps.length} — ${this.hints[this.currentStep]}`;
  }

  get progressPercent(): number {
    return ((this.currentStep + 1) / this.steps.length) * 100;
  }

  ngOnInit(): void {
    this.wireShiftTimeValidation();
    this.wireScheduleMode();
    this.wirePortalAccessValidation();
    this.loadLookups();
    this.loadShiftOptions();
    if (this.mode === 'add') {
      this.setupUsernameGeneration();
      this.professionalGroup.patchValue({ joiningDate: this.today() });
    }
    if (this.mode === 'edit') {
      // Identity fields (name/mobile/email) live on `users` and are not updated via employee edit yet — keep read-only.
      this.lockIdentityFields();
    }
    if (this.mode !== 'add' && this.employeeId) {
      this.loadEmployeeData();
    }
  }

  private lockIdentityFields(): void {
    this.personalGroup.get('firstName')?.disable({ emitEvent: false });
    this.personalGroup.get('lastName')?.disable({ emitEvent: false });
    this.personalGroup.get('mobile')?.disable({ emitEvent: false });
    this.personalGroup.get('email')?.disable({ emitEvent: false });
  }

  private loadLookups(): void {
    this.userTypeService.getUserTypes().subscribe({
      next: (types) => {
        this.userTypes = types.filter((t) =>
          STAFF_USER_TYPE_NAMES.has(String(t.name ?? t.code ?? '').trim().toLowerCase()),
        );
        this.configs['employeeTypeId'].options = this.userTypes.map((t) => ({ label: t.name, value: t.id }));
        this.lookupsReady.userTypes = true;
        this.tryApplyOrganizationLookups();
        this.cdr.markForCheck();
      },
    });

    this.roleService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles.filter(
          (r) => r.name !== 'PlatformAdmin' && r.name !== 'SmartOpsAdmin',
        );
        this.configs['portalRoleId'].options = this.roles.map((r) => ({ label: r.name, value: r.id }));
        this.lookupsReady.roles = true;
        this.tryApplyOrganizationLookups();
        this.cdr.markForCheck();
      },
    });

    this.departmentService.getDepartments().subscribe({
      next: (deps) => {
        this.departments = deps.map((d) => ({ label: d.name, value: d.id }));
        this.configs['departmentId'].options = this.departments;
        this.cdr.markForCheck();
      },
    });

    this.employeeService.getEmployeeDropdown().subscribe({
      next: (items) => {
        const eligible = this.mode === 'edit' && this.employeeId
          ? items.filter((e) => e.id !== this.employeeId)
          : items;
        this.reportingManagers = eligible.map((e) => ({
          label: e.designation ? `${e.name} (${e.designation})` : e.name,
          value: e.id,
        }));
        this.reportingManagerChipOptions = eligible.map((e) => ({
          id: e.id,
          name: e.designation ? `${e.name} (${e.designation})` : e.name,
        }));
        this.configs['reportingManagerId'].options = this.reportingManagers;
        this.cdr.markForCheck();
      },
      error: () => {
        this.reportingManagers = [];
        this.reportingManagerChipOptions = [];
        this.cdr.markForCheck();
      },
    });
  }

  private wireShiftTimeValidation(): void {
    const start = this.scheduleGroup.get('shiftStartTime');
    const end = this.scheduleGroup.get('shiftEndTime');
    const sync = () => syncShiftTimeValidity(this.scheduleGroup);
    start?.valueChanges.subscribe(sync);
    end?.valueChanges.subscribe(sync);
  }

  private wireScheduleMode(): void {
    this.scheduleGroup.get('scheduleMode')?.valueChanges.subscribe((mode) => {
      this.applyScheduleMode(mode === 'custom' ? 'custom' : 'master', { clearOpposite: true });
    });
  }

  private isCustomScheduleMode(): boolean {
    return this.scheduleGroup?.get('scheduleMode')?.value === 'custom';
  }

  get shiftSelectedIds(): string[] {
    const ids = this.scheduleGroup.get('shiftIds')?.value;
    return Array.isArray(ids) ? ids.map(String) : [];
  }

  onShiftSelectionChange(ids: string[]): void {
    this.scheduleGroup.get('shiftIds')?.setValue(ids);
    this.scheduleGroup.get('shiftIds')?.markAsDirty();
    this.scheduleGroup.get('shiftIds')?.markAsTouched();
    this.applyDerivedShiftTimes(ids);
  }

  setScheduleMode(mode: 'master' | 'custom'): void {
    if (this.mode === 'view') return;
    this.scheduleGroup.get('scheduleMode')?.setValue(mode);
  }

  private applyScheduleMode(
    mode: 'master' | 'custom',
    options?: { clearOpposite?: boolean },
  ): void {
    const start = this.scheduleGroup.get('shiftStartTime');
    const end = this.scheduleGroup.get('shiftEndTime');
    const shiftIds = this.scheduleGroup.get('shiftIds');

    if (mode === 'master') {
      start?.disable({ emitEvent: false });
      end?.disable({ emitEvent: false });
      if (options?.clearOpposite) {
        // keep times derived from selection
      }
      this.applyDerivedShiftTimes(this.shiftSelectedIds);
    } else {
      start?.enable({ emitEvent: false });
      end?.enable({ emitEvent: false });
      if (options?.clearOpposite) {
        shiftIds?.setValue([], { emitEvent: false });
      }
    }
    syncShiftTimeValidity(this.scheduleGroup);
    this.cdr.markForCheck();
  }

  private applyDerivedShiftTimes(ids: string[]): void {
    if (!ids.length) {
      this.scheduleGroup.patchValue(
        { shiftStartTime: null, shiftEndTime: null },
        { emitEvent: false },
      );
      syncShiftTimeValidity(this.scheduleGroup);
      return;
    }

    const windows = ids
      .map((id) => this.shiftTimeById.get(id))
      .filter((x): x is { startTime: string; endTime: string; name: string } => !!x);

    if (!windows.length) {
      return;
    }

    const starts = windows.map((w) => w.startTime).sort();
    const ends = windows.map((w) => w.endTime).sort();
    this.scheduleGroup.patchValue(
      {
        shiftStartTime: starts[0] ?? null,
        shiftEndTime: ends[ends.length - 1] ?? null,
      },
      { emitEvent: false },
    );
    syncShiftTimeValidity(this.scheduleGroup);
  }

  private loadShiftOptions(): void {
    this.shiftService.getShifts(1, 200, '', 'displayOrder', 'asc', 'Active').subscribe({
      next: (res: any) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        this.shiftTimeById.clear();
        this.shiftChipOptions = items.map((s: any) => {
          const id = String(s.id ?? s.Id ?? '');
          const name = String(s.shiftName ?? s.ShiftName ?? '');
          const startTime = normalizeTimeValue(s.startTime ?? s.StartTime) ?? '';
          const endTime = normalizeTimeValue(s.endTime ?? s.EndTime) ?? '';
          if (id) {
            this.shiftTimeById.set(id, { startTime, endTime, name });
          }
          const label =
            startTime && endTime ? `${name} (${startTime} - ${endTime})` : name;
          return { id, name: label };
        });
        if (this.shiftSelectedIds.length) {
          this.applyDerivedShiftTimes(this.shiftSelectedIds);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.shiftChipOptions = [];
        this.cdr.markForCheck();
      },
    });
  }

  private setupUsernameGeneration(): void {
    const firstControl = this.employeeForm.get('personal.firstName');
    const lastControl = this.employeeForm.get('personal.lastName');
    firstControl?.valueChanges.subscribe(() => this.updateGeneratedUsername());
    lastControl?.valueChanges.subscribe(() => this.updateGeneratedUsername());
  }

  private updateGeneratedUsername(): void {
    if (this.mode !== 'add') return;
    const first = (this.employeeForm.get('personal.firstName')?.value || '').trim().toLowerCase();
    const last = (this.employeeForm.get('personal.lastName')?.value || '').trim().toLowerCase();
    if (first || last) {
      const base = last ? `${first}.${last}` : first;
      const username = base.replace(/[^a-z0-9.]/g, '');
      this.organizationGroup.get('username')?.setValue(username);
    }
  }

  get qualifications(): FormArray {
    return this.employeeForm.get('professional.qualifications') as FormArray;
  }

  get personalGroup(): FormGroup {
    return this.employeeForm.get('personal') as FormGroup;
  }

  get professionalGroup(): FormGroup {
    return this.employeeForm.get('professional') as FormGroup;
  }

  get organizationGroup(): FormGroup {
    return this.employeeForm.get('organization') as FormGroup;
  }

  get reportingManagerSelectedIds(): string[] {
    const id = this.organizationGroup.get('reportingManagerId')?.value;
    return id ? [String(id)] : [];
  }

  onReportingManagerChange(ids: string[]): void {
    const control = this.organizationGroup.get('reportingManagerId');
    control?.setValue(ids[0] ?? null);
    control?.markAsDirty();
    control?.markAsTouched();
  }

  get scheduleGroup(): FormGroup {
    return this.employeeForm.get('schedule') as FormGroup;
  }

  get bankDetailsGroup(): FormGroup {
    return this.professionalGroup.get('bankDetails') as FormGroup;
  }

  getGroupForSection(tab: FormTab, section: FormSection): FormGroup {
    const basePath = section.groupPath || tab.groupPath;
    let group = this.employeeForm.get(basePath!) as FormGroup;
    if (section.subGroup) {
      group = group.get(section.subGroup) as FormGroup;
    }
    return group;
  }

  getReviewValue(section: FormSection, field: string): string {
    if (field === 'scheduleSummary') {
      return this.getScheduleReviewSummary();
    }
    const basePath = section.groupPath;
    let actualPath = basePath ?? '';
    if (section.subGroup) {
      actualPath += '.' + section.subGroup;
    }
    if (section.subGroupMap && section.subGroupMap[field]) {
      actualPath += '.' + section.subGroupMap[field];
    }
    const controlName = this.configs[field].controlName;
    actualPath += '.' + controlName;
    const val = this.employeeForm.get(actualPath)?.value;
    if (field === 'employeeTypeId') {
      return this.userTypes.find((t) => t.id === val)?.name ?? val ?? '—';
    }
    if (field === 'portalRoleId') {
      return this.roles.find((r) => r.id === val)?.name ?? val ?? '—';
    }
    if (field === 'departmentId') {
      return this.departments.find((d) => d.value === val)?.label ?? val ?? '—';
    }
    if (field === 'reportingManagerId') {
      return this.reportingManagers.find((m) => m.value === val)?.label ?? val ?? '—';
    }
    if (val === true) return 'Yes';
    if (val === false) return 'No';
    return val || '—';
  }

  private loadedEmployee: any = null;
  private readonly lookupsReady = { userTypes: false, roles: false };
  private employeeDataReady = false;

  get isPortalAccessEnabled(): boolean {
    return this.organizationGroup.get('portalAccess')?.value === 'Enabled';
  }

  shouldShowOrganizationField(field: string): boolean {
    if (field === 'portalRoleId' || field === 'username') {
      return this.isPortalAccessEnabled;
    }
    return true;
  }

  private resolveEmployeeTypeId(data: Record<string, unknown>): string | null {
    const direct = data['employeeTypeId'] ?? data['userTypeId'] ?? data['EmployeeTypeId'] ?? data['UserTypeId'];
    if (direct) {
      return String(direct);
    }
    const typeName = String(data['userTypeCode'] ?? data['UserTypeCode'] ?? '').trim().toLowerCase();
    if (!typeName) {
      return null;
    }
    return (
      this.userTypes.find((t) => String(t.name ?? t.code ?? '').trim().toLowerCase() === typeName)?.id ?? null
    );
  }

  private resolvePortalRoleId(data: Record<string, unknown>): string | null {
    const direct = data['portalRoleId'] ?? data['roleId'] ?? data['PortalRoleId'] ?? data['RoleId'];
    if (direct) {
      return String(direct);
    }
    const roleName = String(data['portalRoleName'] ?? data['PortalRoleName'] ?? '').trim();
    if (!roleName) {
      return null;
    }
    return this.roles.find((r) => r.name === roleName)?.id ?? null;
  }

  private tryApplyOrganizationLookups(): void {
    if (!this.employeeDataReady || !this.lookupsReady.userTypes || !this.lookupsReady.roles || !this.loadedEmployee) {
      return;
    }

    const employeeTypeId = this.resolveEmployeeTypeId(this.loadedEmployee);
    const portalRoleId = this.resolvePortalRoleId(this.loadedEmployee);

    this.organizationGroup.patchValue(
      {
        employeeTypeId: employeeTypeId ?? '',
        portalRoleId: portalRoleId ?? '',
      },
      { emitEvent: false },
    );
    this.syncPortalAccessValidation();
    this.cdr.markForCheck();
  }

  private syncPortalAccessValidation(): void {
    const portalRole = this.organizationGroup.get('portalRoleId');
    if (!portalRole) {
      return;
    }

    if (this.isPortalAccessEnabled) {
      portalRole.setValidators(Validators.required);
    } else {
      portalRole.clearValidators();
      portalRole.setValue(null, { emitEvent: false });
    }
    portalRole.updateValueAndValidity({ emitEvent: false });
  }

  private wirePortalAccessValidation(): void {
    const portalAccess = this.organizationGroup.get('portalAccess');
    this.syncPortalAccessValidation();
    portalAccess?.valueChanges.subscribe(() => this.syncPortalAccessValidation());
  }

  loadEmployeeData(): void {
    this.employeeService.getEmployeeById(this.employeeId!).subscribe({
      next: (data) => {
        this.loadedEmployee = data;
        this.employeeForm.patchValue({
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
            employeeCode: data.employeeCode ?? data.employeeId,
            joiningDate: this.toLocalDate(data.joiningDate),
            designation: data.designation,
            experience: clampExperienceValue(data.experience),
            bankDetails: {
              accountNumber: data.bankAccountNumber ? sanitizeBankAccountInput(String(data.bankAccountNumber)) : '',
              ifscCode: data.bankIfscCode ? sanitizeIfscInput(String(data.bankIfscCode)) : '',
              bankName: data.bankName,
            },
          },
          organization: {
            employeeTypeId: '',
            portalRoleId: '',
            departmentId: data.departmentId ? String(data.departmentId) : null,
            reportingManagerId: data.reportingManagerId ? String(data.reportingManagerId) : null,
            portalAccess: data.portalAccess === true || data.portalAccess === 'Enabled' ? 'Enabled' : 'Disabled',
            username: data.username ?? data.Username ?? '',
          },
          schedule: {
            scheduleMode: 'master',
            shiftIds: [],
            shiftStartTime: normalizeTimeValue(data.shiftStartTime ?? data.shiftStarttime),
            shiftEndTime: normalizeTimeValue(data.shiftEndTime ?? data.shiftEndtime),
          },
        });
        const rawShiftIds = data.shiftIds ?? data.ShiftIds ?? [];
        const shiftIds = Array.isArray(rawShiftIds)
          ? rawShiftIds.map((id: unknown) => String(id)).filter(Boolean)
          : [];
        const mode = shiftIds.length > 0 ? 'master' : 'custom';
        this.scheduleGroup.patchValue(
          {
            scheduleMode: mode,
            shiftIds,
            shiftStartTime: normalizeTimeValue(data.shiftStartTime ?? data.shiftStarttime),
            shiftEndTime: normalizeTimeValue(data.shiftEndTime ?? data.shiftEndtime),
          },
          { emitEvent: false },
        );
        this.applyScheduleMode(mode);
        if (mode === 'master') {
          this.applyDerivedShiftTimes(shiftIds);
        }
        this.employeeDataReady = true;
        this.tryApplyOrganizationLookups();
        this.setQualificationsFromApi(data.qualifications);
        syncShiftTimeValidity(this.scheduleGroup);
        if (this.mode === 'view') {
          this.employeeForm.disable();
        }
      },
      error: () => {
        this.snackBar.open('Failed to load employee data', 'Close', { duration: 3000 });
      },
    });
  }

  addQualification(): void {
    if (this.mode === 'view') return;
    this.qualifications.push(this.createQualificationRow());
  }

  removeQualification(index: number): void {
    if (this.mode === 'view') return;
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
    const items = raw ? String(raw).split(';').map((x) => x.trim()).filter(Boolean) : [];
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
    const parts = text.trim().split(' — ').map((p) => p.trim());
    return { degree: parts[0] || '', university: parts[1] || '', year: parts[2] || '', percentage: parts[3] || '' };
  }

  setGender(gender: string): void {
    if (this.mode === 'view') return;
    this.employeeForm.get('personal.gender')?.setValue(gender);
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

  get shiftSummary(): string {
    return formatShiftRangeDisplay(
      this.scheduleGroup.get('shiftStartTime')?.value,
      this.scheduleGroup.get('shiftEndTime')?.value,
    );
  }

  onShiftTimeChange(): void {
    syncShiftTimeValidity(this.scheduleGroup);
  }

  onShiftTimeBlur(): void {
    this.onShiftTimeChange();
    this.scheduleGroup.get('shiftStartTime')?.markAsTouched();
    this.scheduleGroup.get('shiftEndTime')?.markAsTouched();
  }

  goTab(step: number): void {
    if (step > this.currentStep && !this.validateStep(this.currentStep)) {
      return;
    }
    this.currentStep = step;
  }

  nextStep(): void {
    if (this.currentStep < this.lastStepIndex) {
      if (!this.validateStep(this.currentStep)) {
        this.snackBar.open('Please fix errors on this step before continuing', 'Close', { duration: 3000 });
        return;
      }
      this.currentStep += 1;
    } else {
      this.saveEmployee();
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep -= 1;
    }
  }

  private validateStep(step: number): boolean {
    let paths = this.stepFieldPaths[step] ?? [];
    if (step === 2) {
      paths = ['organization.employeeTypeId'];
      if (this.isPortalAccessEnabled) {
        paths = [...paths, 'organization.portalRoleId'];
      }
    }
    if (step === 3) {
      return this.validateScheduleStep();
    }
    return validateFormControls(this.employeeForm, paths);
  }

  private validateScheduleStep(): boolean {
    const mode = this.scheduleGroup.get('scheduleMode')?.value;
    if (mode === 'master') {
      const ids = this.shiftSelectedIds;
      if (!ids.length) {
        this.scheduleGroup.get('shiftIds')?.markAsTouched();
        this.snackBar.open('Select at least one shift from Shift Master', 'Close', { duration: 3000 });
        return false;
      }
      return true;
    }

    syncShiftTimeValidity(this.scheduleGroup);
    const ok = validateFormControls(this.employeeForm, [
      'schedule.shiftStartTime',
      'schedule.shiftEndTime',
    ]);
    if (!ok) {
      return false;
    }
    const start = normalizeTimeValue(this.scheduleGroup.get('shiftStartTime')?.value);
    const end = normalizeTimeValue(this.scheduleGroup.get('shiftEndTime')?.value);
    if (!start || !end) {
      this.scheduleGroup.get('shiftStartTime')?.markAsTouched();
      this.scheduleGroup.get('shiftEndTime')?.markAsTouched();
      this.snackBar.open('Enter custom shift start and end times', 'Close', { duration: 3000 });
      return false;
    }
    return true;
  }

  private getScheduleReviewSummary(): string {
    const mode = this.scheduleGroup.get('scheduleMode')?.value;
    const range = formatShiftRangeDisplay(
      this.scheduleGroup.get('shiftStartTime')?.value,
      this.scheduleGroup.get('shiftEndTime')?.value,
    );
    if (mode === 'master') {
      const names = this.shiftSelectedIds
        .map((id) => this.shiftTimeById.get(id)?.name)
        .filter(Boolean);
      if (!names.length) {
        return range;
      }
      return `${names.join(', ')} (${range})`;
    }
    return range === '—' ? 'Custom —' : `Custom (${range})`;
  }

  saveEmployee(): void {
    if (!this.validateScheduleStep() || this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000, panelClass: 'snack-error' });
      return;
    }

    const data = this.employeeForm.getRawValue();
    if (this.mode === 'edit' && this.loadedEmployee) {
      data.userId = this.loadedEmployee.userId ?? this.loadedEmployee.UserId;
    }

    const action =
      this.mode === 'edit'
        ? this.employeeService.updateEmployee(this.employeeId!, data, {
            userTypes: this.userTypes,
            roles: this.roles,
            existing: this.loadedEmployee,
          })
        : this.employeeService.createEmployee(data, {
            userTypes: this.userTypes,
            roles: this.roles,
          });

    action.subscribe({
      next: () => {
        if (this.mode === 'edit') {
          this.snackBar.open('Employee updated successfully', 'Close', { duration: 3000 });
        } else {
          const username = String(this.organizationGroup.get('username')?.value || '').trim();
          this.snackBar.success(
            'Employee added successfully',
            username
              ? `Login username: ${username} · Default password: SmartOps@123`
              : 'Default password: SmartOps@123',
            5000,
          );
        }
        this.saved.emit();
      },
      error: (err) => {
        const apiErrors = err?.error?.errors;
        let message = 'Failed to save employee';
        if (apiErrors && typeof apiErrors === 'object') {
          const parts = Object.values(apiErrors).flat().filter(Boolean);
          if (parts.length) message = parts.join(' ');
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

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private toLocalDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const [year, month, day] = String(value).substring(0, 10).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }
}
