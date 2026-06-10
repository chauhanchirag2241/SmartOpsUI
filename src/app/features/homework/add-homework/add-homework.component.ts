import { Component, EventEmitter, Output, Input, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
import {
  HomeworkService,
  HomeworkPriority,
  HomeworkSubmissionType,
  CreateHomeworkRequest,
} from '../../../core/services/homework.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { FormTab } from '../../../shared/interfaces/form-layout';
import { enumToOptions } from '../../../shared/enums/field-options.enum';

@Component({
  selector: 'app-add-homework',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, ActionButtonComponent, DynamicFieldComponent],
  templateUrl: './add-homework.component.html',
  styleUrl: './add-homework.component.css',
})
export class AddHomeworkComponent implements OnInit {
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() homeworkId: string | null = null;
  @Input() initialForm?: CreateHomeworkRequest;
  
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private classService = inject(ClassService);
  private subjectService = inject(SubjectService);
  private homeworkService = inject(HomeworkService);
  private snackBar = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private ayContext = inject(AcademicYearContextService);
  private fb = inject(FormBuilder);

  homeworkForm!: FormGroup;
  isSaving = false;

  readonly configs: Record<string, FormFieldConfig> = {
    classId: { type: 'select', controlName: 'classId', label: 'Class', placeholder: 'Select class', options: [], validations: [{ name: 'required', message: 'Class is required', validator: Validators.required }] },
    subjectId: { type: 'select', controlName: 'subjectId', label: 'Subject', placeholder: 'Select subject', options: [], validations: [{ name: 'required', message: 'Subject is required', validator: Validators.required }] },
    title: { type: 'input', controlName: 'title', label: 'Homework title', placeholder: 'e.g. Chapter 4 — Algebra exercises', validations: [{ name: 'required', message: 'Title is required', validator: Validators.required }] },
    description: { type: 'textarea', controlName: 'description', label: 'Description / Instructions', placeholder: 'Write instructions for students...' },
    assignDate: { type: 'datepicker', controlName: 'assignDate', label: 'Assign date' },
    dueDate: { type: 'datepicker', controlName: 'dueDate', label: 'Due date', validations: [{ name: 'required', message: 'Due date is required', validator: Validators.required }] },
    priority: { type: 'select', controlName: 'priority', label: 'Priority', options: [
      { label: 'Normal', value: HomeworkPriority.Normal },
      { label: 'High', value: HomeworkPriority.High },
      { label: 'Low', value: HomeworkPriority.Low }
    ] },
    marks: { type: 'input', inputType: 'number', controlName: 'marks', label: 'Marks (optional)', placeholder: 'e.g. 10' },
    submissionType: { type: 'select', controlName: 'submissionType', label: 'Submission type', options: [
      { label: 'Physical (in class)', value: HomeworkSubmissionType.Physical },
      { label: 'Online (portal upload)', value: HomeworkSubmissionType.Online },
      { label: 'Both', value: HomeworkSubmissionType.Both }
    ] }
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Basic Information',
          icon: 'info',
          layout: 'grid2',
          fields: ['classId', 'subjectId', 'title', 'description']
        },
        {
          title: 'Schedule & Priority',
          icon: 'event',
          layout: 'grid3',
          fields: ['assignDate', 'dueDate', 'priority']
        },
        {
          title: 'Grading & Submission',
          icon: 'grading',
          layout: 'grid2',
          fields: ['marks', 'submissionType']
        }
      ]
    }
  ];

  ngOnInit(): void {
    const today = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 2);

    this.homeworkForm = this.fb.group({
      classId: ['', Validators.required],
      subjectId: ['', Validators.required],
      title: ['', Validators.required],
      description: [''],
      assignDate: [today],
      dueDate: [due, Validators.required],
      priority: [HomeworkPriority.Normal],
      marks: [null],
      submissionType: [HomeworkSubmissionType.Physical],
    });

    this.loadDropdowns();
    if (this.initialForm) {
      this.homeworkForm.patchValue({
        ...this.initialForm,
        assignDate: this.initialForm.assignDate ? new Date(this.initialForm.assignDate) : null,
        dueDate: this.initialForm.dueDate ? new Date(this.initialForm.dueDate) : null,
      });
    }

    if (!this.canManageHomework) {
      this.homeworkForm.disable();
    }
  }

  get canManageHomework(): boolean {
    return !this.ayContext.isReadOnlyScope();
  }

  loadDropdowns(): void {
    this.classService.getClassDropdown().subscribe({
      next: (c) => {
        const arr = c || [];
        this.configs['classId'].options = arr.map((item: any) => ({ label: item.name, value: item.id }));
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to load classes', 'Close', { duration: 3000 }),
    });
    this.subjectService.getSubjectDropdown().subscribe({
      next: (s) => {
        const arr = s || [];
        this.configs['subjectId'].options = arr.map((item: any) => ({ label: item.subjectName || item.name, value: item.id }));
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to load subjects', 'Close', { duration: 3000 }),
    });
  }

  saveHomework(): void {
    if (!this.canManageHomework) return;
    
    this.homeworkForm.markAllAsTouched();
    if (this.homeworkForm.invalid) {
      this.snackBar.open('Please fill required fields correctly', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formVal = this.homeworkForm.value;
    const req: CreateHomeworkRequest = {
      ...formVal,
      title: formVal.title.trim(),
      assignDate: formVal.assignDate ? formVal.assignDate.toISOString().split('T')[0] : null,
      dueDate: formVal.dueDate ? formVal.dueDate.toISOString().split('T')[0] : null,
    };

    const call = this.homeworkId && this.mode === 'edit'
      ? this.homeworkService.update(this.homeworkId, req)
      : this.homeworkService.create(req);

    call.subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open(
          this.mode === 'edit' ? 'Homework updated' : 'Homework assigned',
          'Close',
          { duration: 2500, panelClass: ['snack-success'] },
        );
        this.saved.emit();
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err?.error || 'Save failed', 'Close', {
          duration: 3000,
          panelClass: ['snack-error'],
        });
        this.cdr.detectChanges();
      },
    });
  }

  closeForm(): void {
    this.cancel.emit();
  }
}
