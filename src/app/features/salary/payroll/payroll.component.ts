import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PayrollService } from '../../../core/services/payroll.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import {
  extractApiError,
  formatInr,
  MONTH_OPTIONS,
  normalizePayrollRun,
  normalizePayslip,
  payrollStatusBadgeClass,
} from '../salary.shared';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './payroll.component.html',
  styleUrl: '../salary.shared.css',
})
export class PayrollComponent implements OnInit {
  private readonly service = inject(PayrollService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  monthOptions = MONTH_OPTIONS;
  payYear = new Date().getFullYear();
  payMonth = new Date().getMonth() + 1;

  payroll: ReturnType<typeof normalizePayrollRun> | null = null;
  loading = false;
  selectedEntryIds = new Set<string>();

  showProcessModal = false;
  showPayslipModal = false;
  processForm = { useAttendanceWiseSalary: false };
  payslip: ReturnType<typeof normalizePayslip> | null = null;

  formatInr = formatInr;
  payrollStatusBadgeClass = payrollStatusBadgeClass;

  ngOnInit(): void {
    this.loadPayroll();
  }

  get monthLabel(): string {
    return this.monthOptions.find((m) => m.value === this.payMonth)?.label ?? '';
  }

  loadPayroll(): void {
    this.loading = true;
    this.selectedEntryIds.clear();
    this.refresh();
    this.service.getPayroll(this.payYear, this.payMonth).subscribe({
      next: (raw) => {
        this.payroll = normalizePayrollRun(raw);
        this.loading = false;
        this.refresh();
      },
      error: (e) => {
        this.loading = false;
        this.payroll = null;
        this.toast(extractApiError(e, 'Failed to load payroll'), true);
        this.refresh();
      },
    });
  }

  openProcessModal(): void {
    if (!this.permissionService.canAdd(MenuCodes.SalaryPayroll)) return;
    this.processForm = {
      useAttendanceWiseSalary: this.payroll?.useAttendanceWiseSalary ?? false,
    };
    this.showProcessModal = true;
    this.refresh();
  }

  processPayroll(): void {
    this.service
      .processPayroll({
        payYear: this.payYear,
        payMonth: this.payMonth,
        useAttendanceWiseSalary: this.processForm.useAttendanceWiseSalary,
      })
      .subscribe({
        next: (raw) => {
          this.payroll = normalizePayrollRun(raw);
          this.showProcessModal = false;
          this.toast('Payroll processed');
          this.refresh();
        },
        error: (e) => this.toast(extractApiError(e, 'Process failed'), true),
      });
  }

  toggleSelectAll(checked: boolean): void {
    if (!this.payroll) return;
    this.selectedEntryIds.clear();
    if (checked) {
      this.payroll.entries.forEach((e) => this.selectedEntryIds.add(e.id));
    }
    this.refresh();
  }

  toggleEntry(id: string, checked: boolean): void {
    if (checked) this.selectedEntryIds.add(id);
    else this.selectedEntryIds.delete(id);
    this.refresh();
  }

  isAllSelected(): boolean {
    return !!this.payroll?.entries.length && this.selectedEntryIds.size === this.payroll.entries.length;
  }

  markSelectedPaid(): void {
    if (!this.payroll?.id || !this.permissionService.canEdit(MenuCodes.SalaryPayroll)) return;
    const ids = [...this.selectedEntryIds];
    this.service.markPaid(this.payroll.id, ids.length ? ids : undefined).subscribe({
      next: () => {
        this.toast('Marked as paid');
        this.loadPayroll();
      },
      error: (e) => this.toast(extractApiError(e, 'Update failed'), true),
    });
  }

  openPayslip(entryId: string): void {
    this.service.getPayslip(entryId).subscribe({
      next: (raw) => {
        this.payslip = normalizePayslip(raw);
        this.showPayslipModal = true;
        this.refresh();
      },
      error: (e) => this.toast(extractApiError(e, 'Failed to load payslip'), true),
    });
  }

  canProcess(): boolean {
    return this.permissionService.canAdd(MenuCodes.SalaryPayroll);
  }

  canMarkPaid(): boolean {
    return this.permissionService.canEdit(MenuCodes.SalaryPayroll);
  }

  exportPlaceholder(type: string): void {
    this.toast(`${type} export will be available in a future update`);
  }

  payslipRows(): { earning: string; earningAmt: number; deduction: string; deductionAmt: number }[] {
    if (!this.payslip) return [];
    const max = Math.max(this.payslip.earnings.length, this.payslip.deductions.length);
    const rows: { earning: string; earningAmt: number; deduction: string; deductionAmt: number }[] = [];
    for (let i = 0; i < max; i++) {
      const er = this.payslip.earnings[i];
      const dr = this.payslip.deductions[i];
      rows.push({
        earning: er?.name ?? '',
        earningAmt: er?.amount ?? 0,
        deduction: dr?.name ?? '',
        deductionAmt: dr?.amount ?? 0,
      });
    }
    return rows;
  }

  private toast(msg: string, isError = false): void {
    this.snackBar.open(msg, 'Close', { duration: 3500, panelClass: isError ? 'snack-error' : undefined });
  }

  private refresh(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
