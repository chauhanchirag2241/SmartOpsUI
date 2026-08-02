import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
import { TeacherMappingService } from '../../../core/services/teacher-mapping.service';
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
}

export interface AssignClassSubjectDialogData {
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  /** Class groups (id = classgroupid). */
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

  /** Selected class group ids. */
  formClassGroupIds: string[] = [];
  perGroupRows: Record<string, SubjectAssignRow[]> = {};
  activeGroupTab: string | null = null;
  formError = '';
  saving = false;

  private rowSeq = 1;
  private subjectsByGroup = new Map<string, FormFieldOption[]>();

  get classMultiOptions(): MappingOption[] {
    return (this.data.classes || []).map((c) => ({ id: c.id, name: c.name }));
  }

  get showGroupTabs(): boolean {
    return this.formClassGroupIds.length > 1;
  }

  get activeSubjectRows(): SubjectAssignRow[] {
    const key = this.activeGroupId;
    if (!key) return [];
    return this.perGroupRows[key] ?? [];
  }

  private get activeGroupId(): string | null {
    if (!this.formClassGroupIds.length) return null;
    if (this.activeGroupTab && this.formClassGroupIds.includes(this.activeGroupTab)) {
      return this.activeGroupTab;
    }
    return this.formClassGroupIds[0];
  }

  get permissionCount(): number {
    return this.formClassGroupIds.reduce(
      (sum, groupId) => sum + this.countValidRows(this.perGroupRows[groupId] ?? []),
      0,
    );
  }

  get canAssign(): boolean {
    return this.formClassGroupIds.length > 0 && this.permissionCount > 0 && !this.saving;
  }

  ngOnInit(): void {
    /* rows created when class groups are selected */
  }

  onClassGroupsChange(): void {
    this.syncPerGroupRows();
    if (!this.activeGroupTab || !this.formClassGroupIds.includes(this.activeGroupTab)) {
      this.activeGroupTab = this.formClassGroupIds[0] ?? null;
    }
    void this.ensureSubjectsLoaded().then(() => this.pruneInvalidSubjectSelections());
  }

  switchGroupTab(groupId: string): void {
    this.activeGroupTab = groupId;
    void this.ensureSubjectsLoaded().then(() => this.cdr.detectChanges());
  }

  groupTabLabel(groupId: string): string {
    return this.data.classes.find((c) => c.id === groupId)?.name ?? groupId;
  }

  addSubjectRow(): void {
    const key = this.activeGroupId;
    if (!key) return;
    const existing = this.perGroupRows[key] ?? [];
    this.perGroupRows = {
      ...this.perGroupRows,
      [key]: [...existing, this.newRow()],
    };
  }

  removeSubjectRow(rowId: number): void {
    const key = this.activeGroupId;
    if (!key) return;
    this.perGroupRows = {
      ...this.perGroupRows,
      [key]: (this.perGroupRows[key] ?? []).filter((r) => r.id !== rowId),
    };
  }

  onSubjectChange(): void {
    /* no-op: each class group keeps its own subject list */
  }

  subjectOptionsForRow(row: SubjectAssignRow): FormFieldOption[] {
    const groupId = this.activeGroupId;
    const options = groupId ? this.subjectsForGroup(groupId) : [];
    const taken = new Set(
      this.activeSubjectRows
        .filter((r) => r.id !== row.id && r.subjectId)
        .map((r) => r.subjectId),
    );
    return options.filter((opt) => !taken.has(String(opt.value)));
  }

  cancel(): void {
    this.ref.close(false);
  }

  assign(): void {
    this.formError = '';

    const mappings = this.buildMappings();
    if (!mappings.length) {
      this.formError = 'Select class groups and at least one subject.';
      return;
    }

    const missingSubjects = this.formClassGroupIds.filter((groupId) => {
      const subjectIds = (this.perGroupRows[groupId] ?? [])
        .map((r) => r.subjectId)
        .filter(Boolean);
      return subjectIds.length === 0;
    });
    if (missingSubjects.length) {
      this.formError = `Add at least one subject for: ${missingSubjects
        .map((id) => this.groupTabLabel(id))
        .join(', ')}.`;
      return;
    }

    for (const m of mappings) {
      const seen = new Set<string>();
      for (const sid of m.subjectIds) {
        if (seen.has(sid)) {
          this.formError = `Duplicate subject in ${this.groupTabLabel(m.classGroupId)}.`;
          return;
        }
        seen.add(sid);
      }
    }

    this.saving = true;
    this.mappingService
      .bulkCreate({
        employeeId: this.data.teacherId,
        academicYearId: this.data.academicYearId,
        mappings,
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

  private buildMappings(): { classGroupId: string; subjectIds: string[] }[] {
    const result: { classGroupId: string; subjectIds: string[] }[] = [];
    for (const groupId of this.formClassGroupIds) {
      const subjectIds = (this.perGroupRows[groupId] ?? [])
        .map((r) => r.subjectId)
        .filter(Boolean);
      if (!subjectIds.length) continue;
      result.push({ classGroupId: groupId, subjectIds });
    }
    return result;
  }

  private subjectsForGroup(groupId: string): FormFieldOption[] {
    return [...(this.subjectsByGroup.get(groupId) ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }

  private pruneInvalidSubjectSelections(): void {
    for (const groupId of this.formClassGroupIds) {
      const allowed = new Set(this.subjectsForGroup(groupId).map((o) => String(o.value)));
      for (const row of this.perGroupRows[groupId] ?? []) {
        if (row.subjectId && !allowed.has(row.subjectId)) {
          row.subjectId = '';
        }
      }
    }
  }

  private async ensureSubjectsLoaded(): Promise<void> {
    const groupIds = [...this.formClassGroupIds];
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

  private syncPerGroupRows(): void {
    const next: Record<string, SubjectAssignRow[]> = { ...this.perGroupRows };
    for (const groupId of this.formClassGroupIds) {
      if (!next[groupId]?.length) {
        next[groupId] = [this.newRow()];
      }
    }
    for (const key of Object.keys(next)) {
      if (!this.formClassGroupIds.includes(key)) delete next[key];
    }
    this.perGroupRows = next;
  }

  private newRow(): SubjectAssignRow {
    return { id: this.rowSeq++, subjectId: '' };
  }

  private countValidRows(rows: SubjectAssignRow[]): number {
    return rows.filter((r) => !!r.subjectId).length;
  }
}
