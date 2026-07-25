import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../../shared/form-controls/form-field';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
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
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    SmartDataTableComponent,
    ActionButtonComponent,
    PageChromeDirective,
    FormFieldComponent,
  ],
  templateUrl: './exam-schedule.component.html',
  styleUrl: './exam-schedule.component.css',
})
export class ExamScheduleComponent implements OnInit {
  private examService = inject(ExamService);
  private subjectService = inject(SubjectService);
  private employeeService = inject(EmployeeService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private ayContext = inject(AcademicYearContextService);
  private cdr = inject(ChangeDetectorRef);

  exams: ExamListItem[] = [];
  subjects: any[] = [];
  employees: EmployeeDropdownItem[] = [];
  rows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  selectedExamId = '';
  selectedClassId = '';

  showForm = false;
  formMode: 'add' | 'edit' = 'add';
  editingId: string | null = null;
  formError = '';
  saving = false;

  formExamId = '';
  formClassId = '';
  formSubjectId = '';
  formExamDate = '';
  formStartTime = '';
  formEndTime = '';
  formRoomNo = '';
  formInvigilatorId = '';

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Exam Schedule',
      subtitle: 'Subject & class wise exam timetable',
      showAddButton: true,
      addButtonText: 'Add slot',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'examDate', label: 'Date', sortable: true, cellType: 'date' },
      { key: 'className', label: 'Class', sortable: true },
      {
        key: 'subject',
        label: 'Subject',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: { nameKey: 'subjectName' },
      },
      { key: 'timeLabel', label: 'Time' },
      { key: 'roomNo', label: 'Room' },
      { key: 'invigilatorName', label: 'Invigilator' },
      { key: 'maxMarks', label: 'Max marks' },
      {
        key: 'status',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Today: { cssClass: 'b-amber', label: 'Today' },
          Completed: { cssClass: 'b-green', label: 'Completed' },
          Upcoming: { cssClass: 'b-blue', label: 'Upcoming' },
        },
      },
    ],
    actions: [
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    filtersInPanel: true,
    searchPlaceholder: 'Search schedule...',
    searchKeys: ['subjectName', 'className', 'roomNo', 'invigilatorName'],
    itemLabel: 'slots',
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50],
    selectable: false,
    showExport: true,
  };

  get selectedExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.selectedExamId);
  }

  get examClasses(): ExamClassInfo[] {
    return this.selectedExam?.classes ?? [];
  }

  get formExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.formExamId);
  }

  get formExamClasses(): ExamClassInfo[] {
    return this.formExam?.classes ?? [];
  }

  get examOptions(): FormFieldOption[] {
    return this.exams.map((e) => ({
      label: `${e.name} (${e.examGroupName})`,
      value: e.id,
    }));
  }

  get examClassOptions(): FormFieldOption[] {
    return this.examClasses.map((c) => ({ label: c.className, value: c.classId }));
  }

  get formExamClassOptions(): FormFieldOption[] {
    return this.formExamClasses.map((c) => ({ label: c.className, value: c.classId }));
  }

  get subjectOptions(): FormFieldOption[] {
    return (this.subjects || []).map((s: { id: string; name: string }) => ({
      label: s.name,
      value: s.id,
    }));
  }

  get employeeOptions(): FormFieldOption[] {
    return this.employees.map((e) => ({ label: e.name, value: e.id }));
  }

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissions,
      MenuCodes.ExamSchedule,
      this.ayContext.isReadOnlyScope(),
    );
    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        if (this.exams.length > 0 && !this.selectedExamId) {
          this.selectedExamId = this.exams[0].id;
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
    this.selectedClassId = '';
    this.loadSchedules();
  }

  onFormExamChange(): void {
    const classes = this.formExamClasses;
    this.formClassId = classes[0]?.classId ?? '';
    this.formExamDate = this.formExam?.startDate?.substring(0, 10) ?? this.formExamDate;
  }

  loadSchedules(): void {
    if (!this.selectedExamId) {
      this.rows = [];
      return;
    }
    this.examService.getSchedules(this.selectedExamId, this.selectedClassId || undefined).subscribe({
      next: (schedules) => {
        this.rows = (schedules ?? []).map((item: ExamScheduleItem) => ({
          ...item,
          subject: item.subjectName,
          timeLabel: this.timeRange(item),
          roomNo: item.roomNo || '—',
          invigilatorName: item.invigilatorName || '—',
          status: item.status || 'Upcoming',
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.rows = [];
        this.snackBar.open('Failed to load schedule', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  timeRange(item: ExamScheduleItem): string {
    if (!item.startTime && !item.endTime) return '—';
    return `${item.startTime ?? '?'} – ${item.endTime ?? '?'}`;
  }

  onExportClicked(): void {
    if (!this.selectedExamId) {
      this.snackBar.open('Select an exam first', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }
    if (!this.rows.length) {
      this.snackBar.open('No schedule slots to export', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }

    const exam = this.selectedExam;
    const examTitle = exam
      ? `${exam.name} (${exam.examGroupName})`
      : 'Exam Schedule';
    const dateRange =
      exam?.startDate && exam?.endDate
        ? `${this.formatExportDate(exam.startDate)} – ${this.formatExportDate(exam.endDate)}`
        : '';

    const byClass = new Map<string, ExamScheduleItem[]>();
    for (const row of this.rows) {
      const item = row as unknown as ExamScheduleItem;
      const key = item.className || 'Class';
      const list = byClass.get(key) ?? [];
      list.push(item);
      byClass.set(key, list);
    }

    const sections = [...byClass.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([className, slots]) => {
        const sorted = [...slots].sort((a, b) => {
          const dateCmp = (a.examDate || '').localeCompare(b.examDate || '');
          if (dateCmp !== 0) return dateCmp;
          return (a.startTime || '').localeCompare(b.startTime || '');
        });
        const rowsHtml = sorted
          .map(
            (s) => `
          <tr>
            <td>${this.escapeHtml(this.formatExportDate(s.examDate))}</td>
            <td>${this.escapeHtml(s.subjectName || '—')}</td>
            <td>${this.escapeHtml(this.timeRange(s))}</td>
            <td>${this.escapeHtml(s.roomNo || '—')}</td>
            <td>${this.escapeHtml(s.invigilatorName || '—')}</td>
            <td>${this.escapeHtml(String(s.maxMarks ?? '—'))}</td>
          </tr>`,
          )
          .join('');
        return `
        <section class="class-block">
          <h2>Class: ${this.escapeHtml(className)}</h2>
          <p class="meta">${sorted.length} subject(s)${dateRange ? ` · ${this.escapeHtml(dateRange)}` : ''}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Time</th>
                <th>Room</th>
                <th>Invigilator</th>
                <th>Max marks</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>`;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!printWindow) {
      this.snackBar.open('Pop-up blocked. Allow pop-ups to export PDF.', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(examTitle)} — Timetable</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #555; margin: 0 0 18px; font-size: 12px; }
    .class-block { margin-bottom: 28px; page-break-inside: avoid; }
    h2 { font-size: 14px; margin: 0 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { color: #666; margin: 0 0 8px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    @media print {
      body { margin: 12mm; }
      .class-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(examTitle)}</h1>
  <p class="sub">Class-wise exam timetable${dateRange ? ` · ${this.escapeHtml(dateRange)}` : ''}</p>
  ${sections}
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  }

  private formatExportDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value.substring(0, 10);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  onAddButtonClicked(): void {
    if (!this.exams.length) {
      this.snackBar.open('No exams available. Create an exam first.', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }
    this.formMode = 'add';
    this.editingId = null;
    this.formExamId = this.selectedExamId || this.exams[0]?.id || '';
    const classes = this.formExamClasses;
    this.formClassId =
      (this.selectedClassId && classes.some((c) => c.classId === this.selectedClassId)
        ? this.selectedClassId
        : classes[0]?.classId) ?? '';
    this.formSubjectId = '';
    this.formExamDate = this.formExam?.startDate?.substring(0, 10) ?? '';
    this.formStartTime = '10:00';
    this.formEndTime = '13:00';
    this.formRoomNo = '';
    this.formInvigilatorId = '';
    this.formError = '';
    this.showForm = true;
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const item = event.row as unknown as ExamScheduleItem;
    if (event.action.label === 'Edit') {
      this.formMode = 'edit';
      this.editingId = item.id;
      this.formExamId = item.examId;
      this.formClassId = item.classId;
      this.formSubjectId = item.subjectId;
      this.formExamDate = item.examDate?.substring(0, 10) ?? '';
      this.formStartTime = item.startTime ?? '';
      this.formEndTime = item.endTime ?? '';
      this.formRoomNo = item.roomNo ?? '';
      this.formInvigilatorId = item.invigilatorId ?? '';
      this.formError = '';
      this.showForm = true;
    } else if (event.action.label === 'Delete') {
      this.deleteSchedule(item);
    }
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
  }

  save(): void {
    if (!this.formExamId) {
      this.formError = 'Exam is required.';
      return;
    }
    if (!this.formClassId) {
      this.formError = 'Class is required.';
      return;
    }
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
      examId: this.formExamId,
      classId: this.formClassId,
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
          { duration: 2500, panelClass: 'snack-success' },
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
          this.snackBar.open('Schedule slot deleted', 'Close', {
            duration: 2500,
            panelClass: 'snack-success',
          });
          this.loadSchedules();
        },
        error: (err) =>
          this.snackBar.open(
            typeof err?.error === 'string' ? err.error : 'Delete failed',
            'Close',
            { duration: 3500, panelClass: 'snack-error' },
          ),
      });
    });
  }
}
