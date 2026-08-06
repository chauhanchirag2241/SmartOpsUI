import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../../core/services/notification.service';
import { finalize } from 'rxjs';

import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { FormFieldComponent } from '../../../../shared/form-controls/form-field/form-field.component';
import type { FormFieldOption } from '../../../../shared/form-controls/form-field/form-field.types';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { PeriodLineDto, PeriodTemplateService } from '../../../../core/services/period-template.service';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';

const WEEK_DAYS = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
];

@Component({
  selector: 'app-add-period-template',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    ActionButtonComponent,
    FormFieldComponent,
    DynamicFieldComponent,
    PageChromeDirective,
  ],
  templateUrl: './add-period-template.component.html',
  styleUrl: './add-period-template.component.css',
})
export class AddPeriodTemplateComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() templateId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  form: FormGroup;
  isSaving = false;
  readonly weekDays = WEEK_DAYS;
  newOverrideDay: number | '' = 6;

  readonly configs: Record<string, FormFieldConfig> = {
    name: {
      type: 'input',
      controlName: 'name',
      label: 'Template name',
      placeholder: 'e.g. Primary short day (2 periods)',
      validations: [
        { name: 'required', message: 'Template name is required', validator: Validators.required },
      ],
    },
    description: {
      type: 'input',
      controlName: 'description',
      label: 'Description',
      placeholder: 'Optional notes',
    },
  };

  constructor(
    private fb: FormBuilder,
    private snackBar: NotificationService,
    private templateService: PeriodTemplateService,
    private cdr: ChangeDetectorRef,
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      isActive: [true],
      periods: this.fb.array([]),
      dayOverrides: this.fb.array([]),
    });
  }

  get periods(): FormArray {
    return this.form.get('periods') as FormArray;
  }

  get dayOverrides(): FormArray {
    return this.form.get('dayOverrides') as FormArray;
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit period template';
    if (this.mode === 'view') return 'View period template';
    return 'Add period template';
  }

  get availableOverrideDays(): { day: number; label: string }[] {
    const used = new Set(this.dayOverrides.controls.map((c) => Number(c.get('dayOfWeek')?.value)));
    return this.weekDays.filter((d) => !used.has(d.day));
  }

  get availableOverrideDayOptions(): FormFieldOption[] {
    return this.availableOverrideDays.map((d) => ({ label: d.label, value: d.day }));
  }

  ngOnInit(): void {
    if (this.templateId && this.mode !== 'add') {
      this.load(this.templateId);
    } else {
      this.addPeriodRow();
      this.addPeriodRow({
        name: 'Break',
        shortName: 'Br',
        isBreak: true,
        startTime: '09:00',
        endTime: '09:15',
      });
    }
  }

  dayLabel(day: number): string {
    return this.weekDays.find((d) => d.day === day)?.label || `Day ${day}`;
  }

  overridePeriods(index: number): FormArray {
    return this.dayOverrides.at(index).get('periods') as FormArray;
  }

  addPeriodRow(
    defaults?: {
      name?: string;
      shortName?: string;
      startTime?: string;
      endTime?: string;
      isBreak?: boolean;
      id?: string;
    },
    target?: FormArray,
  ): void {
    const arr = target ?? this.periods;
    const order = arr.length + 1;
    const isBreak = defaults?.isBreak ?? false;
    // Breaks do not increment teaching-period numbering (Period 3 → Break → Period 4).
    const teachingCount = arr.controls.filter((c) => !c.get('isBreak')?.value).length;
    const periodNum = teachingCount + 1;
    arr.push(
      this.fb.group({
        id: [defaults?.id || ''],
        name: [defaults?.name || (isBreak ? 'Break' : `Period ${periodNum}`), Validators.required],
        shortName: [defaults?.shortName || (isBreak ? 'Br' : `P${periodNum}`), Validators.required],
        periodOrder: [order, Validators.required],
        startTime: [defaults?.startTime || '', Validators.required],
        endTime: [defaults?.endTime || '', Validators.required],
        isBreak: [isBreak],
      }),
    );
  }

  removePeriodRow(index: number, target?: FormArray): void {
    const arr = target ?? this.periods;
    if (arr.length <= 1) {
      this.snackBar.open('Schedule needs at least one period', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }
    arr.removeAt(index);
    this.reindexOrders(arr);
  }

  addDayOverride(): void {
    const day = Number(this.newOverrideDay);
    if (!day || day < 1 || day > 6) {
      this.snackBar.open('Select a day for the override', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }
    if (this.dayOverrides.controls.some((c) => Number(c.get('dayOfWeek')?.value) === day)) {
      this.snackBar.open('Override for this day already exists', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const periods = this.fb.array([]);
    this.addPeriodRow(
      { name: 'Period 1', shortName: 'P1', startTime: '08:00', endTime: '08:45' },
      periods,
    );
    this.addPeriodRow(
      { name: 'Period 2', shortName: 'P2', startTime: '08:45', endTime: '09:30' },
      periods,
    );
    this.addPeriodRow(
      { name: 'Period 3', shortName: 'P3', startTime: '09:30', endTime: '10:15' },
      periods,
    );
    this.addPeriodRow(
      { name: 'Period 4', shortName: 'P4', startTime: '10:15', endTime: '11:00' },
      periods,
    );

    this.dayOverrides.push(
      this.fb.group({
        dayOfWeek: [day, Validators.required],
        periods,
      }),
    );

    const next = this.availableOverrideDays[0]?.day;
    this.newOverrideDay = next ?? '';
    this.cdr.detectChanges();
  }

  removeDayOverride(index: number): void {
    this.dayOverrides.removeAt(index);
    const next = this.availableOverrideDays[0]?.day;
    this.newOverrideDay = next ?? '';
  }

  private reindexOrders(arr: FormArray): void {
    arr.controls.forEach((ctrl, i) => ctrl.get('periodOrder')?.setValue(i + 1));
  }

  private pushPeriodLines(arr: FormArray, lines: PeriodLineDto[]): void {
    arr.clear();
    for (const p of lines) {
      arr.push(
        this.fb.group({
          id: [p.id || ''],
          name: [p.name, Validators.required],
          shortName: [p.shortName, Validators.required],
          periodOrder: [p.periodOrder, Validators.required],
          startTime: [p.startTime, Validators.required],
          endTime: [p.endTime, Validators.required],
          isBreak: [p.isBreak ?? false],
        }),
      );
    }
    if (arr.length === 0) this.addPeriodRow(undefined, arr);
  }

  load(id: string): void {
    this.templateService.get(id).subscribe({
      next: (data) => {
        this.form.patchValue({
          name: data.name,
          description: data.description || '',
          isActive: data.isActive ?? true,
        });

        const all = data.periods || [];
        const defaults = all.filter((p) => p.dayOfWeek == null);
        this.pushPeriodLines(this.periods, defaults);

        this.dayOverrides.clear();
        const byDay = new Map<number, PeriodLineDto[]>();
        for (const p of all) {
          if (p.dayOfWeek == null) continue;
          const list = byDay.get(p.dayOfWeek) || [];
          list.push(p);
          byDay.set(p.dayOfWeek, list);
        }
        for (const [day, lines] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
          const periods = this.fb.array([]);
          this.pushPeriodLines(
            periods,
            lines.slice().sort((a, b) => a.periodOrder - b.periodOrder),
          );
          this.dayOverrides.push(
            this.fb.group({
              dayOfWeek: [day, Validators.required],
              periods,
            }),
          );
        }

        const next = this.availableOverrideDays[0]?.day;
        this.newOverrideDay = next ?? '';

        if (this.mode === 'view') this.form.disable();
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Error loading template', 'Close', { duration: 3000 }),
    });
  }

  private mapPeriodRows(rawPeriods: any[], dayOfWeek: number | null): PeriodLineDto[] {
    return (rawPeriods || []).map((p: any, i: number) => ({
      id: p.id || undefined,
      name: String(p.name ?? '').trim(),
      shortName: String(p.shortName ?? '').trim(),
      periodOrder: Number(p.periodOrder) || i + 1,
      startTime: String(p.startTime ?? '').trim(),
      endTime: String(p.endTime ?? '').trim(),
      isBreak: !!p.isBreak,
      dayOfWeek,
    }));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fill template name and all period fields', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.isSaving = true;
    const raw = this.form.getRawValue();
    const periods: PeriodLineDto[] = [
      ...this.mapPeriodRows(raw.periods, null),
      ...(raw.dayOverrides || []).flatMap((ov: any) =>
        this.mapPeriodRows(ov.periods, Number(ov.dayOfWeek)),
      ),
    ];

    const payload = {
      name: String(raw.name ?? '').trim(),
      description: String(raw.description ?? '').trim() || null,
      isActive: raw.isActive ?? true,
      periods,
    };

    const done = () => {
      this.isSaving = false;
      this.cdr.detectChanges();
    };
    const onSuccess = () => {
      this.snackBar.open(`Template ${this.mode === 'edit' ? 'updated' : 'saved'} successfully`, 'Close', {
        duration: 3000,
        panelClass: 'snack-success',
      });
      this.saved.emit();
    };
    const onError = (err: unknown) => {
      this.snackBar.open(getUserFacingApiError(err, 'Failed to save template.'), 'Close', {
        duration: 5000,
        panelClass: 'snack-error',
      });
    };

    if (this.mode === 'edit' && this.templateId) {
      this.templateService.update(this.templateId, payload).pipe(finalize(done)).subscribe({
        next: onSuccess,
        error: onError,
      });
    } else {
      this.templateService.create(payload).pipe(finalize(done)).subscribe({
        next: onSuccess,
        error: onError,
      });
    }
  }
}
