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
  formatInr,
  normalizeDropdownItem,
  normalizeStudentDetail,
  normalizeStudentListItem,
  pick,
  studentInitials,
} from '../fees.shared';

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
  showCollectModal = false;

  paymentModes = FEE_PAYMENT_MODE_OPTIONS;
  collectForm = {
    amount: 0,
    paymentMode: FeePaymentMode.Cash,
    transactionNo: '',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '',
    allocations: [] as { feeTypeId: string; amount: number; checked: boolean }[],
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

  selectStudent(id: string): void {
    this.selectedStudentId = id;
    this.service.getStudentDetail(id, this.academicYearId || undefined).subscribe({
      next: (d) => {
        this.detail = normalizeStudentDetail(d);
        this.refreshView();
      },
      error: () => this.toast('Failed to load student fees', true),
    });
  }

  openCollect(): void {
    if (!this.detail) return;
    this.collectForm = {
      amount: this.detail.dueAmount ?? 0,
      paymentMode: FeePaymentMode.Cash,
      transactionNo: '',
      paymentDate: new Date().toISOString().split('T')[0],
      remarks: '',
      allocations: (this.detail.feeHeads ?? []).map((h) => ({
        feeTypeId: h.feeTypeId,
        amount: h.dueAmount,
        checked: true,
      })),
    };
    this.showCollectModal = true;
    this.refreshView();
  }

  collectFee(): void {
    if (!this.selectedStudentId || !this.collectForm.amount) {
      this.toast('Enter amount', true);
      return;
    }
    const allocations = this.collectForm.allocations
      .filter((a) => a.checked && a.amount > 0)
      .map((a) => ({ feeTypeId: a.feeTypeId, amount: a.amount }));

    this.service
      .collectFee({
        studentId: this.selectedStudentId,
        amount: this.collectForm.amount,
        paymentMode: this.collectForm.paymentMode,
        transactionNo: this.collectForm.transactionNo || null,
        paymentDate: this.collectForm.paymentDate,
        remarks: this.collectForm.remarks || null,
        allocations,
      })
      .subscribe({
        next: (res) => {
          this.showCollectModal = false;
          this.detail = normalizeStudentDetail(pick(res, 'studentDetail', 'StudentDetail') ?? res);
          this.loadStudents();
          this.toast(formatInr(this.collectForm.amount) + ' collected');
          this.refreshView();
        },
        error: (e) => this.toast(e?.error ?? 'Collection failed', true),
      });
  }

  statusBadgeClass(status: string): string {
    if (status === 'Fully paid') return 'b-green';
    if (status === 'Partial') return 'b-amber';
    if (status === 'Not paid') return 'b-red';
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
