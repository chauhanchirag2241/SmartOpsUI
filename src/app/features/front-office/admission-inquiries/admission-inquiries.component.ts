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
import { AddAdmissionInquiryComponent } from './add-admission-inquiry/add-admission-inquiry.component';

@Component({
  selector: 'app-admission-inquiries',
  standalone: true,
  imports: [
    SmartDataTableComponent,
    MatDialogModule,
    AddAdmissionInquiryComponent,
    DateRangeFilterComponent,
  ],
  template: `
    <section class="admission-inquiries-page">
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
        <app-add-admission-inquiry
          [mode]="formMode"
          [inquiryId]="selectedId"
          (cancel)="closeForm()"
          (saved)="onSaved()"
        />
      }
    </section>
  `,
})
export class AdmissionInquiriesComponent implements OnInit {
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
      title: 'Admission Inquiries',
      subtitle: 'Track prospective admissions and follow-ups',
      showAddButton: true,
      addButtonText: 'Add inquiry',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'parentName', label: 'Parent', sortable: true },
      { key: 'studentName', label: 'Student', sortable: true },
      { key: 'phone', label: 'Phone' },
      { key: 'classLabel', label: 'Class' },
      { key: 'inquiryDate', label: 'Inquiry date', sortable: true },
      { key: 'nextFollowUpDate', label: 'Follow-up' },
      { key: 'assignedToEmployeeName', label: 'Assigned to' },
      { key: 'reference', label: 'Reference' },
      {
        key: 'statusLabel',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          New: { cssClass: 'b-blue', label: 'New' },
          'Follow-up': { cssClass: 'b-amber', label: 'Follow-up' },
          'Visit Scheduled': { cssClass: 'b-teal', label: 'Visit Scheduled' },
          'Admission Form': { cssClass: 'b-purple', label: 'Admission Form' },
          Enrolled: { cssClass: 'b-green', label: 'Enrolled' },
          'Not Interested': { cssClass: 'b-gray', label: 'Not Interested' },
        },
      },
      { key: 'autoFollowUpLabel', label: 'Auto follow-up' },
      {
        key: 'isActive',
        label: 'Active',
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
      {
        label: 'New',
        icon: 'fiber_new',
        value: 'New',
        filterFn: (row) => Number(row['status']) === 0 || row['statusLabel'] === 'New',
      },
      {
        label: 'Follow-up',
        icon: 'update',
        value: 'Follow-up',
        filterFn: (row) => Number(row['status']) === 1 || row['statusLabel'] === 'Follow-up',
      },
      {
        label: 'Visit Scheduled',
        icon: 'event',
        value: 'Visit Scheduled',
        filterFn: (row) =>
          Number(row['status']) === 2 || row['statusLabel'] === 'Visit Scheduled',
      },
      {
        label: 'Admission Form',
        icon: 'description',
        value: 'Admission Form',
        filterFn: (row) =>
          Number(row['status']) === 3 || row['statusLabel'] === 'Admission Form',
      },
      {
        label: 'Enrolled',
        icon: 'school',
        value: 'Enrolled',
        filterFn: (row) => Number(row['status']) === 4 || row['statusLabel'] === 'Enrolled',
      },
      {
        label: 'Not Interested',
        icon: 'block',
        value: 'Not Interested',
        filterFn: (row) =>
          Number(row['status']) === 5 || row['statusLabel'] === 'Not Interested',
      },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Convert to admission', icon: 'school', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search inquiries…',
    searchKeys: ['parentName', 'studentName', 'phone', 'classLabel', 'reference'],
    itemLabel: 'inquiries',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.AdmissionInquiries,
    );
    this.load();
  }

  onDateRange(range: DateRangeValue): void {
    this.dateRange = range;
    this.applyDisplayedRows();
  }

  onAdd(): void {
    if (!this.permissionService.canAdd(MenuCodes.AdmissionInquiries)) return;
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
      if (!this.permissionService.canView(MenuCodes.AdmissionInquiries)) return;
      this.formMode = 'view';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.AdmissionInquiries)) return;
      this.router.navigate(['/front-office/admission-inquiries', id, 'history']);
      return;
    }

    if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.AdmissionInquiries)) return;
      this.formMode = 'edit';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }

    if (event.action.label === 'Convert to admission') {
      if (!this.permissionService.canEdit(MenuCodes.AdmissionInquiries)) return;
      this.api.convertAdmissionInquiry(id).subscribe({
        next: () => {
          this.notify.success('Converted to admission');
          this.load();
        },
        error: (err) => this.notify.error(getUserFacingApiError(err, 'Convert failed')),
      });
      return;
    }

    if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.AdmissionInquiries)) return;
      const name = String(event.row['studentName'] ?? event.row['parentName'] ?? 'this inquiry');
      this.dialog
        .open(DeleteConfirmDialogComponent, {
          data: {
            title: 'Delete inquiry?',
            description: 'This will permanently remove the admission inquiry.',
            recordName: name,
          },
          panelClass: 'erp-dialog',
          disableClose: true,
        })
        .afterClosed()
        .subscribe((ok) => {
          if (!ok) return;
          this.api.deleteAdmissionInquiry(id).subscribe({
            next: () => {
              this.notify.success('Inquiry deleted');
              this.load();
            },
            error: (err) => this.notify.error(getUserFacingApiError(err, 'Delete failed')),
          });
        });
    }
  }

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (action.label === 'Convert to admission' && Number(row['status']) === 4) return false;
    if (row['isActive'] === false) {
      return action.label === 'View details' || action.label === 'Show history';
    }
    return true;
  }

  private load(): void {
    this.api.getAdmissionInquiries({ activeFilter: 'All' }).subscribe({
      next: (list) => {
        this.allRows = list.map((r) => ({
          ...r,
          autoFollowUpLabel: r.autoFollowUp ? 'Yes' : 'No',
        }));
        this.applyDisplayedRows();
      },
      error: (err) =>
        this.notify.error(getUserFacingApiError(err, 'Failed to load admission inquiries')),
    });
  }

  private applyDisplayedRows(): void {
    this.rows = this.allRows.filter((row) =>
      isDayInDateRange(row['inquiryDate'], this.dateRange),
    );
    this.cdr.markForCheck();
  }
}
