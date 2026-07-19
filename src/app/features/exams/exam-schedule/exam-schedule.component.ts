import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SubjectService } from '../../../core/services/subject.service';
import { EmployeeService, EmployeeDropdownItem } from '../../../core/services/employee.service';
import {
  ExamService,
  ExamListItem,
  ExamClassInfo,
  ExamScheduleItem,
} from '../../../core/services/exam.service';

@Component({
  selector: 'app-exam-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  templateUrl: './exam-schedule.component.html',
  styleUrls: ['../exam-shared.css'],
})
export class ExamScheduleComponent implements OnInit {
  private examService = inject(ExamService);
  private subjectService = inject(SubjectService);
  private employeeService = inject(EmployeeService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private cdr = inject(ChangeDetectorRef);

  exams: ExamListItem[] = [];
  subjects: any[] = [];
  employees: EmployeeDropdownItem[] = [];
  schedules: ExamScheduleItem[] = [];
  loading = false;

  selectedExamId = '';
  selectedClassId = '';

  showForm = false;
  formMode: 'add' | 'edit' = 'add';
  editingId: string | null = null;
  formError = '';
  saving = false;

  formSubjectId = '';
  formExamDate = '';
  formStartTime = '';
  formEndTime = '';
  formRoomNo = '';
  formInvigilatorId = '';

  get canAdd(): boolean {
    return this.permissions.canAdd(MenuCodes.ExamSchedule);
  }
  get canEdit(): boolean {
    return this.permissions.canEdit(MenuCodes.ExamSchedule);
  }
  get canDelete(): boolean {
    return this.permissions.canDelete(MenuCodes.ExamSchedule);
  }

  get selectedExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.selectedExamId);
  }

  get examClasses(): ExamClassInfo[] {
    return this.selectedExam?.classes ?? [];
  }

  ngOnInit(): void {
    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        if (this.exams.length > 0 && !this.selectedExamId) {
          this.selectedExamId = this.exams[0].id;
          this.onExamChange();
        }
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to load exams', 'Close', { duration: 3000 }),
    });
    this.subjectService.getSubjectDropdown().subscribe({
      next: (subjects) => {
        this.subjects = subjects ?? [];
        this.cdr.detectChanges();
      },
    });
    this.employeeService.getEmployeeDropdown().subscribe({
      next: (employees) => {
        this.employees = employees ?? [];
        this.cdr.detectChanges();
      },
    });
  }

  onExamChange(): void {
    const classes = this.examClasses;
    this.selectedClassId = classes[0]?.classId ?? '';
    this.loadSchedules();
  }

  loadSchedules(): void {
    if (!this.selectedExamId) {
      this.schedules = [];
      return;
    }
    this.loading = true;
    this.examService.getSchedules(this.selectedExamId, this.selectedClassId || undefined).subscribe({
      next: (schedules) => {
        this.schedules = schedules ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.schedules = [];
        this.loading = false;
        this.snackBar.open('Failed to load schedule', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  statusBadgeClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'today':
        return 'b-a';
      case 'completed':
        return 'b-g';
      case 'upcoming':
        return 'b-b';
      default:
        return 'b-gray';
    }
  }

  timeRange(item: ExamScheduleItem): string {
    if (!item.startTime && !item.endTime) return '—';
    return `${item.startTime ?? '?'} – ${item.endTime ?? '?'}`;
  }

  openCreate(): void {
    if (!this.selectedExamId || !this.selectedClassId) {
      this.snackBar.open('Select an exam and class first', 'Close', { duration: 2500 });
      return;
    }
    this.formMode = 'add';
    this.editingId = null;
    this.formSubjectId = '';
    this.formExamDate = this.selectedExam?.startDate?.substring(0, 10) ?? '';
    this.formStartTime = '10:00';
    this.formEndTime = '13:00';
    this.formRoomNo = '';
    this.formInvigilatorId = '';
    this.formError = '';
    this.showForm = true;
  }

  openEdit(item: ExamScheduleItem): void {
    this.formMode = 'edit';
    this.editingId = item.id;
    this.formSubjectId = item.subjectId;
    this.formExamDate = item.examDate?.substring(0, 10) ?? '';
    this.formStartTime = item.startTime ?? '';
    this.formEndTime = item.endTime ?? '';
    this.formRoomNo = item.roomNo ?? '';
    this.formInvigilatorId = item.invigilatorId ?? '';
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
  }

  save(): void {
    if (!this.formSubjectId) {
      this.formError = 'Subject is required.';
      return;
    }
    if (!this.formExamDate) {
      this.formError = 'Exam date is required.';
      return;
    }
    if (this.formStartTime && this.formEndTime && this.formEndTime <= this.formStartTime) {
      this.formError = 'End time must be after start time.';
      return;
    }

    const payload = {
      examId: this.selectedExamId,
      classId: this.selectedClassId,
      subjectId: this.formSubjectId,
      examDate: this.formExamDate,
      startTime: this.formStartTime || null,
      endTime: this.formEndTime || null,
      roomNo: this.formRoomNo.trim() || null,
      invigilatorId: this.formInvigilatorId || null,
    };

    this.saving = true;
    const request =
      this.formMode === 'edit' && this.editingId
        ? this.examService.updateSchedule(this.editingId, payload)
        : this.examService.createSchedule(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(
          this.formMode === 'edit' ? 'Schedule updated' : 'Schedule slot added',
          'Close',
          { duration: 2500 },
        );
        this.closeForm();
        this.loadSchedules();
      },
      error: (err) => {
        this.saving = false;
        this.formError = typeof err?.error === 'string' ? err.error : 'Failed to save schedule';
        this.cdr.detectChanges();
      },
    });
  }

  deleteSchedule(item: ExamScheduleItem): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete schedule slot?',
        description: 'This exam schedule slot will be removed.',
        recordName: item.subjectName,
        recordMeta: `${item.className} · ${item.examDate?.substring(0, 10)}`,
        initials: 'SC',
        warningMessage: 'Marks entered against this slot will no longer be accessible.',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.examService.deleteSchedule(item.id).subscribe({
        next: () => {
          this.snackBar.open('Schedule slot deleted', 'Close', { duration: 2500 });
          this.loadSchedules();
        },
        error: (err) =>
          this.snackBar.open(
            typeof err?.error === 'string' ? err.error : 'Delete failed',
            'Close',
            { duration: 3500 },
          ),
      });
    });
  }

  print(): void {
    window.print();
  }
}
