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
import { AddVisitorComponent } from './add-visitor/add-visitor.component';

@Component({
  selector: 'app-visitors',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    MatDialogModule,
    AddVisitorComponent,
    DateRangeFilterComponent,
  ],
  template: `
    <section class="visitors-page">
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
        <app-add-visitor
          [mode]="formMode"
          [visitorId]="selectedId"
          (cancel)="closeForm()"
          (saved)="onSaved()"
        />
      }
    </section>
  `,
})
export class VisitorsComponent implements OnInit {
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
      title: 'Visitor Book',
      subtitle: 'Record and track school visitors',
      showAddButton: true,
      addButtonText: 'Add visitor',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'phone', label: 'Phone' },
      { key: 'idCardType', label: 'ID type' },
      { key: 'purposeName', label: 'Purpose', sortable: true },
      { key: 'inTime', label: 'In time', sortable: true },
      { key: 'outTime', label: 'Out time' },
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
      { label: 'Check out', icon: 'logout', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search visitors…',
    searchKeys: ['name', 'phone', 'purposeName', 'meetingWith'],
    itemLabel: 'visitors',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.VisitorBook,
    );
    this.load();
  }

  onDateRange(range: DateRangeValue): void {
    this.dateRange = range;
    this.applyDisplayedRows();
  }

  onAdd(): void {
    if (!this.permissionService.canAdd(MenuCodes.VisitorBook)) return;
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
      if (!this.permissionService.canView(MenuCodes.VisitorBook)) return;
      this.formMode = 'view';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.VisitorBook)) return;
      this.router.navigate(['/front-office/visitors', id, 'history']);
      return;
    }

    if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.VisitorBook)) return;
      this.formMode = 'edit';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Check out') {
      if (!this.permissionService.canEdit(MenuCodes.VisitorBook)) return;
      this.api.checkoutVisitor(id).subscribe({
        next: () => {
          this.notify.success('Visitor checked out');
          this.load();
        },
        error: (err) => this.notify.error(getUserFacingApiError(err, 'Check out failed')),
      });
      return;
    }

    if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.VisitorBook)) return;
      const name = String(event.row['name'] ?? 'this visitor');
      this.dialog
        .open(DeleteConfirmDialogComponent, {
          data: {
            title: 'Delete visitor?',
            description: 'This will permanently remove the visitor record.',
            recordName: name,
          },
          panelClass: 'erp-dialog',
          disableClose: true,
        })
        .afterClosed()
        .subscribe((ok) => {
          if (!ok) return;
          this.api.deleteVisitor(id).subscribe({
            next: () => {
              this.notify.success('Visitor deleted');
              this.load();
            },
            error: (err) => this.notify.error(getUserFacingApiError(err, 'Delete failed')),
          });
        });
    }
  }

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (action.label === 'Check out' && row['outTime']) return false;
    if (row['isActive'] === false) {
      return action.label === 'View details' || action.label === 'Show history';
    }
    return true;
  }

  private load(): void {
    this.api.getVisitors({ activeFilter: 'All' }).subscribe({
      next: (list) => {
        this.allRows = list.map((r) => ({ ...r }));
        this.applyDisplayedRows();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load visitors')),
    });
  }

  private applyDisplayedRows(): void {
    this.rows = this.allRows.filter((row) => isDayInDateRange(row['inTime'], this.dateRange));
    this.cdr.markForCheck();
  }
}
