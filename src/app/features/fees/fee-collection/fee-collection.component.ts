import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FeeCollectionService } from '../../../core/services/fee-collection.service';
import { ClassService } from '../../../core/services/class.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import {
  FEE_PAYMENT_MODE_OPTIONS,
  FeePaymentMode,
  asArray,
  extractApiError,
  formatInr,
  normalizeDropdownItem,
  normalizeStudentDetail,
  normalizeStudentListItem,
  pick,
  studentInitials,
} from '../fees.shared';

type CollectAllocRow = {
  installmentId: string;
  feeTypeId: string;
  label: string;
  feeTypeName: string;
  amount: number;
  checked: boolean;
};

@Component({
  selector: 'app-fee-collection',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './fee-collection.component.html',
  styleUrl: '../fees.shared.css',
})
export class FeeCollectionComponent implements OnInit {
  private readonly service = inject(FeeCollectionService);
  private readonly classService = inject(ClassService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  students: ReturnType<typeof normalizeStudentListItem>[] = [];
  classes: { id: string; name: string }[] = [];
  academicYearId = '';
  classFilter = '';
  statusFilter = '';
  searchQuery = '';
  selectedStudentId = '';
  detail: ReturnType<typeof normalizeStudentDetail> | null = null;
  expandedHeadIds = new Set<string>();
  showCollectModal = false;
  collectingInProgress = false;

  paymentModes = FEE_PAYMENT_MODE_OPTIONS;
  collectForm = {
    amount: 0,
    paymentMode: FeePaymentMode.Cash,
    transactionNo: '',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '',
    allocations: [] as CollectAllocRow[],
  };

  ngOnInit(): void {
    this.classService.getClassDropdown().subscribe({
      next: (c) => {
        this.classes = asArray(c).map((x) => ({
          id: String(pick(x, 'id', 'Id') ?? ''),
          name: String(pick(x, 'name', 'Name') ?? ''),
        }));
        this.refreshView();
      },
    });

    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        const list = asArray(years).map(normalizeDropdownItem);
        const first = list[0];
        if (first?.id) {
          this.academicYearId = first.id;
          this.loadStudents();
        }
        this.refreshView();
      },
    });
  }

  loadStudents(): void {
    this.service
      .getStudents(
        this.classFilter || undefined,
        this.academicYearId || undefined,
        this.searchQuery || undefined,
        this.statusFilter || undefined,
      )
      .subscribe({
        next: (list) => {
          this.students = asArray(list).map(normalizeStudentListItem);
          this.refreshView();
        },
        error: () => {
          this.students = [];
          this.toast('Failed to load students', true);
          this.refreshView();
        },
      });
  }

  get canCollectFee(): boolean {
    return !!this.detail && this.detail.dueAmount > 0 && !this.collectingInProgress;
  }

  get selectedAllocCount(): number {
    return this.collectForm.allocations.filter((a) => a.checked).length;
  }

  get selectedAllocDue(): number {
    return this.collectForm.allocations
      .filter((a) => a.checked)
      .reduce((sum, a) => sum + (a.amount || 0), 0);
  }

  isHeadExpanded(feeTypeId: string): boolean {
    return this.expandedHeadIds.has(feeTypeId);
  }

  toggleHeadExpand(feeTypeId: string): void {
    if (this.expandedHeadIds.has(feeTypeId)) {
      this.expandedHeadIds.delete(feeTypeId);
    } else {
      this.expandedHeadIds.add(feeTypeId);
    }
    this.refreshView();
  }

  toggleAllocation(row: CollectAllocRow): void {
    if (this.collectingInProgress || row.amount <= 0) return;
    row.checked = !row.checked;
    this.syncCollectAmountToSelection();
  }

  onAllocationCheckChange(): void {
    this.syncCollectAmountToSelection();
  }

  private syncCollectAmountToSelection(): void {
    const max = this.selectedAllocDue;
    if (max > 0 && this.collectForm.amount > max) {
      this.collectForm.amount = max;
    }
  }

  selectStudent(id: string): void {
    this.closeCollectModal();
    this.collectingInProgress = false;
    this.selectedStudentId = id;
    this.expandedHeadIds = new Set();
    this.service.getStudentDetail(id, this.academicYearId || undefined).subscribe({
      next: (d) => {
        this.detail = normalizeStudentDetail(d);
        for (const h of this.detail.feeHeads) {
          if (h.installments.length > 1) {
            this.expandedHeadIds.add(h.feeTypeId);
          }
        }
        this.refreshView();
      },
      error: () => this.toast('Failed to load student fees', true),
    });
  }

  openCollect(): void {
    const detail = this.detail;
    if (!detail || detail.dueAmount <= 0 || this.collectingInProgress) return;

    const allocations: CollectAllocRow[] = [];
    for (const h of detail.feeHeads) {
      for (const inst of h.installments) {
        if (inst.dueAmount <= 0) continue;
        allocations.push({
          installmentId: inst.installmentId,
          feeTypeId: inst.feeTypeId || h.feeTypeId,
          label: inst.periodLabel || h.feeTypeName,
          feeTypeName: h.feeTypeName,
          amount: inst.dueAmount,
          checked: this.isCurrentPeriod(inst.periodLabel),
        });
      }
    }

    if (!allocations.some((a) => a.checked)) {
      for (const a of allocations) {
        a.checked = true;
      }
    }

    this.collectForm = {
      amount: allocations.filter((a) => a.checked).reduce((s, a) => s + a.amount, 0) || detail.dueAmount,
      paymentMode: FeePaymentMode.Cash,
      transactionNo: '',
      paymentDate: new Date().toISOString().split('T')[0],
      remarks: '',
      allocations,
    };
    this.syncCollectAmountToSelection();
    this.showCollectModal = true;
    this.refreshView();
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
    this.refreshView();
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

    if (this.collectForm.amount > this.selectedAllocDue) {
      this.toast(`Amount cannot exceed ${formatInr(this.selectedAllocDue)} on selected installments`, true);
      return;
    }

    const selected = this.collectForm.allocations.filter((a) => a.checked);
    if (!selected.length) {
      this.toast('Select at least one installment', true);
      return;
    }

    const allocations = selected.map((a) => ({
      feeTypeId: a.feeTypeId,
      installmentId: a.installmentId || null,
      amount: 0,
    }));

    const collectedAmount = this.collectForm.amount;
    this.collectingInProgress = true;
    this.refreshView();

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
          this.loadStudents();
          this.toast(formatInr(collectedAmount) + ' collected');
          this.refreshView();
        },
        error: (e) => {
          this.collectingInProgress = false;
          this.toast(extractApiError(e, 'Collection failed'), true);
          this.refreshView();
        },
      });
  }

  statusBadgeClass(status: string): string {
    if (status === 'Fully paid' || status === 'Paid') return 'b-green';
    if (status === 'Partial') return 'b-amber';
    if (status === 'Not paid' || status === 'Unpaid') return 'b-red';
    return 'b-gray';
  }

  formatInr = formatInr;
  studentInitials = studentInitials;

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', { duration: 2800, panelClass: error ? 'snack-error' : 'snack-success' });
  }
}
