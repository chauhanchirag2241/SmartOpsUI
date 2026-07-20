import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, finalize } from 'rxjs';
import {
  AcademicPeriodClassSummary,
  AcademicPeriodService,
  AcademicPeriodType,
} from '../../core/services/academic-period.service';
import {
  AcademicYearDropdownItem,
  AcademicYearService,
} from '../../core/services/academic-year.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { ListPageHeaderComponent } from '../../shared/components/list-page-header/list-page-header.component';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { DynamicFieldComponent } from '../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../shared/interfaces/form-field-config';

@Component({
  selector: 'app-academic-period-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    ListPageHeaderComponent,
    ActionButtonComponent,
    DynamicFieldComponent,
  ],
  templateUrl: './academic-period-management.component.html',
  styleUrl: './academic-period-management.component.css',
})
export class AcademicPeriodManagementComponent implements OnInit, OnDestroy {
  private readonly periodService = inject(AcademicPeriodService);
  private readonly yearService = inject(AcademicYearService);
  private readonly yearContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly subs = new Subscription();

  readonly periodTypes = [
    { value: AcademicPeriodType.Semester, label: 'Semester' },
    { value: AcademicPeriodType.Term, label: 'Term' },
    { value: AcademicPeriodType.Quarter, label: 'Quarter' },
    { value: AcademicPeriodType.Custom, label: 'Custom' },
  ];

  academicYears: AcademicYearDropdownItem[] = [];
  classes: AcademicPeriodClassSummary[] = [];
  selectedClassId = '';
  loading = false;
  saving = false;
  errorMessage = '';

  readonly filterForm = this.fb.group({
    academicYearId: [''],
  });

  readonly editorForm = this.fb.group({
    periodType: [AcademicPeriodType.Semester as AcademicPeriodType],
    periods: this.fb.array<FormGroup>([]),
  });

  yearConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'academicYearId',
    label: 'Academic year',
    placeholder: 'Select academic year',
    options: [],
  };

  periodTypeConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'periodType',
    label: 'Period type',
    placeholder: 'Select period type',
    options: this.periodTypes,
  };

  readonly periodNameConfig: FormFieldConfig = {
    type: 'input',
    controlName: 'name',
    label: '',
    placeholder: 'Period name',
  };

  readonly startDateConfig: FormFieldConfig = {
    type: 'datepicker',
    controlName: 'startDate',
    label: '',
    placeholder: 'dd-mm-yyyy',
  };

  readonly endDateConfig: FormFieldConfig = {
    type: 'datepicker',
    controlName: 'endDate',
    label: '',
    placeholder: 'dd-mm-yyyy',
  };

  get canEdit(): boolean {
    return !this.yearContext.isReadOnlyScope()
      && this.permissionService.canEdit(MenuCodes.AcademicPeriods);
  }

  get selectedClass(): AcademicPeriodClassSummary | undefined {
    return this.classes.find((item) => item.classId === this.selectedClassId);
  }

  get academicYearId(): string {
    return String(this.filterForm.get('academicYearId')?.value ?? '');
  }

  get periodType(): AcademicPeriodType {
    return (this.editorForm.get('periodType')?.value ?? AcademicPeriodType.Semester) as AcademicPeriodType;
  }

  get periodsArray(): FormArray<FormGroup> {
    return this.editorForm.get('periods') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.subs.add(
      this.filterForm.get('academicYearId')!.valueChanges.subscribe(() => this.onYearChange()),
    );
    this.subs.add(
      this.editorForm.get('periodType')!.valueChanges.subscribe(() => this.onPeriodTypeChange()),
    );

    this.yearService.getAcademicYearDropdown('all').subscribe({
      next: (years) => {
        this.academicYears = years ?? [];
        this.yearConfig = {
          ...this.yearConfig,
          options: this.academicYears.map((year) => ({ label: year.name, value: year.id })),
        };
        const effective = this.yearContext.effectiveYearId();
        const nextYearId =
          (effective && this.academicYears.some((year) => year.id === effective)
            ? effective
            : this.academicYears[0]?.id) ?? '';
        if (nextYearId) {
          this.filterForm.patchValue({ academicYearId: nextYearId }, { emitEvent: false });
          this.loadClasses();
        }
        this.cdr.detectChanges();
      },
      error: () => this.showError('Failed to load academic years'),
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onYearChange(): void {
    this.selectedClassId = '';
    this.periodsArray.clear();
    this.loadClasses();
  }

  loadClasses(keepClassId = ''): void {
    if (!this.academicYearId) return;
    this.loading = true;
    this.periodService.getClasses(this.academicYearId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (classes) => {
          this.classes = classes ?? [];
          const nextClassId =
            (keepClassId && this.classes.some((item) => item.classId === keepClassId)
              ? keepClassId
              : this.classes[0]?.classId) ?? '';
          if (nextClassId) this.selectClass(nextClassId);
        },
        error: () => this.showError('Failed to load classes'),
      });
  }

  selectClass(classId: string): void {
    this.selectedClassId = classId;
    this.errorMessage = '';
    this.loading = true;
    this.periodService.getClassSetup(classId)
      .pipe(finalize(() => {
        this.loading = false;
        this.syncEditorDisabledState();
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (setup) => {
          this.editorForm.patchValue(
            { periodType: setup.periodType ?? AcademicPeriodType.Semester },
            { emitEvent: false },
          );
          this.periodsArray.clear();
          const rows = setup.periods ?? [];
          if (rows.length) {
            rows.forEach((period) => {
              this.periodsArray.push(
                this.createPeriodGroup({
                  name: period.name,
                  startDate: this.toDateValue(period.startDate),
                  endDate: this.toDateValue(period.endDate),
                }),
              );
            });
          } else if (this.canEdit) {
            this.addPeriod();
          }
        },
        error: () => this.showError('Failed to load academic periods'),
      });
  }

  onPeriodTypeChange(): void {
    if (this.periodType === AcademicPeriodType.Custom) return;
    this.periodsArray.controls.forEach((group, index) => {
      group.patchValue({ name: `${this.typeLabel()} ${index + 1}` }, { emitEvent: false });
    });
  }

  addPeriod(): void {
    const periodIndex = this.periodsArray.length + 1;
    this.periodsArray.push(
      this.createPeriodGroup({
        name: this.periodType === AcademicPeriodType.Custom
          ? `Period ${periodIndex}`
          : `${this.typeLabel()} ${periodIndex}`,
        startDate: null,
        endDate: null,
      }),
    );
  }

  removePeriod(index: number): void {
    this.periodsArray.removeAt(index);
  }

  movePeriod(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.periodsArray.length) return;
    const current = this.periodsArray.at(index);
    this.periodsArray.removeAt(index);
    this.periodsArray.insert(target, current);
  }

  save(): void {
    if (!this.selectedClassId || !this.canEdit || this.saving) return;
    const error = this.validate();
    if (error) {
      this.errorMessage = error;
      this.showError(error);
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const rows = this.periodsArray.getRawValue();
    this.periodService.saveClassSetup(this.selectedClassId, {
      academicYearId: this.academicYearId,
      periodType: this.periodType,
      periods: rows.map((period, index) => ({
        periodIndex: index + 1,
        name: String(period['name'] ?? '').trim(),
        startDate: this.formatDate(period['startDate']),
        endDate: this.formatDate(period['endDate']),
      })),
    })
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.notification.open('Academic periods saved successfully', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.loadClasses(this.selectedClassId);
        },
        error: (error) => this.showError(
          error?.error?.message
          || (typeof error?.error === 'string' ? error.error : 'Failed to save academic periods'),
        ),
      });
  }

  private createPeriodGroup(value: {
    name: string;
    startDate: Date | null;
    endDate: Date | null;
  }): FormGroup {
    return this.fb.group({
      name: [value.name, Validators.required],
      startDate: [value.startDate, Validators.required],
      endDate: [value.endDate, Validators.required],
    });
  }

  private syncEditorDisabledState(): void {
    if (this.canEdit) {
      this.editorForm.enable({ emitEvent: false });
      this.periodTypeConfig = { ...this.periodTypeConfig, disabled: false };
    } else {
      this.editorForm.disable({ emitEvent: false });
      this.periodTypeConfig = { ...this.periodTypeConfig, disabled: true };
    }
  }

  private validate(): string | null {
    if (!this.periodsArray.length) return 'Add at least one academic period';
    const rows = this.periodsArray.getRawValue().map((period) => ({
      name: String(period['name'] ?? '').trim(),
      startDate: this.formatDate(period['startDate']),
      endDate: this.formatDate(period['endDate']),
    }));

    for (const period of rows) {
      if (!period.name || !period.startDate || !period.endDate) {
        return 'Fill all period names and dates';
      }
      if (period.endDate < period.startDate) {
        return `'${period.name}' end date cannot be earlier than start date`;
      }
    }
    const names = rows.map((period) => period.name.toLowerCase());
    if (new Set(names).size !== names.length) return 'Period names must be unique';
    const chronological = [...rows].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 1; i < chronological.length; i++) {
      if (chronological[i].startDate <= chronological[i - 1].endDate) {
        return 'Academic period dates cannot overlap';
      }
    }
    return null;
  }

  private typeLabel(): string {
    return this.periodTypes.find((type) => type.value === this.periodType)?.label ?? 'Period';
  }

  private toDateValue(value: string | null | undefined): Date | null {
    const raw = value?.slice(0, 10) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatDate(date: unknown): string {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.slice(0, 10);
    }
    const d = new Date(date as string | number | Date);
    if (Number.isNaN(d.getTime())) return '';
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  private showError(message: string): void {
    this.notification.open(message, 'Close', { duration: 4000, panelClass: 'snack-error' });
    this.cdr.detectChanges();
  }
}
