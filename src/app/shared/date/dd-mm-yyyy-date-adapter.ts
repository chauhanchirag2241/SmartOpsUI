import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

export const DD_MM_YYYY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD-MM-YYYY',
  },
  display: {
    dateInput: 'DD-MM-YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'DD-MM-YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Injectable()
export class DdMmYyyyDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const parts = trimmed.split(/[-/]/).map(Number);
      if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
        const [day, month, year] = parts;
        return this.createDate(year, month - 1, day);
      }
    }

    return value ? new Date(value as string | number | Date) : null;
  }

  override format(date: Date, displayFormat: object): string {
    if (this.shouldUseDateOnlyFormat(displayFormat)) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}-${month}-${date.getFullYear()}`;
    }

    return super.format(date, displayFormat);
  }

  private shouldUseDateOnlyFormat(displayFormat: object): boolean {
    if (String(displayFormat) === DD_MM_YYYY_DATE_FORMATS.display.dateInput) {
      return true;
    }

    const format = displayFormat as Intl.DateTimeFormatOptions;
    return format.year === 'numeric' && format.month === 'numeric' && format.day === 'numeric';
  }
}
