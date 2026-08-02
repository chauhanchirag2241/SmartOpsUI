import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  ExamService,
  ExamListItem,
  ExamClassInfo,
  HallTicket,
} from '../../../core/services/exam.service';

@Component({
  selector: 'app-hall-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    PageChromeDirective,
    ActionButtonComponent,
    DynamicFieldComponent,
  ],
  templateUrl: './hall-tickets.component.html',
  styleUrl: './hall-tickets.component.css',
})
export class HallTicketsComponent implements OnInit, OnDestroy {
  private examService = inject(ExamService);
  private snackBar = inject(NotificationService);
  private permissions = inject(PermissionService);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private readonly subs = new Subscription();

  exams: ExamListItem[] = [];
  tickets: HallTicket[] = [];

  loading = false;
  generating = false;

  readonly filterForm = this.fb.group({
    selectedExamId: [''],
    selectedClassId: [''],
  });

  examConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'selectedExamId',
    label: 'Exam',
    placeholder: 'Select exam',
    options: [{ label: 'Select exam', value: '' }],
  };

  classConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'selectedClassId',
    label: 'Class',
    placeholder: 'Select class',
    options: [{ label: 'Select class', value: '' }],
  };

  get canGenerate(): boolean {
    return (
      this.permissions.canAdd(MenuCodes.ExamHallTickets) ||
      this.permissions.canEdit(MenuCodes.ExamHallTickets)
    );
  }

  get selectedExamId(): string {
    return String(this.filterForm.get('selectedExamId')?.value ?? '');
  }

  get selectedClassId(): string {
    return String(this.filterForm.get('selectedClassId')?.value ?? '');
  }

  get selectedExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.selectedExamId);
  }

  get examClasses(): ExamClassInfo[] {
    return this.selectedExam?.classes ?? [];
  }

  ngOnInit(): void {
    this.subs.add(
      this.filterForm.get('selectedExamId')!.valueChanges.subscribe(() => this.onExamChange()),
    );
    this.subs.add(
      this.filterForm.get('selectedClassId')!.valueChanges.subscribe(() => this.loadTickets()),
    );

    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        this.examConfig = {
          ...this.examConfig,
          options: [
            { label: 'Select exam', value: '' },
            ...this.exams.map((e) => ({
              label: `${e.name} (${e.examGroupName})`,
              value: e.id,
            })),
          ],
        };
        if (this.exams.length > 0) {
          this.filterForm.patchValue({ selectedExamId: this.exams[0].id }, { emitEvent: false });
          this.onExamChange();
        }
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load exams', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onExamChange(): void {
    const classes = this.examClasses;
    this.classConfig = {
      ...this.classConfig,
      options: [
        { label: 'Select class', value: '' },
        ...classes.map((c) => ({ label: c.className, value: c.classId })),
      ],
    };
    const nextClassId = classes[0]?.classId ?? '';
    this.filterForm.patchValue({ selectedClassId: nextClassId }, { emitEvent: false });
    this.loadTickets();
  }

  loadTickets(): void {
    this.tickets = [];
    if (!this.selectedExamId || !this.selectedClassId) return;
    this.loading = true;
    this.examService.getHallTickets(this.selectedExamId, this.selectedClassId).subscribe({
      next: (tickets) => {
        this.tickets = tickets ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load hall tickets', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  generate(): void {
    if (!this.selectedExamId || !this.selectedClassId) {
      this.snackBar.open('Select an exam and class first', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }
    this.generating = true;
    this.examService.generateHallTickets(this.selectedExamId, this.selectedClassId).subscribe({
      next: (tickets) => {
        this.tickets = tickets ?? [];
        this.generating = false;
        this.snackBar.open(`Generated hall tickets for ${this.tickets.length} student(s)`, 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.generating = false;
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Hall ticket generation failed',
          'Close',
          { duration: 3500, panelClass: 'snack-error' },
        );
        this.cdr.detectChanges();
      },
    });
  }

  initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  printAll(): void {
    window.print();
  }
}
