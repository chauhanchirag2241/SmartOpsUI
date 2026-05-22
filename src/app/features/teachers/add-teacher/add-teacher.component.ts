import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TeacherService } from '../../../core/services/teacher.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FileUploadComponent, SelectedUploadFile } from '../../../shared/components/file-upload/file-upload.component';
import { DigitsOnlyDirective } from '../../../shared/directives/digits-only.directive';
import { LettersOnlyDirective } from '../../../shared/directives/letters-only.directive';
import { BloodGroup, enumToOptions, Gender } from '../../../shared/enums/field-options.enum';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { BANK_NAME_MAX_LENGTH, PERSON_NAME_MAX_LENGTH, SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';
import {
  aadhaarValidationConfig,
  aadhaarValidator,
  formatAadhaarDisplay,
  nameValidationConfig,
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
  shiftTimesValidator,
} from '../../../shared/utils/form-validators.util';
import { validateFormControls } from '../../../shared/utils/form-validation.util';

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
    FileUploadComponent,
    DigitsOnlyDirective,
    LettersOnlyDirective,
    DynamicFieldComponent,
  ],
  templateUrl: './add-teacher.component.html',
  styleUrl: './add-teacher.component.css'
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
    { title: 'Review', icon: 'fact_check' }
  ];

  hints = [
    'Step 1 of 4 — Personal information',
    'Step 2 of 4 — Professional details',
    'Step 3 of 4 — Schedule and portal access',
    'Step 4 of 4 — Review & save'
  ];

  readonly configs: Record<string, FormFieldConfig> = {
    firstName: {
      type: 'input',
      controlName: 'firstName',
      label: 'First name',
      placeholder: 'First Name',
      inputFormat: 'name',
      maxLength: PERSON_NAME_MAX_LENGTH,
      validations: nameValidationConfig(true, PERSON_NAME_MAX_LENGTH).validations,
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
    dob: { type: 'datepicker', controlName: 'dob', label: 'Date of birth', validations: [{ name: 'required', message: 'DOB is required', validator: Validators.required }] },
    bloodGroup: { type: 'select', controlName: 'bloodGroup', label: 'Blood group', placeholder: SELECT_PLACEHOLDER, options: enumToOptions(BloodGroup) },
    aadhaarNumber: { type: 'input', controlName: 'aadhaarNumber', label: 'Aadhaar number', placeholder: 'XXXX XXXX XXXX', inputFormat: 'aadhaar', validations: aadhaarValidationConfig().validations },
    panNumber: { type: 'input', controlName: 'panNumber', label: 'PAN number', placeholder: 'ABCDE1234F', inputFormat: 'pan', validations: panValidationConfig().validations },
    joiningDate: { type: 'datepicker', controlName: 'joiningDate', label: 'Joining date', validations: [{ name: 'required', message: 'Joining date is required', validator: Validators.required }] },
  };

  private readonly stepFieldPaths: Record<number, string[]> = {
    0: [
      'personal.firstName', 'personal.lastName', 'personal.dob', 'personal.gender',
      'personal.aadhaarNumber', 'personal.panNumber', 'personal.mobile', 'personal.email',
      'personal.emergencyContact.name', 'personal.emergencyContact.mobile',
    ],
    1: ['professional.joiningDate'],
    2: ['schedule.role'],
  };

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private snackBar: MatSnackBar
  ) {
    this.teacherForm = this.fb.group({
      personal: this.fb.group({
        firstName: ['', [Validators.required, nameValidator(PERSON_NAME_MAX_LENGTH)]],
        lastName: ['', [Validators.required, nameValidator(PERSON_NAME_MAX_LENGTH)]],
        dob: ['', Validators.required],
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
          mobile: ['', Validators.pattern('^[0-9]{10}$')]
        })
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
          bankName: ['', bankNameValidator(BANK_NAME_MAX_LENGTH)]
        })
      }),
      schedule: this.fb.group({
        classId: [''],
        shiftStartTime: [null, shiftTimesValidator()],
        shiftEndTime: [null, shiftTimesValidator()],
        weeklyPeriods: [null, optionalPositiveIntValidator(99)],
        maxPeriodsPerDay: [null, optionalPositiveIntValidator(12)],
        role: ['Teacher', Validators.required],
        portalAccess: ['Enabled'],
        username: [{ value: '', disabled: true }],
        sendWelcomeEmail: ['Yes — send credentials']
      })
    });
  }

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  ngOnInit(): void {
    if (this.mode === 'add') {
      this.generateEmployeeId();
      this.setupUsernameGeneration();
      this.professionalGroup.patchValue({ joiningDate: this.today() });
    }
    if (this.mode !== 'add' && this.teacherId) {
      this.loadTeacherData();
    }
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
    return (this.teacherForm.get('professional.qualifications') as FormArray);
  }

  get personalGroup(): FormGroup {
    return this.teacherForm.get('personal') as FormGroup;
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
            address: data.address
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
              bankName: data.bankName
            }
          },
          schedule: {
            classId: data.classId,
            shiftStartTime: normalizeTimeValue(data.shiftStartTime ?? data.shiftStarttime),
            shiftEndTime: normalizeTimeValue(data.shiftEndTime ?? data.shiftEndtime),
            weeklyPeriods: data.weeklyPeriods ?? null,
            maxPeriodsPerDay: data.maxPeriodsPerDay ?? null,
            role: data.role,
            portalAccess: data.portalAccess ? 'Enabled' : 'Disabled',
            username: data.username
          }
        });
        this.setQualificationsFromApi(data.qualifications);
        if (this.mode === 'view') {
          this.teacherForm.disable();
        }
      },
      error: () => {
        this.snackBar.open('Failed to load teacher data', 'Close', { duration: 3000 });
      }
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

  private createQualificationRow(degree = '', institution = ''): FormGroup {
    return this.fb.group({
      degree: [degree],
      institution: [institution],
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
      const { degree, institution } = this.parseQualificationEntry(item);
      arr.push(this.createQualificationRow(degree, institution), { emitEvent: false });
    }
  }

  private parseQualificationEntry(text: string): { degree: string; institution: string } {
    const value = text.trim();
    const sep = value.indexOf(' — ');
    if (sep >= 0) {
      return {
        degree: value.slice(0, sep).trim(),
        institution: value.slice(sep + 3).trim(),
      };
    }
    return { degree: value, institution: '' };
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
    return this.resolveFieldError(this.bankDetailsGroup.get('accountNumber'), 'bankAccount', 'Enter a valid bank account number (9–18 digits)');
  }

  get ifscError(): string {
    return this.resolveFieldError(this.bankDetailsGroup.get('ifscCode'), 'ifsc', 'Enter a valid 11-character IFSC (e.g. SBIN0001234)');
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
    this.scheduleGroup.get('shiftStartTime')?.updateValueAndValidity();
    this.scheduleGroup.get('shiftEndTime')?.updateValueAndValidity();
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
        this.snackBar.open('Please fix errors on this step before continuing', 'Close', { duration: 3000 });
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
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000, panelClass: 'snack-error' });
      return;
    }

    const data = this.teacherForm.getRawValue();
    data.schedule.classId = data.schedule.classId || null;
    data.schedule.classAssignments = [];

    const action = this.mode === 'edit'
      ? this.teacherService.updateTeacher(this.teacherId!, data)
      : this.teacherService.createTeacher(data);

    action.subscribe({
      next: () => {
        if (this.mode === 'add') {
          this.persistEmployeeSequence();
        }
        this.snackBar.open(`Teacher ${this.mode === 'edit' ? 'updated' : 'added'} successfully`, 'Close', { duration: 3000 });
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
      }
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
