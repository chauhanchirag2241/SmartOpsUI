import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TeacherService } from '../../../core/services/teacher.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';

@Component({
  selector: 'app-add-teacher',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatIconModule],
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
  steps = [
    { title: 'Personal', icon: 'person' },
    { title: 'Professional', icon: 'work' },
    { title: 'Subjects & Schedule', icon: 'menu_book' },
    { title: 'Review', icon: 'fact_check' }
  ];

  hints = [
    'Step 1 of 4 — Personal information',
    'Step 2 of 4 — Professional details',
    'Step 3 of 4 — Subjects & schedule',
    'Step 4 of 4 — Review & save'
  ];

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
        subjectAssignments: this.fb.array([]),
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
    this.addSubjectAssignment(); // Add one initial row
    if (this.mode !== 'add' && this.teacherId) {
      this.loadTeacherData();
    }
  }

  get qualifications() {
    return (this.teacherForm.get('professional.qualifications') as FormArray);
  }

  get subjectAssignments() {
    return (this.teacherForm.get('schedule.subjectAssignments') as FormArray);
  }

  loadTeacherData(): void {
    this.teacherService.getTeacherById(this.teacherId!).subscribe({
      next: (data) => {
        this.teacherForm.patchValue({
          personal: {
            firstName: data.firstName,
            lastName: data.lastName,
            dob: data.dob,
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
            joiningDate: data.joiningDate,
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
        this.subjectAssignments.at(0)?.patchValue({ classId: data.classId });
        if (this.mode === 'view') {
          this.teacherForm.disable();
        }
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

  addSubjectAssignment(): void {
    const group = this.fb.group({
      subjectId: [''],
      classId: ['', Validators.required],
      isClassTeacher: [false]
    });
    this.subjectAssignments.push(group);
  }

  removeSubjectAssignment(index: number): void {
    if (this.subjectAssignments.length > 1) {
      this.subjectAssignments.removeAt(index);
    }
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
    data.schedule.classId = data.schedule.subjectAssignments?.[0]?.classId || data.schedule.classId || null;
    const action = this.mode === 'edit' 
      ? this.teacherService.updateTeacher(this.teacherId!, data)
      : this.teacherService.createTeacher(data);

    action.subscribe({
      next: () => {
        this.snackBar.open(`Teacher ${this.mode === 'edit' ? 'updated' : 'added'} successfully`, 'Close', { duration: 3000 });
        this.saved.emit();
      },
      error: () => {
        this.snackBar.open('Failed to save teacher', 'Close', { duration: 3000 });
        // For demo, let's pretend it worked
        // this.saved.emit();
      }
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
