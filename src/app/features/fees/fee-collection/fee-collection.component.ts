import { Component, DestroyRef, OnInit, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';

import { StudentService } from '../../../core/services/student.service';
import { ClassService } from '../../../core/services/class.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import { StudentFilter } from '../../../shared/enums/table-filters.enum';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';

@Component({
  selector: 'app-fee-collection',
  standalone: true,
  imports: [SmartDataTableComponent, MatIconModule, MatSnackBarModule],
  templateUrl: './fee-collection.component.html',
  styleUrl: './fee-collection.component.css',
})
export class FeeCollectionComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly classService = inject(ClassService);
  private readonly studentService = inject(StudentService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  private studentsRequestSeq = 0;
  allClassesSelected = true;

  students: Record<string, unknown>[] = [];
  totalStudents = 0;
  tableConfig!: DataTableConfig;

  classOptions: { id: string; name: string }[] = [];
  readonly selectedClassIds = new Set<string>();
  classFilterDropdownOpen = false;

  private listState = {
    pageIndex: 1,
    pageSize: 10,
    searchQuery: '',
    sortColumn: null as string | null,
    sortDirection: null as string | null,
  };

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Fee Collection',
      subtitle: 'Collect fees student-wise',
      showAddButton: false,
    },
    columns: [
      { key: 'rollNumber', label: 'Roll no', sortable: true, cellType: 'text' },
      { key: 'studentName', label: 'Student name', sortable: true, cellType: 'text' },
      { key: 'className', label: 'Class', sortable: true, cellType: 'text' },
      { key: 'section', label: 'Section', sortable: true, cellType: 'text' },
      { key: 'admissionNo', label: 'Admission no', sortable: true, cellType: 'text' },
      { key: 'totalDue', label: 'Total due', sortable: false, cellType: 'text' },
      { key: 'paid', label: 'Paid', sortable: false, cellType: 'text' },
      { key: 'balance', label: 'Balance', sortable: false, cellType: 'text' },
      {
        key: 'collectionStatus',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Pending: { cssClass: 'b-amber', label: 'Pending' },
          Partial: { cssClass: 'b-gray', label: 'Partial' },
          Paid: { cssClass: 'b-green', label: 'Paid' },
        },
      },
    ],
    actionsLayout: 'inline',
    actions: [
      { label: 'View', icon: 'visibility', iconColor: '#639922' },
      { label: 'Collect Fee', icon: 'payments', iconColor: '#1E40AF' },
    ],
    actionVisibleFn: (action) => {
      if (action.label === 'Collect Fee') {
        return this.permissionService.canEdit(MenuCodes.FeeCollection);
      }
      return this.permissionService.canView(MenuCodes.FeeCollection);
    },
    searchPlaceholder: 'Search by name or roll number...',
    searchKeys: ['studentName', 'rollNumber', 'admissionNo'],
    itemLabel: 'students',
    defaultPageSize: 10,
    selectable: false,
    showExport: false,
    showColumnToggle: false,
    filtersInPanel: true,
  };

  get classFilterPanelActive(): boolean {
    if (!this.classOptions.length) return false;
    if (this.allClassesSelected) return false;
    return this.selectedClassIds.size > 0 && this.selectedClassIds.size < this.classOptions.length;
  }

  get classFilterSummary(): string {
    if (!this.classOptions.length || this.allClassesSelected) {
      return 'All classes';
    }
    const count = this.selectedClassIds.size;
    if (!count) return 'No classes';
    if (count === 1) {
      const id = Array.from(this.selectedClassIds)[0];
      return this.classOptions.find((c) => c.id === id)?.name ?? '1 class';
    }
    return `${count} classes`;
  }

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.FeeCollection,
    );
    this.loadClassOptions();
  }

  private loadClassOptions(): void {
    const yearKey = this.ayContext.effectiveYearKey();
    this.classService
      .getClassDropdown()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          if (yearKey !== this.ayContext.effectiveYearKey()) return;
          this.classOptions = (items || []).map((item: { id: string; name: string }) => ({
            id: String(item.id),
            name: String(item.name ?? ''),
          }));
          this.selectAllClasses(false);
          this.loadStudents();
          this.refreshView();
        },
        error: () => {
          this.snackBar.open('Failed to load class list', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
          this.loadStudents();
        },
      });
  }

  private selectAllClasses(reload: boolean): void {
    this.selectedClassIds.clear();
    for (const cls of this.classOptions) {
      this.selectedClassIds.add(cls.id);
    }
    this.allClassesSelected = true;
    if (reload) this.loadStudents(1);
  }

  loadStudents(
    pageIndex = this.listState.pageIndex,
    pageSize = this.listState.pageSize,
    searchQuery = this.listState.searchQuery,
    sortColumn: string | null = this.listState.sortColumn,
    sortDirection: string | null = this.listState.sortDirection,
  ): void {
    this.listState = { pageIndex, pageSize, searchQuery, sortColumn, sortDirection };

    const classIds =
      !this.classOptions.length || this.allClassesSelected
        ? null
        : this.selectedClassIds.size
          ? Array.from(this.selectedClassIds)
          : [];

    // Empty selection → no rows
    if (classIds && classIds.length === 0) {
      this.students = [];
      this.totalStudents = 0;
      this.refreshView();
      return;
    }

    const requestSeq = ++this.studentsRequestSeq;
    const yearKey = this.ayContext.effectiveYearKey();

    this.studentService
      .getStudents(
        pageIndex,
        pageSize,
        searchQuery,
        this.mapSortColumn(sortColumn),
        sortDirection,
        StudentFilter.Active,
        classIds,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          if (
            requestSeq !== this.studentsRequestSeq ||
            yearKey !== this.ayContext.effectiveYearKey()
          ) {
            return;
          }
          this.students = (res?.items || []).map((row: Record<string, unknown>) =>
            this.mapRow(row),
          );
          this.totalStudents = res?.totalCount || 0;
          this.refreshView();
        },
        error: () => {
          if (requestSeq !== this.studentsRequestSeq) return;
          this.students = [];
          this.totalStudents = 0;
          this.snackBar.open('Failed to load students', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
          this.refreshView();
        },
      });
  }

  private mapRow(row: Record<string, unknown>): Record<string, unknown> {
    const name =
      String(row['name'] ?? row['studentName'] ?? '').trim() ||
      [row['firstName'], row['lastName']].filter(Boolean).join(' ').trim() ||
      '—';
    const classRaw = String(row['class'] ?? row['className'] ?? '').trim();
    const classParts = classRaw.includes(' — ')
      ? classRaw.split(' — ')
      : [classRaw, String(row['section'] ?? '')];
    return {
      ...row,
      studentId: String(row['id'] ?? row['studentId'] ?? ''),
      studentName: name,
      rollNumber: row['rollNumber'] ?? row['rollNo'] ?? '—',
      className: classParts[0]?.trim() || '—',
      section: classParts[1]?.trim() || '—',
      admissionNo: row['admNo'] ?? row['admissionNo'] ?? '—',
      // Payment summaries will wire to collection APIs later.
      totalDue: '—',
      paid: '—',
      balance: '—',
      collectionStatus: 'Pending',
    };
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

  onAdvancedFiltersCleared(): void {
    this.selectAllClasses(true);
    this.classFilterDropdownOpen = false;
  }

  toggleClassFilterDropdown(event: Event): void {
    event.stopPropagation();
    this.classFilterDropdownOpen = !this.classFilterDropdownOpen;
  }

  isClassSelected(classId: string): boolean {
    return this.selectedClassIds.has(classId);
  }

  toggleClassSelection(classId: string, checked: boolean): void {
    if (checked) {
      this.selectedClassIds.add(classId);
    } else {
      this.selectedClassIds.delete(classId);
    }
    this.allClassesSelected =
      this.classOptions.length > 0 && this.selectedClassIds.size === this.classOptions.length;
    this.loadStudents(1);
  }

  clearClassFilter(): void {
    this.selectAllClasses(true);
    this.classFilterDropdownOpen = false;
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const studentId = String(event.row['studentId'] ?? event.row['id'] ?? '');
    if (!studentId) return;
    if (event.action.label === 'View' || event.action.label === 'Collect Fee') {
      if (
        event.action.label === 'Collect Fee' &&
        !this.permissionService.canEdit(MenuCodes.FeeCollection)
      ) {
        return;
      }
      void this.router.navigate(['/fees/collection', studentId]);
    }
  }

  private mapSortColumn(col: string | null): string | null {
    if (!col) return null;
    switch (col) {
      case 'studentName':
        return 'name';
      case 'admissionNo':
        return 'admNo';
      case 'className':
        return 'class';
      default:
        return col;
    }
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
