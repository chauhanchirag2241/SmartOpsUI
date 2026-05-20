import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EMPTY, switchMap, catchError, finalize, timeout } from 'rxjs';
import {
  HomeworkService,
  HomeworkSubmissionStatus,
  StudentHomeworkSubmissionItem,
} from '../../core/services/homework.service';
import {
  StudentRow,
  normalizeHomeworkStatus,
  homeworkStatusBadgeClass,
  homeworkSubjectBadgeClass,
} from './homework.shared';

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-homework-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './homework-detail.component.html',
  styleUrl: './homework-detail.component.css',
})
export class HomeworkDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private homeworkService = inject(HomeworkService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  HomeworkSubmissionStatus = HomeworkSubmissionStatus;

  homeworkId = '';
  detail: any = null;
  loading = false;
  loadError = '';
  isSubmitting = false;

  studentFilter = 'all';
  studentRows: StudentRow[] = [];
  filteredStudents: StudentRow[] = [];
  paginatedStudents: StudentRow[] = [];
  detailProgressPct = 0;

  pageIndex = 1;
  pageSize = 15;
  readonly pageSizeOptions = [10, 15, 25, 50];

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((params) => {
          const id = (params.get('id') ?? '').trim();
          if (!id || !GUID_REGEX.test(id)) {
            this.router.navigate(['/homework']);
            return EMPTY;
          }
          this.homeworkId = id;
          this.pageIndex = 1;
          this.loading = true;
          this.loadError = '';
          this.detail = null;
          return this.homeworkService.getById(id).pipe(
            timeout(30000),
            catchError((err) => {
              this.loadError =
                typeof err?.error === 'string'
                  ? err.error
                  : err?.name === 'TimeoutError'
                    ? 'Request timed out. Check API is running.'
                    : 'Failed to load homework';
              this.snackBar.open(this.loadError, 'Close', { duration: 4000 });
              this.endLoading();
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe({
        next: (d) => this.applyDetailResponse(d),
        error: () => this.endLoading(),
      });
  }

  private applyDetailResponse(d: unknown): void {
    try {
      if (!d) {
        this.loadError = 'Homework not found';
        this.detail = null;
        return;
      }
      const raw = d as Record<string, unknown>;
      this.detail = {
        ...raw,
        id: raw['id'] ?? raw['Id'],
        title: raw['title'] ?? raw['Title'],
        description: raw['description'] ?? raw['Description'],
        classId: raw['classId'] ?? raw['ClassId'],
        className: raw['className'] ?? raw['ClassName'],
        subjectId: raw['subjectId'] ?? raw['SubjectId'],
        subjectName: raw['subjectName'] ?? raw['SubjectName'],
        assignDate: raw['assignDate'] ?? raw['AssignDate'],
        dueDate: raw['dueDate'] ?? raw['DueDate'],
        submissionTypeLabel: raw['submissionTypeLabel'] ?? raw['SubmissionTypeLabel'],
        isSubmissionsSubmitted: raw['isSubmissionsSubmitted'] ?? raw['IsSubmissionsSubmitted'],
        students: raw['students'] ?? raw['Students'] ?? [],
      };
      this.studentFilter = 'all';
      this.syncStudentRows();
    } catch {
      this.loadError = 'Could not display homework data';
      this.detail = null;
    } finally {
      this.endLoading();
    }
  }

  private endLoading(): void {
    this.loading = false;
    this.cdr.detectChanges();
  }

  retryLoad(): void {
    if (this.homeworkId) {
      this.loadDetail();
    }
  }

  loadDetail(): void {
    if (!this.homeworkId || !GUID_REGEX.test(this.homeworkId)) return;
    this.loading = true;
    this.loadError = '';
    this.homeworkService
      .getById(this.homeworkId)
      .pipe(
        timeout(30000),
      )
      .subscribe({
        next: (d) => this.applyDetailResponse(d),
        error: (err) => {
          this.loadError =
            typeof err?.error === 'string' ? err.error : 'Failed to load homework';
          this.snackBar.open(this.loadError, 'Close', { duration: 4000 });
          this.endLoading();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/homework']);
  }

  setStudentFilter(filter: string): void {
    this.studentFilter = filter;
    this.pageIndex = 1;
    this.applyFiltersAndPagination();
  }

  setPage(page: number): void {
    const total = this.totalPages;
    if (page < 1 || page > total) return;
    this.pageIndex = page;
    this.applyPagination();
  }

  onPageSizeChange(): void {
    this.pageIndex = 1;
    this.applyPagination();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredStudents.length / this.pageSize));
  }

  get pageStart(): number {
    if (!this.filteredStudents.length) return 0;
    return (this.pageIndex - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.pageIndex * this.pageSize, this.filteredStudents.length);
  }

  get isSubmissionsSubmitted(): boolean {
    return !!this.detail?.isSubmissionsSubmitted;
  }

  isStudentStatus(row: StudentRow, status: HomeworkSubmissionStatus): boolean {
    return row.status === status;
  }

  statusBadgeClass(status: string): string {
    return homeworkStatusBadgeClass(status);
  }

  subjectBadgeClass(name: string): string {
    return homeworkSubjectBadgeClass(name);
  }

  private syncStudentRows(): void {
    this.studentRows = (this.detail?.students || []).map((s: any) => ({
      studentId: s.studentId ?? s.StudentId,
      studentName: s.studentName ?? s.StudentName,
      rollNo: s.rollNo ?? s.RollNo ?? '',
      status: normalizeHomeworkStatus(s.status ?? s.Status),
      submittedOn: s.submittedOn || s.SubmittedOn || '',
      marks: s.marks ?? s.Marks ?? null,
      remark: s.remark || s.Remark || '',
    }));
    this.applyFiltersAndPagination();
  }

  private applyFiltersAndPagination(): void {
    this.filteredStudents = this.studentRows.filter((s) => {
      if (this.studentFilter === 'all') return true;
      if (this.studentFilter === 'submitted') return s.status === HomeworkSubmissionStatus.Submitted;
      if (this.studentFilter === 'pending') return s.status === HomeworkSubmissionStatus.Pending;
      if (this.studentFilter === 'late') return s.status === HomeworkSubmissionStatus.Late;
      return true;
    });
    if (this.pageIndex > this.totalPages) {
      this.pageIndex = this.totalPages;
    }
    this.refreshDetailSummary();
    this.applyPagination();
  }

  private applyPagination(): void {
    const start = (this.pageIndex - 1) * this.pageSize;
    this.paginatedStudents = this.filteredStudents.slice(start, start + this.pageSize);
  }

  private refreshDetailSummary(): void {
    if (!this.detail) return;
    const submitted = this.studentRows.filter((s) => s.status === HomeworkSubmissionStatus.Submitted).length;
    const pending = this.studentRows.filter((s) => s.status === HomeworkSubmissionStatus.Pending).length;
    const late = this.studentRows.filter((s) => s.status === HomeworkSubmissionStatus.Late).length;
    this.detail = { ...this.detail, submitted, pending, late, total: this.studentRows.length };
    const total = this.detail.total || 0;
    this.detailProgressPct = total ? Math.round((this.detail.submitted / total) * 100) : 0;
  }

  setStudentStatus(studentId: string, status: HomeworkSubmissionStatus): void {
    this.studentRows = this.studentRows.map((row) => {
      if (row.studentId !== studentId) return row;
      const nextStatus = row.status === status ? HomeworkSubmissionStatus.Pending : status;
      if (nextStatus === HomeworkSubmissionStatus.Submitted || nextStatus === HomeworkSubmissionStatus.Late) {
        return {
          ...row,
          status: nextStatus,
          submittedOn: row.submittedOn || new Date().toISOString().split('T')[0],
        };
      }
      return { ...row, status: nextStatus, submittedOn: '', marks: null, remark: '' };
    });
    this.applyFiltersAndPagination();
  }

  buildSubmissionPayload(): StudentHomeworkSubmissionItem[] {
    return this.studentRows.map((s) => ({
      studentId: s.studentId,
      status: s.status,
      submittedOn:
        s.status === HomeworkSubmissionStatus.Submitted || s.status === HomeworkSubmissionStatus.Late
          ? s.submittedOn || new Date().toISOString().split('T')[0]
          : null,
      marks: s.marks,
      remark: s.remark?.trim() || null,
    }));
  }

  submitOrUpdateSubmissions(): void {
    if (!this.homeworkId) return;
    this.isSubmitting = true;
    const isUpdate = this.isSubmissionsSubmitted;
    const call = isUpdate
      ? this.homeworkService.updateSubmissions(this.homeworkId, this.buildSubmissionPayload())
      : this.homeworkService.submitSubmissions(this.homeworkId, this.buildSubmissionPayload());

    call.subscribe({
      next: (res) => {
        this.detail = { ...res };
        this.syncStudentRows();
        this.isSubmitting = false;
        this.snackBar.open(
          isUpdate ? 'Submissions updated' : 'Submissions recorded for all students',
          'Close',
          { duration: 3000, panelClass: ['snack-success'] },
        );
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snackBar.open(err?.error || 'Submit failed', 'Close', {
          duration: 3000,
          panelClass: ['snack-error'],
        });
        this.cdr.markForCheck();
      },
    });
  }

  trackStudent(_index: number, student: StudentRow): string {
    return student.studentId;
  }
}
