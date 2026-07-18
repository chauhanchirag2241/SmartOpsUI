import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import {
  AcademicPeriodClassSummary,
  AcademicPeriodRow,
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

@Component({
  selector: 'app-academic-period-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ListPageHeaderComponent,
    ActionButtonComponent,
  ],
  templateUrl: './academic-period-management.component.html',
  styleUrl: './academic-period-management.component.css',
})
export class AcademicPeriodManagementComponent implements OnInit {
  private readonly periodService = inject(AcademicPeriodService);
  private readonly yearService = inject(AcademicYearService);
  private readonly yearContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly periodTypes = [
    { value: AcademicPeriodType.Semester, label: 'Semester' },
    { value: AcademicPeriodType.Term, label: 'Term' },
    { value: AcademicPeriodType.Quarter, label: 'Quarter' },
    { value: AcademicPeriodType.Custom, label: 'Custom' },
  ];

  academicYears: AcademicYearDropdownItem[] = [];
  academicYearId = '';
  classes: AcademicPeriodClassSummary[] = [];
  selectedClassId = '';
  periodType = AcademicPeriodType.Semester;
  periods: AcademicPeriodRow[] = [];
  loading = false;
  saving = false;
  errorMessage = '';

  get canEdit(): boolean {
    return !this.yearContext.isReadOnlyScope()
      && this.permissionService.canEdit(MenuCodes.AcademicPeriods);
  }

  get selectedClass(): AcademicPeriodClassSummary | undefined {
    return this.classes.find((item) => item.classId === this.selectedClassId);
  }

  ngOnInit(): void {
    this.yearService.getAcademicYearDropdown('all').subscribe({
      next: (years) => {
        this.academicYears = years ?? [];
        const effective = this.yearContext.effectiveYearId();
        this.academicYearId =
          (effective && this.academicYears.some((year) => year.id === effective)
            ? effective
            : this.academicYears[0]?.id) ?? '';
        if (this.academicYearId) this.loadClasses();
        this.cdr.detectChanges();
      },
      error: () => this.showError('Failed to load academic years'),
    });
  }

  onYearChange(): void {
    this.selectedClassId = '';
    this.periods = [];
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
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (setup) => {
          this.periodType = setup.periodType ?? AcademicPeriodType.Semester;
          this.periods = (setup.periods ?? []).map((period) => ({
            ...period,
            startDate: this.inputDate(period.startDate),
            endDate: this.inputDate(period.endDate),
          }));
          if (!this.periods.length && this.canEdit) this.addPeriod();
        },
        error: () => this.showError('Failed to load academic periods'),
      });
  }

  onPeriodTypeChange(): void {
    if (this.periodType === AcademicPeriodType.Custom) return;
    this.periods = this.periods.map((period, index) => ({
      ...period,
      name: `${this.typeLabel()} ${index + 1}`,
    }));
  }

  addPeriod(): void {
    const periodIndex = this.periods.length + 1;
    this.periods = [
      ...this.periods,
      {
        periodIndex,
        name: this.periodType === AcademicPeriodType.Custom
          ? `Period ${periodIndex}`
          : `${this.typeLabel()} ${periodIndex}`,
        startDate: '',
        endDate: '',
      },
    ];
  }

  removePeriod(index: number): void {
    this.periods = this.periods
      .filter((_, rowIndex) => rowIndex !== index)
      .map((period, rowIndex) => ({ ...period, periodIndex: rowIndex + 1 }));
  }

  movePeriod(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.periods.length) return;
    const rows = [...this.periods];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.periods = rows.map((period, rowIndex) => ({ ...period, periodIndex: rowIndex + 1 }));
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
    this.periodService.saveClassSetup(this.selectedClassId, {
      academicYearId: this.academicYearId,
      periodType: this.periodType,
      periods: this.periods.map((period, index) => ({
        periodIndex: index + 1,
        name: period.name.trim(),
        startDate: period.startDate,
        endDate: period.endDate,
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

  private validate(): string | null {
    if (!this.periods.length) return 'Add at least one academic period';
    for (const period of this.periods) {
      if (!period.name.trim() || !period.startDate || !period.endDate) {
        return 'Fill all period names and dates';
      }
      if (period.endDate < period.startDate) {
        return `'${period.name.trim()}' end date cannot be earlier than start date`;
      }
    }
    const names = this.periods.map((period) => period.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return 'Period names must be unique';
    const chronological = [...this.periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
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

  private inputDate(value: string): string {
    return value?.slice(0, 10) ?? '';
  }

  private showError(message: string): void {
    this.notification.open(message, 'Close', { duration: 4000, panelClass: 'snack-error' });
    this.cdr.detectChanges();
  }
}
