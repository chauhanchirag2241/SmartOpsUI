import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  forwardRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DatePicker } from 'primeng/datepicker';

export interface MonthYearValue {
  month: number;
  year: number;
}

function toPickerDate(month: number, year: number): Date {
  const m = Math.min(12, Math.max(1, month || 1));
  const y = year || new Date().getFullYear();
  return new Date(y, m - 1, 1);
}

function fromPickerDate(value: Date | null | undefined): MonthYearValue | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return { month: value.getMonth() + 1, year: value.getFullYear() };
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Component({
  selector: 'app-month-year-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, DatePicker],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MonthYearPickerComponent),
      multi: true,
    },
  ],
  templateUrl: './month-year-picker.component.html',
  styleUrl: './month-year-picker.component.css',
})
export class MonthYearPickerComponent implements OnChanges, ControlValueAccessor {
  /** 1–12 */
  @Input() month = new Date().getMonth() + 1;
  @Input() year = new Date().getFullYear();
  @Input() label = 'Month / Year';
  @Input() placeholder = 'Select month';
  @Input() disabled = false;
  /** `field` for forms, `filter` for table filter panels */
  @Input() appearance: 'field' | 'filter' = 'field';
  @Input() inputId = 'month-year-picker';
  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;
  @Input() showLabel = true;

  @Output() monthChange = new EventEmitter<number>();
  @Output() yearChange = new EventEmitter<number>();
  @Output() periodChange = new EventEmitter<MonthYearValue>();

  pickerDate: Date = toPickerDate(this.month, this.year);

  private onChange: (value: MonthYearValue | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private cvaDisabled = false;

  get isDisabled(): boolean {
    return this.disabled || this.cvaDisabled;
  }

  get displayLabel(): string {
    const idx = this.month - 1;
    const name = MONTH_LABELS[idx] ?? '';
    return name ? `${name} ${this.year}` : this.placeholder;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['month'] || changes['year']) {
      this.syncPickerFromInputs();
    }
  }

  writeValue(obj: MonthYearValue | Date | null): void {
    if (obj instanceof Date) {
      const parsed = fromPickerDate(obj);
      if (parsed) {
        this.month = parsed.month;
        this.year = parsed.year;
      }
    } else if (obj && typeof obj.month === 'number' && typeof obj.year === 'number') {
      this.month = obj.month;
      this.year = obj.year;
    }
    this.syncPickerFromInputs();
  }

  registerOnChange(fn: (value: MonthYearValue | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled = isDisabled;
  }

  onPickerModelChange(value: Date | null): void {
    const parsed = fromPickerDate(value);
    if (!parsed) return;
    this.applyPeriod(parsed.month, parsed.year);
  }

  onPickerSelect(): void {
    this.onTouched();
  }

  private applyPeriod(month: number, year: number): void {
    const changed = this.month !== month || this.year !== year;
    this.month = month;
    this.year = year;
    this.pickerDate = toPickerDate(month, year);
    if (!changed) return;

    this.monthChange.emit(month);
    this.yearChange.emit(year);
    const value: MonthYearValue = { month, year };
    this.periodChange.emit(value);
    this.onChange(value);
  }

  private syncPickerFromInputs(): void {
    this.pickerDate = toPickerDate(this.month, this.year);
  }
}
