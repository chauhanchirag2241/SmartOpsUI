import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  NgZone,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { NotificationService } from '../../core/services/notification.service';
import { StudentService } from '../../core/services/student.service';
import { ClassService } from '../../core/services/class.service';
import { AcademicYearService } from '../../core/services/academic-year.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { PermissionService } from '../../core/services/permission.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';

import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { FormFieldComponent } from '../../shared/form-controls/form-field/form-field.component';
import type { FormFieldOption } from '../../shared/form-controls/form-field/form-field.types';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { StudentFilter } from '../../shared/enums/table-filters.enum';
import type { DataTableConfig } from '../../shared/components/smart-data-table';

@Component({
  selector: 'app-promote-students',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SmartDataTableComponent,
    FormFieldComponent,
    MatIconModule,
    MatSnackBarModule,
    PageChromeDirective,
  ],
  templateUrl: './promote-students.component.html',
  styleUrl: './promote-students.component.css',
})
export class PromoteStudentsComponent implements OnInit {
  @ViewChild(SmartDataTableComponent) private studentsTable?: SmartDataTableComponent;

  readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly classService = inject(ClassService);
  private readonly studentService = inject(StudentService);
  private readonly snackBar = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  private studentsRequestSeq = 0;

  sourceYearId = '';
  sourceClassId = '';
  targetYearId = '';
  targetClassId = '';
  autoRollNumber = true;
  promoting = false;
  resultErrors: string[] = [];

  academicYears: { id: string; name: string }[] = [];
  sourceClasses: { id: string; name: string }[] = [];
  targetClasses: { id: string; name: string }[] = [];

  students: Record<string, unknown>[] = [];
  totalStudents = 0;
  tableConfig!: DataTableConfig;

  private listState = {
    pageIndex: 1,
    pageSize: 10,
    searchQuery: '',
    sortColumn: null as string | null,
    sortDirection: null as string | null,
  };

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Students to promote',
      subtitle: 'Select students from the source class, then click Promote',
      showAddButton: false,
    },
    columns: [
      {
        key: 'student',
        label: 'Student',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: {
          nameKey: 'name',
          subtitleKey: 'email',
        },
      },
      {
        key: 'admNo',
        label: 'Admission No.',
        sortable: true,
      },
      {
        key: 'class',
        label: 'Class',
        sortable: true,
      },
    ],
    filters: [],
    filtersInPanel: false,
    actions: [],
    bulkActions: [],
    searchPlaceholder: 'Search by name, admission no...',
    searchKeys: ['name', 'admNo', 'class', 'email'],
    itemLabel: 'students',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
    showExport: false,
  };

  get sourceYearOptions(): FormFieldOption[] {
    return this.academicYears.map((y) => ({ label: y.name, value: y.id }));
  }

  get sourceClassOptions(): FormFieldOption[] {
    return this.sourceClasses.map((c) => ({ label: c.name, value: c.id }));
  }

  get targetYearOptions(): FormFieldOption[] {
    return this.academicYears
      .filter((y) => y.id !== this.sourceYearId)
      .map((y) => ({ label: y.name, value: y.id }));
  }

  get targetClassOptions(): FormFieldOption[] {
    return this.targetClasses.map((c) => ({ label: c.name, value: c.id }));
  }

  get showStudentsTable(): boolean {
    return !!this.sourceYearId && !!this.sourceClassId;
  }

  get canPromoteSetup(): boolean {
    return (
      !!this.sourceYearId &&
      !!this.sourceClassId &&
      !!this.targetYearId &&
      !!this.targetClassId &&
      this.targetClasses.length > 0 &&
      this.sourceYearId !== this.targetYearId &&
      !this.promoting
    );
  }

  get canClickPromote(): boolean {
    return (
      this.canPromoteSetup &&
      this.permissionService.canEdit(MenuCodes.PromoteStudents) &&
      this.showStudentsTable
    );
  }

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.loadAcademicYears();
  }

  studentRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false || row['enrollmentIsActive'] === false ? 'row-inactive' : '';
  };

  private buildTableConfig(): DataTableConfig {
    return applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.PromoteStudents,
      false,
    );
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private loadAcademicYears(): void {
    this.academicYearService.getAcademicYearDropdown('all').subscribe({
      next: (years) => {
        this.academicYears = (years ?? []).map((y) => ({
          id: String(y.id),
          name: String(y.name ?? ''),
        }));
        const currentId = this.ayContext.effectiveYearId() ?? '';
        if (currentId && this.academicYears.some((y) => y.id === currentId)) {
          this.sourceYearId = currentId;
        } else if (this.academicYears.length) {
          this.sourceYearId = this.academicYears[0].id;
        }
        if (this.sourceYearId) {
          this.onSourceYearChange(false);
          const next = this.academicYears.find((y) => y.id !== this.sourceYearId);
          if (next) {
            this.targetYearId = next.id;
            this.onTargetYearChange(false);
          }
        }
        this.refreshView();
      },
      error: () => {
        this.snackBar.open('Failed to load academic years', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.refreshView();
      },
    });
  }

  onSourceYearChange(clearClass = true): void {
    if (clearClass) {
      this.sourceClassId = '';
    }
    this.sourceClasses = [];
    this.clearStudents();
    this.resultErrors = [];

    if (!this.sourceYearId) {
      return;
    }

    if (this.targetYearId === this.sourceYearId) {
      this.targetYearId = '';
      this.targetClassId = '';
      this.targetClasses = [];
    }

    this.classService.getClassDropdown(this.sourceYearId).subscribe({
      next: (items) => {
        this.sourceClasses = (items || []).map((c: { id: string; name: string }) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        if (this.sourceClasses.length === 1) {
          this.sourceClassId = this.sourceClasses[0].id;
          this.onSourceClassChange();
        }
        this.refreshView();
      },
      error: () => {
        this.snackBar.open('Failed to load classes for source year', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.refreshView();
      },
    });
  }

  onSourceClassChange(): void {
    this.resultErrors = [];
    if (!this.sourceClassId) {
      this.clearStudents();
      return;
    }
    this.loadStudents(1, this.listState.pageSize, '');
  }

  onTargetYearChange(clearClass = true): void {
    if (clearClass) {
      this.targetClassId = '';
    }
    this.targetClasses = [];
    this.resultErrors = [];
    if (!this.targetYearId) {
      return;
    }
    this.classService.getClassDropdown(this.targetYearId).subscribe({
      next: (items) => {
        this.targetClasses = (items || []).map((c: { id: string; name: string }) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        if (this.targetClasses.length === 1) {
          this.targetClassId = this.targetClasses[0].id;
        }
        this.refreshView();
      },
      error: () => {
        this.snackBar.open('Failed to load classes for target year', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.refreshView();
      },
    });
  }

  onTargetClassChange(): void {
    this.resultErrors = [];
    this.refreshView();
  }

  private clearStudents(): void {
    this.students = [];
    this.totalStudents = 0;
  }

  loadStudents(
    pageIndex = this.listState.pageIndex,
    pageSize = this.listState.pageSize,
    searchQuery = this.listState.searchQuery,
    sortColumn: string | null = this.listState.sortColumn,
    sortDirection: string | null = this.listState.sortDirection,
  ): void {
    if (!this.sourceYearId || !this.sourceClassId) {
      this.clearStudents();
      return;
    }

    this.listState = { pageIndex, pageSize, searchQuery, sortColumn, sortDirection };
    const requestSeq = ++this.studentsRequestSeq;
    this.clearStudents();

    this.studentService
      .getStudents(
        pageIndex,
        pageSize,
        searchQuery,
        sortColumn,
        sortDirection,
        StudentFilter.Active,
        [this.sourceClassId],
        this.sourceYearId,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          if (requestSeq !== this.studentsRequestSeq) {
            return;
          }
          this.students = res?.items || [];
          this.totalStudents = res?.totalCount || 0;
          this.refreshView();
        },
        error: () => {
          if (requestSeq !== this.studentsRequestSeq) {
            return;
          }
          this.snackBar.open('Failed to load students', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  onPageChange(event: {
    pageIndex: number;
    pageSize: number;
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: string | null;
  }): void {
    this.loadStudents(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
    );
  }

  onPromoteClick(): void {
    const selected = this.studentsTable?.getSelectedRows() ?? [];
    this.promoteSelected(selected);
  }

  promoteSelected(rows: Record<string, unknown>[]): void {
    if (!this.permissionService.canEdit(MenuCodes.PromoteStudents)) {
      return;
    }
    if (!this.canPromoteSetup) {
      if (this.sourceYearId && this.targetYearId && this.sourceYearId === this.targetYearId) {
        this.snackBar.open('Target year must be different from source year', 'Close', {
          duration: 3000,
          panelClass: 'snack-warning',
        });
        return;
      }
      this.snackBar.open('Select from/to academic year and class', 'Close', {
        duration: 3000,
        panelClass: 'snack-warning',
      });
      return;
    }

    if (!rows.length) {
      this.snackBar.open('Select students to promote', 'Close', {
        duration: 3000,
        panelClass: 'snack-warning',
      });
      return;
    }

    const active = rows.filter((r) => r['isActive'] !== false);
    const promotable = active.filter((r) => r['enrollmentIsActive'] !== false);
    if (!promotable.length) {
      const alreadyPromoted = active.length > 0 && active.every((r) => r['enrollmentIsActive'] === false);
      this.snackBar.open(
        alreadyPromoted
          ? 'Selected student(s) are already promoted from this academic year.'
          : 'Select students with an active enrollment in the source academic year to promote.',
        'Close',
        { duration: 5000, panelClass: 'snack-warning' },
      );
      return;
    }
    if (promotable.length < active.length) {
      this.snackBar.open(
        `${active.length - promotable.length} selected student(s) skipped — already promoted from this year.`,
        'Close',
        { duration: 4000, panelClass: 'snack-info' },
      );
    }

    this.promoting = true;
    this.resultErrors = [];

    const payload = {
      sourceAcademicYearId: this.sourceYearId,
      targetAcademicYearId: this.targetYearId,
      students: promotable.map((r) => ({
        studentId: String(r['id'] ?? ''),
        targetClassId: this.targetClassId,
        rollNumber: this.autoRollNumber ? undefined : '',
      })),
    };

    this.studentService
      .promoteStudents(payload)
      .pipe(
        finalize(() => {
          this.promoting = false;
          this.refreshView();
        }),
      )
      .subscribe({
        next: (res) => {
          this.resultErrors = (res.errors ?? []).map((e) => String(e));
          this.refreshView();
          if (res.promotedCount > 0 && !this.resultErrors.length) {
            this.snackBar.open(`${res.promotedCount} student(s) promoted successfully`, 'Close', {
              duration: 5000,
              panelClass: 'snack-success',
            });
            this.loadStudents();
          } else if (res.promotedCount > 0 && this.resultErrors.length) {
            this.snackBar.open(
              `${res.promotedCount} promoted, but some follow-up steps had issues. See details below.`,
              'Close',
              { duration: 5000, panelClass: 'snack-warning' },
            );
            this.loadStudents();
          }
          if (this.resultErrors.length && res.promotedCount === 0) {
            this.snackBar.open(`${this.resultErrors.length} student(s) could not be promoted`, 'Close', {
              duration: 5000,
              panelClass: 'snack-warning',
            });
          }
          if (res.promotedCount === 0 && !this.resultErrors.length) {
            this.snackBar.open('No students were promoted', 'Close', {
              duration: 3000,
              panelClass: 'snack-info',
            });
          }
        },
        error: (err) => {
          const msg = err?.error?.message ?? err?.error ?? 'Promotion failed';
          this.snackBar.open(typeof msg === 'string' ? msg : 'Promotion failed', 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
          this.refreshView();
        },
      });
  }
}
