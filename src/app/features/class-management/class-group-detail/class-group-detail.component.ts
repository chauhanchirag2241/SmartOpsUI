import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
import { ShiftService } from '../../../core/services/shift.service';
import {
  AcademicPeriodRow,
  AcademicPeriodService,
} from '../../../core/services/academic-period.service';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { FormDialogComponent, FormDialogData } from '../../../shared/components/form-dialog/form-dialog.component';
import {
  AddSubjectDialogComponent,
  AddSubjectDialogData,
} from '../../../shared/components/add-subject-dialog/add-subject-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table/smart-data-table.component';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';
import { ERP_FORM_DIALOG_WIDTH } from '../../../shared/constants/dialog.constants';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import { PermissionService } from '../../../core/services/permission.service';
import { LoaderService } from '../../../core/services/loader.service';
import { MenuCodes } from '../../../core/constants/menu-codes';

@Component({
  selector: 'app-class-group-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, PageChromeDirective, SmartDataTableComponent],
  templateUrl: './class-group-detail.component.html',
  styleUrl: './class-group-detail.component.css',
  host: { class: 'class-group-detail-page form-page-shell' },
})
export class ClassGroupDetailComponent implements OnInit {
  @Input() classGroupId!: string;
  @Input() mode: 'edit' | 'view' = 'edit';
  /** Initial tab index when opened from history return (0=Basic, 1=Sections, 2=Subjects, 3=Periods). */
  @Input() initialTab = 0;
  @Output() cancel = new EventEmitter<void>();

  private readonly classService = inject(ClassService);
  private readonly subjectService = inject(SubjectService);
  private readonly academicPeriodService = inject(AcademicPeriodService);
  private readonly shiftService = inject(ShiftService);
  private readonly snackBar = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly loader = inject(LoaderService);
  private readonly cdr = inject(ChangeDetectorRef);

  currentTab = 0;
  className = '';
  description = '';
  loading = true;

  sections: Record<string, unknown>[] = [];
  subjects: Record<string, unknown>[] = [];
  periods: Record<string, unknown>[] = [];
  totalSubjects = 0;
  sectionTableConfig!: DataTableConfig;
  subjectTableConfig!: DataTableConfig;
  periodTableConfig!: DataTableConfig;

  private shiftOptions: { label: string; value: string }[] = [];
  private periodDraft: AcademicPeriodRow[] = [];

  readonly tabs = [
    { label: 'Basic Detail' },
    { label: 'Sections' },
    { label: 'Subjects' },
    { label: 'Academic Periods' },
  ];

  get isView(): boolean {
    return this.mode === 'view';
  }

  get canView(): boolean {
    return this.permissionService.canView(MenuCodes.Classes);
  }

  get canViewSubject(): boolean {
    return (
      this.permissionService.canView(MenuCodes.Subjects) ||
      this.permissionService.canView(MenuCodes.Classes)
    );
  }

  get canViewPeriods(): boolean {
    return (
      this.permissionService.canView(MenuCodes.AcademicPeriods) ||
      this.permissionService.canView(MenuCodes.Classes)
    );
  }

  get canEdit(): boolean {
    return !this.isView && this.permissionService.canEdit(MenuCodes.Classes);
  }

  get canAdd(): boolean {
    return !this.isView && this.permissionService.canAdd(MenuCodes.Classes);
  }

  get canDelete(): boolean {
    return !this.isView && this.permissionService.canDelete(MenuCodes.Classes);
  }

  get canAddSubject(): boolean {
    return (
      !this.isView &&
      (this.permissionService.canAdd(MenuCodes.Subjects) || this.permissionService.canAdd(MenuCodes.Classes))
    );
  }

  get canEditSubject(): boolean {
    return (
      !this.isView &&
      (this.permissionService.canEdit(MenuCodes.Subjects) || this.permissionService.canEdit(MenuCodes.Classes))
    );
  }

  get canDeleteSubject(): boolean {
    return (
      !this.isView &&
      (this.permissionService.canDelete(MenuCodes.Subjects) || this.permissionService.canDelete(MenuCodes.Classes))
    );
  }

  get canEditPeriods(): boolean {
    return (
      !this.isView &&
      (this.permissionService.canEdit(MenuCodes.AcademicPeriods) ||
        this.permissionService.canEdit(MenuCodes.Classes))
    );
  }

  get canAddPeriods(): boolean {
    return (
      !this.isView &&
      (this.permissionService.canEdit(MenuCodes.AcademicPeriods) ||
        this.permissionService.canAdd(MenuCodes.Classes) ||
        this.permissionService.canEdit(MenuCodes.Classes))
    );
  }

  ngOnInit(): void {
    this.currentTab = Math.min(Math.max(0, this.initialTab || 0), this.tabs.length - 1);
    this.sectionTableConfig = this.buildSectionTableConfig();
    this.subjectTableConfig = this.buildSubjectTableConfig();
    this.periodTableConfig = this.buildPeriodTableConfig();
    this.loadGroup();
    this.loadSections();
    this.loadSubjects();
    this.loadPeriods();
    this.loadShiftOptions();
  }

  /** Build return URL so history Back lands on this class + tab. */
  private historyReturnUrl(tabIndex: number): string {
    const params = new URLSearchParams({
      groupId: this.classGroupId,
      tab: String(tabIndex),
      mode: this.mode,
    });
    return `/classes?${params.toString()}`;
  }

  private openHistory(path: string[], tabIndex: number): void {
    void this.router.navigate(path, {
      queryParams: { returnUrl: this.historyReturnUrl(tabIndex) },
    });
  }

  goTab(index: number): void {
    this.currentTab = index;
  }

  private buildSectionTableConfig(): DataTableConfig {
    const actions: DataTableAction[] = [];
    if (this.canView) {
      actions.push({ label: 'View details', icon: 'visibility', iconColor: '#639922' });
    }
    if (this.canEdit) {
      actions.push({ label: 'Edit section', icon: 'edit', iconColor: '#1E40AF' });
    }
    if (this.canView) {
      actions.push({ label: 'Show history', icon: 'history', iconColor: '#639922' });
    }
    if (this.canDelete) {
      actions.push({
        label: 'Delete section',
        icon: 'delete',
        danger: true,
        separatorBefore: true,
      });
    }

    return {
      header: {
        title: '',
        showAddButton: this.canAdd,
        addButtonText: 'Add section',
        addButtonIcon: 'add',
        addButtonClass: 'btn-primary',
      },
      columns: [
        { key: 'section', label: 'Section', sortable: true },
        { key: 'capacity', label: 'Capacity', sortable: true },
        { key: 'roomNumber', label: 'Room', sortable: true },
        {
          key: 'status',
          label: 'Status',
          cellType: 'badge',
          badgeMap: {
            Active: { cssClass: 'b-green', label: 'Active' },
            Inactive: { cssClass: 'b-red', label: 'Inactive' },
          },
        },
      ],
      actions,
      searchPlaceholder: 'Search sections...',
      searchKeys: ['section', 'roomNumber'],
      itemLabel: 'sections',
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50],
      showExport: false,
      selectable: false,
    };
  }

  private buildSubjectTableConfig(): DataTableConfig {
    const actions: DataTableAction[] = [];
    if (this.canViewSubject) {
      actions.push({ label: 'View details', icon: 'visibility', iconColor: '#639922' });
    }
    if (this.canEditSubject) {
      actions.push({ label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' });
    }
    if (this.canViewSubject) {
      actions.push({ label: 'Show history', icon: 'history', iconColor: '#639922' });
    }
    if (this.canDeleteSubject) {
      actions.push({ label: 'Delete', icon: 'delete', danger: true, separatorBefore: true });
    }

    return {
      header: {
        title: '',
        showAddButton: this.canAddSubject,
        addButtonText: 'Add subject',
        addButtonIcon: 'add',
        addButtonClass: 'btn-primary',
      },
      columns: [
        { key: 'subjectName', label: 'Subject', sortable: true },
        { key: 'subjectCode', label: 'Code', sortable: true },
        {
          key: 'subjectType',
          label: 'Type',
          cellType: 'badge',
          badgeMap: {
            Theory: { cssClass: 'b-blue', label: 'Theory' },
            Practical: { cssClass: 'b-purple', label: 'Practical' },
            Both: { cssClass: 'b-teal', label: 'Both' },
          },
        },
        { key: 'subjectCategory', label: 'Category' },
        { key: 'medium', label: 'Medium' },
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
      actions,
      searchPlaceholder: 'Search by name or code...',
      searchKeys: ['subjectName', 'subjectCode'],
      itemLabel: 'subjects',
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50],
      showExport: false,
      selectable: false,
    };
  }

  private buildPeriodTableConfig(): DataTableConfig {
    const actions: DataTableAction[] = [];
    if (this.canViewPeriods) {
      actions.push({ label: 'View details', icon: 'visibility', iconColor: '#639922' });
    }
    if (this.canEditPeriods) {
      actions.push({ label: 'Edit period', icon: 'edit', iconColor: '#1E40AF' });
    }
    if (this.canViewPeriods) {
      actions.push({ label: 'Show history', icon: 'history', iconColor: '#639922' });
    }
    if (this.canEditPeriods) {
      actions.push({ label: 'Delete period', icon: 'delete', danger: true, separatorBefore: true });
    }

    return {
      header: {
        title: '',
        showAddButton: this.canAddPeriods,
        addButtonText: 'Add period',
        addButtonIcon: 'add',
        addButtonClass: 'btn-primary',
      },
      columns: [
        { key: 'periodIndex', label: '#', sortable: false },
        { key: 'name', label: 'Name', sortable: true },
      ],
      actions,
      searchPlaceholder: 'Search periods...',
      searchKeys: ['name'],
      itemLabel: 'periods',
      defaultPageSize: 25,
      pageSizeOptions: [10, 25, 50],
      showExport: false,
      selectable: false,
    };
  }

  private loadGroup(): void {
    this.classService.getClassGroupById(this.classGroupId).subscribe({
      next: (res) => {
        this.className = res?.className ?? 'Class';
        this.description = res?.description ?? '';
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load class', 'Close', { duration: 3000, panelClass: 'snack-error' });
        this.cdr.detectChanges();
      },
    });
  }

  loadSections(): void {
    this.classService.getClasses(1, 200, '', null, null, 'All', this.classGroupId).subscribe({
      next: (res) => {
        this.sections = (res?.items ?? []).map((row: any) => ({
          ...row,
          capacity: Number(row.capacity) === 0 ? null : row.capacity,
          roomNumber: row.roomNumber === 'N/A' ? '—' : row.roomNumber,
        }));
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load sections', 'Close', { duration: 3000, panelClass: 'snack-error' }),
    });
  }

  loadSubjects(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
  ): void {
    this.subjectService
      .getSubjects(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, 'All', this.classGroupId)
      .subscribe({
        next: (res) => {
          this.subjects = res?.items ?? [];
          this.totalSubjects = res?.totalCount ?? this.subjects.length;
          this.cdr.detectChanges();
        },
        error: () =>
          this.snackBar.open('Failed to load subjects', 'Close', { duration: 3000, panelClass: 'snack-error' }),
      });
  }

  loadPeriods(): void {
    this.academicPeriodService.getClassSetup(this.classGroupId).subscribe({
      next: (setup) => {
        this.periodDraft = (setup?.periods ?? []).map((p, i) => ({
          id: p.id,
          periodIndex: p.periodIndex || i + 1,
          name: p.name,
        }));
        this.syncPeriodTable();
      },
      error: () =>
        this.snackBar.open('Failed to load academic periods', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  private syncPeriodTable(): void {
    this.periods = this.periodDraft.map((p, i) => ({
      ...p,
      periodIndex: i + 1,
      _index: i,
    }));
    this.cdr.detectChanges();
  }

  private savePeriods(successMessage: string): void {
    const periods = this.periodDraft.map((p, i) => ({
      periodIndex: i + 1,
      name: String(p.name ?? '').trim(),
    }));

    this.loader.showManualImmediate('Saving periods...');
    this.academicPeriodService.saveClassSetup(this.classGroupId, { periods }).subscribe({
      next: (setup) => {
        this.loader.hideManual();
        this.periodDraft = (setup?.periods ?? periods).map((p, i) => ({
          id: p.id,
          periodIndex: p.periodIndex || i + 1,
          name: p.name,
        }));
        this.syncPeriodTable();
        this.snackBar.open(successMessage, 'Close', { duration: 2500, panelClass: 'snack-success' });
      },
      error: (err) => {
        this.loader.hideManual();
        this.snackBar.open(getUserFacingApiError(err, 'Failed to save academic periods'), 'Close', {
          duration: 4000,
          panelClass: 'snack-error',
        });
        this.loadPeriods();
      },
    });
  }

  openPeriodDialog(row?: Record<string, unknown>, viewOnly = false): void {
    if (viewOnly) {
      if (!this.canViewPeriods) return;
    } else if (row ? !this.canEditPeriods : !this.canAddPeriods) {
      return;
    }

    const data: FormDialogData = {
      title: viewOnly ? 'View period' : row ? 'Edit period' : 'Add period',
      subtitle: viewOnly
        ? 'Academic period details'
        : row
          ? 'Update academic period name'
          : 'Create an academic period for this class',
      saveLabel: row ? 'Update period' : 'Save period',
      sectionTitle: 'Period details',
      sectionIcon: 'event_note',
      viewOnly,
      fields: [
        {
          type: 'input',
          controlName: 'name',
          label: 'Period name',
          placeholder: 'e.g. Period 1, Term 1',
          validations: [{ name: 'required', message: 'Period name is required', validator: Validators.required }],
        },
      ],
      layout: 'grid1',
      width: ERP_FORM_DIALOG_WIDTH,
      initialValue: { name: row?.['name'] ?? `Period ${this.periodDraft.length + 1}` },
    };

    this.dialog
      .open(FormDialogComponent, {
        data,
        panelClass: 'erp-dialog',
        disableClose: true,
        width: ERP_FORM_DIALOG_WIDTH,
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((value) => {
        if (!value || viewOnly) return;
        const name = String(value['name'] ?? '').trim();
        if (!name) return;

        const duplicate = this.periodDraft.some(
          (p, i) =>
            p.name.trim().toLowerCase() === name.toLowerCase() &&
            i !== Number(row?.['_index'] ?? -1),
        );
        if (duplicate) {
          this.snackBar.open('Period names must be unique', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
          return;
        }

        if (row && row['_index'] != null) {
          const index = Number(row['_index']);
          this.periodDraft[index] = { ...this.periodDraft[index], name };
          this.savePeriods('Period updated');
        } else {
          this.periodDraft = [...this.periodDraft, { periodIndex: this.periodDraft.length + 1, name }];
          this.savePeriods('Period added');
        }
      });
  }

  onSubjectPageChange(event: {
    pageIndex: number;
    pageSize: number;
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: string | null;
  }): void {
    this.loadSubjects(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
    );
  }

  private loadShiftOptions(): void {
    this.shiftService.getShiftDropdown().subscribe({
      next: (items) => {
        this.shiftOptions = (items || []).map((s) => ({ label: s.name, value: s.id }));
      },
      error: () => {
        this.shiftOptions = [];
      },
    });
  }

  private sectionFields(): FormFieldConfig[] {
    return [
      {
        type: 'input',
        controlName: 'section',
        label: 'Section',
        placeholder: 'e.g. A, B, 1, 2',
        validations: [{ name: 'required', message: 'Section is required', validator: Validators.required }],
      },
      {
        type: 'input',
        inputType: 'number',
        controlName: 'studentCapacity',
        label: 'Student capacity',
        placeholder: 'Enter capacity',
      },
      {
        type: 'input',
        controlName: 'roomNumber',
        label: 'Room number',
        placeholder: 'Room number',
      },
      {
        type: 'select',
        controlName: 'shiftId',
        label: 'Shift',
        placeholder: SELECT_PLACEHOLDER,
        options: this.shiftOptions,
      },
    ];
  }

  openSectionDialog(row?: Record<string, unknown>, viewOnly = false): void {
    if (viewOnly) {
      if (!this.canView) return;
    } else if (row ? !this.canEdit : !this.canAdd) {
      return;
    }

    const data: FormDialogData = {
      title: viewOnly ? 'View section' : row ? 'Edit section' : 'Add section',
      subtitle: viewOnly
        ? 'Section details'
        : row
          ? 'Update section details'
          : 'Create a section under this class',
      saveLabel: row ? 'Update section' : 'Save section',
      sectionTitle: 'Section details',
      sectionIcon: 'groups',
      viewOnly,
      fields: this.sectionFields(),
      layout: 'grid2',
      width: ERP_FORM_DIALOG_WIDTH,
      initialValue: row
        ? {
            section: row['section'],
            studentCapacity: row['capacity'] ?? '',
            roomNumber: row['roomNumber'] === '—' ? '' : row['roomNumber'],
            shiftId: row['shiftId'] ?? null,
          }
        : { section: '', studentCapacity: '', roomNumber: '', shiftId: null },
    };

    this.dialog
      .open(FormDialogComponent, {
        data,
        panelClass: 'erp-dialog',
        disableClose: true,
        width: ERP_FORM_DIALOG_WIDTH,
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((value) => {
        if (!value || viewOnly) return;
        const payload = { ...value, classGroupId: this.classGroupId };
        const req$ = row?.['id']
          ? this.classService.updateClass(String(row['id']), payload)
          : this.classService.createClass(payload);

        this.loader.showManualImmediate(row ? 'Updating section...' : 'Saving section...');
        req$.subscribe({
          next: () => {
            this.loader.hideManual();
            this.snackBar.open(row ? 'Section updated' : 'Section added', 'Close', {
              duration: 2500,
              panelClass: 'snack-success',
            });
            this.loadSections();
          },
          error: (err) => {
            this.loader.hideManual();
            this.snackBar.open(getUserFacingApiError(err, 'Failed to save section'), 'Close', {
              duration: 3000,
              panelClass: 'snack-error',
            });
          },
        });
      });
  }

  openSubjectDialog(mode: 'add' | 'edit' | 'view' = 'add', subjectId?: string): void {
    if (mode === 'add' && !this.canAddSubject) return;
    if (mode === 'edit' && !this.canEditSubject) return;

    const data: AddSubjectDialogData = {
      mode,
      classGroupId: this.classGroupId,
      subjectId,
    };

    this.dialog
      .open(AddSubjectDialogComponent, {
        data,
        panelClass: 'erp-dialog',
        disableClose: true,
        width: ERP_FORM_DIALOG_WIDTH,
        maxWidth: '94vw',
        maxHeight: '90vh',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadSubjects();
        }
      });
  }

  onSectionAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    if (event.action.label === 'View details') {
      this.openSectionDialog(event.row, true);
      return;
    }
    if (event.action.label === 'Edit section') {
      this.openSectionDialog(event.row);
      return;
    }
    if (event.action.label === 'Show history') {
      const id = String(event.row['id'] ?? '');
      if (id) this.openHistory(['/classes', id, 'history'], 1);
      return;
    }
    if (event.action.label === 'Delete section') {
      this.deleteSection(event.row);
    }
  }

  onSubjectAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = String(event.row['id']);
    if (event.action.label === 'View details') {
      this.openSubjectDialog('view', id);
      return;
    }
    if (event.action.label === 'Edit details') {
      this.openSubjectDialog('edit', id);
      return;
    }
    if (event.action.label === 'Show history') {
      if (id) this.openHistory(['/subjects', id, 'history'], 2);
      return;
    }
    if (event.action.label === 'Delete') {
      this.deleteSubject(event.row);
    }
  }

  onPeriodAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    if (event.action.label === 'View details') {
      this.openPeriodDialog(event.row, true);
      return;
    }
    if (event.action.label === 'Edit period') {
      this.openPeriodDialog(event.row);
      return;
    }
    if (event.action.label === 'Show history') {
      const id = String(event.row['id'] ?? '');
      if (!id) {
        this.snackBar.open('History is available after the period is saved.', 'Close', {
          duration: 3000,
          panelClass: 'snack-info',
        });
        return;
      }
      this.openHistory(['/academic-periods', id, 'history'], 3);
      return;
    }
    if (event.action.label === 'Delete period') {
      this.deletePeriod(event.row);
    }
  }

  deletePeriod(row: Record<string, unknown>): void {
    if (!this.canEditPeriods) return;
    const index = Number(row['_index']);
    const ref = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete period?',
        description: `Delete "${row['name']}" from ${this.className}?`,
        recordName: String(row['name'] ?? 'Period'),
        recordMeta: `Period ${row['periodIndex'] ?? ''}`,
        initials: String(row['name'] ?? 'P').charAt(0),
        warningMessage: 'This updates the academic period list for this class.',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    ref.afterClosed().subscribe((ok) => {
      if (!ok || Number.isNaN(index)) return;
      this.periodDraft = this.periodDraft.filter((_, i) => i !== index);
      if (!this.periodDraft.length) {
        this.snackBar.open('Add at least one academic period before saving an empty list.', 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
        this.loadPeriods();
        return;
      }
      this.savePeriods('Period deleted');
    });
  }

  deleteSection(row: Record<string, unknown>): void {
    if (!this.canDelete) return;
    const ref = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete section?',
        description: 'This removes the section from this class.',
        recordName: `${this.className} - ${row['section']}`,
        recordMeta: String(row['roomNumber'] || 'No room'),
        initials: String(row['section'] ?? 'S').charAt(0),
        warningMessage: 'This action cannot be undone.',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.classService.deleteClass(String(row['id'])).subscribe({
        next: () => {
          this.snackBar.open('Section deleted', 'Close', { duration: 2500, panelClass: 'snack-success' });
          this.loadSections();
        },
        error: (err) =>
          this.snackBar.open(getUserFacingApiError(err, 'Failed to delete section'), 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          }),
      });
    });
  }

  deleteSubject(row: Record<string, unknown>): void {
    if (!this.canDeleteSubject) return;
    const ref = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete subject?',
        description: `Delete "${row['subjectName']}" from ${this.className}?`,
        recordName: String(row['subjectName'] ?? 'Subject'),
        recordMeta: String(row['subjectCode'] ?? ''),
        initials: String(row['subjectName'] ?? 'S').charAt(0),
        warningMessage: 'This action cannot be undone.',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.subjectService.deleteSubject(String(row['id'])).subscribe({
        next: () => {
          this.snackBar.open('Subject deleted', 'Close', { duration: 2500, panelClass: 'snack-success' });
          this.loadSubjects();
        },
        error: (err) =>
          this.snackBar.open(getUserFacingApiError(err, 'Failed to delete subject'), 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          }),
      });
    });
  }
}
