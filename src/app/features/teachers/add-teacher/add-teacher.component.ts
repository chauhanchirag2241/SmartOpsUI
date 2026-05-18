import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TeacherService } from '../../../core/services/teacher.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
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
  subjects: any[] = [];
  classes: any[] = [];
  selectedPhoto: SelectedUploadFile | null = null;
  readonly bloodGroupOptions = enumToOptions(BloodGroup);
  steps = [
    { title: 'Personal', icon: 'person' },
    { title: 'Professional', icon: 'work' },
    { title: 'Class & Permissions', icon: 'grid_view' },
    { title: 'Review', icon: 'fact_check' }
  ];

  hints = [
    'Step 1 of 4 — Personal information',
    'Step 2 of 4 — Professional details',
    'Step 3 of 4 — Class, subject & permission matrix',
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
    private classService: ClassService,
    private subjectService: SubjectService,
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
        classAssignments: this.fb.array([]),
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
    this.loadSubjects();
    this.loadClasses();
    this.addClassAssignmentRow();
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

  get classAssignments() {
    return this.teacherForm.get('schedule.classAssignments') as FormArray;
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
        this.loadClassAssignments();
      },
      error: (err) => {
        this.snackBar.open('Failed to load teacher data', 'Close', { duration: 3000 });
      }
    });
  }

  loadSubjects(): void {
    this.subjectService.getSubjectDropdown().subscribe({
      next: (subjects) => {
        this.subjects = subjects || [];
      },
      error: () => this.snackBar.open('Failed to load subjects', 'Close', { duration: 3000 })
    });
  }

  loadClasses(): void {
    this.classService.getClassDropdown().subscribe({
      next: (classes) => {
        this.classes = classes || [];
      },
      error: () => this.snackBar.open('Failed to load classes', 'Close', { duration: 3000 })
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

  loadClassAssignments(): void {
    if (!this.teacherId) return;
    this.teacherService.getTeacherAssignments(this.teacherId).subscribe({
      next: (data) => {
        this.classAssignments.clear();
        const rows = data?.classAssignments ?? [];
        if (rows.length === 0) {
          this.addClassAssignmentRow();
          return;
        }
        rows.forEach((row: any) => this.classAssignments.push(this.createClassAssignmentGroup(row)));
      },
      error: () => this.snackBar.open('Failed to load class assignments', 'Close', { duration: 3000 })
    });
  }

  createClassAssignmentGroup(row?: any): FormGroup {
    return this.fb.group({
      classId: [row?.classId ?? '', Validators.required],
      subjectIds: [row?.subjectIds ?? []],
      isClassTeacher: [row?.isClassTeacher ?? false],
      canViewStudents: [row?.canViewStudents ?? true],
      canMarkAttendance: [row?.canMarkAttendance ?? false],
      canAddMarks: [row?.canAddMarks ?? false],
      canSendNotice: [row?.canSendNotice ?? false],
      pendingSubjectId: ['']
    });
  }

  addClassAssignmentRow(): void {
    this.classAssignments.push(this.createClassAssignmentGroup());
  }

  removeClassAssignmentRow(index: number): void {
    if (this.classAssignments.length > 1) {
      this.classAssignments.removeAt(index);
    }
  }

  getSubjectIdsForRow(index: number): string[] {
    return (this.classAssignments.at(index)?.get('subjectIds')?.value as string[]) ?? [];
  }

  availableSubjectsForRow(index: number): any[] {
    const selected = new Set(this.getSubjectIdsForRow(index).map(String));
    return this.subjects.filter(s => !selected.has(String(s.id)));
  }

  addSubjectToRow(index: number): void {
    const group = this.classAssignments.at(index) as FormGroup;
    const pending = group.get('pendingSubjectId')?.value;
    if (!pending) return;
    const ids = [...this.getSubjectIdsForRow(index)];
    if (!ids.includes(pending)) {
      ids.push(pending);
    }
    group.patchValue({ subjectIds: ids, pendingSubjectId: '' });
  }

  removeSubjectFromRow(rowIndex: number, subjectId: string): void {
    const group = this.classAssignments.at(rowIndex) as FormGroup;
    const ids = this.getSubjectIdsForRow(rowIndex).filter(id => String(id) !== String(subjectId));
    group.patchValue({ subjectIds: ids });
  }

  onClassTeacherChange(rowIndex: number): void {
    const group = this.classAssignments.at(rowIndex) as FormGroup;
    if (group.get('isClassTeacher')?.value) {
      this.classAssignments.controls.forEach((ctrl, i) => {
        if (i !== rowIndex) {
          ctrl.get('isClassTeacher')?.setValue(false, { emitEvent: false });
        }
      });
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
    if (this.currentStep === 2 && this.classAssignments.length === 0) {
      this.snackBar.open('Add at least one class assignment', 'Close', { duration: 3000 });
      return;
    }
    if (this.currentStep === 2 && this.classAssignments.invalid) {
      this.snackBar.open('Select class for each assignment row', 'Close', { duration: 3000 });
      return;
    }
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
    const assignments = (data.schedule.classAssignments || []).map((row: any) => ({
      classId: row.classId,
      subjectIds: row.subjectIds || [],
      isClassTeacher: !!row.isClassTeacher,
      canViewStudents: !!row.canViewStudents,
      canMarkAttendance: !!row.canMarkAttendance,
      canAddMarks: !!row.canAddMarks,
      canSendNotice: !!row.canSendNotice
    }));
    data.schedule.classAssignments = assignments;
    data.schedule.classId = assignments[0]?.classId || data.schedule.classId || null;

    const action = this.mode === 'edit'
      ? this.teacherService.updateTeacher(this.teacherId!, data)
      : this.teacherService.createTeacher(data);

    action.subscribe({
      next: (res) => {
        const teacherId = this.mode === 'edit' ? this.teacherId! : (res?.teacherId ?? res?.TeacherId);
        const saveAssignments = () => {
          if (this.mode === 'add') {
            this.persistEmployeeSequence();
          }
          this.snackBar.open(`Teacher ${this.mode === 'edit' ? 'updated' : 'added'} successfully`, 'Close', { duration: 3000 });
          this.saved.emit();
        };

        if (teacherId && (this.mode === 'edit' || assignments.length > 0)) {
          this.teacherService.saveTeacherAssignments(teacherId, { classAssignments: assignments }).subscribe({
            next: () => saveAssignments(),
            error: () => {
              this.snackBar.open('Teacher saved but permissions failed to save', 'Close', { duration: 4000 });
              this.saved.emit();
            }
          });
        } else {
          saveAssignments();
        }
      },
      error: () => {
        this.snackBar.open('Failed to save teacher', 'Close', { duration: 3000 });
      }
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  getSubjectName(subjectId: unknown): string {
    return this.subjects.find(subject => String(subject.id) === String(subjectId))?.name || 'Subject';
  }

  getClassName(classId: unknown): string {
    return this.classes.find(classItem => String(classItem.id) === String(classId))?.name || 'Class';
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
