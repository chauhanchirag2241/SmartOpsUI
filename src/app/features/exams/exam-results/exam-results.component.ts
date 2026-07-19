import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
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
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './exam-results.component.html',
  styleUrls: ['../exam-shared.css', './exam-results.component.css'],
})
export class ExamResultsComponent implements OnInit {
  private examService = inject(ExamService);
  private snackBar = inject(NotificationService);
  private permissions = inject(PermissionService);
  private cdr = inject(ChangeDetectorRef);

  ExamResultStatus = ExamResultStatus;

  exams: ExamListItem[] = [];
  sheet: ExamResultSheet | null = null;
  reportCard: ReportCard | null = null;
  activeTab: 'sheet' | 'report-card' = 'sheet';

  selectedExamId = '';
  selectedClassId = '';

  loading = false;
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

  ngOnInit(): void {
    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        if (this.exams.length > 0) {
          this.selectedExamId = this.exams[0].id;
          this.onExamChange();
        }
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to load exams', 'Close', { duration: 3000 }),
    });
  }

  onExamChange(): void {
    this.selectedClassId = this.examClasses[0]?.classId ?? '';
    this.loadSheet();
  }

  loadSheet(): void {
    this.sheet = null;
    this.reportCard = null;
    this.activeTab = 'sheet';
    if (!this.selectedExamId || !this.selectedClassId) return;
    this.loading = true;
    this.examService.getResultSheet(this.selectedExamId, this.selectedClassId).subscribe({
      next: (sheet) => {
        this.sheet = sheet;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load result sheet', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      },
    });
  }

  calculate(): void {
    if (!this.selectedExamId || !this.selectedClassId) return;
    this.calculating = true;
    this.examService.calculateResults(this.selectedExamId, this.selectedClassId).subscribe({
      next: (sheet) => {
        this.sheet = sheet;
        this.calculating = false;
        this.snackBar.open('Results calculated', 'Close', { duration: 2500 });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.calculating = false;
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Result calculation failed',
          'Close',
          { duration: 3500 },
        );
        this.cdr.detectChanges();
      },
    });
  }

  declare(): void {
    if (!this.selectedExamId || !this.selectedClassId) return;
    if (!confirm('Declare results? Declared results are locked and cannot be recalculated.')) {
      return;
    }
    this.declaring = true;
    this.examService.declareResults(this.selectedExamId, this.selectedClassId).subscribe({
      next: (sheet) => {
        this.sheet = sheet;
        this.declaring = false;
        this.snackBar.open('Results declared', 'Close', { duration: 2500 });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.declaring = false;
        this.snackBar.open(
          typeof err?.error === 'string' ? err.error : 'Failed to declare results',
          'Close',
          { duration: 3500 },
        );
        this.cdr.detectChanges();
      },
    });
  }

  subjectMark(row: ExamResultRow, subjectId: string): string {
    const mark = row.subjectMarks?.find((m) => m.subjectId === subjectId);
    if (!mark) return '—';
    if (mark.isAbsent) return 'AB';
    return mark.marks !== null && mark.marks !== undefined ? String(mark.marks) : '—';
  }

  subjectMarkFailed(row: ExamResultRow, subjectId: string): boolean {
    const mark = row.subjectMarks?.find((m) => m.subjectId === subjectId);
    return !!mark && !mark.pass;
  }

  resultBadgeClass(status: ExamResultStatus): string {
    switch (status) {
      case ExamResultStatus.Pass:
        return 'b-g';
      case ExamResultStatus.Fail:
        return 'b-r';
      case ExamResultStatus.Absent:
        return 'b-a';
      default:
        return 'b-gray';
    }
  }

  medal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
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
          { duration: 3500 },
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
