import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { MappingService, ClassSubjectTeacherMapping, MappingLookupOption, MappingLookups } from '../../../core/services/mapping.service';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { PeriodTemplateService } from '../../../core/services/period-template.service';
import {
  TimetableService,
  TimetableGrid,
  TimetableSlotCell,
  TimetableSlotInput,
  TimetableVersion,
  PeriodGridRow,
} from '../../../core/services/timetable.service';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import type { DataTableAction, DataTableConfig } from '../../../shared/components/smart-data-table';
import { SELECT_PLACEHOLDER } from '../../../shared/constants/form.constants';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import { MappingOption } from '../../../shared/mapping/mapping.types';
import { TimetableSlotDialogComponent, TimetableSlotDialogData, TimetableSlotDialogResult } from './timetable-slot-dialog.component';

type FormMode = 'add' | 'edit' | 'view';

const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
];

@Component({
  selector: 'app-class-timetable',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    ActionButtonComponent,
    MultiSelectChipsComponent,
    DynamicFieldComponent,
    SmartDataTableComponent,
    PageChromeDirective,
  ],
  templateUrl: './class-timetable.component.html',
  styleUrl: './class-timetable.component.css',
})
export class ClassTimetableComponent implements OnInit {
  private readonly timetableService = inject(TimetableService);
  private readonly mappingService = inject(MappingService);
  private readonly classService = inject(ClassService);
  private readonly subjectService = inject(SubjectService);
  private readonly employeeService = inject(EmployeeService);
  private readonly periodTemplateService = inject(PeriodTemplateService);
  private readonly snackBar = inject(NotificationService);
  private readonly permissions = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);

  readonly days = DAYS;
  showDetail = false;
  formMode: FormMode = 'add';

  classes: MappingLookupOption[] = [];
  employees: MappingLookupOption[] = [];
  lookupSubjects: MappingLookupOption[] = [];
  periodTemplates: { id: string; name: string }[] = [];
  mappings: ClassSubjectTeacherMapping[] = [];
  versions: TimetableVersion[] = [];
  versionRows: Record<string, unknown>[] = [];

  grid: TimetableGrid | null = null;
  slotMap = new Map<string, TimetableSlotCell>();
  dirtySlots: TimetableSlotInput[] = [];
  isDirty = false;
  loading = false;
  draftLoading = false;
  draftReady = false;
  saving = false;
  errorMessage = '';
  tableConfig!: DataTableConfig;

  /** List filter — empty means all classes. */
  selectedClassIds: string[] = [];
  classFilterOptions: MappingOption[] = [];
  /** Class of the version currently open in detail (edit/view). */
  private editingClassId = '';

  versionForm: FormGroup = this.fb.group({
    classId: ['', Validators.required],
    periodTemplateId: ['', Validators.required],
    effectiveFrom: [null as Date | null, Validators.required],
    copyFromPrevious: [true],
  });

  versionConfigs: Record<string, FormFieldConfig> = {
    classId: {
      type: 'select',
      controlName: 'classId',
      label: 'Class',
      placeholder: 'Select class',
      options: [{ label: 'Select class', value: '' }],
      validations: [{ name: 'required', message: 'Class is required', validator: Validators.required }],
    },
    periodTemplateId: {
      type: 'select',
      controlName: 'periodTemplateId',
      label: 'Period template',
      placeholder: SELECT_PLACEHOLDER,
      options: [],
      validations: [{ name: 'required', message: 'Template is required', validator: Validators.required }],
    },
    effectiveFrom: {
      type: 'datepicker',
      controlName: 'effectiveFrom',
      label: 'Effective from',
      validations: [{ name: 'required', message: 'Effective from is required', validator: Validators.required }],
    },
    copyFromPrevious: {
      type: 'checkbox',
      controlName: 'copyFromPrevious',
      label: 'Copy slots from previous (same template)',
    },
  };

  /** Active version on the detail screen. */
  selectedVersionId = '';

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Class Timetable',
      subtitle: 'Timetable versions by effective date — add new or edit an existing version',
      showAddButton: true,
      addButtonText: 'Add timetable',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'effectiveFrom', label: 'Effective from', sortable: true, cellType: 'date' },
      { key: 'className', label: 'Class', sortable: true },
      { key: 'periodTemplateName', label: 'Period template', sortable: true },
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
    actions: [
      { label: 'Edit timetable', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'View timetable', icon: 'visibility', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    searchPlaceholder: 'Search by class or template...',
    searchKeys: ['className', 'periodTemplateName', 'effectiveFromLabel'],
    itemLabel: 'timetables',
    defaultPageSize: 10,
  };

  /** Top nav bar academic year. */
  get selectedAcademicYearId(): string {
    return this.ayContext.effectiveYearId() || '';
  }

  get detailAcademicYearId(): string {
    return this.selectedAcademicYearId;
  }

  get detailClassId(): string {
    if (this.formMode === 'add') {
      return String(this.versionForm.get('classId')?.value ?? '');
    }
    return this.editingClassId;
  }

  get canEditGrid(): boolean {
    if (!this.showDetail || this.formMode === 'view' || this.ayContext.isReadOnlyScope()) {
      return false;
    }
    if (this.formMode === 'add') {
      return this.permissions.canAdd(MenuCodes.ClassTimetable) && this.draftReady;
    }
    return this.permissions.canEdit(MenuCodes.ClassTimetable);
  }

  get canSaveTimetable(): boolean {
    if (!this.showDetail || this.formMode === 'view' || this.ayContext.isReadOnlyScope()) {
      return false;
    }
    if (this.formMode === 'add') {
      return this.permissions.canAdd(MenuCodes.ClassTimetable) && this.draftReady;
    }
    return this.permissions.canEdit(MenuCodes.ClassTimetable);
  }

  get canClickSave(): boolean {
    if (this.formMode === 'add') {
      return this.draftReady && this.versionForm.valid;
    }
    return this.isDirty && !!this.selectedVersionId;
  }

  get periods(): PeriodGridRow[] {
    return this.grid?.periods ?? [];
  }

  get hasGridPeriods(): boolean {
    return this.days.some((d) => this.periodsForDay(d.day).length > 0);
  }

  periodsForDay(day: number): PeriodGridRow[] {
    const byDay = this.grid?.periodsByDay;
    if (byDay) {
      const rows = byDay[day] ?? (byDay as Record<string, PeriodGridRow[]>)[String(day)];
      return rows || [];
    }
    return this.grid?.periods ?? [];
  }

  get conflicts() {
    return this.grid?.conflicts ?? [];
  }

  get detailTitle(): string {
    if (this.formMode === 'edit') return 'Edit class timetable';
    if (this.formMode === 'view') return 'View class timetable';
    return 'Add class timetable';
  }

  get detailClassLabel(): string {
    const classId = this.detailClassId;
    const name = this.classes.find((c) => c.id === classId)?.name;
    return name ? `Class: ${name}` : '';
  }

  get detailVersionLabel(): string {
    if (this.formMode === 'add' && this.draftReady) {
      const raw = this.versionForm.getRawValue();
      const templateName =
        this.periodTemplates.find((t) => t.id === raw.periodTemplateId)?.name || '';
      const dateLabel = this.formatDateLabel(this.toDateInputValue(raw.effectiveFrom));
      return `Draft · Effective ${dateLabel}${templateName ? ` · ${templateName}` : ''} (not saved yet)`;
    }
    const row = this.versions.find((v) => v.id === this.selectedVersionId);
    if (!row) return '';
    return `Effective ${this.formatDateLabel(row.effectiveFrom)}${
      row.periodTemplateName ? ` · ${row.periodTemplateName}` : ''
    }`;
  }

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.versionForm.patchValue({ effectiveFrom: today });
    this.loadLookups(this.selectedAcademicYearId || undefined);
  }

  onSelectedClassesChange(ids: string[]): void {
    this.selectedClassIds = ids;
    if (!this.showDetail) {
      this.loadVersionList();
    }
  }

  onAddButtonClicked(): void {
    if (!this.permissions.canAdd(MenuCodes.ClassTimetable)) return;
    this.formMode = 'add';
    this.selectedVersionId = '';
    this.editingClassId = '';
    this.draftReady = false;
    this.grid = null;
    this.slotMap.clear();
    this.isDirty = false;
    this.errorMessage = '';
    this.showDetail = true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const defaultClassId =
      this.selectedClassIds.find((id) => this.classes.some((c) => c.id === id)) ||
      this.classes[0]?.id ||
      '';
    this.versionForm.reset({
      classId: defaultClassId,
      periodTemplateId: this.periodTemplates[0]?.id || '',
      effectiveFrom: today,
      copyFromPrevious: true,
    });
    this.cdr.detectChanges();
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedVersionId = '';
    this.editingClassId = '';
    this.draftReady = false;
    this.grid = null;
    this.isDirty = false;
    this.errorMessage = '';
    this.loadVersionList();
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = String(event.row['id'] ?? '');
    const classId = String(event.row['classId'] ?? '');

    if (event.action.label === 'Edit timetable') {
      if (!this.permissions.canEdit(MenuCodes.ClassTimetable)) return;
      this.openDetail('edit', id, classId);
    } else if (event.action.label === 'View timetable') {
      if (!this.permissions.canView(MenuCodes.ClassTimetable)) return;
      this.openDetail('view', id, classId);
    } else if (event.action.label === 'Delete') {
      if (!this.permissions.canDelete(MenuCodes.ClassTimetable)) return;
      this.confirmDelete(event.row);
    }
  }

  /** Opens draft grid below the form — no DB entry until Save timetable. */
  openDraftGrid(): void {
    if (!this.permissions.canAdd(MenuCodes.ClassTimetable)) return;
    if (this.draftLoading) return;
    if (this.versionForm.invalid) {
      this.versionForm.markAllAsTouched();
      this.snackBar.open('Class, template and Effective from are required', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    const raw = this.versionForm.getRawValue();
    const templateId = String(raw.periodTemplateId ?? '');
    const classId = String(raw.classId ?? '');
    const academicYearId = this.detailAcademicYearId;
    const effectiveFrom = this.toDateInputValue(raw.effectiveFrom);
    if (!templateId || !classId || !academicYearId || !effectiveFrom) {
      this.snackBar.open('Top nav bar ma academic year select karo', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    this.draftLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.periodTemplateService
      .get(templateId)
      .pipe(
        finalize(() => {
          this.draftLoading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (template) => {
          const built = this.buildPeriodsByDayFromTemplate(template.periods || []);
          if (!Object.values(built.periodsByDay).some((rows) => rows.length)) {
            this.snackBar.open('Selected template has no periods', 'Close', {
              duration: 3500,
              panelClass: 'snack-error',
            });
            return;
          }

          this.grid = {
            periods: built.periods,
            periodsByDay: built.periodsByDay,
            slots: [],
            conflicts: [],
          };
          this.slotMap.clear();
          this.selectedVersionId = '';
          this.draftReady = true;
          this.isDirty = true;
          this.loadMappingsForClass(classId, academicYearId);

          const allPeriodIds = Object.values(built.periodsByDay)
            .flat()
            .map((p) => p.id);

          if (raw.copyFromPrevious) {
            this.copyDraftSlotsFromPrevious(
              classId,
              academicYearId,
              templateId,
              effectiveFrom,
              allPeriodIds,
            );
          } else {
            this.dirtySlots = this.slotsFromMap();
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          this.snackBar.open(getUserFacingApiError(err, 'Failed to load period template'), 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  /** Save version + grid together (add) or slots only (edit). */
  saveTimetable(): void {
    if (!this.canSaveTimetable || !this.canClickSave) return;

    if (this.formMode === 'add' && !this.selectedVersionId) {
      this.saveNewTimetable();
      return;
    }

    if (!this.selectedVersionId) return;
    this.saving = true;
    const slots = this.slotsFromMap();
    this.timetableService
      .saveSlots(this.selectedVersionId, slots)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.snackBar.open('Timetable saved', 'Close', { duration: 3000, panelClass: 'snack-success' });
          this.isDirty = false;
          this.loadVersionGrid(this.selectedVersionId);
        },
        error: (err) => {
          this.snackBar.open(getUserFacingApiError(err, 'Failed to save timetable'), 'Close', {
            duration: 5000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private saveNewTimetable(): void {
    const raw = this.versionForm.getRawValue();
    const effectiveFrom = this.toDateInputValue(raw.effectiveFrom);
    const classId = String(raw.classId ?? '');
    const academicYearId = this.detailAcademicYearId;
    const periodTemplateId = String(raw.periodTemplateId ?? '');
    if (!effectiveFrom || !classId || !periodTemplateId) return;
    if (!academicYearId) {
      this.snackBar.open('Top nav bar ma academic year select karo', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    this.saving = true;
    this.cdr.detectChanges();

    this.timetableService
      .createVersion({
        academicYearId,
        classId,
        periodTemplateId,
        effectiveFrom,
        // Slots are sent explicitly below; avoid double-copy from server.
        copyFromPrevious: false,
      })
      .subscribe({
        next: (res) => {
          const timetableId = this.extractTimetableId(res);
          if (!timetableId) {
            this.saving = false;
            this.snackBar.open('Version created, but timetable id missing from response.', 'Close', {
              duration: 4000,
              panelClass: 'snack-error',
            });
            this.cdr.detectChanges();
            return;
          }

          const slots = this.slotsFromMap();
          this.timetableService
            .saveSlots(timetableId, slots)
            .pipe(finalize(() => {
              this.saving = false;
              this.cdr.detectChanges();
            }))
            .subscribe({
              next: () => {
                this.snackBar.open('Timetable version and grid saved', 'Close', {
                  duration: 3000,
                  panelClass: 'snack-success',
                });
                this.selectedVersionId = timetableId;
                this.editingClassId = classId;
                this.formMode = 'edit';
                this.draftReady = false;
                this.isDirty = false;
                if (classId && !this.selectedClassIds.includes(classId)) {
                  this.selectedClassIds = [...this.selectedClassIds, classId];
                }
                this.loadVersionGrid(timetableId);
                this.loadVersionList();
              },
              error: (err) => {
                this.selectedVersionId = timetableId;
                this.editingClassId = classId;
                this.formMode = 'edit';
                this.draftReady = false;
                this.snackBar.open(
                  getUserFacingApiError(err, 'Version created but failed to save slots. Edit and save again.'),
                  'Close',
                  { duration: 5000, panelClass: 'snack-error' },
                );
                this.loadVersionGrid(timetableId);
              },
            });
        },
        error: (err) => {
          this.saving = false;
          this.snackBar.open(getUserFacingApiError(err, 'Failed to save timetable'), 'Close', {
            duration: 5000,
            panelClass: 'snack-error',
          });
          this.cdr.detectChanges();
        },
      });
  }

  private copyDraftSlotsFromPrevious(
    classId: string,
    academicYearId: string,
    templateId: string,
    effectiveFrom: string,
    allowedPeriodIds: string[],
  ): void {
    this.timetableService
      .getVersions(classId, academicYearId)
      .pipe(catchError(() => of([] as TimetableVersion[])))
      .subscribe({
        next: (versions) => {
          const previous = (versions || [])
            .filter(
              (v) =>
                v.periodTemplateId === templateId &&
                String(v.effectiveFrom).slice(0, 10) < effectiveFrom,
            )
            .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];

          if (!previous) {
            this.dirtySlots = this.slotsFromMap();
            this.cdr.detectChanges();
            return;
          }

          this.timetableService
            .getGrid(previous.id)
            .pipe(catchError(() => of(null)))
            .subscribe({
              next: (prevGrid) => {
                const allowed = new Set(allowedPeriodIds);
                for (const slot of prevGrid?.slots || []) {
                  if (!allowed.has(slot.periodId)) continue;
                  this.slotMap.set(this.cellKey(slot.dayOfWeek, slot.periodId), {
                    dayOfWeek: slot.dayOfWeek,
                    periodId: slot.periodId,
                    subjectId: slot.subjectId,
                    subjectName: slot.subjectName,
                    subjectCode: slot.subjectCode,
                    employeeId: slot.employeeId,
                    employeeName: slot.employeeName,
                    roomNo: slot.roomNo,
                  });
                }
                this.dirtySlots = this.slotsFromMap();
                this.cdr.detectChanges();
              },
            });
        },
      });
  }

  openCell(day: number, period: PeriodGridRow): void {
    // Draft add has no versionId until Save — still allow slot popup on local grid.
    if (!this.canEditGrid || period.isBreak) return;

    const existing = this.getCell(day, period.id);
    const subjects = this.uniqueSubjects();
    if (!subjects.length) {
      this.snackBar.open(
        'No subjects available. Add subjects in Subject Master, then refresh this page.',
        'Close',
        { duration: 4500, panelClass: 'snack-error' },
      );
      return;
    }

    const data: TimetableSlotDialogData = {
      dayLabel: DAYS.find((d) => d.day === day)?.label || String(day),
      periodName: period.name,
      subjectId: existing?.subjectId || '',
      employeeId: existing?.employeeId || '',
      roomNo: existing?.roomNo || '',
      subjects,
      employeesForSubject: (subjectId: string) => this.employeesForSubject(subjectId),
    };

    const ref = this.dialog.open(TimetableSlotDialogComponent, {
      data,
      panelClass: 'erp-dialog',
      width: '480px',
      disableClose: true,
    });

    ref.afterClosed().subscribe((result?: TimetableSlotDialogResult | 'clear') => {
      if (!result) return;
      if (result === 'clear') {
        this.slotMap.delete(this.cellKey(day, period.id));
      } else {
        const emp = this.employeesForSubject(result.subjectId).find((e) => e.id === result.employeeId);
        const sub = subjects.find((s) => s.id === result.subjectId);
        this.slotMap.set(this.cellKey(day, period.id), {
          dayOfWeek: day,
          periodId: period.id,
          subjectId: result.subjectId || null,
          subjectName: sub?.name,
          subjectCode: sub?.code,
          employeeId: result.employeeId || null,
          employeeName: emp?.name,
          roomNo: result.roomNo || null,
        });
      }
      this.isDirty = true;
      this.dirtySlots = this.slotsFromMap();
      this.cdr.detectChanges();
    });
  }

  cellKey(day: number, periodId: string): string {
    return `${day}|${periodId}`;
  }

  getCell(day: number, periodId: string): TimetableSlotCell | undefined {
    return this.slotMap.get(this.cellKey(day, periodId));
  }

  private openDetail(mode: FormMode, versionId: string, classId: string): void {
    this.formMode = mode;
    this.selectedVersionId = versionId;
    this.editingClassId = classId;
    this.draftReady = false;
    this.showDetail = true;
    this.isDirty = false;
    this.errorMessage = '';
    this.grid = null;
    this.loadMappingsForClass(classId, this.selectedAcademicYearId);
    this.loadVersionGrid(versionId);
  }

  private confirmDelete(row: Record<string, unknown>): void {
    const id = String(row['id'] ?? '');
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete timetable version?',
        description: 'This removes the timetable version and its assigned slots.',
        recordName: String(row['className'] || 'Timetable'),
        recordMeta: `Effective ${this.formatDateLabel(String(row['effectiveFrom'] ?? ''))}`,
        initials: String(row['className'] || 'TT').substring(0, 2).toUpperCase(),
        warningMessage: 'This cannot be undone.',
        headerIcon: 'delete_outline',
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Delete',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.timetableService.deleteVersion(id).subscribe({
        next: () => {
          this.snackBar.open('Timetable version deleted', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.loadVersionList();
        },
        error: (err) => {
          this.snackBar.open(getUserFacingApiError(err, 'Failed to delete version'), 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        },
      });
    });
  }

  private loadLookups(yearId?: string): void {
    this.loading = true;
    forkJoin({
      classes: this.classService.getClassDropdown(yearId).pipe(
        catchError(() => of([] as unknown[])),
      ),
      subjects: this.subjectService.getSubjectDropdown().pipe(
        catchError(() => of([] as unknown[])),
      ),
      employees: this.employeeService.getClassTeacherDropdown().pipe(
        catchError(() => of([] as { id: string; name: string }[])),
      ),
      lookups: this.mappingService.getLookups(yearId).pipe(
        catchError(() =>
          of({
            classes: [],
            subjects: [],
            teachers: [],
            employees: [],
            academicYears: [],
            classSummaries: [],
          } satisfies MappingLookups),
        ),
      ),
      templates: this.periodTemplateService.getDropdown().pipe(
        catchError(() => of([] as { id: string; name: string }[])),
      ),
    }).subscribe({
      next: ({ classes, subjects, employees, lookups, templates }) => {
        this.classes = this.normalizeDropdownOptions(classes);
        if (!this.classes.length && lookups.classes?.length) {
          this.classes = lookups.classes;
        }

        this.lookupSubjects = this.normalizeDropdownOptions(subjects);
        if (!this.lookupSubjects.length && lookups.subjects?.length) {
          this.lookupSubjects = lookups.subjects;
        }

        this.employees = (employees || [])
          .map((e) => ({ id: e.id, name: e.name }))
          .filter((e) => e.id && e.name);
        if (!this.employees.length) {
          this.employees = lookups.employees || lookups.teachers || [];
        }

        this.periodTemplates = this.normalizeDropdownOptions(templates);

        this.syncClassFilterOptions();
        this.versionConfigs['classId'] = {
          ...this.versionConfigs['classId'],
          options: [
            { label: 'Select class', value: '' },
            ...this.classes.map((c) => ({ value: c.id, label: c.name })),
          ],
        };
        this.versionConfigs['periodTemplateId'] = {
          ...this.versionConfigs['periodTemplateId'],
          options: [
            { label: SELECT_PLACEHOLDER, value: '' },
            ...this.periodTemplates.map((t) => ({ value: t.id, label: t.name })),
          ],
        };

        // Keep only still-valid selected class ids.
        this.selectedClassIds = this.selectedClassIds.filter((id) =>
          this.classes.some((c) => c.id === id),
        );

        const currentTemplate = this.versionForm.get('periodTemplateId')?.value;
        if ((!currentTemplate || !this.periodTemplates.some((t) => t.id === currentTemplate)) && this.periodTemplates.length) {
          this.versionForm.patchValue({ periodTemplateId: this.periodTemplates[0].id });
        }

        if (this.showDetail && this.formMode === 'add') {
          const currentClassId = String(this.versionForm.get('classId')?.value ?? '');
          if (!currentClassId || !this.classes.some((c) => c.id === currentClassId)) {
            this.versionForm.patchValue({ classId: this.classes[0]?.id || '' });
          }
        }

        this.loading = false;
        if (!this.showDetail) {
          this.loadVersionList();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Failed to load lookups.';
        this.cdr.detectChanges();
      },
    });
  }

  private normalizeDropdownOptions(items: unknown): MappingLookupOption[] {
    if (!Array.isArray(items)) {
      return [];
    }
    return items
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const id = String(row['id'] ?? row['Id'] ?? '');
        const name = String(row['name'] ?? row['Name'] ?? '').trim();
        const code = row['code'] ?? row['Code'] ?? row['subjectCode'] ?? row['SubjectCode'];
        return {
          id,
          name,
          ...(code != null && String(code) ? { code: String(code) } : {}),
        };
      })
      .filter((c) => c.id && c.name);
  }

  private loadVersionList(): void {
    if (!this.selectedAcademicYearId) {
      this.versions = [];
      this.versionRows = [];
      return;
    }

    this.loading = true;
    const classIds = this.selectedClassIds.length
      ? this.selectedClassIds
      : this.classes.map((c) => c.id);

    if (!classIds.length) {
      this.versions = [];
      this.versionRows = [];
      this.loading = false;
      return;
    }

    forkJoin(
      classIds.map((classId) =>
        this.timetableService.getVersions(classId, this.selectedAcademicYearId).pipe(
          map((rows) =>
            (rows || []).map((v) => ({
              ...v,
              className: v.className || this.classes.find((c) => c.id === classId)?.name || classId,
            })),
          ),
          catchError(() => of([] as TimetableVersion[])),
        ),
      ),
    )
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (groups) => {
          const merged = groups.flat();
          merged.sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)));
          this.versions = merged;
          this.versionRows = merged.map((v) => ({
            id: v.id,
            classId: v.classId,
            className: v.className || '',
            periodTemplateId: v.periodTemplateId,
            periodTemplateName: v.periodTemplateName || '',
            effectiveFrom: v.effectiveFrom,
            effectiveFromLabel: this.formatDateLabel(v.effectiveFrom),
            isActive: v.isActive,
            academicYearId: v.academicYearId,
          }));
        },
        error: () => (this.errorMessage = 'Failed to load timetable versions.'),
      });
  }

  private loadMappingsForClass(classId?: string, academicYearId?: string): void {
    const resolvedClassId = classId || this.detailClassId;
    const resolvedYearId = academicYearId || this.detailAcademicYearId;
    if (!resolvedClassId || !resolvedYearId) {
      this.mappings = [];
      return;
    }
    this.mappingService
      .getByClass(resolvedClassId, resolvedYearId)
      .pipe(catchError(() => of([] as ClassSubjectTeacherMapping[])))
      .subscribe({
        next: (rows) => {
          this.mappings = this.normalizeMappings(rows || []);
          this.cdr.detectChanges();
        },
      });
  }

  private loadVersionGrid(timetableId: string): void {
    if (!timetableId) {
      this.errorMessage = 'Timetable id missing.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.timetableService
      .getGrid(timetableId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (g) => this.applyGrid(g),
        error: (err) => {
          this.grid = null;
          this.errorMessage = getUserFacingApiError(err, 'Failed to load timetable grid.');
          this.cdr.detectChanges();
        },
      });
  }

  private applyGrid(g: TimetableGrid): void {
    this.errorMessage = '';
    const periodsByDay =
      g.periodsByDay && Object.keys(g.periodsByDay).length
        ? g.periodsByDay
        : this.buildPeriodsByDayFromFlat(g.periods || []);
    this.grid = { ...g, periodsByDay };
    this.slotMap.clear();
    for (const slot of g.slots || []) {
      this.slotMap.set(this.cellKey(slot.dayOfWeek, slot.periodId), slot);
    }
    this.isDirty = false;
    this.dirtySlots = this.slotsFromMap();
    this.cdr.detectChanges();
  }

  private buildPeriodsByDayFromTemplate(lines: {
    id?: string;
    name: string;
    shortName: string;
    periodOrder: number;
    startTime: string;
    endTime: string;
    isBreak: boolean;
    dayOfWeek?: number | null;
  }[]): { periods: PeriodGridRow[]; periodsByDay: Record<number, PeriodGridRow[]> } {
    const toRow = (p: (typeof lines)[number]): PeriodGridRow => ({
      id: p.id || `${p.dayOfWeek ?? 'd'}-${p.periodOrder}-${p.shortName}`,
      name: p.name,
      shortName: p.shortName,
      periodOrder: p.periodOrder,
      startTime: p.startTime,
      endTime: p.endTime,
      isBreak: !!p.isBreak,
      dayOfWeek: p.dayOfWeek ?? null,
    });

    return this.splitPeriodsByDay((lines || []).map(toRow));
  }

  private buildPeriodsByDayFromFlat(periods: PeriodGridRow[]): Record<number, PeriodGridRow[]> {
    return this.splitPeriodsByDay(periods).periodsByDay;
  }

  private splitPeriodsByDay(all: PeriodGridRow[]): {
    periods: PeriodGridRow[];
    periodsByDay: Record<number, PeriodGridRow[]>;
  } {
    const defaults = all
      .filter((p) => p.dayOfWeek == null)
      .slice()
      .sort((a, b) => a.periodOrder - b.periodOrder);
    const overrideDays = new Set(
      all.filter((p) => p.dayOfWeek != null).map((p) => Number(p.dayOfWeek)),
    );
    const periodsByDay: Record<number, PeriodGridRow[]> = {};
    for (let day = 1; day <= 6; day++) {
      if (overrideDays.has(day)) {
        periodsByDay[day] = all
          .filter((p) => Number(p.dayOfWeek) === day)
          .slice()
          .sort((a, b) => a.periodOrder - b.periodOrder);
      } else {
        periodsByDay[day] = defaults.map((p) => ({ ...p }));
      }
    }
    return {
      periods: defaults.length ? defaults : all,
      periodsByDay,
    };
  }

  private syncClassFilterOptions(): void {
    this.classFilterOptions = this.classes.map((c) => ({ id: c.id, name: c.name }));
  }

  private slotsFromMap(): TimetableSlotInput[] {
    return Array.from(this.slotMap.values()).map((s) => ({
      dayOfWeek: s.dayOfWeek,
      periodId: s.periodId,
      subjectId: s.subjectId,
      employeeId: s.employeeId,
      roomNo: s.roomNo,
    }));
  }

  private normalizeMappings(rows: ClassSubjectTeacherMapping[]): ClassSubjectTeacherMapping[] {
    return rows.map((m) => ({
      ...m,
      employeeId: m.employeeId ?? m.teacherId ?? null,
      employeeName: m.employeeName ?? m.teacherName ?? null,
    }));
  }

  private uniqueSubjects(): { id: string; name: string; code?: string }[] {
    // Prefer full subject master list so timetable assign does not require Class Mapping.
    if (this.lookupSubjects.length) {
      return this.lookupSubjects.map((s) => ({ id: s.id, name: s.name, code: s.code }));
    }
    const map = new Map<string, { id: string; name: string; code?: string }>();
    for (const m of this.mappings) {
      if (!m.subjectId || map.has(m.subjectId)) continue;
      map.set(m.subjectId, {
        id: m.subjectId,
        name: m.subjectName || m.subjectId,
        code: m.subjectCode,
      });
    }
    return Array.from(map.values());
  }

  private employeesForSubject(_subjectId: string): { id: string; name: string }[] {
    // Full employee list — Class Mapping is optional for timetable assign.
    if (this.employees.length) {
      return this.employees.map((e) => ({ id: e.id, name: e.name }));
    }
    const map = new Map<string, { id: string; name: string }>();
    for (const m of this.mappings) {
      const id = m.employeeId ?? m.teacherId;
      if (!id || map.has(id)) continue;
      map.set(id, { id, name: (m.employeeName ?? m.teacherName ?? id) as string });
    }
    return Array.from(map.values());
  }

  private formatDateLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private extractTimetableId(res: unknown): string {
    if (!res || typeof res !== 'object') return '';
    const row = res as Record<string, unknown>;
    const id = row['timetableId'] ?? row['TimetableId'] ?? row['id'] ?? row['Id'];
    return id != null ? String(id) : '';
  }

  private toDateInputValue(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value.length >= 10 ? value.slice(0, 10) : value;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  }

  private buildTableConfig(): DataTableConfig {
    return applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissions,
      MenuCodes.ClassTimetable,
      this.ayContext.isReadOnlyScope(),
    );
  }
}
