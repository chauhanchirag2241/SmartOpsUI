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
  DataTableColumn,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import {
  ExamService,
  ExamListItem,
  ExamClassInfo,
  ExamResultSheet,
  ExamResultRow,
  ExamResultStatus,
  ReportCard,
} from '../../../core/services/exam.service';

@Component({
  selector: 'app-exam-results',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    SmartDataTableComponent,
    ActionButtonComponent,
    PageChromeDirective,
  ],
  templateUrl: './exam-results.component.html',
  styleUrl: './exam-results.component.css',
})
export class ExamResultsComponent implements OnInit {
  private examService = inject(ExamService);
  private snackBar = inject(NotificationService);
  private permissions = inject(PermissionService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);

  ExamResultStatus = ExamResultStatus;

  exams: ExamListItem[] = [];
  sheet: ExamResultSheet | null = null;
  reportCard: ReportCard | null = null;
  activeTab: 'sheet' | 'report-card' = 'sheet';

  selectedExamId = '';
  selectedClassId = '';

  rows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  calculating = false;
  declaring = false;
  loadingCard = false;

  get canEdit(): boolean {
    return this.permissions.canEdit(MenuCodes.ExamResults);
  }

  get selectedExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.selectedExamId);
  }

  get examClasses(): ExamClassInfo[] {
    return this.selectedExam?.classes ?? [];
  }

  get sheetSubtitle(): string {
    if (!this.sheet) return 'Calculate, review and declare results; print report cards';
    const declared = this.sheet.resultDeclared ? ' · Declared' : '';
    return `${this.sheet.examName} — ${this.sheet.className}${declared}`;
  }

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig([]);
    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        if (this.exams.length > 0) {
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
  }

  onExamChange(): void {
    this.selectedClassId = this.examClasses[0]?.classId ?? '';
    this.loadSheet();
  }

  loadSheet(): void {
    this.sheet = null;
    this.rows = [];
    this.reportCard = null;
    this.activeTab = 'sheet';
    this.tableConfig = this.buildTableConfig([]);
    if (!this.selectedExamId || !this.selectedClassId) return;
    this.examService.getResultSheet(this.selectedExamId, this.selectedClassId).subscribe({
      next: (sheet) => {
        this.applySheet(sheet);
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load result sheet', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private applySheet(sheet: ExamResultSheet | null): void {
    this.sheet = sheet;
    const subjects = sheet?.subjects ?? [];
    this.tableConfig = this.buildTableConfig(subjects);
    this.rows = (sheet?.rows ?? []).map((row) => {
      const mapped: Record<string, unknown> = {
        ...row,
        student: row.studentName,
        percentageLabel: `${row.percentage}%`,
        gradeLabel: row.grade || '—',
      };
      for (const subject of subjects) {
        mapped[`subj_${subject.subjectId}`] = this.subjectMark(row, subject.subjectId);
      }
      return mapped;
    });
  }

  private buildTableConfig(
    subjects: { subjectId: string; subjectName: string; maxMarks: number }[],
  ): DataTableConfig {
    const subjectColumns: DataTableColumn[] = subjects.map((s) => ({
      key: `subj_${s.subjectId}`,
      label: `${s.subjectName} (${s.maxMarks})`,
      align: 'center',
    }));

    return {
      header: {
        title: 'Exam Results',
        subtitle: this.sheetSubtitle,
        showAddButton: false,
      },
      columns: [
        { key: 'rank', label: 'Rank', sortable: true, align: 'center', width: '70px' },
        { key: 'rollNo', label: 'Roll', sortable: true },
        {
          key: 'student',
          label: 'Student',
          sortable: true,
          cellType: 'avatar',
          toggleable: false,
          avatarConfig: { nameKey: 'studentName' },
        },
        ...subjectColumns,
        {
          key: 'totalMarks',
          label: sheetMaxLabel(this.sheet),
          sortable: true,
          align: 'center',
        },
        { key: 'percentageLabel', label: '%', align: 'center' },
        { key: 'gradeLabel', label: 'Grade', align: 'center' },
        {
          key: 'resultLabel',
          label: 'Result',
          cellType: 'badge',
          badgeMap: {
            Pass: { cssClass: 'b-green', label: 'Pass' },
            Fail: { cssClass: 'b-red', label: 'Fail' },
            Absent: { cssClass: 'b-amber', label: 'Absent' },
          },
        },
      ],
      actions: [{ label: 'Report card', icon: 'description', iconColor: '#639922' }],
      filtersInPanel: true,
      searchPlaceholder: 'Search students...',
      searchKeys: ['studentName', 'rollNo', 'resultLabel', 'grade'],
      itemLabel: 'students',
      defaultPageSize: 50,
      pageSizeOptions: [25, 50, 100],
      selectable: false,
      showExport: true,
    };
  }

  calculate(): void {
    if (!this.selectedExamId || !this.selectedClassId) return;
    this.calculating = true;
    this.examService.calculateResults(this.selectedExamId, this.selectedClassId).subscribe({
      next: (sheet) => {
        this.applySheet(sheet);
        this.calculating = false;
        this.snackBar.open('Results calculated', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.calculating = false;
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Result calculation failed',
          'Close',
          { duration: 3500, panelClass: 'snack-error' },
        );
        this.cdr.detectChanges();
      },
    });
  }

  declare(): void {
    if (!this.selectedExamId || !this.selectedClassId) return;
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Declare results?',
        description: 'Declared results are locked and cannot be recalculated.',
        recordName: this.sheet?.examName ?? 'Exam',
        recordMeta: this.sheet?.className ?? '',
        initials: 'RS',
        warningMessage: 'Students and parents will see the declared results.',
        confirmButtonText: 'Yes, declare',
        cancelButtonText: 'Cancel',
        variant: 'primary',
        headerIcon: 'campaign',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.declaring = true;
      this.examService.declareResults(this.selectedExamId, this.selectedClassId).subscribe({
        next: (sheet) => {
          this.applySheet(sheet);
          this.declaring = false;
          this.snackBar.open('Results declared', 'Close', {
            duration: 2500,
            panelClass: 'snack-success',
          });
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.declaring = false;
          this.snackBar.open(
            typeof err?.error === 'string' ? err.error : 'Failed to declare results',
            'Close',
            { duration: 3500, panelClass: 'snack-error' },
          );
          this.cdr.detectChanges();
        },
      });
    });
  }

  subjectMark(row: ExamResultRow, subjectId: string): string {
    const mark = row.subjectMarks?.find((m) => m.subjectId === subjectId);
    if (!mark) return '—';
    if (mark.isAbsent) return 'AB';
    return mark.marks !== null && mark.marks !== undefined ? String(mark.marks) : '—';
  }

  resultBadgeClass(status: ExamResultStatus): string {
    switch (status) {
      case ExamResultStatus.Pass:
        return 'b-green';
      case ExamResultStatus.Fail:
        return 'b-red';
      case ExamResultStatus.Absent:
        return 'b-amber';
      default:
        return 'b-gray';
    }
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    if (event.action.label === 'Report card') {
      this.openReportCard(event.row as unknown as ExamResultRow);
    }
  }

  openReportCard(row: ExamResultRow): void {
    this.loadingCard = true;
    this.activeTab = 'report-card';
    this.examService.getReportCard(this.selectedExamId, row.studentId).subscribe({
      next: (card) => {
        this.reportCard = card;
        this.loadingCard = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingCard = false;
        this.activeTab = 'sheet';
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Failed to load report card',
          'Close',
          { duration: 3500, panelClass: 'snack-error' },
        );
        this.cdr.detectChanges();
      },
    });
  }

  backToSheet(): void {
    this.activeTab = 'sheet';
    this.reportCard = null;
  }

  print(): void {
    window.print();
  }

  exportCsv(): void {
    if (!this.sheet) return;
    const header = [
      'Rank',
      'Roll No',
      'Student',
      ...this.sheet.subjects.map((s) => s.subjectName),
      'Total',
      'Percentage',
      'Grade',
      'Result',
    ];
    const lines = this.sheet.rows.map((row) =>
      [
        row.rank,
        row.rollNo,
        `"${row.studentName}"`,
        ...this.sheet!.subjects.map((s) => this.subjectMark(row, s.subjectId)),
        row.totalMarks,
        row.percentage + '%',
        row.grade ?? '',
        row.resultLabel,
      ].join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result-sheet-${this.sheet.examName}-${this.sheet.className}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function sheetMaxLabel(sheet: ExamResultSheet | null): string {
  return sheet ? `Total (${sheet.maxMarks})` : 'Total';
}
