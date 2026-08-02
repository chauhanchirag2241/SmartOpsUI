import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../../core/services/notification.service';
import { PayrollService } from '../../../../core/services/payroll.service';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import { SmartDataTableComponent } from '../../../../shared/components/smart-data-table/smart-data-table.component';
import type {
  DataTableBulkAction,
  DataTableConfig,
} from '../../../../shared/components/smart-data-table';
import {
  extractApiError,
  formatInr,
  MONTH_OPTIONS,
  normalizePayrollRun,
} from '../../salary.shared';
import {
  MonthYearPickerComponent,
  type MonthYearValue,
} from '../../../../shared/components/month-year-picker';

type PreviewEntry = ReturnType<typeof normalizePayrollRun>['entries'][number];

@Component({
  selector: 'app-payroll-process',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PageChromeDirective,
    ActionButtonComponent,
    SmartDataTableComponent,
    MonthYearPickerComponent,
  ],
  templateUrl: './payroll-process.component.html',
  styleUrl: '../../salary.shared.css',
  host: { class: 'form-page-shell' },
})
export class PayrollProcessComponent implements OnInit {
  @Input() initialYear = new Date().getFullYear();
  @Input() initialMonth = new Date().getMonth() + 1;
  @Output() cancel = new EventEmitter<void>();
  @Output() processed = new EventEmitter<void>();

  private readonly service = inject(PayrollService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  payYear = new Date().getFullYear();
  payMonth = new Date().getMonth() + 1;
  useAttendanceWiseSalary = false;
  /** Employees who get full salary while attendance-wise is on. */
  fullSalaryEmployeeIds = new Set<string>();

  preview: ReturnType<typeof normalizePayrollRun> | null = null;
  /** Stable reference — do not rebuild on every CD or expand state is cleared. */
  tableRows: Record<string, unknown>[] = [];
  tableConfig: DataTableConfig = this.buildTableConfig();
  loading = false;
  saving = false;

  formatInr = formatInr;

  ngOnInit(): void {
    this.payYear = this.initialYear;
    this.payMonth = this.initialMonth;
    this.loadPreview();
  }

  get monthLabel(): string {
    return MONTH_OPTIONS.find((m) => m.value === this.payMonth)?.label ?? '';
  }

  onPeriodChange(period: MonthYearValue): void {
    this.payMonth = period.month;
    this.payYear = period.year;
    this.loadPreview();
  }

  setAttendanceWise(value: boolean): void {
    if (this.useAttendanceWiseSalary === value) return;
    this.useAttendanceWiseSalary = value;
    if (!value) {
      this.fullSalaryEmployeeIds.clear();
    }
    this.tableConfig = this.buildTableConfig();
    this.loadPreview();
  }

  onBulkActionClicked(event: {
    action: DataTableBulkAction;
    selectedRows: Record<string, unknown>[];
  }): void {
    if (!this.useAttendanceWiseSalary) return;
    const ids = event.selectedRows
      .map((r) => String(r['employeeRecordId'] ?? ''))
      .filter(Boolean);
    if (!ids.length) return;

    if (event.action.label === 'Pay full salary') {
      for (const id of ids) this.fullSalaryEmployeeIds.add(id);
      this.toast(`${ids.length} employee(s) set to full salary`);
      this.loadPreview();
      return;
    }

    if (event.action.label === 'Apply attendance cut') {
      for (const id of ids) this.fullSalaryEmployeeIds.delete(id);
      this.toast(`${ids.length} employee(s) set to attendance-wise`);
      this.loadPreview();
    }
  }

  entryFromRow(row: Record<string, unknown>): PreviewEntry | null {
    const id = String(row['employeeRecordId'] ?? '');
    return this.preview?.entries.find((e) => e.employeeRecordId === id) ?? null;
  }

  detailRows(entry: PreviewEntry): {
    earning: string;
    earningAmt: number;
    deduction: string;
    deductionAmt: number;
  }[] {
    const max = Math.max(entry.earnings.length, entry.deductions.length);
    const rows: {
      earning: string;
      earningAmt: number;
      deduction: string;
      deductionAmt: number;
    }[] = [];
    for (let i = 0; i < max; i++) {
      const er = entry.earnings[i];
      const dr = entry.deductions[i];
      rows.push({
        earning: er?.name ?? '',
        earningAmt: er?.amount ?? 0,
        deduction: dr?.name ?? '',
        deductionAmt: dr?.amount ?? 0,
      });
    }
    return rows;
  }

  loadPreview(): void {
    this.loading = true;
    this.refresh();
    this.service
      .previewPayroll({
        payYear: this.payYear,
        payMonth: this.payMonth,
        useAttendanceWiseSalary: this.useAttendanceWiseSalary,
        fullSalaryEmployeeIds: [...this.fullSalaryEmployeeIds],
      })
      .subscribe({
        next: (raw) => {
          this.preview = normalizePayrollRun(raw);
          if (this.useAttendanceWiseSalary) {
            this.fullSalaryEmployeeIds = new Set(
              this.preview.entries.filter((e) => e.useFullSalaryOverride).map((e) => e.employeeRecordId),
            );
          }
          this.rebuildTableRows();
          this.loading = false;
          this.refresh();
        },
        error: (e) => {
          this.preview = null;
          this.tableRows = [];
          this.loading = false;
          this.toast(extractApiError(e, 'Failed to load payroll preview'), true);
          this.refresh();
        },
      });
  }

  processPayroll(): void {
    if (this.saving) return;
    this.saving = true;
    this.service
      .processPayroll({
        payYear: this.payYear,
        payMonth: this.payMonth,
        useAttendanceWiseSalary: this.useAttendanceWiseSalary,
        fullSalaryEmployeeIds: this.useAttendanceWiseSalary ? [...this.fullSalaryEmployeeIds] : [],
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.toast('Payroll processed');
          this.processed.emit();
        },
        error: (e) => {
          this.saving = false;
          this.toast(extractApiError(e, 'Process failed'), true);
          this.refresh();
        },
      });
  }

  private rebuildTableRows(): void {
    if (!this.preview) {
      this.tableRows = [];
      return;
    }
    this.tableRows = this.preview.entries.map((e) => ({
      ...e,
      modeDisplay: e.useFullSalaryOverride
        ? 'Full salary'
        : this.useAttendanceWiseSalary
          ? 'Attendance'
          : 'Full salary',
      grossDisplay: formatInr(e.grossSalary),
      deductionsDisplay: formatInr(e.totalDeductions),
      attendanceCutDisplay: e.attendanceCutAmount > 0 ? formatInr(e.attendanceCutAmount) : '—',
      daysCutDisplay: e.daysCut > 0 ? String(e.daysCut) : '—',
      netDisplay: formatInr(e.netSalary),
    }));
  }

  private buildTableConfig(): DataTableConfig {
    const bulkActions: DataTableBulkAction[] | undefined = this.useAttendanceWiseSalary
      ? [
          { label: 'Pay full salary', icon: 'payments' },
          { label: 'Apply attendance cut', icon: 'event_busy' },
        ]
      : undefined;

    return {
      header: {
        title: 'Employee salary preview',
        subtitle: this.useAttendanceWiseSalary
          ? 'Expand a row for component details. Select employees to pay full salary (no attendance cut).'
          : 'Expand a row for salary component details before processing.',
        showAddButton: false,
      },
      columns: [
        { key: 'employeeName', label: 'Employee', sortable: true },
        { key: 'department', label: 'Department', sortable: true },
        { key: 'modeDisplay', label: 'Mode', sortable: true, width: '110px' },
        { key: 'grossDisplay', label: 'Gross', sortable: true, align: 'right', width: '100px' },
        { key: 'deductionsDisplay', label: 'Deductions', sortable: true, align: 'right', width: '100px' },
        { key: 'attendanceCutDisplay', label: 'Att. cut', sortable: true, align: 'right', width: '100px' },
        { key: 'daysCutDisplay', label: 'Days cut', sortable: true, align: 'right', width: '90px' },
        { key: 'netDisplay', label: 'Net salary', sortable: true, align: 'right', width: '110px' },
      ],
      searchPlaceholder: 'Search employee...',
      searchKeys: ['employeeName', 'department'],
      itemLabel: 'employees',
      defaultPageSize: 10,
      showExport: false,
      expandableRows: true,
      expandRowKey: 'employeeRecordId',
      expandAccordion: true,
      bulkActions,
    };
  }

  private toast(msg: string, isError = false): void {
    this.snackBar.open(msg, 'Close', { duration: 3500, panelClass: isError ? 'snack-error' : undefined });
  }

  private refresh(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
