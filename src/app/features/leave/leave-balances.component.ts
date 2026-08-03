import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MenuCodes } from '../../core/constants/menu-codes';
import {
  LeaveBalanceDto,
  LeaveBalanceService,
  LeaveLedgerDto,
} from '../../core/services/leave-balance.service';
import { LeaveTypeDto, LeaveTypeService } from '../../core/services/leave-type.service';
import {
  EmployeeDropdownItem,
  EmployeeService,
} from '../../core/services/employee.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';
import { ErpDialogShellComponent } from '../../shared/components/erp-dialog-shell/erp-dialog-shell.component';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../shared/interfaces/data-table.interface';
import { FormFieldComponent } from '../../shared/form-controls/form-field';
import type { FormFieldOption } from '../../shared/form-controls/form-field';
import { ERP_FORM_DIALOG_WIDTH } from '../../shared/constants/dialog.constants';
import { getUserFacingApiError } from '../../shared/utils/api-error.util';
import { ledgerTxnTypeLabel } from './leave.shared';

interface AddLeaveDialogData {
  employees: EmployeeDropdownItem[];
  leaveTypes: LeaveTypeDto[];
  presetEmployeeId?: string;
}

interface LedgerDialogData {
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
}

@Component({
  selector: 'app-add-leave-balance-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, ErpDialogShellComponent, FormFieldComponent],
  template: `
    <app-erp-dialog-shell
      title="Add leave"
      subtitle="Credit days to an employee balance (manual adjustment)"
      [width]="dialogWidth"
      [showSave]="true"
      saveLabel="Add leave"
      savingLabel="Saving…"
      [saving]="saving"
      (cancel)="ref.close(false)"
      (save)="save()"
    >
      <div class="dialog-grid">
        <app-form-field
          label="Employee"
          type="select"
          [(ngModel)]="employeeId"
          [options]="employeeOptions"
          emptyOptionLabel="Select employee"
          [required]="true"
        />
        <app-form-field
          label="Leave type"
          type="select"
          [(ngModel)]="leaveTypeId"
          [options]="leaveTypeOptions"
          emptyOptionLabel="Select type"
          [required]="true"
        />
        <app-form-field
          label="Days"
          type="number"
          [(ngModel)]="days"
          [step]="0.5"
          [required]="true"
        />
        <app-form-field
          label="Remark"
          type="textarea"
          [(ngModel)]="remark"
          placeholder="Optional note…"
          [rows]="3"
          [fullWidth]="true"
        />
      </div>
    </app-erp-dialog-shell>
  `,
  styles: `
    .dialog-grid {
      display: grid;
      gap: 12px 16px;
      grid-template-columns: 1fr 1fr;
    }
  `,
})
export class AddLeaveBalanceDialogComponent {
  readonly data = inject<AddLeaveDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AddLeaveBalanceDialogComponent, boolean>);
  private readonly service = inject(LeaveBalanceService);
  private readonly notify = inject(NotificationService);

  readonly dialogWidth = ERP_FORM_DIALOG_WIDTH;
  saving = false;
  employeeId = this.data.presetEmployeeId ?? '';
  leaveTypeId = '';
  days: number = 1;
  remark = '';

  readonly employeeOptions: FormFieldOption[] = this.data.employees.map((e) => ({
    label: e.employeeCode ? `${e.name} (${e.employeeCode})` : e.name,
    value: e.id,
  }));

  readonly leaveTypeOptions: FormFieldOption[] = this.data.leaveTypes.map((t) => ({
    label: `${t.code} — ${t.name}`,
    value: t.id,
  }));

  save(): void {
    if (!this.employeeId || !this.leaveTypeId) {
      this.notify.error('Employee and leave type are required');
      return;
    }
    if (this.days === null || this.days === undefined || Number.isNaN(Number(this.days))) {
      this.notify.error('Days are required');
      return;
    }
    this.saving = true;
    this.service
      .addLeave({
        employeeId: String(this.employeeId),
        leaveTypeId: String(this.leaveTypeId),
        days: Number(this.days),
        remark: this.remark?.trim() || null,
      })
      .subscribe({
        next: () => {
          this.notify.success('Leave credited');
          this.ref.close(true);
        },
        error: (err) => {
          this.notify.error(getUserFacingApiError(err, 'Failed to add leave'));
          this.saving = false;
        },
      });
  }
}

@Component({
  selector: 'app-leave-ledger-dialog',
  standalone: true,
  imports: [SmartDataTableComponent, MatDialogModule, ErpDialogShellComponent],
  template: `
    <app-erp-dialog-shell
      [title]="'Ledger — ' + data.leaveTypeName"
      [subtitle]="data.employeeName"
      [width]="dialogWidth"
      [showSave]="false"
      (cancel)="ref.close()"
    >
      <app-smart-data-table
        [config]="tableConfig"
        [data]="rows"
        [serverSide]="false"
      />
    </app-erp-dialog-shell>
  `,
})
export class LeaveLedgerDialogComponent implements OnInit {
  readonly data = inject<LedgerDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<LeaveLedgerDialogComponent>);
  private readonly service = inject(LeaveBalanceService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly dialogWidth = '720px';
  rows: Record<string, unknown>[] = [];

  readonly tableConfig: DataTableConfig = {
    header: {
      title: 'Ledger entries',
      showAddButton: false,
      syncPageChrome: false,
    },
    columns: [
      { key: 'txnDate', label: 'Date', sortable: true, cellType: 'date' },
      { key: 'txnTypeLabel', label: 'Type', sortable: true },
      { key: 'days', label: 'Days', sortable: true, align: 'right', width: '90px' },
      { key: 'balanceAfter', label: 'Balance after', sortable: true, align: 'right', width: '120px' },
      { key: 'remark', label: 'Remark' },
    ],
    filters: [],
    actions: [],
    showSearch: true,
    searchPlaceholder: 'Search ledger...',
    searchKeys: ['txnTypeLabel', 'remark'],
    itemLabel: 'entries',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.service.getLedger(this.data.employeeId, this.data.leaveTypeId).subscribe({
      next: (list) => {
        this.rows = (Array.isArray(list) ? list : []).map((r) => this.toRow(r));
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows = [];
        this.notify.error(getUserFacingApiError(err, 'Failed to load ledger'));
        this.cdr.detectChanges();
      },
    });
  }

  private toRow(r: LeaveLedgerDto): Record<string, unknown> {
    return {
      id: r.id,
      txnDate: r.txnDate,
      txnTypeLabel: r.txnTypeLabel || ledgerTxnTypeLabel(r.txnType),
      days: r.days,
      balanceAfter: r.balanceAfter,
      remark: r.remark || '—',
    };
  }
}

@Component({
  selector: 'app-leave-balances',
  standalone: true,
  imports: [
    FormsModule,
    SmartDataTableComponent,
    MatSnackBarModule,
    MatDialogModule,
    FormFieldComponent,
  ],
  template: `
    <section class="leave-balances-page">
      <app-smart-data-table
        [config]="tableConfig"
        [data]="rows"
        [serverSide]="false"
        (addButtonClicked)="openAddLeave()"
        (actionClicked)="onActionClicked($event)"
      >
        <div headerActions class="bal-header-filter">
          <app-form-field
            label="Employee"
            type="select"
            variant="filter"
            [(ngModel)]="selectedEmployeeId"
            [options]="employeeOptions"
            emptyOptionLabel="Select employee"
            (valueChange)="onEmployeeChange()"
          />
        </div>
      </app-smart-data-table>
    </section>
  `,
  styles: `
    .bal-header-filter {
      min-width: 260px;
    }
  `,
})
export class LeaveBalancesComponent implements OnInit {
  private readonly balanceService = inject(LeaveBalanceService);
  private readonly leaveTypeService = inject(LeaveTypeService);
  private readonly employeeService = inject(EmployeeService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  employees: EmployeeDropdownItem[] = [];
  leaveTypes: LeaveTypeDto[] = [];
  employeeOptions: FormFieldOption[] = [];
  selectedEmployeeId = '';
  rows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Leave balances',
      subtitle: 'View employee leave balances and credit adjustments',
      showAddButton: true,
      addButtonText: 'Add leave',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'leaveTypeLabel', label: 'Leave type', sortable: true },
      { key: 'openingBalance', label: 'Opening', sortable: true, align: 'right', width: '100px' },
      { key: 'accrued', label: 'Accrued', sortable: true, align: 'right', width: '100px' },
      { key: 'used', label: 'Used', sortable: true, align: 'right', width: '90px' },
      { key: 'adjusted', label: 'Adjusted', sortable: true, align: 'right', width: '100px' },
      { key: 'closingBalance', label: 'Closing', sortable: true, align: 'right', width: '100px' },
    ],
    filters: [],
    actions: [{ label: 'View ledger', icon: 'receipt_long', iconColor: '#639922' }],
    searchPlaceholder: 'Search leave type...',
    searchKeys: ['leaveTypeLabel', 'leaveTypeCode'],
    itemLabel: 'balances',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.LeaveBalances,
    );

    this.employeeService.getEmployeeDropdown().subscribe({
      next: (list) => {
        this.employees = list ?? [];
        this.employeeOptions = this.employees.map((e) => ({
          label: e.employeeCode ? `${e.name} (${e.employeeCode})` : e.name,
          value: e.id,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.employees = [];
        this.employeeOptions = [];
      },
    });

    this.leaveTypeService.getAll().subscribe({
      next: (list) => {
        this.leaveTypes = (Array.isArray(list) ? list : []).filter((t) => t.isActive !== false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.leaveTypes = [];
      },
    });
  }

  onEmployeeChange(): void {
    if (!this.selectedEmployeeId) {
      this.rows = [];
      this.cdr.detectChanges();
      return;
    }
    this.loadBalances();
  }

  openAddLeave(): void {
    if (!this.permissionService.canAdd(MenuCodes.LeaveBalances)
      && !this.permissionService.canEdit(MenuCodes.LeaveBalances)) {
      return;
    }
    const ref = this.dialog.open(AddLeaveBalanceDialogComponent, {
      width: ERP_FORM_DIALOG_WIDTH,
      data: {
        employees: this.employees,
        leaveTypes: this.leaveTypes,
        presetEmployeeId: this.selectedEmployeeId || undefined,
      } satisfies AddLeaveDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok && this.selectedEmployeeId) this.loadBalances();
    });
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    if (event.action.label !== 'View ledger') return;
    if (!this.selectedEmployeeId) {
      this.notify.error('Select an employee first');
      return;
    }
    const emp = this.employees.find((e) => e.id === this.selectedEmployeeId);
    this.dialog.open(LeaveLedgerDialogComponent, {
      width: '720px',
      data: {
        employeeId: this.selectedEmployeeId,
        employeeName: emp?.name ?? String(event.row['employeeName'] ?? 'Employee'),
        leaveTypeId: String(event.row['leaveTypeId'] ?? ''),
        leaveTypeName: String(event.row['leaveTypeName'] ?? event.row['leaveTypeCode'] ?? 'Leave'),
      } satisfies LedgerDialogData,
    });
  }

  private loadBalances(): void {
    this.balanceService.getBalances(this.selectedEmployeeId).subscribe({
      next: (list) => {
        this.rows = (Array.isArray(list) ? list : []).map((b) => this.toRow(b));
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows = [];
        this.notify.error(getUserFacingApiError(err, 'Failed to load balances'));
        this.cdr.detectChanges();
      },
    });
  }

  private toRow(b: LeaveBalanceDto): Record<string, unknown> {
    const code = b.leaveTypeCode ? `${b.leaveTypeCode} — ` : '';
    return {
      id: b.id,
      employeeId: b.employeeId,
      employeeName: b.employeeName,
      leaveTypeId: b.leaveTypeId,
      leaveTypeName: b.leaveTypeName ?? '',
      leaveTypeCode: b.leaveTypeCode ?? '',
      leaveTypeLabel: `${code}${b.leaveTypeName ?? '—'}`,
      openingBalance: b.openingBalance,
      accrued: b.accrued,
      used: b.used,
      adjusted: b.adjusted,
      closingBalance: b.closingBalance,
    };
  }
}
