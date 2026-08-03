import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MenuCodes } from '../../core/constants/menu-codes';
import { LeavePolicyDto, LeavePolicyService } from '../../core/services/leave-policy.service';
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
import { ERP_FORM_DIALOG_WIDTH } from '../../shared/constants/dialog.constants';
import { getUserFacingApiError } from '../../shared/utils/api-error.util';

interface EditPolicyDialogData {
  policy: LeavePolicyDto;
}

@Component({
  selector: 'app-edit-leave-policy-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, ErpDialogShellComponent, FormFieldComponent],
  template: `
    <app-erp-dialog-shell
      title="Edit leave policy"
      [subtitle]="subtitle"
      [width]="dialogWidth"
      [showSave]="true"
      saveLabel="Save"
      savingLabel="Saving…"
      [saving]="saving"
      (cancel)="ref.close(false)"
      (save)="save()"
    >
      <app-form-field
        label="Monthly leave (days)"
        type="number"
        [(ngModel)]="monthlyLeave"
        [min]="0"
        [step]="0.5"
        [required]="true"
      />
    </app-erp-dialog-shell>
  `,
})
export class EditLeavePolicyDialogComponent {
  readonly data = inject<EditPolicyDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<EditLeavePolicyDialogComponent, boolean>);
  private readonly service = inject(LeavePolicyService);
  private readonly notify = inject(NotificationService);

  readonly dialogWidth = ERP_FORM_DIALOG_WIDTH;
  saving = false;
  monthlyLeave: number = Number(this.data.policy.monthlyLeave ?? 0);

  get subtitle(): string {
    const ut = this.data.policy.userTypeName ?? this.data.policy.userTypeCode ?? 'User type';
    const lt = this.data.policy.leaveTypeName ?? this.data.policy.leaveTypeCode ?? 'Leave type';
    return `${ut} · ${lt}`;
  }

  save(): void {
    if (this.monthlyLeave < 0 || Number.isNaN(Number(this.monthlyLeave))) {
      this.notify.error('Monthly leave must be zero or greater');
      return;
    }
    this.saving = true;
    this.service.update(this.data.policy.id, { monthlyLeave: Number(this.monthlyLeave) }).subscribe({
      next: () => {
        this.notify.success('Leave policy updated');
        this.ref.close(true);
      },
      error: (err) => {
        this.notify.error(getUserFacingApiError(err, 'Failed to update policy'));
        this.saving = false;
      },
    });
  }
}

@Component({
  selector: 'app-leave-policies',
  standalone: true,
  imports: [SmartDataTableComponent, MatSnackBarModule, MatDialogModule],
  template: `
    <section class="leave-policies-page">
      <app-smart-data-table
        [config]="tableConfig"
        [data]="rows"
        [serverSide]="false"
        (actionClicked)="onActionClicked($event)"
      />
    </section>
  `,
})
export class LeavePoliciesComponent implements OnInit {
  private readonly service = inject(LeavePolicyService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  rows: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Leave policies',
      subtitle: 'Monthly leave accrual by employee type and leave type',
      showAddButton: false,
    },
    columns: [
      { key: 'userTypeName', label: 'User type', sortable: true },
      { key: 'leaveTypeLabel', label: 'Leave type', sortable: true },
      {
        key: 'monthlyLeave',
        label: 'Monthly leave',
        sortable: true,
        align: 'right',
        width: '140px',
      },
    ],
    filtersInPanel: false,
    filters: [],
    actions: [{ label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' }],
    actionVisibleFn: () => this.permissionService.canEdit(MenuCodes.LeavePolicies),
    searchPlaceholder: 'Search by user type or leave type...',
    searchKeys: ['userTypeName', 'leaveTypeLabel', 'leaveTypeCode'],
    itemLabel: 'policies',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.LeavePolicies,
    );
    this.load();
  }

  load(): void {
    this.service.getAll().subscribe({
      next: (list) => {
        this.rows = (Array.isArray(list) ? list : []).map((r) => this.toRow(r));
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rows = [];
        this.notify.error(getUserFacingApiError(err, 'Failed to load leave policies'));
        this.cdr.detectChanges();
      },
    });
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    if (event.action.label !== 'Edit details') return;
    if (!this.permissionService.canEdit(MenuCodes.LeavePolicies)) return;

    const policy: LeavePolicyDto = {
      id: String(event.row['id'] ?? ''),
      userTypeId: String(event.row['userTypeId'] ?? ''),
      userTypeName: String(event.row['userTypeName'] ?? ''),
      userTypeCode: String(event.row['userTypeCode'] ?? ''),
      leaveTypeId: String(event.row['leaveTypeId'] ?? ''),
      leaveTypeName: String(event.row['leaveTypeName'] ?? ''),
      leaveTypeCode: String(event.row['leaveTypeCode'] ?? ''),
      monthlyLeave: Number(event.row['monthlyLeave'] ?? 0),
    };

    const ref = this.dialog.open(EditLeavePolicyDialogComponent, {
      width: ERP_FORM_DIALOG_WIDTH,
      data: { policy } satisfies EditPolicyDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) this.load();
    });
  }

  private toRow(r: LeavePolicyDto): Record<string, unknown> {
    const code = r.leaveTypeCode ? `${r.leaveTypeCode} — ` : '';
    return {
      id: r.id,
      userTypeId: r.userTypeId,
      userTypeName: r.userTypeName ?? r.userTypeCode ?? '—',
      userTypeCode: r.userTypeCode ?? '',
      leaveTypeId: r.leaveTypeId,
      leaveTypeName: r.leaveTypeName ?? '',
      leaveTypeCode: r.leaveTypeCode ?? '',
      leaveTypeLabel: `${code}${r.leaveTypeName ?? '—'}`,
      monthlyLeave: r.monthlyLeave,
    };
  }
}
