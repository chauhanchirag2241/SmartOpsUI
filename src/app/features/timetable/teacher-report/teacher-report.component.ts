import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { MappingService } from '../../../core/services/mapping.service';
import {
  TimetableService,
  TeacherTimetableReport,
  TeacherReportDetail,
  TimetableSlotCell,
  PeriodGridRow,
} from '../../../core/services/timetable.service';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type { DataTableAction, DataTableConfig } from '../../../shared/components/smart-data-table';
import { MappingOption } from '../../../shared/mapping/mapping.types';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';

const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
];

@Component({
  selector: 'app-teacher-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MultiSelectChipsComponent,
    SmartDataTableComponent,
    PageChromeDirective,
    FormFieldComponent,
  ],
  templateUrl: './teacher-report.component.html',
  styleUrl: './teacher-report.component.css',
})
export class TeacherReportComponent implements OnInit {
  private readonly timetableService = inject(TimetableService);
  private readonly mappingService = inject(MappingService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissions = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly days = DAYS;
  readonly dayOptions: MappingOption[] = DAYS.map((d) => ({ id: String(d.day), name: d.label }));

  teacherOptions: MappingOption[] = [];
  classOptions: MappingOption[] = [];
  subjectOptions: MappingOption[] = [];

  asOf = new Date().toISOString().slice(0, 10);
  selectedTeacherIds: string[] = [];
  selectedClassIds: string[] = [];
  selectedSubjectIds: string[] = [];
  selectedDayIds: string[] = [];

  report: TeacherTimetableReport | null = null;
  summaryRows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;
  loading = false;
  focusedTeacherId = '';

  get canExport(): boolean {
    return (
      this.permissions.canExport(MenuCodes.TeacherTimetableReport) ||
      this.permissions.canView(MenuCodes.TeacherTimetableReport)
    );
  }

  get teacherDetails(): TeacherReportDetail[] {
    return this.report?.teachers ?? [];
  }

  get visibleDays(): { day: number; label: string }[] {
    if (!this.selectedDayIds.length) return this.days;
    const selected = new Set(this.selectedDayIds.map((id) => Number(id)));
    return this.days.filter((d) => selected.has(d.day));
  }

  ngOnInit(): void {
    this.tableConfig = {
      header: {
        title: 'Teacher workload',
        subtitle: 'Periods, classes, conflicts and estimated free slots',
        showAddButton: false,
      },
      columns: [
        { key: 'employeeName', label: 'Teacher', sortable: true },
        { key: 'periodsPerWeek', label: 'Periods/week', sortable: true },
        { key: 'classCount', label: 'Classes', sortable: true },
        { key: 'subjectCount', label: 'Subjects', sortable: true },
        { key: 'daysActive', label: 'Days', sortable: true },
        { key: 'roomCount', label: 'Rooms', sortable: true },
        { key: 'conflictCount', label: 'Conflicts', sortable: true },
        { key: 'estimatedFreeSlots', label: 'Est. free', sortable: true },
      ],
      actions: [{ label: 'View grid', icon: 'calendar_view_week', iconColor: '#639922' }],
      searchPlaceholder: 'Search teacher...',
      searchKeys: ['employeeName'],
      itemLabel: 'teachers',
      defaultPageSize: 25,
      filtersInPanel: false,
      showExport: this.canExport,
    };

    this.mappingService.getLookups(this.ayContext.effectiveYearId() ?? undefined).subscribe({
      next: (lookups) => {
        this.classOptions = (lookups.classes || []).map((c) => ({ id: c.id, name: c.name }));
        this.subjectOptions = (lookups.subjects || []).map((s) => ({ id: s.id, name: s.name }));
        this.teacherOptions = (lookups.employees || lookups.teachers || []).map((e) => ({
          id: e.id,
          name: e.name,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load lookups', 'Close', { duration: 3000, panelClass: 'snack-error' });
      },
    });
  }

  generate(): void {
    const academicYearId = this.ayContext.effectiveYearId();
    if (!academicYearId) {
      this.snackBar.open('Select academic year from the header', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.loading = true;
    this.timetableService
      .getTeacherReport({
        academicYearId,
        asOf: this.asOf || undefined,
        employeeIds: this.selectedTeacherIds.length ? this.selectedTeacherIds : undefined,
        classIds: this.selectedClassIds.length ? this.selectedClassIds : undefined,
        subjectIds: this.selectedSubjectIds.length ? this.selectedSubjectIds : undefined,
        daysOfWeek: this.selectedDayIds.length
          ? this.selectedDayIds.map((id) => Number(id)).filter((n) => n > 0)
          : undefined,
        includeGrids: true,
      })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          this.report = res;
          this.summaryRows = (res.summary || []).map((r) => ({ ...r }));
          if (!this.focusedTeacherId && res.teachers?.length) {
            this.focusedTeacherId = res.teachers[0].employeeId;
          }
        },
        error: (err) => {
          this.snackBar.open(getUserFacingApiError(err, 'Failed to load teacher report'), 'Close', {
            duration: 4000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  onSummaryAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    if (event.action.label === 'View grid') {
      this.focusedTeacherId = String(event.row['employeeId'] || '');
      const el = document.getElementById(`teacher-grid-${this.focusedTeacherId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  periodsFor(detail: TeacherReportDetail): PeriodGridRow[] {
    return detail.grid?.periods ?? [];
  }

  slotMapFor(detail: TeacherReportDetail): Map<string, TimetableSlotCell> {
    const map = new Map<string, TimetableSlotCell>();
    for (const s of detail.grid?.slots || []) {
      map.set(`${s.dayOfWeek}|${s.periodId}`, s);
    }
    return map;
  }

  getCell(detail: TeacherReportDetail, day: number, periodId: string): TimetableSlotCell | undefined {
    return this.slotMapFor(detail).get(`${day}|${periodId}`);
  }

  print(): void {
    if (!this.canExport || !this.report) return;

    const summaryHtml = (this.report.summary || [])
      .map(
        (r) =>
          `<tr><td>${this.esc(r.employeeName)}</td><td>${r.periodsPerWeek}</td><td>${r.classCount}</td><td>${r.subjectCount}</td><td>${r.conflictCount}</td><td>${r.estimatedFreeSlots}</td></tr>`,
      )
      .join('');

    const gridsHtml = (this.report.teachers || [])
      .map((t) => {
        const header = this.visibleDays.map((d) => `<th>${d.label}</th>`).join('');
        const rows = this.periodsFor(t)
          .map((p) => {
            const cells = this.visibleDays
              .map((d) => {
                if (p.isBreak) return `<td class="break">Break</td>`;
                const cell = this.getCell(t, d.day, p.id);
                if (!cell?.className && !cell?.subjectName) return `<td></td>`;
                return `<td>${this.esc(cell.className || '')}<br/><small>${this.esc(cell.subjectName || '')}</small>${cell.roomNo ? `<br/><small>Rm ${this.esc(cell.roomNo)}</small>` : ''}</td>`;
              })
              .join('');
            return `<tr><th>${this.esc(p.shortName || p.name)}</th>${cells}</tr>`;
          })
          .join('');
        return `<h2>${this.esc(t.employeeName)}</h2><table><thead><tr><th>Period</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join('');

    const win = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
    if (!win) {
      this.snackBar.open('Pop-up blocked. Allow pop-ups to print.', 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      return;
    }

    const asOfLabel = this.asOf || String(this.report.asOf).slice(0, 10);
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Teacher Timetable Report</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px;font-size:12px;color:#111}
h1{font-size:18px;margin:0 0 4px} .sub{color:#555;margin:0 0 16px}
h2{font-size:14px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th,td{border:1px solid #ccc;padding:6px 8px;vertical-align:top;text-align:left}
th{background:#f3f4f6} td.break{background:#fafafa;color:#888;text-align:center}
@media print{body{margin:12mm}}
</style></head><body>
<h1>Teacher Timetable Report</h1>
<p class="sub">As of ${this.esc(asOfLabel)}</p>
<h2>Workload summary</h2>
<table><thead><tr><th>Teacher</th><th>Periods</th><th>Classes</th><th>Subjects</th><th>Conflicts</th><th>Est. free</th></tr></thead>
<tbody>${summaryHtml}</tbody></table>
${gridsHtml}
<script>window.onload=function(){window.focus();window.print();};</script>
</body></html>`);
    win.document.close();
  }

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
