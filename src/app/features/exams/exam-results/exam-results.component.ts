import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableColumn,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../../shared/form-controls/form-field';
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

type ResultsView = 'list' | 'calculate' | 'report-card';

@Component({
  selector: 'app-exam-results',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    ActionButtonComponent,
    FormFieldComponent,
    SmartDataTableComponent,
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
  view: ResultsView = 'list';

  /** List page — Filter panel only (does not drive calculate/declare). */
  filterExamId = '';
  filterClassId = '';
  listSheet: ExamResultSheet | null = null;
  listRows: Record<string, unknown>[] = [];
  listTableConfig!: DataTableConfig;

  /** Calculate / declare add-style screen. */
  calcExamId = '';
  calcClassId = '';
  calcSheet: ExamResultSheet | null = null;
  calcRows: Record<string, unknown>[] = [];
  calcTableConfig!: DataTableConfig;
  calcError = '';

  reportCard: ReportCard | null = null;
  private reportCardReturnView: ResultsView = 'list';
  calculating = false;
  declaring = false;
  loadingCard = false;

  get canEdit(): boolean {
    return this.permissions.canEdit(MenuCodes.ExamResults);
  }

  get filterExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.filterExamId);
  }

  get filterExamClasses(): ExamClassInfo[] {
    return this.filterExam?.classes ?? [];
  }

  get calcExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.calcExamId);
  }

  get calcExamClasses(): ExamClassInfo[] {
    return this.calcExam?.classes ?? [];
  }

  get examOptions(): FormFieldOption[] {
    return this.exams.map((e) => ({
      label: `${e.name} (${e.examGroupName})`,
      value: e.id,
    }));
  }

  get filterClassOptions(): FormFieldOption[] {
    return this.filterExamClasses.map((c) => ({ label: c.className, value: c.classId }));
  }

  get calcClassOptions(): FormFieldOption[] {
    return this.calcExamClasses.map((c) => ({ label: c.className, value: c.classId }));
  }

  get listSubtitle(): string {
    if (!this.listSheet) {
      return 'Filter by exam and class to review results; use Calculate result to compute and declare';
    }
    const declared = this.listSheet.resultDeclared ? ' · Declared' : '';
    return `${this.listSheet.examName} — ${this.listSheet.className}${declared}`;
  }

  get canRunCalculate(): boolean {
    return !!this.calcExamId && !!this.calcClassId && !this.calcSheet?.resultDeclared;
  }

  get canDeclare(): boolean {
    return (
      !!this.calcSheet &&
      this.calcSheet.rows.length > 0 &&
      !this.calcSheet.resultDeclared &&
      !!this.calcExamId &&
      !!this.calcClassId
    );
  }

  ngOnInit(): void {
    this.listTableConfig = this.buildTableConfig([], this.listSubtitle, false, true, null);
    this.calcTableConfig = this.buildTableConfig([], 'Calculated results', false, false, null);
    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load exams', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  onFilterExamChange(): void {
    this.filterClassId = this.filterExamClasses[0]?.classId ?? '';
    this.loadListSheet();
  }

  onFilterClassChange(): void {
    this.loadListSheet();
  }

  loadListSheet(): void {
    this.listSheet = null;
    this.listRows = [];
    this.listTableConfig = this.buildTableConfig([], this.listSubtitle, false, true, null);
    if (!this.filterExamId || !this.filterClassId) {
      this.cdr.detectChanges();
      return;
    }
    this.examService.getResultSheet(this.filterExamId, this.filterClassId).subscribe({
      next: (sheet) => {
        this.applyListSheet(sheet);
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

  openCalculateScreen(): void {
    this.view = 'calculate';
    this.calcError = '';
    this.calcExamId = this.filterExamId || this.exams[0]?.id || '';
    this.calcClassId = '';
    this.calcSheet = null;
    this.calcRows = [];
    this.onCalcExamChange(false);
    this.cdr.detectChanges();
  }

  closeCalculateScreen(): void {
    this.view = 'list';
    this.calcError = '';
    // Refresh list if filters match what was just calculated/declared.
    if (
      this.filterExamId &&
      this.filterClassId &&
      this.filterExamId === this.calcExamId &&
      this.filterClassId === this.calcClassId
    ) {
      this.loadListSheet();
    } else if (this.calcExamId && this.calcClassId && !this.filterExamId) {
      this.filterExamId = this.calcExamId;
      this.filterClassId = this.calcClassId;
      this.loadListSheet();
    }
  }

  onCalcExamChange(resetSheet = true): void {
    this.calcClassId = this.calcExamClasses[0]?.classId ?? '';
    if (resetSheet) {
      this.calcSheet = null;
      this.calcRows = [];
      this.calcError = '';
      this.calcTableConfig = this.buildTableConfig([], 'Calculated results', false, false, null);
    }
    if (this.calcExamId && this.calcClassId) {
      this.previewCalcSheet();
    }
  }

  onCalcClassChange(): void {
    this.calcSheet = null;
    this.calcRows = [];
    this.calcError = '';
    this.calcTableConfig = this.buildTableConfig([], 'Calculated results', false, false, null);
    if (this.calcExamId && this.calcClassId) {
      this.previewCalcSheet();
    }
  }

  /** Load existing sheet (if any) so user can review before recalculate / declare. */
  private previewCalcSheet(): void {
    this.examService.getResultSheet(this.calcExamId, this.calcClassId).subscribe({
      next: (sheet) => {
        if (sheet?.rows?.length) {
          this.applyCalcSheet(sheet);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        /* no sheet yet — fine */
        this.cdr.detectChanges();
      },
    });
  }

  calculate(): void {
    if (!this.canRunCalculate) {
      this.calcError = 'Select exam and class first.';
      return;
    }
    this.calculating = true;
    this.calcError = '';
    this.examService.calculateResults(this.calcExamId, this.calcClassId).subscribe({
      next: (sheet) => {
        this.applyCalcSheet(sheet);
        this.calculating = false;
        this.snackBar.open('Results calculated', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.calculating = false;
        this.calcError =
          typeof err?.error === 'string' ? err.error : 'Result calculation failed';
        this.snackBar.open(this.calcError, 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  declare(): void {
    if (!this.canDeclare) return;
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Declare results?',
        description: 'Declared results are locked and cannot be recalculated.',
        recordName: this.calcSheet?.examName ?? 'Exam',
        recordMeta: this.calcSheet?.className ?? '',
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
      this.examService.declareResults(this.calcExamId, this.calcClassId).subscribe({
        next: (sheet) => {
          this.applyCalcSheet(sheet);
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

  private applyListSheet(sheet: ExamResultSheet | null): void {
    this.listSheet = sheet;
    const subjects = sheet?.subjects ?? [];
    this.listTableConfig = this.buildTableConfig(
      subjects,
      this.listSubtitle,
      true,
      true,
      sheet,
    );
    this.listRows = this.mapSheetRows(sheet, subjects);
  }

  private applyCalcSheet(sheet: ExamResultSheet | null): void {
    this.calcSheet = sheet;
    const subjects = sheet?.subjects ?? [];
    const subtitle = sheet
      ? `${sheet.examName} — ${sheet.className}${sheet.resultDeclared ? ' · Declared' : ''}`
      : 'Calculated results';
    this.calcTableConfig = this.buildTableConfig(subjects, subtitle, true, false, sheet);
    this.calcRows = this.mapSheetRows(sheet, subjects);
  }

  private mapSheetRows(
    sheet: ExamResultSheet | null,
    subjects: { subjectId: string; subjectName: string; maxMarks: number }[],
  ): Record<string, unknown>[] {
    return (sheet?.rows ?? []).map((row) => {
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
    subtitle: string,
    withActions: boolean,
    filtersInPanel: boolean,
    sheet: ExamResultSheet | null,
  ): DataTableConfig {
    const subjectColumns: DataTableColumn[] = subjects.map((s) => ({
      key: `subj_${s.subjectId}`,
      label: `${s.subjectName} (${s.maxMarks})`,
      align: 'center',
    }));

    return {
      header: {
        title: filtersInPanel ? 'Exam Results' : '',
        subtitle: filtersInPanel ? subtitle : '',
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
          label: sheetMaxLabel(sheet),
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
      actions: withActions
        ? [{ label: 'Report card', icon: 'description', iconColor: '#639922' }]
        : [],
      filtersInPanel,
      searchPlaceholder: 'Search students...',
      searchKeys: ['studentName', 'rollNo', 'resultLabel', 'grade'],
      itemLabel: 'students',
      defaultPageSize: 50,
      pageSizeOptions: [25, 50, 100],
      selectable: false,
      showExport: filtersInPanel,
    };
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

  onListActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    if (event.action.label === 'Report card') {
      this.openReportCard(
        event.row as unknown as ExamResultRow,
        this.filterExamId || this.listSheet?.examId || '',
      );
    }
  }

  onCalcActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    if (event.action.label === 'Report card') {
      this.openReportCard(
        event.row as unknown as ExamResultRow,
        this.calcExamId || this.calcSheet?.examId || '',
      );
    }
  }

  openReportCard(row: ExamResultRow, examId: string): void {
    if (!examId) return;
    this.reportCardReturnView = this.view === 'calculate' ? 'calculate' : 'list';
    this.loadingCard = true;
    this.view = 'report-card';
    this.examService.getReportCard(examId, row.studentId).subscribe({
      next: (card) => {
        this.reportCard = card;
        this.loadingCard = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingCard = false;
        this.view = this.reportCardReturnView;
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Failed to load report card',
          'Close',
          { duration: 3500, panelClass: 'snack-error' },
        );
        this.cdr.detectChanges();
      },
    });
  }

  backFromReportCard(): void {
    this.reportCard = null;
    this.view = this.reportCardReturnView;
  }

  print(): void {
    window.print();
  }

  exportCsv(): void {
    const sheet = this.listSheet;
    if (!sheet) return;
    const header = [
      'Rank',
      'Roll No',
      'Student',
      ...sheet.subjects.map((s) => s.subjectName),
      'Total',
      'Percentage',
      'Grade',
      'Result',
    ];
    const lines = sheet.rows.map((row) =>
      [
        row.rank,
        row.rollNo,
        `"${row.studentName}"`,
        ...sheet.subjects.map((s) => this.subjectMark(row, s.subjectId)),
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
    a.download = `result-sheet-${sheet.examName}-${sheet.className}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function sheetMaxLabel(sheet: ExamResultSheet | null): string {
  return sheet ? `Total (${sheet.maxMarks})` : 'Total';
}
