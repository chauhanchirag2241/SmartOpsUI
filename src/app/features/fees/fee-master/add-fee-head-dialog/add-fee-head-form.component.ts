import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { forkJoin } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  CreateFeeHeadPayload,
  FeeMasterService,
} from '../../../../core/services/fee-master.service';
import {
  AcademicPeriodService,
  AcademicPeriodRow,
} from '../../../../core/services/academic-period.service';
import { ClassService } from '../../../../core/services/class.service';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { MultiSelectChipsComponent } from '../../../../shared/components/multi-select-chips/multi-select-chips.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../../shared/constants/form.constants';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import { FeeApplicableTo, FeeType } from '../../../../shared/enums/field-options.enum';
import { MappingOption } from '../../../../shared/mapping/mapping.types';

interface PeriodAmountGroup {
  classGroupId: string;
  classGroupName: string;
  periods: { academicPeriodId: string; name: string; controlName: string }[];
}

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

@Component({
  selector: 'app-add-fee-head-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatCheckboxModule,
    DynamicFieldComponent,
    MultiSelectChipsComponent,
  ],
  templateUrl: './add-fee-head-form.component.html',
  styleUrl: './add-fee-head-form.component.css',
})
export class AddFeeHeadFormComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input({ required: true }) feeMasterId!: string;
  @Input() feeHeadId?: string;
  @Input() feeType = '';
  @Input() applicableTo = '';
  @Output() saved = new EventEmitter<void>();
  @Output() busyChange = new EventEmitter<boolean>();

  private readonly fb = inject(FormBuilder);
  private readonly feeMasterService = inject(FeeMasterService);
  private readonly academicPeriodService = inject(AcademicPeriodService);
  private readonly classService = inject(ClassService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly months = MONTHS;
  selectedMonths = new Set<number>();
  selectedClassGroupIds: string[] = [];
  periodGroups: PeriodAmountGroup[] = [];
  classGroupOptions: MappingOption[] = [];

  form: FormGroup = this.fb.group({
    feeHeadName: ['', Validators.required],
    isMandatory: [true],
    isEditable: [false],
    amount: [null],
    classGroupIds: [[] as string[]],
  });

  readonly nameConfig: FormFieldConfig = {
    type: 'input',
    controlName: 'feeHeadName',
    label: 'Fee head name',
    placeholder: 'e.g. Tuition',
    validations: [
      { name: 'required', message: 'Fee head name is required', validator: Validators.required },
    ],
  };

  readonly amountConfig: FormFieldConfig = {
    type: 'number',
    controlName: 'amount',
    label: 'Default amount',
    placeholder: '0.00',
  };

  readonly studentAmountConfig: FormFieldConfig = {
    type: 'number',
    controlName: 'amount',
    label: 'Amount',
    placeholder: '0.00',
  };

  readonly classGroupConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'classGroupIds',
    label: 'Class groups',
    placeholder: SELECT_PLACEHOLDER,
    options: [],
  };

  get isStudentWise(): boolean {
    return this.applicableTo === FeeApplicableTo.StudentWise || this.applicableTo === 'StudentWise';
  }

  get isClassWise(): boolean {
    return !this.isStudentWise;
  }

  get isOneTime(): boolean {
    return this.feeType === FeeType.OneTime || this.feeType === 'OneTime';
  }

  get isMonthly(): boolean {
    return this.feeType === FeeType.Monthly || this.feeType === 'Monthly';
  }

  get isPeriodWise(): boolean {
    return this.feeType === FeeType.PeriodWise || this.feeType === 'PeriodWise';
  }

  get showSingleAmount(): boolean {
    return this.isStudentWise || (this.isClassWise && (this.isOneTime || this.isMonthly));
  }

  get showMonthGrid(): boolean {
    return this.isClassWise && this.isMonthly;
  }

  get showPeriodAmounts(): boolean {
    return this.isClassWise && this.isPeriodWise;
  }

  ngOnInit(): void {
    if (this.showSingleAmount) {
      this.form.get('amount')?.setValidators([Validators.required]);
      if (this.isStudentWise) {
        this.studentAmountConfig.validations = [
          { name: 'required', message: 'Amount is required', validator: Validators.required },
        ];
      } else {
        this.amountConfig.validations = [
          {
            name: 'required',
            message: 'Default amount is required',
            validator: Validators.required,
          },
        ];
      }
    }

    if (this.showPeriodAmounts) {
      this.loadClassGroups();
    }

    if (this.feeHeadId && this.mode !== 'add') {
      this.loadHead(this.feeHeadId);
    }

    if (this.mode === 'view') {
      this.form.disable();
    }
  }

  toggleMandatory(): void {
    if (this.mode === 'view') return;
    const ctrl = this.form.get('isMandatory');
    ctrl?.setValue(!ctrl.value);
  }

  toggleEditable(): void {
    if (this.mode === 'view') return;
    const ctrl = this.form.get('isEditable');
    ctrl?.setValue(!ctrl.value);
  }

  isMonthSelected(month: number): boolean {
    return this.selectedMonths.has(month);
  }

  toggleMonth(month: number): void {
    if (this.mode === 'view') return;
    if (this.selectedMonths.has(month)) {
      this.selectedMonths.delete(month);
    } else {
      this.selectedMonths.add(month);
    }
  }

  save(): void {
    if (this.mode === 'view') return;

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    if (this.showMonthGrid && this.selectedMonths.size === 0) {
      this.snackBar.open('Select at least one month', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    if (this.showPeriodAmounts) {
      if (this.periodGroups.length === 0) {
        this.snackBar.open('Select at least one class group', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        return;
      }
      for (const group of this.periodGroups) {
        for (const period of group.periods) {
          const ctrl = this.form.get(period.controlName);
          if (ctrl?.invalid || ctrl?.value == null || ctrl.value === '') {
            ctrl?.markAsTouched();
            this.snackBar.open('Enter amount for all periods', 'Close', {
              duration: 3000,
              panelClass: 'snack-error',
            });
            return;
          }
        }
      }
    }

    const raw = this.form.getRawValue();
    const payload: CreateFeeHeadPayload = {
      feeHeadName: String(raw.feeHeadName).trim(),
      isMandatory: !!raw.isMandatory,
      isEditable: !!raw.isEditable,
      amount: this.showSingleAmount ? Number(raw.amount) : null,
      applicableMonths: this.showMonthGrid ? [...this.selectedMonths].sort((a, b) => a - b) : null,
      periodAmounts: this.showPeriodAmounts
        ? this.periodGroups.flatMap((g) =>
            g.periods.map((p) => ({
              classGroupId: g.classGroupId,
              academicPeriodId: p.academicPeriodId,
              amount: Number(this.form.get(p.controlName)?.value),
            })),
          )
        : null,
    };

    this.busyChange.emit(true);
    const onSuccess = () => {
      this.busyChange.emit(false);
      this.saved.emit();
      this.snackBar.open(
        this.mode === 'edit' ? 'Fee head updated' : 'Fee head created',
        'Close',
        { duration: 3000, panelClass: 'snack-success' },
      );
    };
    const onError = (err: unknown) => {
      this.busyChange.emit(false);
      this.snackBar.open(getUserFacingApiError(err, 'Failed to save fee head'), 'Close', {
        duration: 3500,
        panelClass: 'snack-error',
      });
      this.cdr.detectChanges();
    };

    if (this.mode === 'edit' && this.feeHeadId) {
      this.feeMasterService.updateFeeHead(this.feeHeadId, payload).subscribe({
        next: onSuccess,
        error: onError,
      });
      return;
    }

    this.feeMasterService.createFeeHead(this.feeMasterId, payload).subscribe({
      next: onSuccess,
      error: onError,
    });
  }

  private loadClassGroups(): void {
    this.feeMasterService.getFee(this.feeMasterId).subscribe({
      next: (fee) => {
        const allowed = new Set((fee.classGroupIds ?? []).map((id) => String(id)));
        this.classService.getClassDropdown(undefined, 'group').subscribe({
          next: (rows: any[]) => {
            const all = (rows || []).map((c) => ({
              id: String(c.id),
              name: String(c.name ?? ''),
            }));
            this.classGroupOptions = allowed.size
              ? all.filter((o) => allowed.has(o.id))
              : all;
            this.cdr.detectChanges();
          },
          error: () => {
            this.snackBar.open('Failed to load classes', 'Close', {
              duration: 3000,
              panelClass: 'snack-error',
            });
          },
        });
      },
      error: () => {
        this.snackBar.open('Failed to load fee classes', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  onClassGroupIdsChange(ids: string[]): void {
    if (this.mode === 'view') return;
    this.selectedClassGroupIds = ids;
    this.form.get('classGroupIds')?.setValue(ids);
    this.rebuildPeriodGroups(ids);
  }

  private rebuildPeriodGroups(
    classGroupIds: string[],
    amountsToPatch?: { classGroupId: string; academicPeriodId: string; amount: number }[],
  ): void {
    for (const group of this.periodGroups) {
      for (const p of group.periods) {
        this.form.removeControl(p.controlName);
      }
    }

    if (classGroupIds.length === 0) {
      this.periodGroups = [];
      this.cdr.detectChanges();
      return;
    }

    const requests = classGroupIds.map((id) => this.academicPeriodService.getClassSetup(id));
    forkJoin(requests).subscribe({
      next: (setups) => {
        const groups: PeriodAmountGroup[] = [];
        setups.forEach((setup, index) => {
          const classGroupId = classGroupIds[index];
          const label =
            this.classGroupOptions.find((o) => o.id === classGroupId)?.name ?? 'Class';
          const periods = (setup.periods || []).map((p: AcademicPeriodRow) => {
            const controlName = `amt_${classGroupId}_${p.id}`;
            if (!this.form.contains(controlName)) {
              this.form.addControl(
                controlName,
                new FormControl(
                  { value: null, disabled: this.mode === 'view' },
                  Validators.required,
                ),
              );
            }
            return {
              academicPeriodId: String(p.id),
              name: p.name,
              controlName,
            };
          });
          groups.push({ classGroupId, classGroupName: label, periods });
        });
        this.periodGroups = groups;

        if (amountsToPatch?.length) {
          for (const pa of amountsToPatch) {
            const controlName = `amt_${pa.classGroupId}_${pa.academicPeriodId}`;
            this.form.get(controlName)?.setValue(pa.amount);
          }
        }

        if (this.mode === 'view') {
          this.form.disable();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load academic periods', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private loadHead(id: string): void {
    this.feeMasterService.getFeeHead(id).subscribe({
      next: (head) => {
        this.form.patchValue({
          feeHeadName: head.feeHeadName,
          isMandatory: head.isMandatory ?? true,
          isEditable: head.isEditable ?? false,
          amount: head.amount ?? null,
        });

        const monthsRaw = head.applicableMonths;
        let months: number[] = [];
        if (Array.isArray(monthsRaw)) {
          months = monthsRaw.map(Number);
        } else if (typeof monthsRaw === 'string' && monthsRaw.trim()) {
          months = monthsRaw.split(',').map((m) => Number(m.trim())).filter((n) => n >= 1 && n <= 12);
        }
        this.selectedMonths = new Set(months);

        const periodAmounts = head.periodAmounts || [];
        if (periodAmounts.length && this.showPeriodAmounts) {
          const classIds = [...new Set(periodAmounts.map((p) => String(p.classGroupId)))];
          this.selectedClassGroupIds = classIds;
          this.form.get('classGroupIds')?.setValue(classIds);

          const amounts = periodAmounts.map((p) => ({
            classGroupId: String(p.classGroupId),
            academicPeriodId: String(p.academicPeriodId),
            amount: Number(p.amount),
          }));

          if (this.classGroupOptions.length > 0) {
            this.rebuildPeriodGroups(classIds, amounts);
          } else {
            this.classService.getClassDropdown(undefined, 'group').subscribe({
              next: (rows: any[]) => {
                this.classGroupOptions = (rows || []).map((c) => ({
                  id: String(c.id),
                  name: String(c.name ?? ''),
                }));
                this.rebuildPeriodGroups(classIds, amounts);
              },
            });
          }
        }

        if (this.mode === 'view') {
          this.form.disable();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load fee head', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }
}
