import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  AcademicCalendarService,
  CalendarEventTypeDto,
  CalendarWeekendSettingDto,
  CreateCalendarEventDto,
  CreateCalendarEventTypeDto,
  CalendarEventDto,
} from '../../core/services/academic-calendar.service';
import { ClassService } from '../../core/services/class.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { DeleteConfirmDialogComponent } from '../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import type { DeleteDialogData } from '../../shared/interfaces/delete-dialog.interface';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import {
  MonthYearPickerComponent,
  type MonthYearValue,
} from '../../shared/components/month-year-picker';
import { FormFieldComponent } from '../../shared/form-controls/form-field/form-field.component';
import { MultiSelectChipsComponent } from '../../shared/components/multi-select-chips/multi-select-chips.component';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { ColorPickerComponent } from '../../shared/components/color-picker';
import type { MappingOption } from '../../shared/mapping/mapping.types';
import { parseDateOnly, toDateOnlyString } from '../../shared/utils/date-only.util';
import { getUserFacingApiError } from '../../shared/utils/api-error.util';

interface DayCell {
  date: Date;
  key: string;
  day: number;
  otherMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: CalendarEventDto[];
}

interface ListRow {
  event: CalendarEventDto;
  dateKey: string;
  date: Date;
  kind: 'holiday' | 'event';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-academic-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    PageChromeDirective,
    MonthYearPickerComponent,
    FormFieldComponent,
    MultiSelectChipsComponent,
    ActionButtonComponent,
    ColorPickerComponent,
  ],
  templateUrl: './academic-calendar.component.html',
  styleUrl: './academic-calendar.component.css',
})
export class AcademicCalendarComponent implements OnInit {
  private readonly calendarApi = inject(AcademicCalendarService);
  private readonly classService = inject(ClassService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly notify = inject(NotificationService);
  private readonly permissions = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  readonly menuCode = MenuCodes.AcademicCalendar;
  readonly monthNames = MONTH_NAMES;
  readonly dowNames = DOW_NAMES;

  canAdd = false;
  canEdit = false;
  canDelete = false;

  viewMode: 'month' | 'list' = 'month';
  /** 1–12, same as payroll `app-month-year-picker` */
  currentMonth = new Date().getMonth() + 1;
  currentYear = new Date().getFullYear();

  filters = { weekend: true, holiday: true, event: true };

  eventTypes: CalendarEventTypeDto[] = [];
  weekend: CalendarWeekendSettingDto | null = null;
  events: CalendarEventDto[] = [];
  dayCells: DayCell[] = [];
  listRows: ListRow[] = [];
  loading = false;
  classOptions: MappingOption[] = [];
  selectedClassIds: string[] = [];
  appliesToClass = false;

  summary = { workingDays: 0, holidays: 0, events: 0, weekends: 0 };

  showEventModal = false;
  showTypesModal = false;
  showWeekendModal = false;
  eventPanelMode: 'add' | 'edit' = 'add';
  editingEventId: string | null = null;
  editingEvent: CalendarEventDto | null = null;
  editingTypeId: string | null = null;

  eventForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    eventTypeId: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    description: [''],
    appliesToStudents: [true],
    appliesToTeachers: [true],
    appliesToStaff: [true],
    isNonWorkingDay: [false],
  });

  typeForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    color: ['#639922', Validators.required],
    isNonWorkingDefault: [false],
    displayOrder: [0],
  });

  weekendForm: FormGroup = this.fb.group({
    sundayOff: [true],
    mondayOff: [false],
    tuesdayOff: [false],
    wednesdayOff: [false],
    thursdayOff: [false],
    fridayOff: [false],
    saturdayOff: [false],
  });

  ngOnInit(): void {
    this.canAdd = this.permissions.canAdd(this.menuCode);
    this.canEdit = this.permissions.canEdit(this.menuCode);
    this.canDelete = this.permissions.canDelete(this.menuCode);
    this.loadEventTypes();
    this.loadWeekendSettings();
    this.loadClassOptions();
    this.reloadMonth();

    this.eventForm.get('eventTypeId')?.valueChanges.subscribe((typeId: string) => {
      if (this.eventPanelMode === 'edit') return;
      const type = this.eventTypes.find((t) => t.id === typeId);
      if (type) {
        this.eventForm.patchValue({ isNonWorkingDay: type.isNonWorkingDefault }, { emitEvent: false });
      }
    });
  }

  get selectedType(): CalendarEventTypeDto | undefined {
    return this.eventTypes.find((t) => t.id === this.eventForm.value.eventTypeId);
  }

  /** 0–11 index for `Date` APIs */
  get monthIndex(): number {
    return this.currentMonth - 1;
  }

  changeMonth(delta: number): void {
    const d = new Date(this.currentYear, this.monthIndex + delta, 1);
    this.currentYear = d.getFullYear();
    this.currentMonth = d.getMonth() + 1;
    this.reloadMonth();
  }

  goToday(): void {
    const t = new Date();
    this.currentYear = t.getFullYear();
    this.currentMonth = t.getMonth() + 1;
    this.reloadMonth();
  }

  onPeriodChange(period: MonthYearValue): void {
    this.currentMonth = period.month;
    this.currentYear = period.year;
    this.reloadMonth();
  }

  setView(mode: 'month' | 'list'): void {
    this.viewMode = mode;
  }

  toggleFilter(key: 'weekend' | 'holiday' | 'event'): void {
    this.filters[key] = !this.filters[key];
    this.rebuildViews();
  }

  openAddForDate(key: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.canAdd) return;
    this.openAddEvent(key, key);
  }

  openEditEventBar(ev: CalendarEventDto, event: Event): void {
    event.stopPropagation();
    this.openEditEvent(ev);
  }

  openAddEntry(): void {
    if (!this.canAdd) return;
    const key = toDateOnlyString(new Date(this.currentYear, this.monthIndex, 1))!;
    this.openAddEvent(key, key);
  }

  closeEventModal(): void {
    this.showEventModal = false;
    this.editingEvent = null;
    this.appliesToClass = false;
    this.selectedClassIds = [];
  }

  onAppliesToClassChange(checked: boolean): void {
    this.appliesToClass = checked;
    if (!checked) {
      this.selectedClassIds = [];
    } else {
      this.eventForm.patchValue({ appliesToStudents: true });
    }
  }

  openTypesModal(): void {
    this.showTypesModal = true;
    this.editingTypeId = null;
    this.typeForm.reset({
      name: '',
      code: '',
      color: '#639922',
      isNonWorkingDefault: false,
      displayOrder: this.eventTypes.length + 1,
    });
  }

  closeTypesModal(): void {
    this.showTypesModal = false;
  }

  openWeekendModal(): void {
    this.showWeekendModal = true;
    if (this.weekend) {
      this.weekendForm.patchValue({
        sundayOff: this.weekend.sundayOff,
        mondayOff: this.weekend.mondayOff,
        tuesdayOff: this.weekend.tuesdayOff,
        wednesdayOff: this.weekend.wednesdayOff,
        thursdayOff: this.weekend.thursdayOff,
        fridayOff: this.weekend.fridayOff,
        saturdayOff: this.weekend.saturdayOff,
      });
    }
  }

  closeWeekendModal(): void {
    this.showWeekendModal = false;
  }

  saveEvent(): void {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      return;
    }
    const ayId = this.ayContext.effectiveYearId();
    if (!ayId) {
      this.notify.error('Select an academic year first.');
      return;
    }

    const v = this.eventForm.getRawValue();
    const startDate = String(v.startDate ?? '').slice(0, 10);
    const endDate = String(v.endDate ?? '').slice(0, 10);
    if (!startDate || !endDate) {
      this.notify.error('Please enter a date.');
      return;
    }
    if (endDate < startDate) {
      this.notify.error('End date must be on or after start date.');
      return;
    }
    if (!v.appliesToStudents && !v.appliesToTeachers && !v.appliesToStaff && !this.appliesToClass) {
      this.notify.error('Select at least one audience.');
      return;
    }
    if (this.appliesToClass && this.selectedClassIds.length === 0) {
      this.notify.error('Select at least one class.');
      return;
    }

    const type = this.eventTypes.find((t) => t.id === v.eventTypeId);
    const classIds = this.appliesToClass ? [...this.selectedClassIds] : [];
    const payload: CreateCalendarEventDto = {
      academicYearId: ayId,
      eventTypeId: v.eventTypeId,
      title: String(v.title ?? '').trim(),
      description: String(v.description ?? '').trim() || null,
      startDate,
      endDate,
      appliesToStudents: !!v.appliesToStudents || this.appliesToClass,
      appliesToTeachers: !!v.appliesToTeachers,
      appliesToStaff: !!v.appliesToStaff,
      isNonWorkingDay: !!v.isNonWorkingDay,
      color: type?.color || null,
      classIds,
    };

    const onSaved = (): void => {
      this.notify.success(this.eventPanelMode === 'edit' ? 'Event updated.' : 'Event created.');
      this.showEventModal = false;
      this.reloadMonth();
    };
    const onError = (err: unknown): void => {
      this.notify.error(getUserFacingApiError(err, 'Failed to save event.'));
    };

    if (this.eventPanelMode === 'edit' && this.editingEventId) {
      this.calendarApi.updateEvent(this.editingEventId, payload).subscribe({ next: onSaved, error: onError });
    } else {
      this.calendarApi.createEvent(payload).subscribe({ next: onSaved, error: onError });
    }
  }

  deleteCurrentEvent(): void {
    if (!this.editingEventId || !this.canDelete) return;
    const title = String(this.eventForm.value.title ?? 'Calendar entry').trim() || 'Calendar entry';
    const dateLabel = String(this.eventForm.value.startDate ?? '').slice(0, 10);
    const initials = title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0]?.toUpperCase() ?? '')
      .join('') || 'EV';

    const eventId = this.editingEventId;
    this.showEventModal = false;

    this.dialog
      .open(DeleteConfirmDialogComponent, {
        width: '420px',
        disableClose: true,
        data: {
          title: 'Delete event?',
          description: 'This removes the holiday/event from the academic calendar.',
          confirmButtonText: 'Yes, delete',
          recordName: title,
          recordMeta: dateLabel || 'Academic calendar',
          initials,
        } satisfies DeleteDialogData,
        panelClass: 'erp-dialog',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          this.showEventModal = true;
          this.editingEventId = eventId;
          this.cdr.markForCheck();
          return;
        }
        this.calendarApi.deleteEvent(eventId).subscribe({
          next: () => {
            this.notify.success('Event deleted.');
            this.editingEventId = null;
            this.reloadMonth();
          },
          error: (err: unknown) => {
            this.showEventModal = true;
            this.editingEventId = eventId;
            this.notify.error(getUserFacingApiError(err, 'Failed to delete event.'));
            this.cdr.markForCheck();
          },
        });
      });
  }

  saveType(): void {
    if (this.typeForm.invalid) {
      this.typeForm.markAllAsTouched();
      return;
    }
    const v = this.typeForm.getRawValue();
    const payload: CreateCalendarEventTypeDto = {
      name: String(v.name ?? '').trim(),
      code: String(v.code ?? '').trim().toUpperCase(),
      color: String(v.color ?? '').trim() || '#639922',
      isNonWorkingDefault: !!v.isNonWorkingDefault,
      displayOrder: Number(v.displayOrder) || 0,
    };
    const onSaved = (): void => {
      this.notify.success(this.editingTypeId ? 'Event type updated.' : 'Event type created.');
      this.editingTypeId = null;
      this.typeForm.reset({
        name: '',
        code: '',
        color: '#639922',
        isNonWorkingDefault: false,
        displayOrder: this.eventTypes.length + 1,
      });
      this.loadEventTypes();
    };
    const onError = (err: unknown): void => {
      this.notify.error(getUserFacingApiError(err, 'Failed to save event type.'));
    };
    if (this.editingTypeId) {
      this.calendarApi.updateEventType(this.editingTypeId, payload).subscribe({ next: onSaved, error: onError });
    } else {
      this.calendarApi.createEventType(payload).subscribe({ next: onSaved, error: onError });
    }
  }

  editType(type: CalendarEventTypeDto): void {
    this.editingTypeId = type.id;
    this.typeForm.patchValue({
      name: type.name,
      code: type.code,
      color: type.color,
      isNonWorkingDefault: type.isNonWorkingDefault,
      displayOrder: type.displayOrder,
    });
  }

  deleteType(type: CalendarEventTypeDto): void {
    if (!this.canDelete) return;
    const initials = (type.name || 'ET')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'ET';
    this.dialog
      .open(DeleteConfirmDialogComponent, {
        width: '420px',
        disableClose: true,
        data: {
          title: 'Delete event type?',
          description: 'Types already used by calendar entries cannot be deleted.',
          confirmButtonText: 'Yes, delete',
          recordName: type.name,
          recordMeta: type.code,
          initials,
        } satisfies DeleteDialogData,
        panelClass: 'erp-dialog',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.calendarApi.deleteEventType(type.id).subscribe({
          next: () => {
            this.notify.success('Event type deleted.');
            this.loadEventTypes();
          },
          error: (err: unknown) =>
            this.notify.error(getUserFacingApiError(err, 'Failed to delete event type.')),
        });
      });
  }

  saveWeekend(): void {
    if (!this.canEdit) return;
    this.calendarApi.upsertWeekendSettings(this.weekendForm.getRawValue()).subscribe({
      next: (saved) => {
        this.weekend = saved;
        this.notify.success('Weekend settings saved for this branch.');
        this.showWeekendModal = false;
        this.rebuildViews();
      },
      error: (err: unknown) =>
        this.notify.error(getUserFacingApiError(err, 'Failed to save weekend settings.')),
    });
  }

  eventKind(ev: CalendarEventDto): 'holiday' | 'event' {
    if (ev.isNonWorkingDay || (ev.eventTypeCode || '').toUpperCase() === 'HOLIDAY') {
      return 'holiday';
    }
    return 'event';
  }

  isExamEvent(ev: CalendarEventDto | null | undefined): boolean {
    return !!ev?.sourceExamId || (ev?.eventTypeCode || '').toUpperCase() === 'EXAM';
  }

  eventDisplayTitle(ev: CalendarEventDto): string {
    const classes = (ev.classNames ?? []).filter(Boolean);
    if (classes.length === 0) return ev.title;
    const short = classes.length <= 2 ? classes.join(', ') : `${classes.slice(0, 2).join(', ')} +${classes.length - 2}`;
    return `${ev.title} · ${short}`;
  }

  viewExamSchedule(): void {
    const examId = this.editingEvent?.sourceExamId;
    if (!examId) return;
    this.closeEventModal();
    void this.router.navigate(['/exams/schedule'], { queryParams: { examId } });
  }

  eventBarStyle(ev: CalendarEventDto): Record<string, string> {
    const kind = this.eventKind(ev);
    const bg = ev.color || (kind === 'holiday' ? '#C0392B' : '#3355A8');
    return { background: bg };
  }

  private openAddEvent(start: string, end: string): void {
    this.eventPanelMode = 'add';
    this.editingEventId = null;
    this.editingEvent = null;
    this.showEventModal = true;
    this.showTypesModal = false;
    this.showWeekendModal = false;
    this.appliesToClass = false;
    this.selectedClassIds = [];
    const defaultType =
      this.eventTypes.find((t) => t.code.toUpperCase() === 'HOLIDAY') ?? this.eventTypes[0];
    this.eventForm.reset({
      title: '',
      eventTypeId: defaultType?.id ?? '',
      startDate: start,
      endDate: end,
      description: '',
      appliesToStudents: true,
      appliesToTeachers: true,
      appliesToStaff: true,
      isNonWorkingDay: defaultType?.isNonWorkingDefault ?? true,
    });
  }

  private openEditEvent(ev: CalendarEventDto): void {
    this.eventPanelMode = 'edit';
    this.editingEventId = ev.id;
    this.editingEvent = ev;
    this.showEventModal = true;
    this.showTypesModal = false;
    this.showWeekendModal = false;
    const classIds = (ev.classIds ?? []).map(String);
    this.selectedClassIds = classIds;
    this.appliesToClass = classIds.length > 0;
    this.eventForm.patchValue({
      title: ev.title,
      eventTypeId: ev.eventTypeId,
      startDate: ev.startDate?.substring(0, 10) ?? '',
      endDate: ev.endDate?.substring(0, 10) ?? '',
      description: ev.description ?? '',
      appliesToStudents: ev.appliesToStudents,
      appliesToTeachers: ev.appliesToTeachers,
      appliesToStaff: ev.appliesToStaff,
      isNonWorkingDay: ev.isNonWorkingDay,
    });
  }

  private loadClassOptions(): void {
    this.classService.getClassDropdown().subscribe({
      next: (classes) => {
        this.classOptions = (classes ?? []).map((c: { id?: string; Id?: string; name?: string; Name?: string; className?: string }) => ({
          id: String(c.id ?? c.Id ?? ''),
          name: String(c.name ?? c.Name ?? c.className ?? ''),
        })).filter((c) => !!c.id);
        this.cdr.markForCheck();
      },
      error: () => {
        this.classOptions = [];
      },
    });
  }

  private loadEventTypes(): void {
    this.calendarApi.getEventTypes().subscribe({
      next: (types) => {
        this.eventTypes = types;
        this.cdr.markForCheck();
      },
      error: (err: unknown) =>
        this.notify.error(getUserFacingApiError(err, 'Failed to load event types.')),
    });
  }

  private loadWeekendSettings(): void {
    this.calendarApi.getWeekendSettings().subscribe({
      next: (w) => {
        this.weekend = w;
        this.rebuildViews();
      },
      error: () => {
        this.weekend = null;
      },
    });
  }

  private reloadMonth(): void {
    const from = toDateOnlyString(new Date(this.currentYear, this.monthIndex, 1))!;
    const to = toDateOnlyString(new Date(this.currentYear, this.monthIndex + 1, 0))!;
    this.loading = true;
    const ayId = this.ayContext.effectiveYearId();
    this.calendarApi.getEvents(from, to, ayId).subscribe({
      next: (events) => {
        this.events = events;
        this.loading = false;
        this.rebuildViews();
      },
      error: (err: unknown) => {
        this.loading = false;
        this.notify.error(getUserFacingApiError(err, 'Failed to load calendar events.'));
      },
    });
  }

  private rebuildViews(): void {
    this.dayCells = this.buildMonthGrid(this.currentYear, this.monthIndex);
    this.listRows = this.buildListRows();
    this.summary = this.buildSummary();
    this.cdr.markForCheck();
  }

  private buildMonthGrid(year: number, month: number): DayCell[] {
    const firstOfMonth = new Date(year, month, 1);
    const startDow = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startDow);
    const today = new Date();
    const cells: DayCell[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = toDateOnlyString(d)!;
      const dayEvents = this.eventsForDay(key).filter((e) => this.passesFilter(e));
      cells.push({
        date: d,
        key,
        day: d.getDate(),
        otherMonth: d.getMonth() !== month,
        isToday: this.isSameDate(d, today),
        isWeekend: this.isWeekendOff(d),
        events: dayEvents,
      });
    }
    return cells;
  }

  private buildListRows(): ListRow[] {
    const rows: ListRow[] = [];
    for (const ev of this.events) {
      if (!this.passesFilter(ev)) continue;
      const start = parseDateOnly(ev.startDate);
      if (!start) continue;
      if (start.getFullYear() !== this.currentYear || start.getMonth() !== this.monthIndex) {
        // still include if range overlaps month
      }
      const key = toDateOnlyString(start)!;
      rows.push({
        event: ev,
        dateKey: key,
        date: start,
        kind: this.eventKind(ev),
      });
    }
    rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return rows;
  }

  private buildSummary(): { workingDays: number; holidays: number; events: number; weekends: number } {
    const daysInMonth = new Date(this.currentYear, this.monthIndex + 1, 0).getDate();
    const holidayDays = new Set<string>();
    let holidays = 0;
    let events = 0;
    let weekendDays = 0;

    for (const ev of this.events) {
      if (this.eventKind(ev) === 'holiday') {
        holidays++;
        const start = parseDateOnly(ev.startDate);
        const end = parseDateOnly(ev.endDate || ev.startDate);
        if (start && end) {
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getFullYear() === this.currentYear && d.getMonth() === this.monthIndex) {
              holidayDays.add(toDateOnlyString(d)!);
            }
          }
        }
      } else {
        events++;
      }
    }

    for (let day = 1; day <= daysInMonth; day++) {
      if (this.isWeekendOff(new Date(this.currentYear, this.monthIndex, day))) {
        weekendDays++;
      }
    }

    const workingDays = Math.max(daysInMonth - holidayDays.size - weekendDays, 0);
    return { workingDays, holidays, events, weekends: weekendDays };
  }

  private eventsForDay(key: string): CalendarEventDto[] {
    return this.events.filter((e) => {
      const start = (e.startDate || '').substring(0, 10);
      const end = (e.endDate || e.startDate || '').substring(0, 10);
      return start <= key && end >= key;
    });
  }

  private passesFilter(ev: CalendarEventDto): boolean {
    const kind = this.eventKind(ev);
    if (kind === 'holiday') return this.filters.holiday;
    return this.filters.event;
  }

  private isWeekendOff(date: Date): boolean {
    if (!this.filters.weekend) return false;
    const dow = date.getDay();
    if (!this.weekend) return dow === 0;
    switch (dow) {
      case 0: return this.weekend.sundayOff;
      case 1: return this.weekend.mondayOff;
      case 2: return this.weekend.tuesdayOff;
      case 3: return this.weekend.wednesdayOff;
      case 4: return this.weekend.thursdayOff;
      case 5: return this.weekend.fridayOff;
      case 6: return this.weekend.saturdayOff;
      default: return false;
    }
  }

  private isSameDate(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
}
