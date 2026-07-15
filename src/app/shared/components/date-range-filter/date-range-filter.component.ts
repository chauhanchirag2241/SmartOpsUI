import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DatePicker } from 'primeng/datepicker';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  from: Date;
  to: Date;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveDateRangePreset(
  preset: DateRangePreset,
  customFrom?: Date,
  customTo?: Date,
): DateRangeValue {
  const today = startOfDay(new Date());
  switch (preset) {
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { preset, from: startOfDay(y), to: endOfDay(y) };
    }
    case 'last7': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { preset, from: startOfDay(from), to: endOfDay(today) };
    }
    case 'last30': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { preset, from: startOfDay(from), to: endOfDay(today) };
    }
    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { preset, from: startOfDay(from), to: endOfDay(today) };
    }
    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { preset, from: startOfDay(from), to: endOfDay(to) };
    }
    case 'custom': {
      const from = customFrom ? startOfDay(customFrom) : today;
      const to = customTo ? endOfDay(customTo) : endOfDay(today);
      return { preset, from, to: to < from ? endOfDay(from) : to };
    }
    case 'today':
    default:
      return { preset: 'today', from: today, to: endOfDay(today) };
  }
}

/** Inclusive day match for list filtering. */
export function isDayInDateRange(value: unknown, range: DateRangeValue): boolean {
  if (value == null || value === '') return false;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return false;
  const day = startOfDay(d).getTime();
  return day >= startOfDay(range.from).getTime() && day <= startOfDay(range.to).getTime();
}

function formatDdMmYyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DatePicker],
  template: `
    <div class="drf-wrap">
      <span class="table-filter-section-label">Date range</span>

      <div class="drf-anchor" #drfAnchor>
        <button type="button" class="drf-display" (click)="toggleList($event)">
          <span class="drf-icon" aria-hidden="true">
            <mat-icon>calendar_today</mat-icon>
          </span>
          <span class="drf-text">{{ displayLabel }}</span>
          <mat-icon class="drf-chevron">{{ listOpen ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>

        @if (listOpen) {
          <div class="drf-dropdown-row" (click)="$event.stopPropagation()">
            <div class="drf-list-panel">
              <ul class="drf-list" role="listbox">
                @for (opt of presets; track opt.id) {
                  <li>
                    <button
                      type="button"
                      class="drf-option"
                      [class.active]="draft.preset === opt.id"
                      (click)="selectPreset(opt.id)"
                    >
                      {{ opt.label }}
                    </button>
                  </li>
                }
              </ul>
            </div>

            @if (draft.preset === 'custom') {
              <div class="drf-calendar-panel">
                <p-datepicker
                  [(ngModel)]="customRange"
                  selectionMode="range"
                  [inline]="true"
                  [numberOfMonths]="2"
                  dateFormat="dd/mm/yy"
                  [showOtherMonths]="true"
                  (onSelect)="onCustomSelect()"
                />
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      z-index: 2;
    }
    .drf-wrap {
      display: grid;
      gap: 8px;
      padding: 4px 0 8px;
    }
    .drf-anchor {
      position: relative;
      display: inline-block;
      max-width: 320px;
      width: 100%;
    }
    .table-filter-section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #667085;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .drf-display {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      max-width: 320px;
      border: 1px solid #d0d5dd;
      border-radius: 8px;
      background: #fff;
      padding: 0;
      overflow: hidden;
      cursor: pointer;
      text-align: left;
      color: #344054;
      font: inherit;
      min-height: 40px;
    }
    .drf-display:hover {
      border-color: #98a2b3;
    }
    .drf-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: #f2f4f7;
      border-right: 1px solid #e4e7ec;
      flex-shrink: 0;
      color: #475467;
    }
    .drf-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .drf-text {
      flex: 1;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 4px;
    }
    .drf-chevron {
      margin-right: 8px;
      color: #98a2b3;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .drf-dropdown-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      position: absolute;
      left: 0;
      top: calc(100% - 4px);
      z-index: 30;
      overflow: visible;
    }
    .drf-list-panel {
      width: 168px;
      flex-shrink: 0;
      border: 1px solid #e4e7ec;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
      overflow: hidden;
    }
    .drf-list {
      list-style: none;
      margin: 0;
      padding: 4px 0;
      max-height: 220px;
      overflow-y: auto;
    }
    .drf-option {
      display: block;
      width: 100%;
      border: 0;
      border-bottom: 1px solid #f2f4f7;
      background: transparent;
      text-align: left;
      padding: 9px 12px;
      font-size: 0.8125rem;
      color: #344054;
      cursor: pointer;
      font-family: inherit;
      border-radius: 0;
    }
    .drf-list li:last-child .drf-option {
      border-bottom: 0;
    }
    .drf-option:hover {
      background: #f2f4f7;
    }
    .drf-option.active {
      background: var(--primary-color, #639922);
      color: #fff;
      font-weight: 600;
    }
    .drf-calendar-panel {
      border: 1px solid #e4e7ec;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
      padding: 6px 8px;
      overflow: visible;
      width: auto;
      min-width: 520px;
      flex-shrink: 0;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker {
      border: 0;
      font-size: 0.75rem;
      width: 100%;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-panel {
      border: 0;
      box-shadow: none;
      padding: 0.25rem;
      gap: 0.5rem;
      overflow: visible;
      display: flex;
      flex-wrap: nowrap;
      width: 100%;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-calendar-container {
      overflow: visible;
      flex: 0 0 auto;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-calendar {
      width: auto;
      min-width: 240px;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-header {
      padding: 0.25rem 0.35rem;
      min-height: 2rem;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-title {
      font-size: 0.8rem;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-weekday,
    :host ::ng-deep .drf-calendar-panel .p-datepicker-day {
      width: 1.75rem;
      height: 1.75rem;
      font-size: 0.72rem;
      margin: 1px;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-day-selected,
    :host ::ng-deep .drf-calendar-panel .p-datepicker-day-selected-range {
      background: var(--primary-color, #639922) !important;
      color: #fff !important;
    }
    :host ::ng-deep .drf-calendar-panel .p-datepicker-day:not(.p-datepicker-day-selected):not(.p-disabled):hover {
      background: color-mix(in srgb, var(--primary-color, #639922) 14%, white);
    }
  `,
})
export class DateRangeFilterComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('drfAnchor') drfAnchor?: ElementRef<HTMLElement>;

  private readonly onDocPointerDown = (event: Event): void => {
    if (!this.listOpen) return;
    const target = event.target as Node | null;
    const anchor = this.drfAnchor?.nativeElement;
    if (target && anchor && !anchor.contains(target)) {
      this.listOpen = false;
    }
  };

  @Input() value: DateRangeValue = resolveDateRangePreset('thisMonth');
  @Output() valueChange = new EventEmitter<DateRangeValue>();

  /** Draft selection until modal Apply commits. */
  draft: DateRangeValue = resolveDateRangePreset('thisMonth');
  listOpen = false;
  customRange: Date[] | null = null;

  readonly presets: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7', label: 'Last 7 Days' },
    { id: 'last30', label: 'Last 30 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'custom', label: 'Custom Range' },
  ];

  get displayLabel(): string {
    return `${formatDdMmYyyy(this.draft.from)} to ${formatDdMmYyyy(this.draft.to)}`;
  }

  ngOnInit(): void {
    this.syncFromCommitted();
    // Capture phase so Filter modal stopPropagation still lets outside-close work.
    document.addEventListener('pointerdown', this.onDocPointerDown, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('pointerdown', this.onDocPointerDown, true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      this.syncFromCommitted();
    }
  }

  toggleList(event?: Event): void {
    event?.stopPropagation();
    this.listOpen = !this.listOpen;
  }

  selectPreset(preset: DateRangePreset): void {
    if (preset === 'custom') {
      this.draft = { ...this.draft, preset: 'custom' };
      this.customRange = [startOfDay(this.draft.from), startOfDay(this.draft.to)];
      this.listOpen = true;
      return;
    }
    this.draft = resolveDateRangePreset(preset);
    this.customRange = null;
    this.listOpen = false;
  }

  onCustomSelect(): void {
    const from = this.customRange?.[0];
    const to = this.customRange?.[1] ?? from;
    if (!from) return;
    this.draft = resolveDateRangePreset('custom', from, to ?? from);
  }

  /** Call when filter popup opens — reset draft; keep list closed. */
  beginEdit(): void {
    this.syncFromCommitted();
    this.listOpen = false;
  }

  /** Commit draft via popup Apply. */
  commit(): void {
    this.value = { ...this.draft };
    this.valueChange.emit(this.value);
    this.listOpen = false;
  }

  /** Discard draft on Close / backdrop. */
  discard(): void {
    this.syncFromCommitted();
    this.listOpen = false;
  }

  /** Clear all → This Month draft. */
  resetDraftToDefault(): void {
    this.draft = resolveDateRangePreset('thisMonth');
    this.customRange = null;
    this.listOpen = false;
  }

  closeList(): void {
    this.listOpen = false;
  }

  private syncFromCommitted(): void {
    this.draft = { ...this.value };
    if (this.draft.preset === 'custom') {
      this.customRange = [startOfDay(this.draft.from), startOfDay(this.draft.to)];
    } else {
      this.customRange = null;
    }
  }
}
