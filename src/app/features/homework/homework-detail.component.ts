import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { DataTableConfig } from '../../shared/interfaces/data-table.interface';
import { FormFieldComponent } from '../../shared/form-controls/form-field';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { EMPTY, switchMap, catchError, timeout } from 'rxjs';
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
import { todayDateOnlyString } from '../../shared/utils/date-only.util';

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-homework-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    PageChromeDirective,
    SmartDataTableComponent,
    FormFieldComponent,
    ActionButtonComponent,
  ],
  templateUrl: './homework-detail.component.html',
  styleUrl: './homework-detail.component.css',
})
export class HomeworkDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private homeworkService = inject(HomeworkService);
  private snackBar = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  readonly ayContext = inject(AcademicYearContextService);

  get canEditSubmissions(): boolean {
    return !this.ayContext.isReadOnlyScope();
  }

  HomeworkSubmissionStatus = HomeworkSubmissionStatus;

  homeworkId = '';
  detail: any = null;
  loadError = '';
  isSubmitting = false;

  studentRows: StudentRow[] = [];
  detailProgressPct = 0;

  readonly studentTableConfig: DataTableConfig = {
    header: {
      title: 'Students',
      showAddButton: false,
      syncPageChrome: false,
    },
    columns: [
      { key: 'rollNo', label: 'Roll', sortable: true, width: '80px' },
      { key: 'studentName', label: 'Student', sortable: true },
      { key: 'status', label: 'Status', cellType: 'custom', width: '280px', sortable: false },
      { key: 'submittedOn', label: 'Submitted on', cellType: 'custom', width: '160px', sortable: false },
      { key: 'marks', label: 'Marks', cellType: 'custom', width: '100px', sortable: false },
      { key: 'remark', label: 'Remark', cellType: 'custom', sortable: false },
    ],
    filters: [
      { label: 'All', icon: 'list', value: 'all' },
      {
        label: 'Submitted',
        icon: 'check_circle',
        value: 'submitted',
        filterFn: (row) => row['status'] === HomeworkSubmissionStatus.Submitted,
      },
      {
        label: 'Pending',
        icon: 'schedule',
        value: 'pending',
        filterFn: (row) => row['status'] === HomeworkSubmissionStatus.Pending,
      },
      {
        label: 'Late',
        icon: 'error_outline',
        value: 'late',
        filterFn: (row) => row['status'] === HomeworkSubmissionStatus.Late,
      },
    ],
    filtersInPanel: false,
    actions: [],
    bulkActions: [],
    searchPlaceholder: 'Search by name or roll...',
    searchKeys: ['studentName', 'rollNo'],
    itemLabel: 'students',
    defaultPageSize: 10,
    pageSizeOptions: [10, 15, 25, 50],
    selectable: false,
    showExport: false,
    showColumnToggle: false,
  };

  get studentTableData(): Record<string, unknown>[] {
    return this.studentRows as unknown as Record<string, unknown>[];
  }

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
              this.cdr.detectChanges();
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe({
        next: (d) => this.applyDetailResponse(d),
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
      this.syncStudentRows();
    } catch {
      this.loadError = 'Could not display homework data';
      this.detail = null;
    } finally {
      this.cdr.detectChanges();
    }
  }

  retryLoad(): void {
    if (this.homeworkId) {
      this.loadDetail();
    }
  }

  loadDetail(): void {
    if (!this.homeworkId || !GUID_REGEX.test(this.homeworkId)) return;
    this.loadError = '';
    this.detail = null;
    this.homeworkService
      .getById(this.homeworkId)
      .pipe(timeout(30000))
      .subscribe({
        next: (d) => this.applyDetailResponse(d),
        error: (err) => {
          this.loadError =
            typeof err?.error === 'string' ? err.error : 'Failed to load homework';
          this.snackBar.open(this.loadError, 'Close', { duration: 4000 });
          this.cdr.detectChanges();
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/homework']);
  }

  get isSubmissionsSubmitted(): boolean {
    return !!this.detail?.isSubmissionsSubmitted;
  }

  isStudentStatus(row: Record<string, unknown> | StudentRow, status: HomeworkSubmissionStatus): boolean {
    return row['status'] === status;
  }

  isPendingRow(row: Record<string, unknown> | StudentRow): boolean {
    return row['status'] === HomeworkSubmissionStatus.Pending;
  }

  asStudentRow(row: Record<string, unknown>): StudentRow {
    return row as unknown as StudentRow;
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
    this.refreshDetailSummary();
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
    if (!this.canEditSubmissions) return;
    this.studentRows = this.studentRows.map((row) => {
      if (row.studentId !== studentId) return row;
      if (status === HomeworkSubmissionStatus.Submitted || status === HomeworkSubmissionStatus.Late) {
        return {
          ...row,
          status,
          submittedOn: row.submittedOn || todayDateOnlyString(),
        };
      }
      return { ...row, status, submittedOn: '', marks: null, remark: '' };
    });
    this.refreshDetailSummary();
    this.cdr.markForCheck();
  }

  buildSubmissionPayload(): StudentHomeworkSubmissionItem[] {
    return this.studentRows.map((s) => ({
      studentId: s.studentId,
      status: s.status,
      submittedOn:
        s.status === HomeworkSubmissionStatus.Submitted || s.status === HomeworkSubmissionStatus.Late
          ? s.submittedOn || todayDateOnlyString()
          : null,
      marks: s.marks,
      remark: s.remark?.trim() || null,
    }));
  }

  submitOrUpdateSubmissions(): void {
    if (!this.canEditSubmissions || !this.homeworkId) return;
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
}
