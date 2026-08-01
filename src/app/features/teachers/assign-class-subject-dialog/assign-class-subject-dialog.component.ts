import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
import {
  TeacherMappingService,
} from '../../../core/services/teacher-mapping.service';
import { ErpDialogShellComponent } from '../../../shared/components/erp-dialog-shell/erp-dialog-shell.component';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../../shared/form-controls/form-field';
import { MappingOption } from '../../../shared/mapping/mapping.types';
import { FEE_HEAD_DIALOG_WIDTH } from '../../../shared/constants/dialog.constants';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';

export interface AssignClassOption {
  id: string;
  name: string;
  classGroupId?: string;
}

export interface AssignClassSubjectDialogData {
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  classes: AssignClassOption[];
}

interface SubjectAssignRow {
  id: number;
  subjectId: string;
}

@Component({
  selector: 'app-assign-class-subject-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatCheckboxModule,
    ErpDialogShellComponent,
    MultiSelectChipsComponent,
    FormFieldComponent,
  ],
  templateUrl: './assign-class-subject-dialog.component.html',
  styleUrl: './assign-class-subject-dialog.component.css',
})
export class AssignClassSubjectDialogComponent implements OnInit {
  readonly data = inject<AssignClassSubjectDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AssignClassSubjectDialogComponent, boolean>);
  private readonly classService = inject(ClassService);
  private readonly subjectService = inject(SubjectService);
  private readonly mappingService = inject(TeacherMappingService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly dialogWidth = FEE_HEAD_DIALOG_WIDTH;

  formClassIds: string[] = [];
  sameSubjectsForAll = true;
  perClassRows: Record<string, SubjectAssignRow[]> = {};
  activeClassTab: string | null = null;
  /** sectionId → class teacher flag for this employee (stored in classsettings). */
  classTeacherByClassId: Record<string, boolean> = {};
  formError = '';
  saving = false;

  private rowSeq = 1;
  private subjectsByGroup = new Map<string, FormFieldOption[]>();

  get classMultiOptions(): MappingOption[] {
    return (this.data.classes || []).map((c) => ({ id: c.id, name: c.name }));
  }

  get showClassTabs(): boolean {
    return this.formClassIds.length > 1;
  }

  get activeSubjectRows(): SubjectAssignRow[] {
    if (!this.activeClassTab) return [];
    return this.perClassRows[this.activeClassTab] ?? [];
  }

  get permissionCount(): number {
    if (!this.formClassIds.length) return 0;
    return this.formClassIds.reduce(
      (sum, classId) => sum + this.countValidRows(this.perClassRows[classId] ?? []),
      0,
    );
  }

  get canAssign(): boolean {
    return this.formClassIds.length > 0 && this.permissionCount > 0 && !this.saving;
  }

  /** Subjects are class-group-wise — same-subjects bulk only when all selected sections share one group. */
  get allSelectedShareClassGroup(): boolean {
    if (this.formClassIds.length <= 1) return this.formClassIds.length === 1;
    const groups = this.selectedClassGroupIds();
    return groups.length === 1;
  }

  get canUseSameSubjects(): boolean {
    return this.formClassIds.length > 0 && this.allSelectedShareClassGroup;
  }

  get sameSubjectsToggleHint(): string {
    if (!this.formClassIds.length) {
      return 'Turn off to edit each class separately';
    }
    if (!this.canUseSameSubjects) {
      return 'Selected classes are from different class groups — edit subjects per class tab';
    }
    if (this.sameSubjectsForAll) {
      return 'Tabs stay visible — edits on one tab auto-fill the others (you can still change per tab)';
    }
    return 'Turn on to auto-fill the same subjects across all selected sections';
  }

  /** Tab-level class teacher for the active section. */
  get showClassTeacherControl(): boolean {
    return !!this.classTeacherTargetClassId;
  }

  get classTeacherTargetClassId(): string | null {
    if (this.activeClassTab) return this.activeClassTab;
    return this.formClassIds.length === 1 ? this.formClassIds[0] : null;
  }

  get classTeacherTargetLabel(): string {
    const id = this.classTeacherTargetClassId;
    return id ? this.classTabLabel(id) : '';
  }

  get isClassTeacherForActiveClass(): boolean {
    const id = this.classTeacherTargetClassId;
    return !!id && !!this.classTeacherByClassId[id];
  }

  /** Manual copy only when same-subjects is off (when on, sync is automatic). */
  get canCopySubjectsToSiblingClasses(): boolean {
    if (this.sameSubjectsForAll || !this.activeClassTab) return false;
    const activeGroup = this.classGroupIdFor(this.activeClassTab);
    if (!activeGroup) return false;
    return this.formClassIds.some(
      (id) => id !== this.activeClassTab && this.classGroupIdFor(id) === activeGroup,
    );
  }

  ngOnInit(): void {
    /* rows created when classes are selected */
  }

  onClassesChange(): void {
    this.syncPerClassRows();
    if (!this.activeClassTab || !this.formClassIds.includes(this.activeClassTab)) {
      this.activeClassTab = this.formClassIds[0] ?? null;
    }
    this.enforceSameSubjectsModeForClassGroups();
    if (this.sameSubjectsForAll) {
      this.syncSubjectsFromActiveTab();
    }
    this.pruneClassTeacherFlags();
    void this.ensureSubjectsLoaded().then(() => this.pruneInvalidSubjectSelections());
  }

  toggleSameSubjects(): void {
    if (!this.canUseSameSubjects && !this.sameSubjectsForAll) {
      return;
    }
    if (this.sameSubjectsForAll) {
      this.sameSubjectsForAll = false;
    } else {
      if (!this.canUseSameSubjects) return;
      this.sameSubjectsForAll = true;
      this.syncSubjectsFromActiveTab();
    }
    this.pruneClassTeacherFlags();
    void this.ensureSubjectsLoaded().then(() => this.pruneInvalidSubjectSelections());
  }

  switchClassTab(classId: string): void {
    this.activeClassTab = classId;
    void this.ensureSubjectsLoaded().then(() => this.cdr.detectChanges());
  }

  classTabLabel(classId: string): string {
    return this.data.classes.find((c) => c.id === classId)?.name ?? classId;
  }

  addSubjectRow(): void {
    if (!this.activeClassTab) return;
    const existing = this.perClassRows[this.activeClassTab] ?? [];
    this.perClassRows = {
      ...this.perClassRows,
      [this.activeClassTab]: [...existing, this.newRow()],
    };
    if (this.sameSubjectsForAll) {
      this.syncSubjectsFromActiveTab();
    }
  }

  removeSubjectRow(rowId: number): void {
    if (!this.activeClassTab) return;
    this.perClassRows = {
      ...this.perClassRows,
      [this.activeClassTab]: (this.perClassRows[this.activeClassTab] ?? []).filter(
        (r) => r.id !== rowId,
      ),
    };
    if (this.sameSubjectsForAll) {
      this.syncSubjectsFromActiveTab();
    }
  }

  onSubjectChange(): void {
    if (this.sameSubjectsForAll) {
      this.syncSubjectsFromActiveTab();
    }
  }

  copyActiveTabToAll(): void {
    this.syncSubjectsFromActiveTab();
  }

  subjectOptionsForRow(row: SubjectAssignRow): FormFieldOption[] {
    const options = this.subjectOptionsForActiveContext();
    const taken = new Set(
      this.activeSubjectRows
        .filter((r) => r.id !== row.id && r.subjectId)
        .map((r) => r.subjectId),
    );
    return options.filter((opt) => !taken.has(String(opt.value)));
  }

  onClassTeacherToggle(checked: boolean): void {
    const id = this.classTeacherTargetClassId;
    if (!id) return;
    this.classTeacherByClassId = { ...this.classTeacherByClassId, [id]: checked };
  }

  cancel(): void {
    this.ref.close(false);
  }

  assign(): void {
    this.formError = '';
    if (this.sameSubjectsForAll && !this.canUseSameSubjects) {
      this.formError =
        'Selected classes belong to different class groups. Turn off “Same subjects” and set subjects per class.';
      return;
    }

    if (this.sameSubjectsForAll) {
      this.syncSubjectsFromActiveTab();
    }

    const mappings = this.buildMappings();
    if (!mappings.length) {
      this.formError = 'Select classes and at least one subject.';
      return;
    }

    const seen = new Set<string>();
    for (const m of mappings) {
      const key = `${m.classId}:${m.subjectId}`;
      if (seen.has(key)) {
        this.formError = 'Duplicate subject for the same class.';
        return;
      }
      seen.add(key);
    }

    this.saving = true;
    this.mappingService
      .bulkCreate({
        employeeId: this.data.teacherId,
        academicYearId: this.data.academicYearId,
        mappings,
        classTeacherClassIds: this.classTeacherClassIds(),
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.ref.close(true);
        },
        error: (err) => {
          this.saving = false;
          this.formError = getUserFacingApiError(err, 'Failed to assign permissions');
          this.cdr.detectChanges();
        },
      });
  }

  private buildMappings(): { classId: string; subjectId: string }[] {
    const result: { classId: string; subjectId: string }[] = [];
    for (const classId of this.formClassIds) {
      for (const row of this.perClassRows[classId] ?? []) {
        if (!row.subjectId) continue;
        result.push({ classId, subjectId: row.subjectId });
      }
    }
    return result;
  }

  private classTeacherClassIds(): string[] {
    return this.formClassIds.filter((id) => !!this.classTeacherByClassId[id]);
  }

  private enforceSameSubjectsModeForClassGroups(): void {
    if (this.sameSubjectsForAll && !this.canUseSameSubjects) {
      this.sameSubjectsForAll = false;
    }
  }

  private pruneClassTeacherFlags(): void {
    const next: Record<string, boolean> = {};
    for (const id of this.formClassIds) {
      if (this.classTeacherByClassId[id]) next[id] = true;
    }
    this.classTeacherByClassId = next;
  }

  /** Copy active tab subject list onto every other selected section in the same class group. */
  private syncSubjectsFromActiveTab(): void {
    if (!this.activeClassTab) return;
    const activeGroup = this.classGroupIdFor(this.activeClassTab);
    const source = (this.perClassRows[this.activeClassTab] ?? []).map((r) => ({
      subjectId: r.subjectId,
    }));
    const next: Record<string, SubjectAssignRow[]> = { ...this.perClassRows };
    for (const classId of this.formClassIds) {
      if (classId === this.activeClassTab) continue;
      if (activeGroup && this.classGroupIdFor(classId) !== activeGroup) continue;
      next[classId] = source.map((r) => ({ id: this.rowSeq++, subjectId: r.subjectId }));
    }
    this.perClassRows = next;
  }

  /** Dropdown options: only the active class group's subjects. */
  private subjectOptionsForActiveContext(): FormFieldOption[] {
    const classId = this.activeClassTab ?? this.formClassIds[0];
    if (!classId) return [];
    const groupId = this.classGroupIdFor(classId);
    return groupId ? this.subjectsForGroup(groupId) : [];
  }

  private subjectsForGroup(groupId: string): FormFieldOption[] {
    return [...(this.subjectsByGroup.get(groupId) ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }

  private classGroupIdFor(classId: string): string | undefined {
    return this.data.classes.find((c) => c.id === classId)?.classGroupId;
  }

  private selectedClassGroupIds(): string[] {
    const groups = new Set<string>();
    for (const classId of this.formClassIds) {
      const groupId = this.classGroupIdFor(classId);
      if (groupId) groups.add(groupId);
    }
    return [...groups];
  }

  private pruneInvalidSubjectSelections(): void {
    for (const classId of this.formClassIds) {
      const groupId = this.classGroupIdFor(classId);
      const allowed = new Set(
        (groupId ? this.subjectsForGroup(groupId) : []).map((o) => String(o.value)),
      );
      for (const row of this.perClassRows[classId] ?? []) {
        if (row.subjectId && !allowed.has(row.subjectId)) {
          row.subjectId = '';
        }
      }
    }
  }

  private async ensureSubjectsLoaded(): Promise<void> {
    await this.resolveMissingClassGroupIds();

    const groupIds = this.selectedClassGroupIds();
    if (!groupIds.length) {
      this.cdr.detectChanges();
      return;
    }

    const missing = groupIds.filter((id) => !this.subjectsByGroup.has(id));
    if (!missing.length) {
      this.cdr.detectChanges();
      return;
    }

    await Promise.all(
      missing.map(async (groupId) => {
        try {
          const rows = await firstValueFrom(this.classService.getClassGroupSubjects(groupId));
          const options = (rows || [])
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
          this.subjectsByGroup.set(groupId, options);
        } catch {
          try {
            const res: any = await firstValueFrom(
              this.subjectService.getSubjects(1, 200, '', null, null, 'Active', groupId),
            );
            const rows = res?.items ?? res?.Items ?? [];
            const options = (rows || [])
              .map((row: any): FormFieldOption | null => {
                const id = String(row.id ?? row.Id ?? '').trim();
                const name = String(
                  row.subjectName ?? row.SubjectName ?? row.name ?? row.Name ?? '',
                ).trim();
                return id && name ? { label: name, value: id } : null;
              })
              .filter((o: FormFieldOption | null): o is FormFieldOption => o !== null);
            this.subjectsByGroup.set(groupId, options);
          } catch {
            this.subjectsByGroup.set(groupId, []);
          }
        }
      }),
    );

    this.cdr.detectChanges();
  }

  /** Class dropdown historically omitted classGroupId — resolve from class detail when missing. */
  private async resolveMissingClassGroupIds(): Promise<void> {
    const needingResolve = this.formClassIds.filter((classId) => {
      const cls = this.data.classes.find((c) => c.id === classId);
      return !!cls && !cls.classGroupId;
    });
    if (!needingResolve.length) return;

    await Promise.all(
      needingResolve.map(async (classId) => {
        try {
          const detail: any = await firstValueFrom(this.classService.getClassById(classId));
          const groupId = String(
            detail?.classGroupId ?? detail?.ClassGroupId ?? '',
          ).trim();
          const cls = this.data.classes.find((c) => c.id === classId);
          if (cls && groupId) {
            cls.classGroupId = groupId;
          }
        } catch {
          /* keep unresolved */
        }
      }),
    );
  }

  private syncPerClassRows(): void {
    const next: Record<string, SubjectAssignRow[]> = { ...this.perClassRows };
    for (const classId of this.formClassIds) {
      if (!next[classId]?.length) {
        next[classId] = [this.newRow()];
      }
    }
    for (const key of Object.keys(next)) {
      if (!this.formClassIds.includes(key)) delete next[key];
    }
    this.perClassRows = next;
  }

  private newRow(): SubjectAssignRow {
    return { id: this.rowSeq++, subjectId: '' };
  }

  private countValidRows(rows: SubjectAssignRow[]): number {
    return rows.filter((r) => !!r.subjectId).length;
  }
}
