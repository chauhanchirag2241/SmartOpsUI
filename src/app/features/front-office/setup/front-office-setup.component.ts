import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { FrontOfficeService } from '../../../core/services/front-office.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/interfaces/data-table.interface';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import { AddComplaintTypeComponent } from './add-complaint-type/add-complaint-type.component';
import { AddVisitorPurposeComponent } from './add-visitor-purpose/add-visitor-purpose.component';

type SetupFormKind = 'complaintType' | 'visitorPurpose';
type SetupTab = 'complaintTypes' | 'visitorPurposes';

const ACTIVE_STATUS_COLUMN = {
  key: 'isActive',
  label: 'Status',
  cellType: 'badge' as const,
  badgeMap: {
    'true': { cssClass: 'b-green', label: 'Active' },
    'false': { cssClass: 'b-red', label: 'Inactive' },
  },
};

const ACTIVE_FILTERS = [
  { label: 'All', icon: 'list', value: 'All' },
  {
    label: 'Active',
    icon: 'check_circle',
    value: 'Active',
    filterFn: (row: Record<string, unknown>) => row['isActive'] !== false,
  },
  {
    label: 'Inactive',
    icon: 'cancel',
    value: 'Inactive',
    filterFn: (row: Record<string, unknown>) => row['isActive'] === false,
  },
];

@Component({
  selector: 'app-front-office-setup',
  standalone: true,
  imports: [
    MatIconModule,
    SmartDataTableComponent,
    MatDialogModule,
    AddComplaintTypeComponent,
    AddVisitorPurposeComponent,
  ],
  template: `
    <section class="front-office-setup-page">
      @if (!showAddForm) {
        <div class="tabs" role="tablist" aria-label="Front office setup tabs">
          <div
            class="tab"
            role="tab"
            [class.active]="activeTab === 'complaintTypes'"
            (click)="setTab('complaintTypes')"
          >
            <mat-icon>list</mat-icon>
            Complaint types
          </div>
          <div
            class="tab"
            role="tab"
            [class.active]="activeTab === 'visitorPurposes'"
            (click)="setTab('visitorPurposes')"
          >
            <mat-icon>door_front</mat-icon>
            Visitor purposes
          </div>
        </div>

        @if (activeTab === 'complaintTypes') {
          <app-smart-data-table
            [config]="complaintTableConfig"
            [data]="complaintRows"
            [serverSide]="false"
            (actionClicked)="onComplaintAction($event)"
            (addButtonClicked)="openAdd('complaintType')"
          />
        } @else {
          <app-smart-data-table
            [config]="purposeTableConfig"
            [data]="purposeRows"
            [serverSide]="false"
            (actionClicked)="onPurposeAction($event)"
            (addButtonClicked)="openAdd('visitorPurpose')"
          />
        }
      } @else if (formKind === 'complaintType') {
        <app-add-complaint-type
          [mode]="formMode"
          [typeId]="selectedId"
          (cancel)="closeForm()"
          (saved)="onSaved()"
        />
      } @else {
        <app-add-visitor-purpose
          [mode]="formMode"
          [purposeId]="selectedId"
          (cancel)="closeForm()"
          (saved)="onSaved()"
        />
      }
    </section>
  `,
})
export class FrontOfficeSetupComponent implements OnInit {
  private readonly api = inject(FrontOfficeService);
  private readonly notify = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  activeTab: SetupTab = 'complaintTypes';
  showAddForm = false;
  formKind: SetupFormKind = 'complaintType';
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedId?: string;

  complaintRows: Record<string, unknown>[] = [];
  purposeRows: Record<string, unknown>[] = [];
  complaintTableConfig!: DataTableConfig;
  purposeTableConfig!: DataTableConfig;

  private readonly baseComplaintConfig: DataTableConfig = {
    header: {
      title: 'Complaint types',
      subtitle: 'Master list used when registering complaints',
      showAddButton: true,
      addButtonText: 'Add type',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description' },
      ACTIVE_STATUS_COLUMN,
    ],
    filtersInPanel: true,
    filters: ACTIVE_FILTERS,
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search types…',
    searchKeys: ['name', 'description'],
    itemLabel: 'types',
    defaultPageSize: 10,
  };

  private readonly basePurposeConfig: DataTableConfig = {
    header: {
      title: 'Visitor purposes',
      subtitle: 'Master list used in the visitor book',
      showAddButton: true,
      addButtonText: 'Add purpose',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'name', label: 'Purpose', sortable: true },
      { key: 'description', label: 'Description' },
      ACTIVE_STATUS_COLUMN,
    ],
    filtersInPanel: true,
    filters: ACTIVE_FILTERS,
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search purposes…',
    searchKeys: ['name', 'description'],
    itemLabel: 'purposes',
    defaultPageSize: 10,
  };

  ngOnInit(): void {
    this.complaintTableConfig = applyModuleTablePermissions(
      this.baseComplaintConfig,
      this.permissionService,
      MenuCodes.FrontOfficeSetup,
    );
    this.purposeTableConfig = applyModuleTablePermissions(
      this.basePurposeConfig,
      this.permissionService,
      MenuCodes.FrontOfficeSetup,
    );
    this.loadAll();
  }

  setTab(tab: SetupTab): void {
    this.activeTab = tab;
  }

  openAdd(kind: SetupFormKind): void {
    if (!this.permissionService.canAdd(MenuCodes.FrontOfficeSetup)) return;
    this.formKind = kind;
    this.formMode = 'add';
    this.selectedId = undefined;
    this.showAddForm = true;
  }

  closeForm(): void {
    this.showAddForm = false;
    this.selectedId = undefined;
    this.activeTab = this.formKind === 'visitorPurpose' ? 'visitorPurposes' : 'complaintTypes';
  }

  onSaved(): void {
    this.closeForm();
    this.loadAll();
  }

  onComplaintAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    const id = String(event.row['id'] ?? '');
    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.FrontOfficeSetup)) return;
      this.formKind = 'complaintType';
      this.formMode = 'view';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }
    if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.FrontOfficeSetup)) return;
      this.formKind = 'complaintType';
      this.formMode = 'edit';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }
    if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.FrontOfficeSetup)) return;
      this.confirmDelete('complaint', id, String(event.row['name'] ?? 'this type'));
    }
  }

  onPurposeAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    const id = String(event.row['id'] ?? '');
    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.FrontOfficeSetup)) return;
      this.formKind = 'visitorPurpose';
      this.formMode = 'view';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }
    if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.FrontOfficeSetup)) return;
      this.formKind = 'visitorPurpose';
      this.formMode = 'edit';
      this.selectedId = id;
      this.showAddForm = true;
      return;
    }
    if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.FrontOfficeSetup)) return;
      this.confirmDelete('purpose', id, String(event.row['name'] ?? 'this purpose'));
    }
  }

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] === false) {
      return action.label === 'View details';
    }
    return true;
  }

  private confirmDelete(kind: 'complaint' | 'purpose', id: string, label: string): void {
    this.dialog
      .open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete?',
          description: `This will permanently remove ${label}.`,
          recordName: label,
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        const req =
          kind === 'complaint' ? this.api.deleteComplaintType(id) : this.api.deleteVisitorPurpose(id);
        req.subscribe({
          next: () => {
            this.notify.success('Deleted');
            this.loadAll();
          },
          error: (err) => this.notify.error(getUserFacingApiError(err, 'Delete failed')),
        });
      });
  }

  private loadAll(): void {
    this.api.getComplaintTypes({ activeFilter: 'All' }).subscribe({
      next: (rows) => {
        this.complaintRows = rows.map((r) => ({ ...r }));
        this.cdr.markForCheck();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load complaint types')),
    });
    this.api.getVisitorPurposes({ activeFilter: 'All' }).subscribe({
      next: (rows) => {
        this.purposeRows = rows.map((r) => ({ ...r }));
        this.cdr.markForCheck();
      },
      error: (err) => this.notify.error(getUserFacingApiError(err, 'Failed to load purposes')),
    });
  }
}
