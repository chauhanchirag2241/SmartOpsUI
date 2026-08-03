import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../../shared/form-controls/form-field';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../../shared/mapping/mapping.types';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { SubjectService } from '../../../core/services/subject.service';
import { ClassService } from '../../../core/services/class.service';
import { EmployeeService, EmployeeDropdownItem } from '../../../core/services/employee.service';
import {
  ExamService,
  ExamListItem,
  ExamClassInfo,
  ExamScheduleItem,
  BulkExamScheduleSlot,
} from '../../../core/services/exam.service';
import { todayDateOnlyString } from '../../../shared/utils/date-only.util';

interface ScheduleSubjectRow {
  id: number;
  subjectId: string;
  examDate: string;
  startTime: string;
  endTime: string;
  invigilatorId: string;
  roomNo: string;
}

@Component({
  selector: 'app-exam-schedule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    SmartDataTableComponent,
    ActionButtonComponent,
    PageChromeDirective,
    FormFieldComponent,
    MultiSelectChipsComponent,
  ],
  templateUrl: './exam-schedule.component.html',
  styleUrl: './exam-schedule.component.css',
})
export class ExamScheduleComponent implements OnInit {
  private examService = inject(ExamService);
  private subjectService = inject(SubjectService);
  private classService = inject(ClassService);
  private employeeService = inject(EmployeeService);
  private snackBar = inject(NotificationService);
  private dialog = inject(MatDialog);
  private permissions = inject(PermissionService);
  private ayContext = inject(AcademicYearContextService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  exams: ExamListItem[] = [];
  employees: EmployeeDropdownItem[] = [];
  /** Subjects keyed by class group id. */
  private subjectsByGroup = new Map<string, FormFieldOption[]>();
  /** Flat schedule slots (for export / edit). */
  private scheduleSlots: ExamScheduleItem[] = [];
  /** Parent rows for expandable table (one per class). */
  rows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  selectedExamId = '';
  selectedClassIds: string[] = [];

  showForm = false;
  formMode: 'add' | 'edit' = 'add';
  editingId: string | null = null;
  formError = '';
  saving = false;

  // Shared / edit fields
  formExamId = '';
  formClassId = '';
  formSubjectId = '';
  formExamDate = '';
  formStartTime = '';
  formEndTime = '';
  formRoomNo = '';
  formInvigilatorId = '';

  // Bulk add
  formClassIds: string[] = [];
  sameTimetableForAll = true;
  uniformRows: ScheduleSubjectRow[] = [];
  perClassRows: Record<string, ScheduleSubjectRow[]> = {};
  perGroupRows: Record<string, ScheduleSubjectRow[]> = {};
  activeClassTab: string | null = null;
  activeGroupTab: string | null = null;
  private rowSeq = 1;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Exam Schedule',
      subtitle: 'Expand an exam to see class-wise subject timetable',
      showAddButton: true,
      addButtonText: 'Schedule exam',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'examName', label: 'Exam', sortable: true, toggleable: false },
      { key: 'examGroupName', label: 'Group', sortable: true },
      { key: 'classCountLabel', label: 'Classes', sortable: false },
      { key: 'slotCountLabel', label: 'Subjects', sortable: false },
      { key: 'dateRangeLabel', label: 'Dates', sortable: false },
    ],
    actions: [],
    expandableRows: true,
    expandRowKey: 'examId',
    expandAccordion: false,
    filtersInPanel: true,
    searchPlaceholder: 'Search exam, class or subject...',
    searchKeys: ['examName', 'examGroupName', 'classSearch', 'subjectSearch'],
    itemLabel: 'exams',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    selectable: false,
    showExport: true,
  };

  get canEditSchedule(): boolean {
    return this.permissions.canEdit(MenuCodes.ExamSchedule) && !this.ayContext.isReadOnlyScope();
  }

  get canDeleteSchedule(): boolean {
    return this.permissions.canDelete(MenuCodes.ExamSchedule) && !this.ayContext.isReadOnlyScope();
  }

  get selectedExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.selectedExamId);
  }

  get examClasses(): ExamClassInfo[] {
    return this.selectedExam?.classes ?? [];
  }

  get formExam(): ExamListItem | undefined {
    return this.exams.find((e) => e.id === this.formExamId);
  }

  get formExamClasses(): ExamClassInfo[] {
    return this.formExam?.classes ?? [];
  }

  get examOptions(): FormFieldOption[] {
    return this.exams.map((e) => ({
      label: `${e.name} (${e.examGroupName})`,
      value: e.id,
    }));
  }

  get examClassOptions(): FormFieldOption[] {
    return this.examClasses.map((c) => ({ label: c.className, value: c.classId }));
  }

  /** Class multi-select options for the list filter panel. */
  get filterClassMultiOptions(): MappingOption[] {
    const source = this.selectedExamId
      ? this.examClasses
      : this.exams.flatMap((e) => e.classes ?? []);
    const map = new Map<string, string>();
    for (const c of source) {
      if (!c?.classId) continue;
      map.set(c.classId, c.className || c.classId);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get formExamClassOptions(): FormFieldOption[] {
    return this.formExamClasses.map((c) => ({ label: c.className, value: c.classId }));
  }

  get formClassMultiOptions(): MappingOption[] {
    return this.formExamClasses.map((c) => ({ id: c.classId, name: c.className }));
  }

  /** Selected exam classes currently checked in the bulk form. */
  get selectedFormClasses(): ExamClassInfo[] {
    const set = new Set(this.formClassIds);
    return this.formExamClasses.filter((c) => set.has(c.classId));
  }

  get selectedClassGroupIds(): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const c of this.selectedFormClasses) {
      const gid = String(c.classGroupId || '').trim();
      if (!gid || seen.has(gid)) continue;
      seen.add(gid);
      ids.push(gid);
    }
    return ids;
  }

  /** Different class groups → group tabs (no “same timetable”). */
  get hasMultipleClassGroups(): boolean {
    return this.selectedClassGroupIds.length > 1;
  }

  /** Same class group, multiple sections → allow “same timetable for all”. */
  get canUseSameTimetableToggle(): boolean {
    return !this.hasMultipleClassGroups && this.formClassIds.length > 1;
  }

  get activeClassGroupId(): string | null {
    if (this.formMode === 'edit') {
      return this.classGroupIdForClass(this.formClassId);
    }
    if (this.hasMultipleClassGroups) {
      return this.activeGroupTab;
    }
    return this.selectedClassGroupIds[0] ?? null;
  }

  get subjectOptions(): FormFieldOption[] {
    const groupId = this.activeClassGroupId;
    if (!groupId) return [];
    return this.subjectsByGroup.get(groupId) ?? [];
  }

  /** Subjects already picked in other rows of the active timetable are hidden. */
  subjectOptionsForRow(row: ScheduleSubjectRow): FormFieldOption[] {
    const taken = new Set(
      this.activeSubjectRows
        .filter((r) => r.id !== row.id && r.subjectId)
        .map((r) => r.subjectId),
    );
    return this.subjectOptions.filter((opt) => !taken.has(String(opt.value)));
  }

  get employeeOptions(): FormFieldOption[] {
    return this.employees.map((e) => ({ label: e.name, value: e.id }));
  }

  get activeSubjectRows(): ScheduleSubjectRow[] {
    if (this.hasMultipleClassGroups) {
      if (!this.activeGroupTab) return [];
      return this.perGroupRows[this.activeGroupTab] ?? [];
    }
    if (this.sameTimetableForAll || this.formClassIds.length <= 1) return this.uniformRows;
    if (!this.activeClassTab) return [];
    return this.perClassRows[this.activeClassTab] ?? [];
  }

  get bulkSlotCount(): number {
    if (!this.formClassIds.length) return 0;
    if (this.hasMultipleClassGroups) {
      return this.selectedClassGroupIds.reduce((sum, groupId) => {
        const classCount = this.formClassIdsForGroup(groupId).length;
        return sum + this.countValidRows(this.perGroupRows[groupId] ?? []) * classCount;
      }, 0);
    }
    if (this.sameTimetableForAll || this.formClassIds.length <= 1) {
      return this.countValidRows(this.uniformRows) * this.formClassIds.length;
    }
    return this.formClassIds.reduce(
      (sum, classId) => sum + this.countValidRows(this.perClassRows[classId] ?? []),
      0,
    );
  }

  get canCreateBulk(): boolean {
    return !!this.formExamId && this.formClassIds.length > 0 && this.bulkSlotCount > 0;
  }

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissions,
      MenuCodes.ExamSchedule,
      this.ayContext.isReadOnlyScope(),
    );

    const examIdFromQuery = String(this.route.snapshot.queryParamMap.get('examId') ?? '').trim();
    if (examIdFromQuery) {
      this.selectedExamId = examIdFromQuery;
    }

    this.examService.getExams().subscribe({
      next: (exams) => {
        this.exams = exams ?? [];
        if (this.selectedExamId && !this.exams.some((e) => e.id === this.selectedExamId)) {
          this.selectedExamId = '';
        }
        this.refreshList();
        this.cdr.detectChanges();
      },
      error: () =>
        this.snackBar.open('Failed to load exams', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
    this.employeeService.getClassTeacherDropdown().subscribe({
      next: (employees) => {
        this.employees = employees ?? [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.employees = [];
        this.cdr.detectChanges();
      },
    });
  }

  onFilterExamChange(): void {
    const allowed = new Set(this.filterClassMultiOptions.map((c) => c.id));
    this.selectedClassIds = this.selectedClassIds.filter((id) => allowed.has(id));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { examId: this.selectedExamId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.refreshList();
  }

  onFilterClassesChange(): void {
    this.refreshList();
  }

  onExamChange(): void {
    this.refreshList();
  }

  onFormExamChange(): void {
    if (this.formMode === 'edit') {
      const classes = this.formExamClasses;
      this.formClassId = classes[0]?.classId ?? '';
      this.formExamDate =
        this.formExamDate || todayDateOnlyString();
      void this.ensureSubjectsLoaded([this.classGroupIdForClass(this.formClassId)].filter(Boolean) as string[]);
      return;
    }

    const classes = this.formExamClasses;
    const preferred =
      this.selectedClassIds.length &&
      this.selectedClassIds.every((id) => classes.some((c) => c.classId === id))
        ? this.selectedClassIds.slice()
        : classes.map((c) => c.classId);
    this.formClassIds = preferred.slice();
    this.seedDefaultDateOnRows();
    this.applyClassSelectionMode();
  }

  onBulkClassesChange(): void {
    this.applyClassSelectionMode();
  }

  onEditClassChange(): void {
    const groupId = this.classGroupIdForClass(this.formClassId);
    void this.ensureSubjectsLoaded(groupId ? [groupId] : []);
    // Drop subject if it does not belong to the new class group.
    if (this.formSubjectId && groupId) {
      const opts = this.subjectsByGroup.get(groupId) ?? [];
      if (!opts.some((o) => String(o.value) === this.formSubjectId)) {
        this.formSubjectId = '';
      }
    }
  }

  toggleSameTimetable(): void {
    if (!this.canUseSameTimetableToggle) return;
    this.sameTimetableForAll = !this.sameTimetableForAll;
    if (!this.sameTimetableForAll) {
      this.syncPerClassRows(true);
      this.activeClassTab = this.formClassIds[0] ?? null;
    }
  }

  switchClassTab(classId: string): void {
    this.activeClassTab = classId;
  }

  switchGroupTab(groupId: string): void {
    this.activeGroupTab = groupId;
  }

  classTabLabel(classId: string): string {
    return this.formExamClasses.find((c) => c.classId === classId)?.className ?? classId;
  }

  groupTabLabel(groupId: string): string {
    const cls = this.formExamClasses.find((c) => c.classGroupId === groupId);
    return cls?.classGroupName || cls?.className || groupId;
  }

  addSubjectRow(): void {
    const row = this.newSubjectRow();
    if (this.hasMultipleClassGroups) {
      if (!this.activeGroupTab) return;
      const existing = this.perGroupRows[this.activeGroupTab] ?? [];
      this.perGroupRows = {
        ...this.perGroupRows,
        [this.activeGroupTab]: [...existing, row],
      };
      return;
    }
    if (this.sameTimetableForAll || this.formClassIds.length <= 1) {
      this.uniformRows = [...this.uniformRows, row];
      return;
    }
    if (!this.activeClassTab) return;
    const existing = this.perClassRows[this.activeClassTab] ?? [];
    this.perClassRows = {
      ...this.perClassRows,
      [this.activeClassTab]: [...existing, row],
    };
  }

  removeSubjectRow(rowId: number): void {
    if (this.hasMultipleClassGroups) {
      if (!this.activeGroupTab) return;
      this.perGroupRows = {
        ...this.perGroupRows,
        [this.activeGroupTab]: (this.perGroupRows[this.activeGroupTab] ?? []).filter(
          (r) => r.id !== rowId,
        ),
      };
      return;
    }
    if (this.sameTimetableForAll || this.formClassIds.length <= 1) {
      this.uniformRows = this.uniformRows.filter((r) => r.id !== rowId);
      return;
    }
    if (!this.activeClassTab) return;
    this.perClassRows = {
      ...this.perClassRows,
      [this.activeClassTab]: (this.perClassRows[this.activeClassTab] ?? []).filter(
        (r) => r.id !== rowId,
      ),
    };
  }

  copyActiveTabToAll(): void {
    if (this.hasMultipleClassGroups) {
      if (!this.activeGroupTab) return;
      const source = this.perGroupRows[this.activeGroupTab] ?? [];
      const next: Record<string, ScheduleSubjectRow[]> = { ...this.perGroupRows };
      for (const groupId of this.selectedClassGroupIds) {
        if (groupId === this.activeGroupTab) continue;
        // Only copy structure if target group shares no subject constraint — skip copy across groups.
        next[groupId] = source.map((r) => ({
          ...r,
          id: this.rowSeq++,
          subjectId: '',
        }));
      }
      this.perGroupRows = next;
      this.snackBar.open('Dates/times copied to other class groups (pick subjects per group)', 'Close', {
        duration: 2800,
        panelClass: 'snack-success',
      });
      return;
    }
    if (!this.activeClassTab || this.sameTimetableForAll) return;
    const source = this.perClassRows[this.activeClassTab] ?? [];
    const next: Record<string, ScheduleSubjectRow[]> = { ...this.perClassRows };
    for (const classId of this.formClassIds) {
      if (classId === this.activeClassTab) continue;
      next[classId] = source.map((r) => ({ ...r, id: this.rowSeq++ }));
    }
    this.perClassRows = next;
    this.snackBar.open("Timetable copied to all other selected classes", 'Close', {
      duration: 2500,
      panelClass: 'snack-success',
    });
  }

  loadSchedules(): void {
    this.refreshList();
  }

  refreshList(): void {
    this.examService.getSchedules(this.selectedExamId || undefined).subscribe({
      next: (schedules) => {
        let slots = (schedules ?? []).map((item: ExamScheduleItem) => ({
          ...item,
          status: item.status || this.deriveSlotStatus(item),
        }));

        if (this.selectedClassIds.length) {
          const classSet = new Set(this.selectedClassIds);
          slots = slots.filter((s) => classSet.has(String(s.classId)));
        }

        this.scheduleSlots = slots;
        this.rows = this.buildExamRows(slots);
        this.cdr.detectChanges();
      },
      error: () => {
        this.scheduleSlots = [];
        this.rows = this.buildExamRows([]);
        this.snackBar.open('Failed to load schedule', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  slotsForExam(row: Record<string, unknown>): ExamScheduleItem[] {
    const list = row['slots'];
    return Array.isArray(list) ? (list as ExamScheduleItem[]) : [];
  }

  classGroupsForExam(row: Record<string, unknown>): {
    classId: string;
    className: string;
    slots: ExamScheduleItem[];
  }[] {
    const byClass = new Map<
      string,
      { classId: string; className: string; slots: ExamScheduleItem[] }
    >();
    for (const slot of this.slotsForExam(row)) {
      const classId = String(slot.classId ?? '');
      if (!classId) continue;
      const existing = byClass.get(classId);
      if (existing) {
        existing.slots.push(slot);
      } else {
        byClass.set(classId, {
          classId,
          className: slot.className || 'Class',
          slots: [slot],
        });
      }
    }
    return [...byClass.values()].sort((a, b) => a.className.localeCompare(b.className));
  }

  slotsForClass(row: Record<string, unknown>): ExamScheduleItem[] {
    return this.slotsForExam(row);
  }

  statusBadgeClass(status: string | undefined): string {
    switch (status) {
      case 'Today':
        return 'b-amber';
      case 'Completed':
        return 'b-green';
      default:
        return 'b-blue';
    }
  }

  formatSlotDate(value: string | undefined): string {
    if (!value) return '—';
    const iso = value.substring(0, 10);
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return value;
    return `${d}-${m}-${y}`;
  }

  editSlot(item: ExamScheduleItem): void {
    if (!this.canEditSchedule) return;
    this.formMode = 'edit';
    this.editingId = item.id;
    this.formExamId = item.examId;
    this.formClassId = item.classId;
    this.formSubjectId = item.subjectId;
    this.formExamDate = item.examDate?.substring(0, 10) ?? '';
    this.formStartTime = item.startTime ?? '';
    this.formEndTime = item.endTime ?? '';
    this.formRoomNo = item.roomNo ?? '';
    this.formInvigilatorId = item.invigilatorId ?? '';
    this.formError = '';
    this.showForm = true;
    void this.ensureSubjectsLoaded(
      [this.classGroupIdForClass(item.classId)].filter(Boolean) as string[],
    );
  }

  private buildExamRows(slots: ExamScheduleItem[]): Record<string, unknown>[] {
    const slotsByExam = new Map<string, ExamScheduleItem[]>();
    for (const slot of slots) {
      const examId = String(slot.examId ?? '');
      if (!examId) continue;
      const list = slotsByExam.get(examId) ?? [];
      list.push(slot);
      slotsByExam.set(examId, list);
    }

    let exams = this.exams.slice();
    if (this.selectedExamId) {
      exams = exams.filter((e) => e.id === this.selectedExamId);
    }

    if (this.selectedClassIds.length) {
      const classSet = new Set(this.selectedClassIds);
      exams = exams.filter((e) => {
        const hasAssigned = (e.classes ?? []).some((c) => classSet.has(c.classId));
        const hasSlots = (slotsByExam.get(e.id) ?? []).some((s) =>
          classSet.has(String(s.classId)),
        );
        return hasAssigned || hasSlots;
      });
    }

    // API already returns exams by createdOn DESC — preserve that order.
    return exams.map((exam) => {
      const examSlots = [...(slotsByExam.get(exam.id) ?? [])].sort((a, b) => {
        const dateCmp = (a.examDate || '').localeCompare(b.examDate || '');
        if (dateCmp !== 0) return dateCmp;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
      const dates = [
        ...new Set(examSlots.map((s) => s.examDate?.substring(0, 10)).filter(Boolean)),
      ] as string[];
      const dateRangeLabel =
        dates.length === 0
          ? '—'
          : dates.length === 1
            ? this.formatSlotDate(dates[0])
            : `${this.formatSlotDate(dates[0])} – ${this.formatSlotDate(dates[dates.length - 1])}`;
      const classNames = [
        ...new Set(examSlots.map((s) => s.className || '').filter(Boolean)),
      ];
      const subjectNames = examSlots.map((s) => s.subjectName || '').filter(Boolean);
      const classCount =
        classNames.length ||
        (this.selectedClassIds.length
          ? (exam.classes ?? []).filter((c) => this.selectedClassIds.includes(c.classId)).length
          : exam.classes?.length ?? 0);

      return {
        examId: exam.id,
        examName: exam.name,
        examGroupName: exam.examGroupName,
        classCount,
        classCountLabel: `${classCount} class${classCount === 1 ? '' : 'es'}`,
        slotCount: examSlots.length,
        slotCountLabel:
          examSlots.length === 0
            ? 'Not scheduled'
            : `${examSlots.length} subject${examSlots.length === 1 ? '' : 's'}`,
        dateRangeLabel,
        classSearch: classNames.join(' '),
        subjectSearch: subjectNames.join(' '),
        slots: examSlots,
      };
    });
  }

  private deriveSlotStatus(item: ExamScheduleItem): string {
    if (item.status) return item.status;
    const date = item.examDate?.substring(0, 10);
    if (!date) return 'Upcoming';
    const today = todayDateOnlyString();
    if (date < today) return 'Completed';
    if (date === today) return 'Today';
    return 'Upcoming';
  }

  timeRange(item: ExamScheduleItem): string {
    if (!item.startTime && !item.endTime) return '—';
    return `${item.startTime ?? '?'} – ${item.endTime ?? '?'}`;
  }

  onExportClicked(): void {
    if (!this.scheduleSlots.length) {
      this.snackBar.open('No schedule slots to export', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }

    const exam = this.selectedExam;
    const examTitle = exam
      ? `${exam.name} (${exam.examGroupName})`
      : this.selectedExamId
        ? 'Exam Schedule'
        : 'All exams — Schedule';
    const scheduleDates = [
      ...new Set(this.scheduleSlots.map((s) => s.examDate?.substring(0, 10)).filter(Boolean)),
    ].sort() as string[];
    const dateRange =
      scheduleDates.length === 0
        ? ''
        : scheduleDates.length === 1
          ? this.formatExportDate(scheduleDates[0])
          : `${this.formatExportDate(scheduleDates[0])} – ${this.formatExportDate(scheduleDates[scheduleDates.length - 1])}`;

    const byClass = new Map<string, ExamScheduleItem[]>();
    for (const item of this.scheduleSlots) {
      const key = this.selectedExamId
        ? item.className || 'Class'
        : `${item.examName || 'Exam'} · ${item.className || 'Class'}`;
      const list = byClass.get(key) ?? [];
      list.push(item);
      byClass.set(key, list);
    }

    const sections = [...byClass.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([className, slots]) => {
        const sorted = [...slots].sort((a, b) => {
          const dateCmp = (a.examDate || '').localeCompare(b.examDate || '');
          if (dateCmp !== 0) return dateCmp;
          return (a.startTime || '').localeCompare(b.startTime || '');
        });
        const rowsHtml = sorted
          .map(
            (s) => `
          <tr>
            <td>${this.escapeHtml(this.formatExportDate(s.examDate))}</td>
            <td>${this.escapeHtml(s.subjectName || '—')}</td>
            <td>${this.escapeHtml(this.timeRange(s))}</td>
            <td>${this.escapeHtml(s.roomNo || '—')}</td>
            <td>${this.escapeHtml(s.invigilatorName || '—')}</td>
            <td>${this.escapeHtml(String(s.maxMarks ?? '—'))}</td>
          </tr>`,
          )
          .join('');
        return `
        <section class="class-block">
          <h2>Class: ${this.escapeHtml(className)}</h2>
          <p class="meta">${sorted.length} subject(s)${dateRange ? ` · ${this.escapeHtml(dateRange)}` : ''}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Time</th>
                <th>Room</th>
                <th>Invigilator</th>
                <th>Max marks</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>`;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!printWindow) {
      this.snackBar.open('Pop-up blocked. Allow pop-ups to export PDF.', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(examTitle)} — Timetable</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #555; margin: 0 0 18px; font-size: 12px; }
    .class-block { margin-bottom: 28px; page-break-inside: avoid; }
    h2 { font-size: 14px; margin: 0 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { color: #666; margin: 0 0 8px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    @media print {
      body { margin: 12mm; }
      .class-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(examTitle)}</h1>
  <p class="sub">Class-wise exam timetable${dateRange ? ` · ${this.escapeHtml(dateRange)}` : ''}</p>
  ${sections}
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  }

  private formatExportDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value.substring(0, 10);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  onAddButtonClicked(): void {
    if (!this.exams.length) {
      this.snackBar.open('No exams available. Create an exam first.', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }
    this.formMode = 'add';
    this.editingId = null;
    this.formExamId = this.selectedExamId || this.exams[0]?.id || '';
    this.sameTimetableForAll = true;
    this.uniformRows = [this.newSubjectRow()];
    this.perClassRows = {};
    this.perGroupRows = {};
    this.formError = '';
    this.onFormExamChange();
    this.showForm = true;
  }

  onActionClicked(_event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    /* Row actions live in the expanded class detail table. */
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.formError = '';
  }

  save(): void {
    if (this.formMode === 'add') {
      this.saveBulk();
      return;
    }
    this.saveEdit();
  }

  private saveBulk(): void {
    if (!this.formExamId) {
      this.formError = 'Exam is required.';
      return;
    }
    if (!this.formClassIds.length) {
      this.formError = 'Select at least one class.';
      return;
    }

    const slots = this.buildBulkSlots();
    if (!slots.length) {
      this.formError = 'Add at least one subject with date and times.';
      return;
    }

    const timeError = slots.find(
      (s) => s.startTime && s.endTime && (s.endTime as string) <= (s.startTime as string),
    );
    if (timeError) {
      this.formError = 'End time must be after start time for every subject.';
      return;
    }

    const seen = new Set<string>();
    for (const slot of slots) {
      const key = `${slot.classId}:${slot.subjectId}`;
      if (seen.has(key)) {
        this.formError = 'Each class can only have one row per subject.';
        return;
      }
      seen.add(key);
    }

    this.saving = true;
    this.formError = '';
    this.examService
      .bulkCreateSchedules({
        examId: this.formExamId,
        slots,
      })
      .subscribe({
        next: (result) => {
          this.saving = false;
          const count = result?.createdCount ?? slots.length;
          this.snackBar.open(
            `Created ${count} exam slot(s) across ${this.formClassIds.length} class(es)`,
            'Close',
            { duration: 3000, panelClass: 'snack-success' },
          );
          this.closeForm();
          if (this.formExamId) {
            this.selectedExamId = this.formExamId;
            this.selectedClassIds = [];
          }
          this.refreshList();
        },
        error: (err) => {
          this.saving = false;
          this.formError =
            typeof err?.error === 'string' ? err.error : 'Failed to create schedule';
          this.cdr.detectChanges();
        },
      });
  }

  private saveEdit(): void {
    if (!this.formExamId) {
      this.formError = 'Exam is required.';
      return;
    }
    if (!this.formClassId) {
      this.formError = 'Class is required.';
      return;
    }
    if (!this.formSubjectId) {
      this.formError = 'Subject is required.';
      return;
    }
    if (!this.formExamDate) {
      this.formError = 'Exam date is required.';
      return;
    }
    if (this.formStartTime && this.formEndTime && this.formEndTime <= this.formStartTime) {
      this.formError = 'End time must be after start time.';
      return;
    }

    const payload = {
      examId: this.formExamId,
      classId: this.formClassId,
      subjectId: this.formSubjectId,
      examDate: this.formExamDate,
      startTime: this.formStartTime || null,
      endTime: this.formEndTime || null,
      roomNo: this.formRoomNo.trim() || null,
      invigilatorId: this.formInvigilatorId || null,
    };

    if (!this.editingId) return;

    this.saving = true;
    this.examService.updateSchedule(this.editingId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open('Schedule updated', 'Close', {
          duration: 2500,
          panelClass: 'snack-success',
        });
        this.closeForm();
        this.loadSchedules();
      },
      error: (err) => {
        this.saving = false;
        this.formError = typeof err?.error === 'string' ? err.error : 'Failed to save schedule';
        this.cdr.detectChanges();
      },
    });
  }

  deleteSchedule(item: ExamScheduleItem): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete schedule slot?',
        description: 'This exam schedule slot will be removed.',
        recordName: item.subjectName,
        recordMeta: `${item.className} · ${item.examDate?.substring(0, 10)}`,
        initials: 'SC',
        warningMessage: 'Marks entered against this slot will no longer be accessible.',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.examService.deleteSchedule(item.id).subscribe({
        next: () => {
          this.snackBar.open('Schedule slot deleted', 'Close', {
            duration: 2500,
            panelClass: 'snack-success',
          });
          this.loadSchedules();
        },
        error: (err) =>
          this.snackBar.open(
            typeof err?.error === 'string' ? err.error : 'Delete failed',
            'Close',
            { duration: 3500, panelClass: 'snack-error' },
          ),
      });
    });
  }

  private newSubjectRow(): ScheduleSubjectRow {
    const defaultDate = todayDateOnlyString();
    return {
      id: this.rowSeq++,
      subjectId: '',
      examDate: defaultDate,
      startTime: '10:00',
      endTime: '13:00',
      invigilatorId: '',
      roomNo: '',
    };
  }

  private seedDefaultDateOnRows(): void {
    const defaultDate = todayDateOnlyString();
    this.uniformRows = this.uniformRows.map((r) => ({
      ...r,
      examDate: r.examDate || defaultDate,
    }));
  }

  private syncPerClassRows(forceFromUniform = false): void {
    const next: Record<string, ScheduleSubjectRow[]> = {};
    for (const classId of this.formClassIds) {
      if (forceFromUniform || !this.perClassRows[classId]?.length) {
        next[classId] = this.uniformRows.map((r) => ({ ...r, id: this.rowSeq++ }));
      } else {
        next[classId] = this.perClassRows[classId];
      }
    }
    this.perClassRows = next;
  }

  private syncPerGroupRows(forceSeed = false): void {
    const next: Record<string, ScheduleSubjectRow[]> = {};
    for (const groupId of this.selectedClassGroupIds) {
      if (forceSeed || !this.perGroupRows[groupId]?.length) {
        const seed =
          this.uniformRows.length > 0 ? this.uniformRows : [this.newSubjectRow()];
        next[groupId] = seed.map((r) => ({
          ...r,
          id: this.rowSeq++,
          subjectId: '',
        }));
      } else {
        next[groupId] = this.perGroupRows[groupId];
      }
    }
    this.perGroupRows = next;
  }

  private applyClassSelectionMode(): void {
    void this.ensureSubjectsLoaded(this.selectedClassGroupIds);

    if (this.hasMultipleClassGroups) {
      this.sameTimetableForAll = false;
      this.syncPerGroupRows();
      if (!this.activeGroupTab || !this.selectedClassGroupIds.includes(this.activeGroupTab)) {
        this.activeGroupTab = this.selectedClassGroupIds[0] ?? null;
      }
      return;
    }

    this.activeGroupTab = null;
    if (!this.canUseSameTimetableToggle) {
      this.sameTimetableForAll = true;
    }
    this.syncPerClassRows();
    if (!this.activeClassTab || !this.formClassIds.includes(this.activeClassTab)) {
      this.activeClassTab = this.formClassIds[0] ?? null;
    }
    this.pruneInvalidSubjectSelections();
  }

  private pruneInvalidSubjectSelections(): void {
    const pruneForGroup = (groupId: string, rows: ScheduleSubjectRow[]): ScheduleSubjectRow[] => {
      const allowed = new Set(
        (this.subjectsByGroup.get(groupId) ?? []).map((o) => String(o.value)),
      );
      if (!allowed.size) return rows;
      return rows.map((r) =>
        r.subjectId && !allowed.has(r.subjectId) ? { ...r, subjectId: '' } : r,
      );
    };

    if (this.hasMultipleClassGroups) {
      const next: Record<string, ScheduleSubjectRow[]> = {};
      for (const groupId of this.selectedClassGroupIds) {
        next[groupId] = pruneForGroup(groupId, this.perGroupRows[groupId] ?? []);
      }
      this.perGroupRows = next;
      return;
    }

    const groupId = this.selectedClassGroupIds[0];
    if (!groupId) return;

    this.uniformRows = pruneForGroup(groupId, this.uniformRows);
    const nextClass: Record<string, ScheduleSubjectRow[]> = {};
    for (const [classId, rows] of Object.entries(this.perClassRows)) {
      nextClass[classId] = pruneForGroup(groupId, rows);
    }
    this.perClassRows = nextClass;
  }

  private classGroupIdForClass(classId: string): string | null {
    if (!classId) return null;
    const cls =
      this.formExamClasses.find((c) => c.classId === classId) ||
      this.examClasses.find((c) => c.classId === classId);
    const gid = String(cls?.classGroupId || '').trim();
    return gid || null;
  }

  private formClassIdsForGroup(groupId: string): string[] {
    return this.selectedFormClasses
      .filter((c) => c.classGroupId === groupId)
      .map((c) => c.classId);
  }

  private async ensureSubjectsLoaded(groupIds: string[]): Promise<void> {
    const missing = groupIds.filter((id) => id && !this.subjectsByGroup.has(id));
    if (!missing.length) {
      this.cdr.detectChanges();
      return;
    }

    await Promise.all(
      missing.map(async (groupId) => {
        try {
          const rows = await firstValueFrom(this.classService.getClassGroupSubjects(groupId));
          this.subjectsByGroup.set(groupId, this.mapSubjectOptions(rows));
        } catch {
          try {
            const res: any = await firstValueFrom(
              this.subjectService.getSubjects(1, 200, '', null, null, 'Active', groupId),
            );
            const rows = res?.items ?? res?.Items ?? [];
            this.subjectsByGroup.set(groupId, this.mapSubjectOptions(rows));
          } catch {
            this.subjectsByGroup.set(groupId, []);
          }
        }
      }),
    );

    this.pruneInvalidSubjectSelections();
    this.cdr.detectChanges();
  }

  private mapSubjectOptions(rows: any[] | null | undefined): FormFieldOption[] {
    return (rows || [])
      .map((row: any): FormFieldOption | null => {
        const id = String(
          row.subjectId ?? row.SubjectId ?? row.id ?? row.Id ?? '',
        ).trim();
        const name = String(
          row.subjectName ?? row.SubjectName ?? row.name ?? row.Name ?? '',
        ).trim();
        return id && name ? { label: name, value: id } : null;
      })
      .filter((o: FormFieldOption | null): o is FormFieldOption => o !== null);
  }

  private countValidRows(rows: ScheduleSubjectRow[]): number {
    return rows.filter((r) => r.subjectId && r.examDate && r.startTime && r.endTime).length;
  }

  private buildBulkSlots(): BulkExamScheduleSlot[] {
    const slots: BulkExamScheduleSlot[] = [];

    if (this.hasMultipleClassGroups) {
      for (const groupId of this.selectedClassGroupIds) {
        const rows = (this.perGroupRows[groupId] ?? []).filter(
          (r) => r.subjectId && r.examDate && r.startTime && r.endTime,
        );
        for (const classId of this.formClassIdsForGroup(groupId)) {
          for (const row of rows) {
            slots.push(this.toSlot(classId, row));
          }
        }
      }
      return slots;
    }

    if (this.sameTimetableForAll || this.formClassIds.length <= 1) {
      const valid = this.uniformRows.filter(
        (r) => r.subjectId && r.examDate && r.startTime && r.endTime,
      );
      for (const classId of this.formClassIds) {
        for (const row of valid) {
          slots.push(this.toSlot(classId, row));
        }
      }
      return slots;
    }

    for (const classId of this.formClassIds) {
      const rows = (this.perClassRows[classId] ?? []).filter(
        (r) => r.subjectId && r.examDate && r.startTime && r.endTime,
      );
      for (const row of rows) {
        slots.push(this.toSlot(classId, row));
      }
    }
    return slots;
  }

  private toSlot(classId: string, row: ScheduleSubjectRow): BulkExamScheduleSlot {
    return {
      classId,
      subjectId: row.subjectId,
      examDate: row.examDate,
      startTime: row.startTime || null,
      endTime: row.endTime || null,
      roomNo: row.roomNo.trim() || null,
      invigilatorId: row.invigilatorId || null,
    };
  }
}
