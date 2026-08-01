import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../../core/services/notification.service';

import { DynamicFieldComponent } from '../../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { MultiSelectChipsComponent } from '../../../../shared/components/multi-select-chips/multi-select-chips.component';
import { FormTab } from '../../../../shared/interfaces/form-layout';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import {
  enumToOptions,
  FeeApplicableTo,
  FeeType,
  FEE_APPLICABLE_TO_LABELS,
  FEE_TYPE_LABELS,
} from '../../../../shared/enums/field-options.enum';
import { FeeMasterService } from '../../../../core/services/fee-master.service';
import { ClassService } from '../../../../core/services/class.service';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import { parseDateOnly, toDateOnlyString } from '../../../../shared/utils/date-only.util';
import { MappingOption } from '../../../../shared/mapping/mapping.types';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

function dueOnOrAfterPublished(group: AbstractControl): ValidationErrors | null {
  const published = parseDateOnly(group.get('publishedOn')?.value);
  const due = parseDateOnly(group.get('defaultDueDate')?.value);
  if (!published || !due) return null;
  return due.getTime() < published.getTime() ? { dueBeforePublished: true } : null;
}

@Component({
  selector: 'app-add-fee-master',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DynamicFieldComponent,
    ActionButtonComponent,
    PageChromeDirective,
    MultiSelectChipsComponent,
  ],
  templateUrl: './add-fee-master.component.html',
  styleUrl: './add-fee-master.component.css',
  host: { class: 'add-fee-master-page form-page-shell' },
})
export class AddFeeMasterComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() feeId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(NotificationService);
  private readonly feeMasterService = inject(FeeMasterService);
  private readonly classService = inject(ClassService);
  private readonly cdr = inject(ChangeDetectorRef);

  feeForm: FormGroup;
  isSaving = false;
  classGroupOptions: MappingOption[] = [];
  selectedClassGroupIds: string[] = [];
  lockedClassGroupIds: string[] = [];

  readonly configs: Record<string, FormFieldConfig> = {
    feeName: {
      type: 'input',
      controlName: 'feeName',
      label: 'Fee name',
      placeholder: 'Academic Year Fee For Primary Section',
      validations: [
        { name: 'required', message: 'Fee name is required', validator: Validators.required },
      ],
    },
    feeType: {
      type: 'badges',
      controlName: 'feeType',
      label: 'Fee type',
      options: enumToOptions(FeeType, (v) => FEE_TYPE_LABELS[v as FeeType] ?? v),
      validations: [
        { name: 'required', message: 'Fee type is required', validator: Validators.required },
      ],
    },
    publishedOn: {
      type: 'datepicker',
      controlName: 'publishedOn',
      label: 'Published on',
      minDate: 'today',
    },
    defaultDueDate: {
      type: 'datepicker',
      controlName: 'defaultDueDate',
      label: 'Default due date',
      minDate: 'today',
    },
    applicableTo: {
      type: 'badges',
      controlName: 'applicableTo',
      label: 'Applicable to',
      options: enumToOptions(
        FeeApplicableTo,
        (v) => FEE_APPLICABLE_TO_LABELS[v as FeeApplicableTo] ?? v,
      ),
      validations: [
        {
          name: 'required',
          message: 'Applicable to is required',
          validator: Validators.required,
        },
      ],
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description (optional)',
      placeholder: 'Add notes about this fee...',
    },
  };

  readonly tabs: FormTab[] = [
    {
      stepIndex: 0,
      sections: [
        {
          title: 'Basic details',
          icon: 'payments',
          layout: 'grid2',
          fields: [
            'feeName',
            'feeType',
            'publishedOn',
            'defaultDueDate',
            'applicableTo',
            'description',
          ],
        },
      ],
    },
  ];

  constructor() {
    this.feeForm = this.fb.group(
      {
        feeName: ['', Validators.required],
        feeType: [null, Validators.required],
        publishedOn: [null],
        defaultDueDate: [null],
        applicableTo: [FeeApplicableTo.ClassWise, Validators.required],
        description: [''],
      },
      { validators: dueOnOrAfterPublished },
    );

    this.feeForm.get('publishedOn')?.valueChanges.subscribe((published: Date | null) => {
      this.syncDueMinDate(published);
    });
  }

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit fee';
    if (this.mode === 'view') return 'View fee';
    return 'Add fee';
  }

  get isClassWise(): boolean {
    const v = this.feeForm.get('applicableTo')?.value;
    return v === FeeApplicableTo.ClassWise || v === 'ClassWise';
  }

  ngOnInit(): void {
    if (this.feeId && this.mode !== 'add') {
      this.loadFee(this.feeId);
    } else {
      this.loadClassGroups();
    }
    if (this.mode === 'view') {
      this.feeForm.disable();
    }
    if (this.mode === 'edit') {
      this.feeForm.get('feeType')?.disable({ emitEvent: false });
      this.feeForm.get('applicableTo')?.disable({ emitEvent: false });
    }
  }

  onClassGroupIdsChange(ids: string[]): void {
    const locked = this.lockedClassGroupIds;
    this.selectedClassGroupIds = [...new Set([...locked, ...ids])];
  }

  private loadClassGroups(): void {
    this.classService.getClassDropdown(undefined, 'group').subscribe({
      next: (rows: any[]) => {
        this.classGroupOptions = (rows || []).map((c) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        this.cdr.detectChanges();
      },
    });
  }

  private loadFee(id: string): void {
    forkJoin({
      fee: this.feeMasterService.getFee(id),
      groups: this.classService.getClassDropdown(undefined, 'group').pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ fee: res, groups }) => {
        this.classGroupOptions = (groups || []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        this.feeForm.patchValue({
          feeName: res.feeName,
          feeType: res.feeType,
          publishedOn: this.toDate(res.publishedOn),
          defaultDueDate: this.toDate(res.defaultDueDate),
          applicableTo: res.applicableTo ?? FeeApplicableTo.ClassWise,
          description: res.description ?? '',
        });
        const rawIds = (res as any).classGroupIds ?? (res as any).ClassGroupIds ?? [];
        const ids = (Array.isArray(rawIds) ? rawIds : []).map((x: unknown) => String(x));
        this.selectedClassGroupIds = ids;
        if (this.mode === 'edit') {
          this.lockedClassGroupIds = [...ids];
        }
        this.syncDueMinDate(this.toDate(res.publishedOn));
        if (this.mode === 'view') {
          this.feeForm.disable();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load fee', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private syncDueMinDate(published: Date | null): void {
    const today = parseDateOnly(new Date())!;
    let min = today;
    const p = parseDateOnly(published);
    if (p && p.getTime() > today.getTime()) {
      min = p;
    }
    this.configs['defaultDueDate'] = {
      ...this.configs['defaultDueDate'],
      minDate: min,
    };
    this.cdr.detectChanges();
  }

  saveFee(): void {
    if (this.feeForm.invalid || this.mode === 'view') {
      this.feeForm.markAllAsTouched();
      if (this.feeForm.hasError('dueBeforePublished')) {
        this.snackBar.open('Default due date must be on or after published on', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
        return;
      }
      this.snackBar.open('Please fill all required fields', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    if (this.isClassWise && !this.selectedClassGroupIds.length) {
      this.snackBar.open('Select at least one class', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const raw = this.feeForm.getRawValue();
    const payload = {
      feeName: String(raw.feeName).trim(),
      feeType: raw.feeType,
      publishedOn: this.toApiDate(raw.publishedOn),
      defaultDueDate: this.toApiDate(raw.defaultDueDate),
      applicableTo: raw.applicableTo,
      description: String(raw.description ?? '').trim() || null,
      classGroupIds: this.isClassWise ? this.selectedClassGroupIds : [],
    };

    this.isSaving = true;
    const done = () => {
      this.isSaving = false;
      this.cdr.detectChanges();
    };

    if (this.mode === 'edit' && this.feeId) {
      this.feeMasterService.updateFee(this.feeId, payload).subscribe({
        next: () => {
          done();
          this.snackBar.open('Fee updated', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.saved.emit();
        },
        error: (err: unknown) => {
          done();
          this.snackBar.open(getUserFacingApiError(err, 'Failed to save fee'), 'Close', {
            duration: 3500,
            panelClass: 'snack-error',
          });
        },
      });
      return;
    }

    this.feeMasterService.createFee(payload).subscribe({
      next: () => {
        done();
        this.snackBar.open('Fee created', 'Close', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.saved.emit();
      },
      error: (err: unknown) => {
        done();
        this.snackBar.open(getUserFacingApiError(err, 'Failed to save fee'), 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private toDate(value: string | null | undefined): Date | null {
    return parseDateOnly(value);
  }

  private toApiDate(value: unknown): string | null {
    return toDateOnlyString(value);
  }
}
