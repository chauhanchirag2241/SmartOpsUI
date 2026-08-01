import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeSalaryService } from '../../../../core/services/employee-salary.service';
import { SalaryStructureService } from '../../../../core/services/salary-structure.service';
import { ErpDialogShellComponent } from '../../../../shared/components/erp-dialog-shell/erp-dialog-shell.component';
import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../../shared/constants/form.constants';
import { ERP_FORM_DIALOG_WIDTH } from '../../../../shared/constants/dialog.constants';
import { parseDateOnly, toDateOnlyString, todayDateOnlyString } from '../../../../shared/utils/date-only.util';
import {
  asArray,
  extractApiError,
  normalizeSalaryStructureVersion,
  normalizeSalaryVersionComponent,
} from '../../salary.shared';

export interface AssignEmployeeSalaryDialogData {
  employeeId: string;
  employeeName: string;
  existingSalaryStructureVersionId?: string | null;
  existingEffectiveDate?: string | null;
  existingComponentValues?: { salaryVersionComponentId: string; value: number }[];
}

export interface AssignComponentRow {
  salaryVersionComponentId: string;
  name: string;
  calculationTypeLabel: string;
  defaultValue: number;
  value: number;
}

@Component({
  selector: 'app-assign-employee-salary-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    ErpDialogShellComponent,
    DynamicFieldComponent,
  ],
  templateUrl: './assign-employee-salary-dialog.component.html',
  styleUrl: './assign-employee-salary-dialog.component.css',
})
export class AssignEmployeeSalaryDialogComponent implements OnInit {
  readonly data = inject<AssignEmployeeSalaryDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AssignEmployeeSalaryDialogComponent, boolean>);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(EmployeeSalaryService);
  private readonly structureService = inject(SalaryStructureService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  readonly dialogWidth = ERP_FORM_DIALOG_WIDTH;
  saving = false;
  loadingComponents = false;
  componentRows: AssignComponentRow[] = [];

  form: FormGroup = this.fb.group({
    salaryStructureVersionId: ['', Validators.required],
    effectiveDate: [null as Date | null, Validators.required],
  });

  versionField: FormFieldConfig = {
    type: 'select',
    controlName: 'salaryStructureVersionId',
    label: 'Salary structure',
    placeholder: SELECT_PLACEHOLDER,
    options: [],
    validations: [
      { name: 'required', message: 'Salary structure is required', validator: Validators.required },
    ],
  };

  effectiveDateField: FormFieldConfig = {
    type: 'datepicker',
    controlName: 'effectiveDate',
    label: 'Effective date',
    validations: [
      { name: 'required', message: 'Effective date is required', validator: Validators.required },
    ],
  };

  ngOnInit(): void {
    this.loadVersions();
    this.form.get('salaryStructureVersionId')?.valueChanges.subscribe((id) => {
      if (id) this.loadComponents(String(id));
    });
  }

  private loadVersions(): void {
    this.structureService.getVersions().subscribe({
      next: (list) => {
        const versions = asArray(list)
          .map(normalizeSalaryStructureVersion)
          .filter((v) => v.statusLabel !== 'Archived');
        this.versionField = {
          ...this.versionField,
          options: versions.map((v) => ({
            label: `${v.versionLabel} (${v.statusLabel})`,
            value: v.id,
          })),
        };

        const preferred =
          this.data.existingSalaryStructureVersionId &&
          versions.some((v) => v.id === this.data.existingSalaryStructureVersionId)
            ? this.data.existingSalaryStructureVersionId
            : versions[0]?.id ?? '';

        const effective =
          parseDateOnly(this.data.existingEffectiveDate) ?? parseDateOnly(todayDateOnlyString());

        this.form.patchValue(
          {
            salaryStructureVersionId: preferred,
            effectiveDate: effective,
          },
          { emitEvent: false },
        );

        if (preferred) {
          this.loadComponents(preferred);
        }
        this.refresh();
      },
      error: () => {
        this.snackBar.open('Failed to load salary structures', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private loadComponents(versionId: string): void {
    this.loadingComponents = true;
    this.refresh();
    this.structureService.getVersionDetail(versionId).subscribe({
      next: (raw) => {
        const components = asArray(raw?.components ?? raw?.Components).map(
          normalizeSalaryVersionComponent,
        );
        const existing = new Map(
          (this.data.existingComponentValues ?? []).map((c) => [
            c.salaryVersionComponentId,
            c.value,
          ]),
        );
        this.componentRows = components.map((m) => ({
          salaryVersionComponentId: m.id,
          name: m.name,
          calculationTypeLabel: m.calculationTypeLabel,
          defaultValue: m.value,
          value: existing.get(m.id) ?? m.value,
        }));
        this.loadingComponents = false;
        this.refresh();
      },
      error: (e) => {
        this.loadingComponents = false;
        this.componentRows = [];
        this.snackBar.open(extractApiError(e, 'Failed to load structure components'), 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
        this.refresh();
      },
    });
  }

  onAmountChange(row: AssignComponentRow, raw: string): void {
    const n = Number(raw);
    row.value = Number.isFinite(n) ? n : 0;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const versionId = String(this.form.value.salaryStructureVersionId ?? '');
    const effectiveDate = toDateOnlyString(this.form.value.effectiveDate);
    if (!versionId || !effectiveDate) {
      this.snackBar.open('Salary structure and effective date are required', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const components = this.componentRows
      .map((c) => ({
        salaryVersionComponentId: c.salaryVersionComponentId,
        value: Number(c.value),
      }))
      .filter((c) => Number.isFinite(c.value) && c.value > 0);

    if (!components.length) {
      this.snackBar.open('Enter at least one component value', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.saving = true;
    this.service
      .assignOrUpdate(this.data.employeeId, {
        salaryStructureVersionId: versionId,
        effectiveDate,
        components,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.snackBar.open('Employee salary saved', 'Close', {
            duration: 2800,
            panelClass: 'snack-success',
          });
          this.ref.close(true);
        },
        error: (e) => {
          this.saving = false;
          this.snackBar.open(extractApiError(e, 'Save failed'), 'Close', {
            duration: 3500,
            panelClass: 'snack-error',
          });
          this.refresh();
        },
      });
  }

  private refresh(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
