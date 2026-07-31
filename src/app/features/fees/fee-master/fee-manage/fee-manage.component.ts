import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../../core/services/notification.service';
import { FeeMasterService, FeeMasterDto } from '../../../../core/services/fee-master.service';
import { SmartDataTableComponent } from '../../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { MenuCodes } from '../../../../core/constants/menu-codes';
import { PermissionService } from '../../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../../core/utils/permission-ui.util';
import {
  FEE_APPLICABLE_TO_LABELS,
  FEE_TYPE_LABELS,
  FeeApplicableTo,
  FeeType,
} from '../../../../shared/enums/field-options.enum';
import { FEE_HEAD_DIALOG_WIDTH, FEE_STUDENT_DIALOG_WIDTH } from '../../../../shared/constants/dialog.constants';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import {
  AddFeeHeadDialogComponent,
  AddFeeHeadDialogData,
} from '../add-fee-head-dialog/add-fee-head-dialog.component';
import {
  FeeStudentDialogComponent,
  FeeStudentDialogData,
} from '../fee-student-dialog/fee-student-dialog.component';
import { ClassService } from '../../../../core/services/class.service';
import { MultiSelectChipsComponent } from '../../../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../../../shared/mapping/mapping.types';

@Component({
  selector: 'app-fee-manage',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    SmartDataTableComponent,
    PageChromeDirective,
    DynamicFieldComponent,
    ActionButtonComponent,
    MultiSelectChipsComponent,
  ],
  templateUrl: './fee-manage.component.html',
  styleUrl: './fee-manage.component.css',
  host: { class: 'fee-manage-page form-page-shell' },
})
export class FeeManageComponent implements OnInit {
  @Input({ required: true }) feeId!: string;
  @Input() initialTab = 0;
  @Output() cancel = new EventEmitter<void>();

  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly feeMasterService = inject(FeeMasterService);
  private readonly classService = inject(ClassService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  readonly tabs = [{ label: 'Basic Detail' }, { label: 'Fee Head' }, { label: 'Students' }];
  currentTab = 0;
  loading = true;
  editingBasic = false;
  isSavingBasic = false;
  fee: FeeMasterDto | null = null;

  heads: Record<string, unknown>[] = [];
  totalHeads = 0;
  headTableConfig!: DataTableConfig;

  students: Record<string, unknown>[] = [];
  totalStudents = 0;
  studentTableConfig!: DataTableConfig;
  selectedStudentClassIds: string[] = [];
  classOptions: { id: string; name: string }[] = [];
  studentClassFilterDropdownOpen = false;
  private studentSearch = '';
  private studentSortColumn: string | null = null;
  private studentSortDirection: string | null = null;
  classGroupLabels: string[] = [];
  classGroupOptions: MappingOption[] = [];
  selectedClassGroupIds: string[] = [];
  lockedClassGroupIds: string[] = [];

  basicForm: FormGroup = this.fb.group({
    feeName: ['', Validators.required],
    feeType: [{ value: '', disabled: true }],
    publishedOn: [null],
    defaultDueDate: [null],
    applicableTo: [{ value: '', disabled: true }],
    description: [''],
  });

  readonly basicConfigs: Record<string, FormFieldConfig> = {
    feeName: {
      type: 'input',
      controlName: 'feeName',
      label: 'Fee name',
      validations: [
        { name: 'required', message: 'Fee name is required', validator: Validators.required },
      ],
    },
    feeType: { type: 'input', controlName: 'feeType', label: 'Fee type', disabled: true },
    publishedOn: {
      type: 'datepicker',
      controlName: 'publishedOn',
      label: 'Published on',
      minDate: 'today',
    },
    defaultDueDate: {
      type: 'datepicker',
      controlName: 'defaultDueDate',
      label: 'Default due date',
      minDate: 'today',
    },
    applicableTo: {
      type: 'input',
      controlName: 'applicableTo',
      label: 'Applicable to',
      disabled: true,
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description (optional)',
    },
  };

  private readonly baseHeadTableConfig: DataTableConfig = {
    header: {
      title: 'Fee heads',
      subtitle: 'Define fee head rules and default amounts',
      showAddButton: true,
      addButtonText: 'Add fee head',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
      syncPageChrome: false,
    },
    columns: [
      { key: 'feeHeadName', label: 'Fee head name', sortable: true, cellType: 'text' },
      {
        key: 'isMandatory',
        label: 'Mandatory',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-green', label: 'Yes' },
          false: { cssClass: 'b-gray', label: 'No' },
        },
      },
      {
        key: 'isEditable',
        label: 'Editable',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-green', label: 'Yes' },
          false: { cssClass: 'b-gray', label: 'No' },
        },
      },
      { key: 'amountDisplay', label: 'Amount', sortable: false, cellType: 'text' },
      {
        key: 'isActive',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-green', label: 'Active' },
          false: { cssClass: 'b-red', label: 'Inactive' },
        },
      },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      { label: 'Active', icon: 'check_circle', value: 'Active' },
      { label: 'Inactive', icon: 'cancel', value: 'Inactive' },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) =>
      action.label !== 'Delete' || (row['isActive'] !== false && row['isActive'] !== 'false'),
    searchPlaceholder: 'Search by fee head name...',
    searchKeys: ['feeHeadName'],
    itemLabel: 'fee heads',
    defaultPageSize: 10,
  };

  get pageTitle(): string {
    return this.tabs[this.currentTab]?.label ?? 'Manage fee';
  }

  get pageSubtitle(): string {
    return 'Fee Master';
  }

  get feeTypeLabel(): string {
    const t = String(this.fee?.feeType ?? '');
    return FEE_TYPE_LABELS[t as FeeType] ?? (t || '—');
  }

  get applicableToLabel(): string {
    const t = String(this.fee?.applicableTo ?? '');
    return FEE_APPLICABLE_TO_LABELS[t as FeeApplicableTo] ?? (t || '—');
  }

  get isStudentWise(): boolean {
    const t = String(this.fee?.applicableTo ?? '');
    return t === FeeApplicableTo.StudentWise || t === 'StudentWise';
  }

  /** Fee master / heads freeze once published-on date has started. */
  get isFeePublishedLocked(): boolean {
    const raw = this.fee?.publishedOn;
    if (!raw) return false;
    const published = new Date(String(raw));
    if (Number.isNaN(published.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    published.setHours(0, 0, 0, 0);
    return published.getTime() <= today.getTime();
  }

  private readonly baseStudentTableConfig: DataTableConfig = {
    header: {
      title: 'Students',
      subtitle: 'Student fee amounts for this fee master',
      showAddButton: false,
      addButtonText: 'Add student',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
      syncPageChrome: false,
    },
    columns: [
      { key: 'rollNumber', label: 'Roll no', sortable: true, cellType: 'text' },
      { key: 'studentName', label: 'Student name', sortable: true, cellType: 'text' },
      { key: 'className', label: 'Class', sortable: true, cellType: 'text' },
      { key: 'section', label: 'Section', sortable: true, cellType: 'text' },
      { key: 'admissionNo', label: 'Admission no', sortable: true, cellType: 'text' },
      { key: 'amountSummary', label: 'Amount', sortable: true, cellType: 'text' },
    ],
    actionsLayout: 'inline',
    actions: [
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Remove', icon: 'delete', danger: true },
    ],
    actionVisibleFn: (action, row) => {
      if (action.label === 'Edit') return row['canEdit'] === true;
      if (action.label === 'Remove') return row['canRemove'] === true;
      return true;
    },
    searchPlaceholder: 'Search by name or roll number...',
    searchKeys: ['studentName', 'rollNumber'],
    itemLabel: 'students',
    defaultPageSize: 10,
    selectable: false,
    showExport: false,
    showColumnToggle: false,
    filtersInPanel: true,
  };

  ngOnInit(): void {
    if (this.initialTab >= 0 && this.initialTab < this.tabs.length) {
      this.currentTab = this.initialTab;
    }
    this.rebuildHeadTableConfig();
    this.rebuildStudentTableConfig();
    this.loadClassOptions();
    this.loadFee();
    this.loadHeads();
    if (this.currentTab === 2) {
      this.loadStudents();
    }
  }

  goTab(index: number): void {
    this.currentTab = index;
    if (index === 0 && this.editingBasic) {
      this.cancelBasicEdit();
    }
    if (index === 1) {
      this.rebuildHeadTableConfig();
    }
    if (index === 2) {
      this.rebuildStudentTableConfig();
      this.loadStudents();
    }
  }

  onStudentClassIdsChange(ids: string[]): void {
    this.selectedStudentClassIds = ids;
    this.loadStudents();
  }

  get studentClassFilterActive(): boolean {
    return this.selectedStudentClassIds.length > 0;
  }

  get studentClassFilterSummary(): string {
    const count = this.selectedStudentClassIds.length;
    if (!count) return 'All classes';
    if (count === 1) {
      const id = this.selectedStudentClassIds[0];
      return this.classOptions.find((c) => c.id === id)?.name || '1 class';
    }
    return `${count} classes`;
  }

  toggleStudentClassFilterDropdown(event: Event): void {
    event.stopPropagation();
    this.studentClassFilterDropdownOpen = !this.studentClassFilterDropdownOpen;
  }

  isStudentClassSelected(classId: string): boolean {
    return this.selectedStudentClassIds.includes(classId);
  }

  toggleStudentClassSelection(classId: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedStudentClassIds.includes(classId)) {
        this.selectedStudentClassIds = [...this.selectedStudentClassIds, classId];
      }
    } else {
      this.selectedStudentClassIds = this.selectedStudentClassIds.filter((id) => id !== classId);
    }
    this.loadStudents(1);
  }

  clearStudentClassFilter(): void {
    this.selectedStudentClassIds = [];
    this.studentClassFilterDropdownOpen = false;
    this.loadStudents(1);
  }

  loadStudents(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = this.studentSearch,
    sortColumn: string | null = this.studentSortColumn,
    sortDirection: string | null = this.studentSortDirection,
  ): void {
    this.feeMasterService
      .getFeeStudents(
        this.feeId,
        pageIndex,
        pageSize,
        searchQuery,
        this.selectedStudentClassIds.length ? this.selectedStudentClassIds : null,
        sortColumn,
        sortDirection,
      )
      .subscribe({
        next: (res: any) => {
          this.students = (res?.items || []).map((row: Record<string, unknown>) => ({
            ...row,
            amountSummary:
              row['amountSummary'] != null && row['amountSummary'] !== ''
                ? String(row['amountSummary'])
                : '—',
            className: row['className'] || '—',
            section: row['section'] || '—',
            rollNumber: row['rollNumber'] || '—',
            admissionNo: row['admissionNo'] || '—',
          }));
          this.totalStudents = res?.totalCount || 0;
          this.refreshView();
        },
        error: () => {
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

  onStudentPageChange(event: any): void {
    this.studentSearch = event.searchQuery || '';
    this.studentSortColumn = event.sortColumn || null;
    this.studentSortDirection = event.sortDirection || null;
    this.loadStudents(
      event.pageIndex,
      event.pageSize,
      this.studentSearch,
      this.studentSortColumn,
      this.studentSortDirection,
    );
  }

  openStudentDialog(mode: 'add' | 'edit', studentId?: string): void {
    if (mode === 'add' && !this.permissionService.canAdd(MenuCodes.FeeMaster)) return;
    if (mode === 'edit' && !this.permissionService.canEdit(MenuCodes.FeeMaster)) return;

    const data: FeeStudentDialogData = {
      mode,
      feeMasterId: this.feeId,
      studentId,
      applicableTo: String(this.fee?.applicableTo ?? ''),
    };

    this.dialog
      .open(FeeStudentDialogComponent, {
        data,
        panelClass: ['erp-dialog', 'fee-dialog'],
        disableClose: true,
        width: FEE_STUDENT_DIALOG_WIDTH,
        maxWidth: '96vw',
        maxHeight: '92vh',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.scheduleAfterDialog(() => this.loadStudents(1));
      });
  }

  onStudentAction(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const studentId = String(event.row['studentId'] ?? '');
    if (event.action.label === 'Edit') {
      this.openStudentDialog('edit', studentId);
    } else if (event.action.label === 'Remove') {
      if (!this.permissionService.canDelete(MenuCodes.FeeMaster)) return;
      this.confirmRemoveStudent(
        studentId,
        String(event.row['studentName'] ?? 'this student'),
      );
    }
  }

  private confirmRemoveStudent(studentId: string, name: string): void {
    this.dialog
      .open(DeleteConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.isStudentWise ? 'Remove student' : 'Exclude optional fees',
          description: this.isStudentWise
            ? `Remove "${name}" from this fee?`
            : `Exclude "${name}" from non-mandatory fee heads?`,
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.feeMasterService.removeFeeStudent(this.feeId, studentId).subscribe({
          next: () => {
            this.snackBar.open(
              this.isStudentWise ? 'Student removed' : 'Optional fees excluded',
              'Close',
              { duration: 3000, panelClass: 'snack-success' },
            );
            this.loadStudents(1);
          },
          error: (err: unknown) => {
            this.snackBar.open(getUserFacingApiError(err, 'Failed to remove student'), 'Close', {
              duration: 3500,
              panelClass: 'snack-error',
            });
            this.refreshView();
          },
        });
      });
  }

  private rebuildHeadTableConfig(): void {
    const locked = this.isFeePublishedLocked;
    const config: DataTableConfig = {
      ...this.baseHeadTableConfig,
      header: {
        ...this.baseHeadTableConfig.header!,
        showAddButton: !locked,
      },
      actionVisibleFn: (action, row) => {
        if (locked && (action.label === 'Edit details' || action.label === 'Delete')) {
          return false;
        }
        return (
          action.label !== 'Delete' || (row['isActive'] !== false && row['isActive'] !== 'false')
        );
      },
    };
    this.headTableConfig = applyModuleTablePermissions(
      config,
      this.permissionService,
      MenuCodes.FeeMaster,
    );
  }

  private rebuildStudentTableConfig(): void {
    const config: DataTableConfig = {
      ...this.baseStudentTableConfig,
      header: {
        ...this.baseStudentTableConfig.header!,
        showAddButton: this.isStudentWise,
        subtitle: this.isStudentWise
          ? 'Manually assigned students for this fee'
          : 'Class roster — defaults until amount is changed',
      },
    };
    this.studentTableConfig = applyModuleTablePermissions(
      config,
      this.permissionService,
      MenuCodes.FeeMaster,
    );
  }

  /** Force UI refresh after async work / dialog teardown. */
  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  /** Run after MatDialog closes so overlay teardown does not swallow the update. */
  private scheduleAfterDialog(fn: () => void): void {
    this.ngZone.run(() => {
      setTimeout(() => {
        fn();
        this.refreshView();
      }, 0);
    });
  }

  private loadClassOptions(): void {
    this.classService.getClassDropdown().subscribe({
      next: (rows: any[]) => {
        this.classOptions = (rows || []).map((c) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        this.refreshView();
      },
    });
  }

  startBasicEdit(): void {
    if (!this.permissionService.canEdit(MenuCodes.FeeMaster) || !this.fee) return;
    if (this.isFeePublishedLocked) {
      this.snackBar.open(
        'Fee master cannot be edited after the published-on date has started.',
        'Close',
        { duration: 3500, panelClass: 'snack-warning' },
      );
      return;
    }
    this.patchBasicForm(this.fee);
    const ids = (this.fee.classGroupIds ?? []).map((x) => String(x));
    this.selectedClassGroupIds = [...ids];
    this.lockedClassGroupIds = [...ids];
    this.editingBasic = true;
  }

  cancelBasicEdit(): void {
    this.editingBasic = false;
    if (this.fee) {
      this.patchBasicForm(this.fee);
      this.selectedClassGroupIds = (this.fee.classGroupIds ?? []).map((x) => String(x));
      this.lockedClassGroupIds = [...this.selectedClassGroupIds];
    }
  }

  onFeeClassGroupIdsChange(ids: string[]): void {
    this.selectedClassGroupIds = [...new Set([...this.lockedClassGroupIds, ...ids])];
  }

  saveBasic(): void {
    if (this.basicForm.invalid || !this.feeId) {
      this.basicForm.markAllAsTouched();
      return;
    }

    const raw = this.basicForm.getRawValue();
    const published = raw.publishedOn as Date | null;
    const due = raw.defaultDueDate as Date | null;
    if (published && due) {
      const p = new Date(published);
      const d = new Date(due);
      p.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() < p.getTime()) {
        this.snackBar.open('Default due date must be on or after published on', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        return;
      }
    }

    if (!this.isStudentWise && !this.selectedClassGroupIds.length) {
      this.snackBar.open('Select at least one class', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.isSavingBasic = true;
    this.feeMasterService
      .updateFeeBasic(this.feeId, {
        feeName: String(raw.feeName).trim(),
        publishedOn: this.toApiDate(raw.publishedOn),
        defaultDueDate: this.toApiDate(raw.defaultDueDate),
        description: String(raw.description ?? '').trim() || null,
        classGroupIds: this.isStudentWise ? undefined : this.selectedClassGroupIds,
      })
      .subscribe({
        next: () => {
          this.isSavingBasic = false;
          this.editingBasic = false;
          this.snackBar.open('Fee details updated', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.loadFee();
        },
        error: (err: unknown) => {
          this.isSavingBasic = false;
          this.snackBar.open(getUserFacingApiError(err, 'Failed to update fee'), 'Close', {
            duration: 3500,
            panelClass: 'snack-error',
          });
          this.refreshView();
        },
      });
  }

  loadHeads(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = 'All',
  ): void {
    this.feeMasterService
      .getFeeHeads(this.feeId, pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter)
      .subscribe({
        next: (res: any) => {
          const items = (res?.items || []) as Record<string, unknown>[];
          this.heads = items.map((row) => ({
            ...row,
            amountDisplay:
              row['amount'] != null && row['amount'] !== ''
                ? String(row['amount'])
                : row['applicableMonths']
                  ? 'Monthly'
                  : 'Period wise',
          }));
          this.totalHeads = res?.totalCount || 0;
          this.refreshView();
        },
        error: () => {
          this.heads = [];
          this.totalHeads = 0;
          this.snackBar.open('Failed to load fee heads', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
          this.refreshView();
        },
      });
  }

  onHeadPageChange(event: any): void {
    this.loadHeads(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
      event.currentFilter || 'All',
    );
  }

  openHeadDialog(mode: 'add' | 'edit' | 'view' = 'add', headId?: string): void {
    if (mode === 'add' && !this.permissionService.canAdd(MenuCodes.FeeMaster)) return;
    if (mode === 'edit' && !this.permissionService.canEdit(MenuCodes.FeeMaster)) return;
    if (mode === 'view' && !this.permissionService.canView(MenuCodes.FeeMaster)) return;

    if ((mode === 'add' || mode === 'edit') && this.isFeePublishedLocked) {
      this.snackBar.open(
        'Fee heads cannot be changed after the published-on date has started.',
        'Close',
        { duration: 3500, panelClass: 'snack-warning' },
      );
      return;
    }

    const data: AddFeeHeadDialogData = {
      mode,
      feeMasterId: this.feeId,
      feeHeadId: headId,
      feeType: String(this.fee?.feeType ?? ''),
      applicableTo: String(this.fee?.applicableTo ?? ''),
    };

    this.dialog
      .open(AddFeeHeadDialogComponent, {
        data,
        panelClass: ['erp-dialog', 'fee-dialog'],
        disableClose: true,
        width: FEE_HEAD_DIALOG_WIDTH,
        maxWidth: '96vw',
        maxHeight: '92vh',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.scheduleAfterDialog(() => this.loadHeads());
      });
  }

  onHeadAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    const id = String(event.row['id'] ?? '');
    if (event.action.label === 'View details') {
      this.openHeadDialog('view', id);
    } else if (event.action.label === 'Edit details') {
      this.openHeadDialog('edit', id);
    } else if (event.action.label === 'Show history') {
      void this.router.navigate(['/fees/master/heads', id, 'history'], {
        queryParams: {
          returnUrl: `/fees/master?manageId=${this.feeId}&tab=1`,
        },
      });
    } else if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.FeeMaster)) return;
      this.confirmDeleteHead(id, String(event.row['feeHeadName'] ?? 'this fee head'));
    }
  }

  private confirmDeleteHead(id: string, name: string): void {
    this.dialog
      .open(DeleteConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete fee head',
          description: `Delete "${name}"?`,
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.feeMasterService.deleteFeeHead(id).subscribe({
          next: () => {
            this.snackBar.open('Fee head deleted', 'Close', {
              duration: 3000,
              panelClass: 'snack-success',
            });
            this.loadHeads();
          },
          error: () => {
            this.snackBar.open('Failed to delete fee head', 'Close', {
              duration: 3000,
              panelClass: 'snack-error',
            });
          },
        });
      });
  }

  private loadFee(): void {
    this.loading = true;
    this.feeMasterService.getFee(this.feeId).subscribe({
      next: (fee) => {
        this.fee = fee;
        this.patchBasicForm(fee);
        this.rebuildHeadTableConfig();
        this.rebuildStudentTableConfig();
        this.classGroupLabels = [];
        const rawIds = (fee as any).classGroupIds ?? (fee as any).ClassGroupIds ?? [];
        const ids = (Array.isArray(rawIds) ? rawIds : []).map((x: unknown) => String(x));
        this.fee = { ...fee, classGroupIds: ids };
        this.selectedClassGroupIds = [...ids];
        this.lockedClassGroupIds = [...ids];
        if (ids.length) {
          this.classService.getClassDropdown(undefined, 'group').subscribe({
            next: (rows: any[]) => {
              this.classGroupOptions = (rows || []).map((c) => ({
                id: String(c.id),
                name: String(c.name ?? ''),
              }));
              const map = new Map(this.classGroupOptions.map((c) => [c.id, c.name]));
              this.classGroupLabels = ids.map((id: string) => map.get(id) || id);
              this.refreshView();
            },
          });
        } else {
          this.classService.getClassDropdown(undefined, 'group').subscribe({
            next: (rows: any[]) => {
              this.classGroupOptions = (rows || []).map((c) => ({
                id: String(c.id),
                name: String(c.name ?? ''),
              }));
              this.refreshView();
            },
          });
        }
        this.loading = false;
        this.refreshView();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load fee', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cancel.emit();
      },
    });
  }

  private patchBasicForm(fee: FeeMasterDto): void {
    this.basicForm.patchValue({
      feeName: fee.feeName,
      feeType: this.feeTypeLabel,
      publishedOn: this.toDate(fee.publishedOn),
      defaultDueDate: this.toDate(fee.defaultDueDate),
      applicableTo: this.applicableToLabel,
      description: fee.description ?? '',
    });
  }

  private toDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private toApiDate(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
  }
}
