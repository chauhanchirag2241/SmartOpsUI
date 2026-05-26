import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize, forkJoin } from 'rxjs';

import {
  ClassMappingSummary,
  ClassSubjectTeacherMapping,
  MappingLookupOption,
  MappingService,
} from '../../core/services/mapping.service';
import { PermissionService } from '../../core/services/permission.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { ListPageHeaderComponent } from '../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../shared/components/page-toolbar/page-toolbar.component';

type ClassFilter = 'all' | 'mapped' | 'unmapped';

const SUBJECT_TAG_CLASSES = ['st-blue', 'st-purple', 'st-green', 'st-amber', 'st-pink'];

@Component({
  selector: 'app-class-subject-teacher-mapping',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, ListPageHeaderComponent, PageToolbarComponent],
  templateUrl: './class-subject-teacher-mapping.component.html',
  styleUrl: './class-subject-teacher-mapping.component.css',
})
export class ClassSubjectTeacherMappingComponent implements OnInit {
  private readonly mappingService = inject(MappingService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly permissionService = inject(PermissionService);

  get canEdit(): boolean {
    return this.permissionService.canEdit(MenuCodes.ClassMappings);
  }

  loading = true;
  savingId: string | null = null;
  deletingId: string | null = null;
  errorMessage = '';

  academicYears: MappingLookupOption[] = [];
  subjects: MappingLookupOption[] = [];
  teachers: MappingLookupOption[] = [];
  classSummaries: ClassMappingSummary[] = [];

  selectedAcademicYearId = '';
  activeClassId = '';
  classFilter: ClassFilter = 'all';

  mappings: ClassSubjectTeacherMapping[] = [];
  subjectColorMap = new Map<string, string>();

  quickAddOpen = false;
  quickAddSubjectId = '';
  quickAddTeacherId = '';
  quickAddClassTeacher = false;

  ngOnInit(): void {
    this.loadLookups();
  }

  get filteredClasses(): ClassMappingSummary[] {
    return this.classSummaries.filter((c) => {
      if (this.classFilter === 'mapped') return c.subjectCount > 0;
      if (this.classFilter === 'unmapped') return c.subjectCount === 0;
      return true;
    });
  }

  get activeClass(): ClassMappingSummary | undefined {
    return this.classSummaries.find((c) => c.classId === this.activeClassId);
  }

  get mappedTeacherCount(): number {
    return this.mappings.filter((m) => !!m.teacherId).length;
  }

  get classTeacherCount(): number {
    return this.mappings.filter((m) => m.isClassTeacher).length;
  }

  get pendingTeacherCount(): number {
    return this.mappings.filter((m) => !m.teacherId).length;
  }

  get availableSubjectsForQuickAdd(): MappingLookupOption[] {
    const mapped = new Set(this.mappings.map((m) => m.subjectId));
    return this.subjects.filter((s) => !mapped.has(s.id));
  }

  loadLookups(academicYearId?: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.mappingService
      .getLookups(academicYearId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (data) => {
          this.academicYears = data.academicYears ?? [];
          this.subjects = data.subjects ?? [];
          this.teachers = data.teachers ?? [];
          this.classSummaries = data.classSummaries ?? [];
          this.selectedAcademicYearId =
            academicYearId ?? data.activeAcademicYearId ?? this.academicYears[0]?.id ?? '';

          if (!this.activeClassId && this.classSummaries.length > 0) {
            this.activeClassId = this.classSummaries[0].classId;
          }

          if (this.activeClassId) {
            this.loadMappingsForClass(this.activeClassId);
          }
        },
        error: (err) => {
          this.errorMessage = err?.error?.message ?? 'Failed to load mapping data';
          this.snackBar.open(this.errorMessage, 'Close', { duration: 4000, panelClass: 'snack-error' });
        },
      });
  }

  get toolbarFilterActive(): boolean {
    return this.classFilter !== 'all';
  }

  onToolbarFiltersCleared(): void {
    this.setClassFilter('all');
  }

  onAcademicYearChange(): void {
    this.activeClassId = '';
    this.mappings = [];
    this.loadLookups(this.selectedAcademicYearId || undefined);
  }

  selectClass(classId: string): void {
    this.activeClassId = classId;
    this.quickAddOpen = false;
    this.loadMappingsForClass(classId);
  }

  setClassFilter(filter: ClassFilter): void {
    this.classFilter = filter;
    const visible = this.filteredClasses;
    if (visible.length > 0 && !visible.some((c) => c.classId === this.activeClassId)) {
      this.selectClass(visible[0].classId);
    }
    this.cdr.markForCheck();
  }

  loadMappingsForClass(classId: string): void {
    if (!classId) return;

    this.mappingService.getByClass(classId, this.selectedAcademicYearId || undefined).subscribe({
      next: (rows) => {
        this.mappings = rows ?? [];
        this.buildSubjectColors();
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open('Failed to load class mappings', 'Close', { duration: 3000, panelClass: 'snack-error' });
      },
    });
  }

  private buildSubjectColors(): void {
    this.subjectColorMap.clear();
    this.mappings.forEach((row, index) => {
      if (!this.subjectColorMap.has(row.subjectId)) {
        this.subjectColorMap.set(row.subjectId, SUBJECT_TAG_CLASSES[index % SUBJECT_TAG_CLASSES.length]);
      }
    });
  }

  subjectTagClass(subjectId: string): string {
    return this.subjectColorMap.get(subjectId) ?? 'st-gray';
  }

  classBadgeLabel(summary: ClassMappingSummary): string {
    const section = summary.section?.trim();
    if (!section) return summary.className.slice(0, 3).toUpperCase();
    return `${summary.className.replace(/\s+/g, '').slice(-2)}${section}`.slice(0, 4).toUpperCase();
  }

  teacherInitials(name?: string | null): string {
    if (!name) return '';
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  onTeacherChange(row: ClassSubjectTeacherMapping, teacherId: string): void {
    if (!this.canEdit) return;

    const assignLater = !teacherId;
    this.savingId = row.id;
    this.cdr.markForCheck();

    this.mappingService
      .assignTeacher(row.id, {
        assignLater,
        teacherId: assignLater ? null : teacherId,
      })
      .pipe(
        finalize(() => {
          this.savingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => this.replaceRow(updated),
        error: (err) => {
          const msg = this.extractErrorMessage(err, 'Failed to update teacher');
          this.snackBar.open(msg, 'Close', { duration: 4000, panelClass: 'snack-error' });
          this.loadMappingsForClass(this.activeClassId);
        },
      });
  }

  onClassTeacherToggle(row: ClassSubjectTeacherMapping, checked: boolean): void {
    if (!this.canEdit) return;

    this.savingId = row.id;
    this.mappingService
      .setClassTeacher(row.id, checked)
      .pipe(
        finalize(() => {
          this.savingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (updated) => {
          this.replaceRow(updated);
          this.refreshSummaries();
        },
        error: (err) => {
          this.snackBar.open(this.extractErrorMessage(err, 'Failed to update class teacher flag'), 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
          this.loadMappingsForClass(this.activeClassId);
        },
      });
  }

  toggleQuickAdd(): void {
    this.quickAddOpen = !this.quickAddOpen;
    if (this.quickAddOpen) {
      this.quickAddSubjectId = '';
      this.quickAddTeacherId = '';
      this.quickAddClassTeacher = false;
    }
  }

  addMappingFromQuickAdd(): void {
    if (!this.canEdit || !this.activeClassId || !this.quickAddSubjectId) {
      this.snackBar.open('Please select a subject', 'Close', { duration: 3000, panelClass: 'snack-error' });
      return;
    }

    this.mappingService
      .createMapping({
        classId: this.activeClassId,
        subjectId: this.quickAddSubjectId,
        teacherId: this.quickAddTeacherId || null,
        academicYearId: this.selectedAcademicYearId || undefined,
        isClassTeacher: this.quickAddClassTeacher,
      })
      .subscribe({
        next: () => {
          this.loadMappingsForClass(this.activeClassId);
          this.toggleQuickAdd();
          this.refreshSummaries();
          this.snackBar.open('Subject mapped successfully', 'Close', { duration: 2500, panelClass: 'snack-success' });
        },
        error: (err) => {
          const msg = this.extractErrorMessage(err, 'Failed to add mapping');
          this.snackBar.open(msg, 'Close', { duration: 4000, panelClass: 'snack-error' });
        },
      });
  }

  removeMapping(row: ClassSubjectTeacherMapping): void {
    if (!this.canEdit) return;

    this.deletingId = row.id;
    this.mappingService
      .deleteMapping(row.id)
      .pipe(
        finalize(() => {
          this.deletingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.mappings = this.mappings.filter((m) => m.id !== row.id);
          this.refreshSummaries();
          this.snackBar.open('Mapping removed', 'Close', { duration: 2500, panelClass: 'snack-success' });
        },
        error: () => {
          this.snackBar.open('Failed to remove mapping', 'Close', { duration: 3000, panelClass: 'snack-error' });
        },
      });
  }

  private replaceRow(updated: ClassSubjectTeacherMapping): void {
    this.mappings = this.mappings.map((m) => (m.id === updated.id ? updated : m));
    if (updated.isClassTeacher) {
      this.mappings = this.mappings.map((m) =>
        m.id === updated.id ? m : { ...m, isClassTeacher: false }
      );
    }
    this.refreshSummaries();
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const message = record['message'] ?? record['error'] ?? record['title'];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return fallback;
  }

  private refreshSummaries(): void {
    this.mappingService.getLookups(this.selectedAcademicYearId || undefined).subscribe({
      next: (data) => {
        this.classSummaries = data.classSummaries ?? [];
        this.cdr.markForCheck();
      },
    });
  }
}
