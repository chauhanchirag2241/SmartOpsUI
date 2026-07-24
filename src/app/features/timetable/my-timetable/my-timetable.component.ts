import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { MappingService, MappingLookupOption } from '../../../core/services/mapping.service';
import {
  TimetableService,
  TimetableGrid,
  TimetableSlotCell,
  PeriodGridRow,
  MyTimetableResponse,
} from '../../../core/services/timetable.service';
import { ListPageHeaderComponent } from '../../../shared/components/list-page-header/list-page-header.component';

const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
];

@Component({
  selector: 'app-my-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ListPageHeaderComponent, RouterLink],
  templateUrl: './my-timetable.component.html',
  styleUrl: './my-timetable.component.css',
})
export class MyTimetableComponent implements OnInit {
  private readonly timetableService = inject(TimetableService);
  private readonly mappingService = inject(MappingService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissions = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly days = DAYS;
  academicYears: MappingLookupOption[] = [];
  selectedAcademicYearId = '';
  response: MyTimetableResponse | null = null;
  slotMap = new Map<string, TimetableSlotCell>();
  loading = false;
  message = '';

  get grid(): TimetableGrid | null {
    return this.response?.grid ?? null;
  }

  get periods(): PeriodGridRow[] {
    return this.grid?.periods ?? [];
  }

  get canExport(): boolean {
    return this.permissions.canExport(MenuCodes.MyTimetable) || this.permissions.canView(MenuCodes.MyTimetable);
  }

  get canOpenTeacherReport(): boolean {
    return this.permissions.canView(MenuCodes.TeacherTimetableReport);
  }

  ngOnInit(): void {
    this.mappingService.getLookups(this.ayContext.effectiveYearId() ?? undefined).subscribe({
      next: (lookups) => {
        this.academicYears = lookups.academicYears || [];
        this.selectedAcademicYearId =
          this.ayContext.effectiveYearId() ||
          lookups.activeAcademicYearId ||
          this.academicYears[0]?.id ||
          '';
        this.loadMy();
        this.cdr.detectChanges();
      },
      error: () => {
        this.message = 'Could not load academic years.';
        this.cdr.detectChanges();
      },
    });
  }

  loadMy(): void {
    if (!this.selectedAcademicYearId) return;
    this.loading = true;
    this.timetableService
      .getMyTimetable(this.selectedAcademicYearId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => {
          this.response = res;
          this.slotMap.clear();
          for (const slot of res.grid?.slots || []) {
            this.slotMap.set(`${slot.dayOfWeek}|${slot.periodId}`, slot);
          }
          if (res.persona === 'none') {
            this.message =
              'No linked teacher or student profile found for your login. Use Class Timetable for admin views.';
          } else {
            this.message = '';
          }
        },
        error: () => {
          this.message = 'Failed to load your timetable.';
        },
      });
  }

  getCell(day: number, periodId: string): TimetableSlotCell | undefined {
    return this.slotMap.get(`${day}|${periodId}`);
  }

  printGrid(): void {
    if (!this.canExport || !this.grid) return;
    const title =
      this.response?.persona === 'teacher'
        ? 'My teaching timetable'
        : `My class timetable${this.response?.className ? ' — ' + this.response.className : ''}`;

    const headerCells = this.days.map((d) => `<th>${d.label}</th>`).join('');
    const rowsHtml = this.periods
      .map((p) => {
        const cells = this.days
          .map((d) => {
            if (p.isBreak) return `<td class="break">Break</td>`;
            const cell = this.getCell(d.day, p.id);
            if (!cell?.subjectName && !cell?.className) return `<td></td>`;
            const main =
              this.response?.persona === 'teacher'
                ? `${this.escapeHtml(cell.className || '')}<br/><small>${this.escapeHtml(cell.subjectName || '')}</small>`
                : `${this.escapeHtml(cell.subjectName || '')}<br/><small>${this.escapeHtml(cell.employeeName || '')}</small>`;
            const room = cell.roomNo ? `<br/><small>Rm ${this.escapeHtml(cell.roomNo)}</small>` : '';
            return `<td>${main}${room}</td>`;
          })
          .join('');
        return `<tr><th>${this.escapeHtml(p.shortName || p.name)}</th>${cells}</tr>`;
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
<html><head><meta charset="utf-8" /><title>${this.escapeHtml(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px;font-size:12px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:6px 8px;vertical-align:top}
th{background:#f3f4f6} td.break{background:#fafafa;color:#888;text-align:center}
</style></head><body>
<h1>${this.escapeHtml(title)}</h1>
<table><thead><tr><th>Period</th>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table>
<script>window.onload=function(){window.focus();window.print();};</script>
</body></html>`);
    printWindow.document.close();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
