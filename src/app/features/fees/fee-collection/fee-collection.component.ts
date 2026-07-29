import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { FeeCollectionService } from '../../../core/services/fee-collection.service';
import { ClassService } from '../../../core/services/class.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { ListPageHeaderComponent } from '../../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../../shared/components/page-toolbar/page-toolbar.component';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  FEE_PAYMENT_MODE_OPTIONS,
  FeePaymentMode,
  asArray,
  extractApiError,
  formatInr,
  normalizeStudentDetail,
  normalizeStudentListItem,
  pick,
  studentInitials,
} from '../fees.shared';
import { Subject, distinctUntilChanged, filter, map, switchMap } from 'rxjs';

type CollectAllocRow = {
  installmentId: string;
  feeHeadId: string;
  label: string;
  feeHeadName: string;
  amount: number;
  checked: boolean;
  isDiscount: boolean;
};

@Component({
  selector: 'app-fee-collection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSnackBarModule,
    ListPageHeaderComponent,
    PageToolbarComponent,
    DynamicFieldComponent,
  ],
  templateUrl: './fee-collection.component.html',
  styleUrl: '../fees.shared.css',
})
export class FeeCollectionComponent {
  private readonly service = inject(FeeCollectionService);
  private readonly classService = inject(ClassService);
  readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly studentsQuery$ = new Subject<string>();

  students: ReturnType<typeof normalizeStudentListItem>[] = [];
  classes: { id: string; name: string }[] = [];
  academicYearId = '';
  searchQuery = '';
  selectedStudentId = '';
  detail: ReturnType<typeof normalizeStudentDetail> | null = null;
  expandedHeadIds = new Set<string>();
  showCollectModal = false;
  collectingInProgress = false;

  readonly filterForm = this.fb.group({
    classFilter: [''],
    statusFilter: [''],
  });

  classConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'classFilter',
    label: 'Class',
    placeholder: 'Select class',
    options: [{ label: 'Select class', value: '' }],
  };

  statusConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'statusFilter',
    label: 'Fee status',
    placeholder: 'All students',
    options: [
      { label: 'All students', value: '' },
      { label: 'Fully paid', value: 'paid' },
      { label: 'Partial', value: 'partial' },
      { label: 'Overdue', value: 'unpaid' },
    ],
    disabled: true,
  };

  paymentModes = FEE_PAYMENT_MODE_OPTIONS;
  collectForm = {
    amount: 0,
    paymentMode: FeePaymentMode.Cash,
    transactionNo: '',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '',
    allocations: [] as CollectAllocRow[],
  };

  private lastYearKey = '';
  private lastStudentQueryKey = '';
  private studentsRequestSeq = 0;

  get classFilter(): string {
    return String(this.filterForm.get('classFilter')?.value ?? '');
  }

  get statusFilter(): string {
    return String(this.filterForm.get('statusFilter')?.value ?? '');
  }

  constructor() {
    this.filterForm.get('statusFilter')?.disable({ emitEvent: false });

    this.filterForm
      .get('classFilter')!
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe(() => this.onClassFilterChange());
    this.filterForm
      .get('statusFilter')!
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe(() => this.onListFiltersChange());

    toObservable(this.ayContext.effectiveYearKey)
      .pipe(
        filter((key): key is string => !!key && key !== 'none'),
        distinctUntilChanged(),
        switchMap((yearKey) => {
          this.applyAcademicYearChange(yearKey);
          return this.classService.getClassDropdown(yearKey).pipe(
            map((items) => ({ yearKey, items })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: ({ yearKey, items }) => this.applyClassDropdown(items, yearKey),
        error: () => {
          const yearKey = this.ayContext.effectiveYearKey();
          if (yearKey && yearKey !== 'none') {
            this.applyClassDropdown([], yearKey);
          }
        },
      });

    this.studentsQuery$
      .pipe(
        switchMap((queryKey) => {
          const yearId = this.ayContext.effectiveYearId() ?? this.academicYearId;
          const requestSeq = ++this.studentsRequestSeq;
          const yearKey = this.ayContext.effectiveYearKey();
          const parts = queryKey.split('|');
          const classId = parts[1] ?? '';
          return this.service.getStudents(classId, yearId || undefined, parts[2] || undefined, parts[3] || undefined).pipe(
            map((list) => ({ list, requestSeq, yearKey, queryKey })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: ({ list, requestSeq, yearKey, queryKey }) => {
          if (requestSeq !== this.studentsRequestSeq || yearKey !== this.ayContext.effectiveYearKey()) {
            return;
          }
          if (queryKey !== this.lastStudentQueryKey) {
            return;
          }
          this.students = asArray(list).map(normalizeStudentListItem);
          this.cdr.markForCheck();
        },
        error: () => {
          this.students = [];
          this.toast('Failed to load students', true);
          this.cdr.markForCheck();
        },
      });
  }

  private applyAcademicYearChange(yearKey: string): void {
    if (yearKey === this.lastYearKey) {
      return;
    }
    this.lastYearKey = yearKey;
    this.lastStudentQueryKey = '';
    this.academicYearId = yearKey;
    this.filterForm.patchValue({ classFilter: '', statusFilter: '' }, { emitEvent: false });
    this.syncStatusDisabled();
    this.searchQuery = '';
    this.students = [];
    this.selectedStudentId = '';
    this.detail = null;
    this.closeCollectModal();
    this.cdr.markForCheck();
  }

  private applyClassDropdown(items: unknown, yearKey: string): void {
    if (yearKey !== this.lastYearKey) {
      return;
    }
    this.classes = asArray(items).map((x) => ({
      id: String(pick(x, 'id', 'Id') ?? ''),
      name: String(pick(x, 'name', 'Name') ?? ''),
    }));
    this.classConfig = {
      ...this.classConfig,
      options: [
        { label: 'Select class', value: '' },
        ...this.classes.map((c) => ({ label: c.name, value: c.id })),
      ],
    };
    if (this.classFilter && !this.classes.some((cls) => cls.id === this.classFilter)) {
      this.filterForm.patchValue({ classFilter: '' }, { emitEvent: false });
      this.syncStatusDisabled();
      this.students = [];
      this.selectedStudentId = '';
      this.detail = null;
      this.lastStudentQueryKey = '';
    }
    this.cdr.markForCheck();
  }

  private syncStatusDisabled(): void {
    const control = this.filterForm.get('statusFilter');
    const disabled = !this.classFilter;
    this.statusConfig = { ...this.statusConfig, disabled };
    if (disabled) {
      control?.disable({ emitEvent: false });
    } else {
      control?.enable({ emitEvent: false });
    }
  }

  onToolbarSearchSubmit(q: string): void {
    this.searchQuery = q;
    if (this.classFilter) {
      this.loadStudents();
    }
  }

  onClassFilterChange(): void {
    this.syncStatusDisabled();
    this.selectedStudentId = '';
    this.detail = null;
    this.closeCollectModal();
    if (!this.classFilter) {
      this.students = [];
      this.searchQuery = '';
      this.lastStudentQueryKey = '';
      this.cdr.markForCheck();
      return;
    }
    this.loadStudents();
  }

  onListFiltersChange(): void {
    if (!this.classFilter) {
      return;
    }
    this.loadStudents();
  }

  loadStudents(): void {
    if (!this.classFilter) {
      this.students = [];
      this.lastStudentQueryKey = '';
      this.cdr.markForCheck();
      return;
    }

    const yearId = this.ayContext.effectiveYearId() ?? this.academicYearId;
    const queryKey = `${yearId}|${this.classFilter}|${this.searchQuery}|${this.statusFilter}`;
    if (queryKey === this.lastStudentQueryKey) {
      return;
    }
    this.lastStudentQueryKey = queryKey;
    if (yearId) {
      this.academicYearId = yearId;
    }

    this.studentsQuery$.next(queryKey);
  }

  get canCollectFee(): boolean {
    return (
      !this.ayContext.isReadOnlyScope() &&
      !!this.detail &&
      this.detail.dueAmount > 0 &&
      !this.collectingInProgress
    );
  }

  get selectedAllocCount(): number {
    return this.collectForm.allocations.filter((a) => a.checked && a.amount > 0).length;
  }

  get selectedAllocDue(): number {
    return this.collectForm.allocations
      .filter((a) => a.checked && a.amount > 0)
      .reduce((sum, a) => sum + (a.amount || 0), 0);
  }

  get cappedCollectAmount(): number {
    const raw = this.selectedAllocDue;
    const netDue = this.detail?.dueAmount ?? raw;
    if (raw <= 0) {
      return netDue;
    }
    return Math.min(raw, netDue);
  }

  isHeadExpanded(feeHeadId: string): boolean {
    return this.expandedHeadIds.has(feeHeadId);
  }

  toggleHeadExpand(feeHeadId: string): void {
    if (this.expandedHeadIds.has(feeHeadId)) {
      this.expandedHeadIds.delete(feeHeadId);
    } else {
      this.expandedHeadIds.add(feeHeadId);
    }
    this.cdr.markForCheck();
  }

  toggleAllocation(row: CollectAllocRow): void {
    if (this.collectingInProgress || row.isDiscount || row.amount <= 0) return;
    row.checked = !row.checked;
    this.syncCollectAmountToSelection();
  }

  onAllocationCheckChange(): void {
    this.syncCollectAmountToSelection();
  }

  private syncCollectAmountToSelection(): void {
    const max = this.cappedCollectAmount;
    if (max > 0) {
      this.collectForm.amount = max;
    }
  }

  selectStudent(id: string): void {
    this.closeCollectModal();
    this.collectingInProgress = false;
    this.selectedStudentId = id;
    this.expandedHeadIds = new Set();
    const yearId = this.ayContext.effectiveYearId() ?? this.academicYearId;
    const yearKey = this.ayContext.effectiveYearKey();
    this.service.getStudentDetail(id, yearId || undefined).subscribe({
        next: (d) => {
          if (yearKey !== this.ayContext.effectiveYearKey()) {
            return;
          }
          this.detail = normalizeStudentDetail(d);
          for (const h of this.detail.feeHeads) {
            if (h.installments.length > 1) {
              this.expandedHeadIds.add(h.feeHeadId);
            }
          }
          this.cdr.markForCheck();
        },
        error: (e) => this.toast(extractApiError(e, 'Failed to load student fees'), true),
      });
  }

  openCollect(): void {
    const detail = this.detail;
    if (!detail || detail.dueAmount <= 0 || this.collectingInProgress) return;

    const allocations: CollectAllocRow[] = [];
    for (const h of detail.feeHeads) {
      for (const inst of h.installments) {
        // Zero remaining: skip. Positive = payable. Negative = discount (show, not selectable).
        if (inst.dueAmount === 0) continue;
        const isDiscount = inst.dueAmount < 0 || inst.totalAmount < 0;
        allocations.push({
          installmentId: inst.installmentId,
          feeHeadId: inst.feeHeadId || h.feeHeadId,
          label: inst.periodLabel || h.feeHeadName,
          feeHeadName: h.feeHeadName,
          amount: inst.dueAmount,
          checked: !isDiscount && this.isCurrentPeriod(inst.periodLabel),
          isDiscount,
        });
      }
    }

    if (!allocations.some((a) => a.checked)) {
      for (const a of allocations) {
        if (!a.isDiscount && a.amount > 0) {
          a.checked = true;
        }
      }
    }

    this.collectForm = {
      amount: detail.dueAmount,
      paymentMode: FeePaymentMode.Cash,
      transactionNo: '',
      paymentDate: new Date().toISOString().split('T')[0],
      remarks: '',
      allocations,
    };
    this.syncCollectAmountToSelection();
    this.showCollectModal = true;
    this.cdr.markForCheck();
  }

  private isCurrentPeriod(periodLabel: string): boolean {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const year = now.getFullYear().toString();
    return periodLabel.includes(month) && periodLabel.includes(year);
  }

  closeCollectModal(): void {
    if (this.collectingInProgress) return;
    this.showCollectModal = false;
    this.cdr.markForCheck();
  }

  collectFee(): void {
    if (this.collectingInProgress || !this.canCollectFee) return;

    if (!this.selectedStudentId || !this.collectForm.amount) {
      this.toast('Enter amount', true);
      return;
    }

    if (this.detail && this.collectForm.amount > this.detail.dueAmount) {
      this.toast('Amount cannot exceed due balance', true);
      return;
    }

    if (this.collectForm.amount > this.cappedCollectAmount) {
      this.toast(`Amount cannot exceed ${formatInr(this.cappedCollectAmount)} on selected installments`, true);
      return;
    }

    const selected = this.collectForm.allocations.filter((a) => a.checked && a.amount > 0 && !a.isDiscount);
    if (!selected.length) {
      this.toast('Select at least one installment', true);
      return;
    }

    const allocations = selected.map((a) => ({
      feeHeadId: a.feeHeadId,
      installmentId: a.installmentId || null,
      amount: 0,
    }));

    const collectedAmount = this.collectForm.amount;
    this.collectingInProgress = true;
    this.cdr.markForCheck();

    this.service
      .collectFee({
        studentId: this.selectedStudentId,
        amount: collectedAmount,
        paymentMode: this.collectForm.paymentMode,
        transactionNo: this.collectForm.transactionNo || null,
        paymentDate: this.collectForm.paymentDate,
        remarks: this.collectForm.remarks || null,
        allocations,
        academicYearId: this.academicYearId || null,
      })
      .subscribe({
        next: (res) => {
          this.collectingInProgress = false;
          this.showCollectModal = false;
          this.detail = normalizeStudentDetail(pick(res, 'studentDetail', 'StudentDetail') ?? res);
          this.lastStudentQueryKey = '';
          this.loadStudents();
          this.toast(formatInr(collectedAmount) + ' collected');
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.collectingInProgress = false;
          this.toast(extractApiError(e, 'Collection failed'), true);
          this.cdr.markForCheck();
        },
      });
  }

  statusBadgeClass(status: string): string {
    if (status === 'Fully paid' || status === 'Paid') return 'b-green';
    if (status === 'Partial') return 'b-amber';
    if (status === 'Overdue') return 'b-red';
    if (status === 'Pending' || status === 'Not paid' || status === 'Unpaid') return 'b-amber';
    return 'b-gray';
  }

  formatInr = formatInr;
  studentInitials = studentInitials;

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', { duration: 2800, panelClass: error ? 'snack-error' : 'snack-success' });
  }
}
