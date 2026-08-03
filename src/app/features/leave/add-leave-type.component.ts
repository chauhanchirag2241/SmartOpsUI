import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { LeaveTypeService } from '../../core/services/leave-type.service';
import { NotificationService } from '../../core/services/notification.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { DynamicFieldComponent } from '../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../shared/interfaces/form-field-config';
import { getUserFacingApiError } from '../../shared/utils/api-error.util';

@Component({
  selector: 'app-add-leave-type',
  standalone: true,
  host: { class: 'form-page-shell' },
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    DynamicFieldComponent,
    ActionButtonComponent,
    PageChromeDirective,
  ],
  template: `
    <span [appPageChrome]="pageTitle" [pageChromeShowBack]="true" (pageChromeBack)="cancel.emit()"></span>

    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="card">
        <div class="card-title">
          <mat-icon>category</mat-icon>
          Leave type details
        </div>
        <div class="grid2">
          <app-dynamic-field [config]="configs['code']" [group]="form" />
          <app-dynamic-field [config]="configs['name']" [group]="form" />
          <app-dynamic-field [config]="configs['sortOrder']" [group]="form" />
          <app-dynamic-field [config]="configs['isPaid']" [group]="form" />
          <app-dynamic-field [config]="configs['carryForward']" [group]="form" />
          <app-dynamic-field [config]="configs['allowHalfDay']" [group]="form" />
          @if (mode !== 'add') {
            <app-dynamic-field [config]="configs['isActive']" [group]="form" />
          }
          <p class="form-hint full">
            Requires balance is derived: unpaid leave types do not track balance. Current:
            <strong>{{ requiresBalance ? 'Yes' : 'No' }}</strong>
          </p>
        </div>
      </div>

      <div class="footer-actions">
        <div class="footer-hint">Leave types appear when applying staff leave and in policies.</div>
        @if (mode !== 'view') {
          <app-action-button
            type="save"
            [label]="saving ? 'Saving…' : mode === 'edit' ? 'Update leave type' : 'Save leave type'"
            [icon]="saving ? 'hourglass_empty' : 'check_circle'"
            [disabled]="saving"
            (action)="save()"
          />
        }
      </div>
    </form>
  `,
  styles: `
    .full {
      grid-column: 1 / -1;
    }
  `,
})
export class AddLeaveTypeComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(LeaveTypeService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private paidSub?: Subscription;

  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() leaveTypeId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  saving = false;
  form: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isPaid: [true],
    carryForward: [true],
    allowHalfDay: [true],
    sortOrder: [0, Validators.required],
    isActive: [true],
  });

  readonly configs: Record<string, FormFieldConfig> = {
    code: {
      type: 'input',
      controlName: 'code',
      label: 'Code',
      placeholder: 'e.g. CL',
      maxLength: 20,
      validations: [
        { name: 'required', message: 'Code is required', validator: Validators.required },
      ],
    },
    name: {
      type: 'input',
      controlName: 'name',
      label: 'Name',
      placeholder: 'e.g. Casual Leave',
      maxLength: 100,
      validations: [
        { name: 'required', message: 'Name is required', validator: Validators.required },
      ],
    },
    sortOrder: {
      type: 'input',
      inputType: 'number',
      controlName: 'sortOrder',
      label: 'Sort order',
      placeholder: '0',
    },
    isPaid: {
      type: 'checkbox',
      controlName: 'isPaid',
      label: 'Paid leave',
    },
    carryForward: {
      type: 'checkbox',
      controlName: 'carryForward',
      label: 'Carry forward',
    },
    allowHalfDay: {
      type: 'checkbox',
      controlName: 'allowHalfDay',
      label: 'Allow half day',
    },
    isActive: {
      type: 'checkbox',
      controlName: 'isActive',
      label: 'Active',
    },
  };

  get pageTitle(): string {
    if (this.mode === 'edit') return 'Edit leave type';
    if (this.mode === 'view') return 'View leave type';
    return 'Add leave type';
  }

  get requiresBalance(): boolean {
    return !!this.form.get('isPaid')?.value;
  }

  ngOnInit(): void {
    this.paidSub = this.form.get('isPaid')?.valueChanges.subscribe((paid) => {
      if (!paid) {
        this.form.patchValue({ carryForward: false }, { emitEvent: false });
      }
      this.cdr.markForCheck();
    });

    if (this.leaveTypeId && this.mode !== 'add') {
      this.load(this.leaveTypeId);
    }
    if (this.mode === 'view') {
      this.form.disable();
    }
    if (this.mode !== 'add') {
      this.form.get('code')?.disable({ emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    this.paidSub?.unsubscribe();
  }

  save(): void {
    if (this.mode === 'view' || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const isPaid = !!raw.isPaid;
    const body = {
      code: String(raw.code).trim().toUpperCase(),
      name: String(raw.name).trim(),
      isPaid,
      requiresBalance: isPaid,
      allowHalfDay: !!raw.allowHalfDay,
      carryForward: isPaid ? !!raw.carryForward : false,
      sortOrder: Number(raw.sortOrder) || 0,
      isActive: raw.isActive !== false,
    };

    this.saving = true;
    const req$ =
      this.mode === 'edit' && this.leaveTypeId
        ? this.service.update(this.leaveTypeId, body)
        : this.service.create(body);

    req$.subscribe({
      next: () => {
        this.notify.success(this.mode === 'edit' ? 'Leave type updated' : 'Leave type created');
        this.saving = false;
        this.saved.emit();
      },
      error: (err) => {
        this.notify.error(getUserFacingApiError(err, 'Failed to save leave type'));
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  private load(id: string): void {
    this.service.getById(id).subscribe({
      next: (row) => {
        this.form.patchValue({
          code: row.code,
          name: row.name,
          isPaid: row.isPaid,
          carryForward: row.carryForward,
          allowHalfDay: row.allowHalfDay !== false,
          sortOrder: row.sortOrder ?? 0,
          isActive: row.isActive !== false,
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.notify.error(getUserFacingApiError(err, 'Failed to load leave type'));
      },
    });
  }
}
