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
import { BloodGroup, enumToOptions, Gender } from '../../../shared/enums/field-options.enum';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';

@Component({
  selector: 'app-add-teacher',
  standalone: true,
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
    firstName: { type: 'input', controlName: 'firstName', label: 'First name', placeholder: 'e.g. Ramesh', validations: [{ name: 'required', message: 'First name is required', validator: Validators.required }] },
    lastName: { type: 'input', controlName: 'lastName', label: 'Last name', placeholder: 'e.g. Sharma', validations: [{ name: 'required', message: 'Last name is required', validator: Validators.required }] },
    dob: { type: 'datepicker', controlName: 'dob', label: 'Date of birth', validations: [{ name: 'required', message: 'DOB is required', validator: Validators.required }] },
    bloodGroup: { type: 'select', controlName: 'bloodGroup', label: 'Blood group', options: enumToOptions(BloodGroup) },
    aadhaarNumber: { type: 'input', controlName: 'aadhaarNumber', label: 'Aadhaar number', placeholder: 'xxxx xxxx xxxx' },
    panNumber: { type: 'input', controlName: 'panNumber', label: 'PAN number', placeholder: 'ABCDE1234F' },
    joiningDate: { type: 'datepicker', controlName: 'joiningDate', label: 'Joining date', validations: [{ name: 'required', message: 'Joining date is required', validator: Validators.required }] },
  };

  workingDays = [
    { label: 'Mon', selected: true },
    { label: 'Tue', selected: true },
    { label: 'Wed', selected: true },
    { label: 'Thu', selected: true },
    { label: 'Fri', selected: true },
    { label: 'Sat', selected: false },
    { label: 'Sun', selected: false }
  ];

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private snackBar: MatSnackBar
  ) {
    this.teacherForm = this.fb.group({
      personal: this.fb.group({
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        dob: ['', Validators.required],
        bloodGroup: [''],
        gender: ['Male', Validators.required],
        aadhaarNumber: [''],
        panNumber: [''],
        mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
        alternateMobile: ['', Validators.pattern('^[0-9]{10}$')],
        email: ['', [Validators.required, Validators.email]],
        address: [''],
        emergencyContact: this.fb.group({
          name: [''],
          relation: [''],
          mobile: ['', Validators.pattern('^[0-9]{10}$')]
        })
      }),
      professional: this.fb.group({
        employeeId: [{ value: 'Auto-generated', disabled: true }],
        joiningDate: ['', Validators.required],
        department: ['', Validators.required],
        designation: ['', Validators.required],
        experience: [0],
        salaryGrade: [''],
        employmentType: ['Full-time'],
        qualifications: this.fb.array([
          this.fb.control('')
        ]),
        bankDetails: this.fb.group({
          accountNumber: [''],
          ifscCode: [''],
          bankName: ['']
        })
      }),
      schedule: this.fb.group({
        classId: [''],
        workingDays: [[]],
        shift: ['Morning (7:30 AM – 1:30 PM)'],
        weeklyPeriods: [30],
        maxPeriodsPerDay: [6],
        role: ['Teacher', Validators.required],
        portalAccess: ['Enabled'],
        username: [{ value: '', disabled: true }],
        sendWelcomeEmail: ['Yes — send credentials']
      })
    });
  }

  ngOnInit(): void {
    this.updateWorkingDays();
    if (this.mode === 'add') {
      this.generateEmployeeId();
      this.setupUsernameGeneration();
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
            aadhaarNumber: data.aadhaarNo,
            panNumber: data.panNo,
            mobile: data.mobile,
            alternateMobile: data.alternateMobile,
            email: data.email,
            address: data.address
          },
          professional: {
            employeeId: data.employeeId,
            joiningDate: this.toLocalDate(data.joiningDate),
            department: data.department,
            designation: data.designation,
            experience: data.experience,
            salaryGrade: data.salaryGrade,
            employmentType: data.employmentType,
            qualifications: data.qualifications ? String(data.qualifications).split(';').map((x: string) => x.trim()) : [''],
            bankDetails: {
              accountNumber: data.bankAccountNumber,
              ifscCode: data.bankIfscCode,
              bankName: data.bankName
            }
          },
          schedule: {
            classId: data.classId,
            shift: data.shift,
            weeklyPeriods: data.weeklyPeriods,
            maxPeriodsPerDay: data.maxPeriodsPerDay,
            role: data.role,
            portalAccess: data.portalAccess ? 'Enabled' : 'Disabled',
            username: data.username
          }
        });
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
    this.qualifications.push(this.fb.control(''));
  }

  removeQualification(index: number): void {
    if (this.qualifications.length > 1) {
      this.qualifications.removeAt(index);
    }
  }

  onPhotoSelected(file: SelectedUploadFile): void {
    this.selectedPhoto = file;
  }

  toggleDay(index: number): void {
    if (this.mode === 'view') return;
    this.workingDays[index].selected = !this.workingDays[index].selected;
    this.updateWorkingDays();
  }

  updateWorkingDays(): void {
    const selected = this.workingDays
      .filter(d => d.selected)
      .map(d => d.label);
    this.teacherForm.get('schedule.workingDays')?.setValue(selected);
  }

  setGender(gender: string): void {
    if (this.mode === 'view') return;
    this.teacherForm.get('personal.gender')?.setValue(gender);
  }

  setEmploymentType(type: string): void {
    if (this.mode === 'view') return;
    this.teacherForm.get('professional.employmentType')?.setValue(type);
  }

  goTab(step: number): void {
    this.currentStep = step;
  }

  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
    } else {
      this.saveTeacher();
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  saveTeacher(): void {
    if (this.teacherForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000 });
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
      error: () => {
        this.snackBar.open('Failed to save teacher', 'Close', { duration: 3000 });
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
