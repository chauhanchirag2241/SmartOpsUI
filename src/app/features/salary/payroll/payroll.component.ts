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
  payrollStatusBadgeClass,
} from '../salary.shared';
import { PayrollProcessComponent } from './payroll-process/payroll-process.component';
import { PayrollEntryDetailComponent } from './payroll-entry-detail/payroll-entry-detail.component';
import {
  MonthYearPickerComponent,
  type MonthYearValue,
} from '../../../shared/components/month-year-picker';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    SmartDataTableComponent,
    PayrollProcessComponent,
    PayrollEntryDetailComponent,
    MonthYearPickerComponent,
  ],
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

  payYear = new Date().getFullYear();
  payMonth = new Date().getMonth() + 1;

  payroll: ReturnType<typeof normalizePayrollRun> | null = null;
  loading = false;

  showProcessScreen = false;
  showEntryDetail = false;
  selectedEntryId: string | null = null;

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
      { key: 'grossDisplay', label: 'Gross', sortable: true, align: 'right', width: '100px' },
      { key: 'deductionsDisplay', label: 'Deductions', sortable: true, align: 'right', width: '100px' },
      { key: 'attendanceCutDisplay', label: 'Att. cut', sortable: true, align: 'right', width: '100px' },
      { key: 'daysCutDisplay', label: 'Days cut', sortable: true, align: 'right', width: '90px' },
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
    actions: [{ label: 'View', icon: 'visibility', iconColor: '#3b6d11' }],
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
    const showAttCols = !!this.payroll?.useAttendanceWiseSalary;
    const columns = showAttCols
      ? this.baseTableConfig.columns
      : this.baseTableConfig.columns.filter(
          (c) => c.key !== 'attendanceCutDisplay' && c.key !== 'daysCutDisplay',
        );
    const actions: DataTableAction[] = [{ label: 'View', icon: 'visibility', iconColor: '#3b6d11' }];
    if (this.canMarkPaid()) {
      actions.push({ label: 'Edit', icon: 'edit', iconColor: '#185fa5' });
    }
    return {
      ...this.baseTableConfig,
      columns,
      actions,
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
      grossDisplay: formatInr(e.grossSalary),
      deductionsDisplay: formatInr(e.totalDeductions),
      attendanceCutDisplay: e.attendanceCutAmount > 0 ? formatInr(e.attendanceCutAmount) : '—',
      daysCutDisplay: e.daysCut > 0 ? String(e.daysCut) : '—',
      netDisplay: formatInr(e.netSalary),
    }));
  }

  get monthLabel(): string {
    return MONTH_OPTIONS.find((m) => m.value === this.payMonth)?.label ?? '';
  }

  get tableFilterPanelActive(): boolean {
    const now = new Date();
    return this.payMonth !== now.getMonth() + 1 || this.payYear !== now.getFullYear();
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

  onPeriodFilterChange(period: MonthYearValue): void {
    this.payMonth = period.month;
    this.payYear = period.year;
    this.loadPayroll();
  }

  openProcessScreen(): void {
    if (!this.permissionService.canAdd(MenuCodes.SalaryPayroll)) return;
    this.showProcessScreen = true;
    this.showEntryDetail = false;
    this.selectedEntryId = null;
    this.refresh();
  }

  closeProcessScreen(): void {
    this.showProcessScreen = false;
    this.refresh();
  }

  onPayrollProcessed(): void {
    this.showProcessScreen = false;
    this.loadPayroll();
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
    if (event.action.label === 'View' || event.action.label === 'Edit') {
      this.openEntryDetail(String(event.row['id'] ?? ''));
    }
  }

  openEntryDetail(entryId: string): void {
    if (!entryId) return;
    this.selectedEntryId = entryId;
    this.showEntryDetail = true;
    this.showProcessScreen = false;
    this.refresh();
  }

  closeEntryDetail(): void {
    this.showEntryDetail = false;
    this.selectedEntryId = null;
    this.refresh();
  }

  canProcess(): boolean {
    const alreadyProcessed = this.payroll?.statusLabel === 'Processed';
    return (
      !alreadyProcessed &&
      !this.ayContext.isReadOnlyScope() &&
      this.permissionService.canAdd(MenuCodes.SalaryPayroll)
    );
  }

  canMarkPaid(): boolean {
    return !this.ayContext.isReadOnlyScope() && this.permissionService.canEdit(MenuCodes.SalaryPayroll);
  }

  onExportClicked(): void {
    this.toast('Export will be available in a future update');
  }

  private toast(msg: string, isError = false): void {
    this.snackBar.open(msg, 'Close', { duration: 3500, panelClass: isError ? 'snack-error' : undefined });
  }

  private refresh(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
