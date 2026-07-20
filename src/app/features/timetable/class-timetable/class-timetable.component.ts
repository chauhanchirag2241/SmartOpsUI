import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { MappingService, ClassSubjectTeacherMapping, MappingLookupOption } from '../../../core/services/mapping.service';
import {
  TimetableService,
  TimetableGrid,
  TimetableSlotCell,
  TimetableSlotInput,
  TimetableVersion,
  PeriodGridRow,
} from '../../../core/services/timetable.service';
import { ListPageHeaderComponent } from '../../../shared/components/list-page-header/list-page-header.component';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import { TimetableSlotDialogComponent, TimetableSlotDialogData, TimetableSlotDialogResult } from './timetable-slot-dialog.component';

type ViewMode = 'class' | 'teacher' | 'student';

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
    FormsModule,
    MatIconModule,
    MatDialogModule,
    ListPageHeaderComponent,
  ],
  templateUrl: './class-timetable.component.html',
  styleUrl: './class-timetable.component.css',
})
export class ClassTimetableComponent implements OnInit {
  private readonly timetableService = inject(TimetableService);
  private readonly mappingService = inject(MappingService);
  private readonly snackBar = inject(NotificationService);
  private readonly permissions = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly days = DAYS;
  viewMode: ViewMode = 'class';

  academicYears: MappingLookupOption[] = [];
  classes: MappingLookupOption[] = [];
  employees: MappingLookupOption[] = [];
  mappings: ClassSubjectTeacherMapping[] = [];

  selectedAcademicYearId = '';
  selectedClassId = '';
  selectedTeacherId = '';
  selectedStudentClassId = '';
  selectedVersionId = '';
  newEffectiveFrom = '';
  copyFromPrevious = true;

  versions: TimetableVersion[] = [];
  grid: TimetableGrid | null = null;
  slotMap = new Map<string, TimetableSlotCell>();
  dirtySlots: TimetableSlotInput[] = [];
  isDirty = false;
  loading = false;
  saving = false;
  errorMessage = '';

  get canEdit(): boolean {
    return (
      !this.ayContext.isReadOnlyScope() &&
      this.permissions.canEdit(MenuCodes.ClassTimetable) &&
      this.viewMode === 'class'
    );
  }

  get canExport(): boolean {
    return this.permissions.canExport(MenuCodes.ClassTimetable) || this.permissions.canView(MenuCodes.ClassTimetable);
  }

  get periods(): PeriodGridRow[] {
    return this.grid?.periods ?? [];
  }

  get conflicts() {
    return this.grid?.conflicts ?? [];
  }

  ngOnInit(): void {
    const today = new Date();
    this.newEffectiveFrom = today.toISOString().slice(0, 10);
    this.loadLookups(this.ayContext.effectiveYearId() ?? undefined);
  }

  loadLookups(yearId?: string): void {
    this.loading = true;
    this.mappingService.getLookups(yearId).subscribe({
      next: (lookups) => {
        this.academicYears = lookups.academicYears || [];
        this.classes = lookups.classes || [];
        this.employees = lookups.employees || lookups.teachers || [];
        this.selectedAcademicYearId =
          yearId || lookups.activeAcademicYearId || this.academicYears[0]?.id || '';
        if (!this.selectedClassId && this.classes.length) {
          this.selectedClassId = this.classes[0].id;
        }
        if (!this.selectedStudentClassId && this.classes.length) {
          this.selectedStudentClassId = this.classes[0].id;
        }
        this.loading = false;
        this.reloadCurrentView();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Failed to load lookups.';
        this.cdr.detectChanges();
      },
    });
  }

  onAcademicYearChange(): void {
    this.selectedClassId = '';
    this.selectedVersionId = '';
    this.versions = [];
    this.loadLookups(this.selectedAcademicYearId);
  }

  onClassChange(): void {
    this.selectedVersionId = '';
    this.loadClassVersionsAndGrid();
  }

  selectVersion(versionId: string): void {
    this.selectedVersionId = versionId;
    this.onVersionChange();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.reloadCurrentView();
  }

  reloadCurrentView(): void {
    this.errorMessage = '';
    if (this.viewMode === 'class') {
      this.loadClassVersionsAndGrid();
    } else if (this.viewMode === 'teacher') {
      this.loadTeacherGrid();
    } else {
      this.loadStudentGrid();
    }
  }

  loadClassVersionsAndGrid(): void {
    if (!this.selectedClassId || !this.selectedAcademicYearId) {
      this.grid = null;
      return;
    }

    this.loading = true;
    forkJoin({
      versions: this.timetableService.getVersions(this.selectedClassId, this.selectedAcademicYearId),
      mappings: this.mappingService.getByClass(this.selectedClassId, this.selectedAcademicYearId).pipe(
        catchError(() => of([] as ClassSubjectTeacherMapping[])),
      ),
    })
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: ({ versions, mappings }) => {
          this.versions = versions || [];
          this.mappings = mappings || [];
          if (!this.selectedVersionId || !this.versions.some((v) => v.id === this.selectedVersionId)) {
            this.selectedVersionId = this.versions[0]?.id || '';
          }
          if (this.selectedVersionId) {
            this.loadVersionGrid(this.selectedVersionId);
          } else {
            this.timetableService
              .getClassGrid(this.selectedClassId, this.selectedAcademicYearId)
              .subscribe({
                next: (g) => this.applyGrid(g),
                error: () => (this.errorMessage = 'Failed to load grid.'),
              });
          }
        },
        error: () => (this.errorMessage = 'Failed to load timetable versions.'),
      });
  }

  loadVersionGrid(timetableId: string): void {
    this.loading = true;
    this.timetableService
      .getGrid(timetableId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (g) => this.applyGrid(g),
        error: () => (this.errorMessage = 'Failed to load timetable grid.'),
      });
  }

  onVersionChange(): void {
    if (this.selectedVersionId) this.loadVersionGrid(this.selectedVersionId);
  }

  createVersion(): void {
    if (!this.permissions.canAdd(MenuCodes.ClassTimetable)) return;
    if (!this.selectedClassId || !this.selectedAcademicYearId || !this.newEffectiveFrom) {
      this.snackBar.open('Pehla Class select karo, ane Effective from date set karo', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    this.timetableService
      .createVersion({
        academicYearId: this.selectedAcademicYearId,
        classId: this.selectedClassId,
        effectiveFrom: this.newEffectiveFrom,
        copyFromPrevious: this.copyFromPrevious,
      })
      .subscribe({
        next: (res) => {
          this.snackBar.open('Timetable version created', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.selectedVersionId = res.timetableId;
          this.loadClassVersionsAndGrid();
        },
        error: (err) => {
          this.snackBar.open(getUserFacingApiError(err, 'Failed to create version'), 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  loadTeacherGrid(): void {
    if (!this.selectedTeacherId || !this.selectedAcademicYearId) {
      this.grid = null;
      this.slotMap.clear();
      return;
    }
    this.loading = true;
    this.timetableService
      .getTeacherGrid(this.selectedTeacherId, this.selectedAcademicYearId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (g) => this.applyGrid(g),
        error: () => (this.errorMessage = 'Failed to load teacher timetable.'),
      });
  }

  loadStudentGrid(): void {
    const classId = this.selectedStudentClassId || this.selectedClassId;
    if (!classId || !this.selectedAcademicYearId) {
      this.grid = null;
      return;
    }
    this.loading = true;
    this.timetableService
      .getClassGrid(classId, this.selectedAcademicYearId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (g) => this.applyGrid(g),
        error: () => (this.errorMessage = 'Failed to load student-class timetable.'),
      });
  }

  applyGrid(g: TimetableGrid): void {
    this.grid = g;
    this.slotMap.clear();
    for (const slot of g.slots || []) {
      this.slotMap.set(this.cellKey(slot.dayOfWeek, slot.periodId), slot);
    }
    this.isDirty = false;
    this.dirtySlots = this.slotsFromMap();
    this.cdr.detectChanges();
  }

  cellKey(day: number, periodId: string): string {
    return `${day}|${periodId}`;
  }

  getCell(day: number, periodId: string): TimetableSlotCell | undefined {
    return this.slotMap.get(this.cellKey(day, periodId));
  }

  openCell(day: number, period: PeriodGridRow): void {
    if (!this.canEdit || period.isBreak || !this.selectedVersionId) return;

    const existing = this.getCell(day, period.id);
    const subjects = this.uniqueSubjects();
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
      width: '420px',
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

  saveGrid(): void {
    if (!this.canEdit || !this.selectedVersionId) return;
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

  printGrid(): void {
    if (!this.canExport || !this.grid) return;

    const title =
      this.viewMode === 'teacher'
        ? `Teacher timetable — ${this.employees.find((e) => e.id === this.selectedTeacherId)?.name || ''}`
        : this.viewMode === 'student'
          ? `Class timetable — ${this.classes.find((c) => c.id === this.selectedStudentClassId)?.name || ''}`
          : `Class timetable — ${this.classes.find((c) => c.id === this.selectedClassId)?.name || ''}`;

    const headerCells = this.days.map((d) => `<th>${d.label}</th>`).join('');
    const rowsHtml = this.periods
      .map((p) => {
        const cells = this.days
          .map((d) => {
            if (p.isBreak) return `<td class="break">Break</td>`;
            const cell = this.getCell(d.day, p.id);
            if (!cell?.subjectName && !cell?.className) return `<td></td>`;
            const main = this.viewMode === 'teacher'
              ? `${this.escapeHtml(cell.className || '')}<br/><small>${this.escapeHtml(cell.subjectName || '')}</small>`
              : `${this.escapeHtml(cell.subjectName || '')}<br/><small>${this.escapeHtml(cell.employeeName || '')}</small>`;
            const room = cell.roomNo ? `<br/><small>Rm ${this.escapeHtml(cell.roomNo)}</small>` : '';
            return `<td>${main}${room}</td>`;
          })
          .join('');
        return `<tr><th>${this.escapeHtml(p.shortName || p.name)}<br/><small>${this.escapeHtml(p.startTime)}–${this.escapeHtml(p.endTime)}</small></th>${cells}</tr>`;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1000,height=700');
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
  <title>${this.escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #555; margin: 0 0 18px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 600; }
    td.break { background: #fafafa; color: #888; text-align: center; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  <p class="sub">SmartOps Timetable${this.grid.version?.effectiveFrom ? ` · Effective ${this.escapeHtml(String(this.grid.version.effectiveFrom).slice(0, 10))}` : ''}</p>
  <table>
    <thead><tr><th>Period</th>${headerCells}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload = function () { window.focus(); window.print(); };</script>
</body>
</html>`);
    printWindow.document.close();
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

  private uniqueSubjects(): { id: string; name: string; code?: string }[] {
    const map = new Map<string, { id: string; name: string; code?: string }>();
    for (const m of this.mappings) {
      if (!map.has(m.subjectId)) {
        map.set(m.subjectId, { id: m.subjectId, name: m.subjectName || m.subjectId, code: m.subjectCode });
      }
    }
    return Array.from(map.values());
  }

  private employeesForSubject(subjectId: string): { id: string; name: string }[] {
    return this.mappings
      .filter((m) => m.subjectId === subjectId && m.employeeId)
      .map((m) => ({ id: m.employeeId!, name: m.employeeName || m.employeeId! }));
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
