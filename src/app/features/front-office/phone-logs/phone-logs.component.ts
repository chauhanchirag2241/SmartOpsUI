import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { FrontOfficeService } from '../../../core/services/front-office.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import {
  DateRangeFilterComponent,
  DateRangeValue,
  isDayInDateRange,
  resolveDateRangePreset,
} from '../../../shared/components/date-range-filter/date-range-filter.component';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/interfaces/data-table.interface';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import { AddPhoneLogComponent } from './add-phone-log/add-phone-log.component';

@Component({
  selector: 'app-phone-logs',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    MatDialogModule,
    AddPhoneLogComponent,
    DateRangeFilterComponent,
  ],
  template: `
    <section class="phone-logs-page">
      @if (!showAddForm) {
        <app-smart-data-table
          [config]="tableConfig"
          [data]="rows"
          [serverSide]="false"
          (actionClicked)="onActionClicked($event)"
          (addButtonClicked)="onAdd()"
        >
          <app-date-range-filter
            tableFilters
            [value]="dateRange"
            (valueChange)="onDateRange($event)"
          />
        </app-smart-data-table>
      } @else {
        <app-add-phone-log
          [mode]="formMode"
          [logId]="selectedId"
          (cancel)="closeForm()"
          (saved)="onSaved()"
        />
      }
    </section>
  `,
})
export class PhoneLogsComponent implements OnInit {
  private readonly api = inject(FrontOfficeService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedId?: string;
  allRows: Record<string, unknown>[] = [];
  rows: Record<string, unknown>[] = [];
  dateRange: DateRangeValue = resolveDateRangePreset('thisMonth');
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Phone Logs',
      subtitle: 'Track incoming and outgoing calls',
      showAddButton: true,
      addButtonText: 'Add phone log',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'callerName', label: 'Caller', sortable: true },
      { key: 'phone', label: 'Phone' },
      {
        key: 'callTypeLabel',
        label: 'Type',
        cellType: 'badge',
        badgeMap: {
          Incoming: { cssClass: 'b-blue', label: 'Incoming' },
          Outgoing: { cssClass: 'b-teal', label: 'Outgoing' },
        },
      },
      { key: 'callDate', label: 'Call date', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'duration', label: 'Duration' },
      { key: 'nextFollowUpDate', label: 'Follow-up' },
      { key: 'note', label: 'Note' },
      {
        key: 'isActive',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          'true': { cssClass: 'b-green', label: 'Active' },
          'false': { cssClass: 'b-red', label: 'Inactive' },
        },
      },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      {
        label: 'Active',
        icon: 'check_circle',
        value: 'Active',
        filterFn: (row) => row['isActive'] !== false,
      },
      {
        label: 'Inactive',
        icon: 'cancel',
        value: 'Inactive',
        filterFn: (row) => row['isActive'] === false,
      },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search phone logs…',
    searchKeys: ['callerName', 'phone', 'description'],
    itemLabel: 'logs',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.PhoneLogs,
    );
    this.load();
  }

  onDateRange(range: DateRangeValue): void {
    this.dateRange = range;
    this.applyDisplayedRows();
  }

  onAdd(): void {
    if (!this.permissionService.canAdd(MenuCodes.PhoneLogs)) return;
    this.formMode = 'add';
    this.selectedId = undefined;
    this.showAddForm = true;
  }

  closeForm(): void {
    this.showAddForm = false;
    this.selectedId = undefined;
  }

  onSaved(): void {
    this.closeForm();
    this.load();
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    if (!id) return;

    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.PhoneLogs)) return;
      this.formMode = 'view';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.PhoneLogs)) return;
      this.router.navigate(['/front-office/phone-logs', id, 'history']);
      return;
    }

    if (event.action.label === 'Edit details' || event.action.label === 'Edit') {
      if (!this.permissionService.canEdit(MenuCodes.PhoneLogs)) return;
      this.formMode = 'edit';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.PhoneLogs)) return;
      const name = String(event.row['callerName'] ?? 'this log');
      this.dialog
        .open(DeleteConfirmDialogComponent, {
          data: {
            title: 'Delete phone log?',
            description: 'This will permanently remove the phone log.',
            recordName: name,
          },
          panelClass: 'erp-dialog',
          disableClose: true,
        })
        .afterClosed()
        .subscribe((ok) => {
          if (!ok) return;
          this.api.deletePhoneLog(id).subscribe({
            next: () => {
              this.notify.success('Phone log deleted');
              this.load();
            },
            error: (err) => this.notify.error(getUserFacingApiError(err, 'Delete failed')),
          });
        });
    }
  }

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] === false) {
      return action.label === 'View details' || action.label === 'Show history';
    }
    return true;
  }

  private load(): void {
    this.api.getPhoneLogs({ activeFilter: 'All' }).subscribe({
      next: (list) => {
        this.allRows = list.map((r) => ({ ...r }));
        this.applyDisplayedRows();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load phone logs')),
    });
  }

  private applyDisplayedRows(): void {
    this.rows = this.allRows.filter((row) => isDayInDateRange(row['callDate'], this.dateRange));
    this.cdr.markForCheck();
  }
}
