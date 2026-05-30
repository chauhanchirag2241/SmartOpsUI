import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { PayrollService } from '../../../core/services/payroll.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table/smart-data-table.component';
import type { DataTableAction, DataTableBulkAction, DataTableConfig } from '../../../shared/components/smart-data-table';
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
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, SmartDataTableComponent],
  templateUrl: './payroll.component.html',
  styleUrl: '../salary.shared.css',
})
export class PayrollComponent implements OnInit {
  private readonly service = inject(PayrollService);
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  monthOptions = MONTH_OPTIONS;
  payYear = new Date().getFullYear();
  payMonth = new Date().getMonth() + 1;

  payroll: ReturnType<typeof normalizePayrollRun> | null = null;
  loading = false;

  showProcessModal = false;
  showPayslipModal = false;
  processForm = { useAttendanceWiseSalary: false };
  payslip: ReturnType<typeof normalizePayslip> | null = null;

  formatInr = formatInr;
  payrollStatusBadgeClass = payrollStatusBadgeClass;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Salary Management — Payroll',
      subtitle: 'Process monthly payroll and view payslips',
      showAddButton: false,
      addButtonText: 'Process payroll',
      addButtonIcon: 'play_arrow',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'employeeName', label: 'Employee', sortable: true },
      { key: 'department', label: 'Department', sortable: true },
      { key: 'basicDisplay', label: 'Basic', sortable: true, align: 'right', width: '100px' },
      { key: 'hraDisplay', label: 'HRA', sortable: true, align: 'right', width: '90px' },
      { key: 'allowancesDisplay', label: 'Allowances', sortable: true, align: 'right', width: '100px' },
      { key: 'grossDisplay', label: 'Gross', sortable: true, align: 'right', width: '100px' },
      { key: 'deductionsDisplay', label: 'Deductions', sortable: true, align: 'right', width: '100px' },
      { key: 'netDisplay', label: 'Net salary', sortable: true, align: 'right', width: '110px' },
      {
        key: 'statusLabel',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Draft: { cssClass: 'b-amber', label: 'Draft' },
          Processed: { cssClass: 'b-blue', label: 'Processed' },
          Paid: { cssClass: 'b-green', label: 'Paid' },
        },
      },
    ],
    filtersInPanel: true,
    actions: [{ label: 'Payslip', icon: 'receipt', iconColor: '#639922' }],
    searchPlaceholder: 'Search employee...',
    searchKeys: ['employeeName', 'department'],
    itemLabel: 'entries',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.loadPayroll();
  }

  get tableConfig(): DataTableConfig {
    const bulkActions: DataTableBulkAction[] | undefined =
      this.canMarkPaid() && (this.payroll?.entries.length ?? 0) > 0
        ? [{ label: 'Mark paid', icon: 'check_circle' }]
        : undefined;
    return {
      ...this.baseTableConfig,
      header: {
        ...this.baseTableConfig.header!,
        showAddButton: this.canProcess(),
      },
      bulkActions,
    };
  }

  get tableRows(): Record<string, unknown>[] {
    if (!this.payroll) return [];
    return this.payroll.entries.map((e) => ({
      ...e,
      basicDisplay: formatInr(e.basicSalary),
      hraDisplay: formatInr(e.hraAmount),
      allowancesDisplay: formatInr(e.allowances),
      grossDisplay: formatInr(e.grossSalary),
      deductionsDisplay: formatInr(e.totalDeductions),
      netDisplay: formatInr(e.netSalary),
    }));
  }

  get monthLabel(): string {
    return this.monthOptions.find((m) => m.value === this.payMonth)?.label ?? '';
  }

  get tableFilterPanelActive(): boolean {
    const now = new Date();
    return this.payMonth !== now.getMonth() + 1 || this.payYear !== now.getFullYear();
  }

  get yearOptions(): number[] {
    return [this.payYear - 1, this.payYear, this.payYear + 1];
  }

  loadPayroll(): void {
    if (!this.payroll) {
      this.loading = true;
    }
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

  onTableFiltersCleared(): void {
    const now = new Date();
    this.payMonth = now.getMonth() + 1;
    this.payYear = now.getFullYear();
    this.loadPayroll();
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

  onBulkActionClicked(event: { action: DataTableBulkAction; selectedRows: Record<string, unknown>[] }): void {
    if (event.action.label !== 'Mark paid' || !this.payroll?.id) return;
    const ids = event.selectedRows.map((r) => String(r['id'] ?? '')).filter(Boolean);
    this.service.markPaid(this.payroll.id, ids.length ? ids : undefined).subscribe({
      next: () => {
        this.toast('Marked as paid');
        this.loadPayroll();
      },
      error: (e) => this.toast(extractApiError(e, 'Update failed'), true),
    });
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    if (event.action.label === 'Payslip') {
      this.openPayslip(String(event.row['id'] ?? ''));
    }
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
    return !this.ayContext.isReadOnlyScope() && this.permissionService.canAdd(MenuCodes.SalaryPayroll);
  }

  canMarkPaid(): boolean {
    return !this.ayContext.isReadOnlyScope() && this.permissionService.canEdit(MenuCodes.SalaryPayroll);
  }

  onExportClicked(): void {
    this.toast('Export will be available in a future update');
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
