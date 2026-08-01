import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SalaryStructureService } from '../../../core/services/salary-structure.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table/smart-data-table.component';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import type { DataTableAction, DataTableConfig } from '../../../shared/components/smart-data-table';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import {
  SalaryStructureVersionStatus,
  asArray,
  extractApiError,
  normalizeSalaryStructureVersion,
} from '../salary.shared';
import { SalaryStructureManageComponent } from './salary-structure-manage/salary-structure-manage.component';

@Component({
  selector: 'app-salary-structure',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    SmartDataTableComponent,
    SalaryStructureManageComponent,
  ],
  templateUrl: './salary-structure.component.html',
  styleUrl: '../salary.shared.css',
})
export class SalaryStructureComponent implements OnInit {
  private readonly service = inject(SalaryStructureService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  tableConfig!: DataTableConfig;
  versions: Record<string, unknown>[] = [];
  currentStatusFilter = 'All';
  loading = false;

  showManage = false;
  selectedVersionId?: string;
  manageInitialTab = 0;

  showCreateVersionModal = false;
  createVersionForm = { effectiveDate: '', cloneFromVersionId: '' };

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Salary Management — Salary Structure',
      subtitle: 'Define versions and salary components',
      showAddButton: true,
      addButtonText: 'New structure',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'versionLabel', label: 'Version', sortable: true, width: '90px' },
      {
        key: 'statusLabel',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Draft: { cssClass: 'b-amber', label: 'Draft' },
          Published: { cssClass: 'b-blue', label: 'Published' },
          Active: { cssClass: 'b-green', label: 'Active' },
          Archived: { cssClass: 'b-gray', label: 'Archived' },
        },
      },
      { key: 'effectiveDate', label: 'Effective date', sortable: true, cellType: 'date' },
      { key: 'componentCount', label: 'Components', sortable: true, align: 'right', width: '100px' },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      { label: 'Draft', icon: 'edit_note', value: 'Draft' },
      { label: 'Published', icon: 'lock', value: 'Published' },
      { label: 'Archived', icon: 'inventory_2', value: 'Archived' },
    ],
    actions: [
      { label: 'Manage structure', icon: 'tune', iconColor: '#639922' },
      { label: 'Activate', icon: 'play_circle', iconColor: '#639922' },
      { label: 'Create new version', icon: 'content_copy', iconColor: '#854f0b' },
      { label: 'Delete draft', icon: 'delete', danger: true, separatorBefore: true },
    ],
    searchPlaceholder: 'Search version or status...',
    searchKeys: ['versionLabel', 'statusLabel'],
    itemLabel: 'versions',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    actionVisibleFn: (action, row) => this.isVersionActionVisible(action, row),
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.SalaryStructure,
      this.ayContext.isReadOnlyScope(),
    );
    this.loadVersions();
  }

  get tableFilterPanelActive(): boolean {
    return this.currentStatusFilter !== 'All';
  }

  onTableFiltersCleared(): void {
    this.currentStatusFilter = 'All';
    this.closeManage();
    this.loadVersions();
  }

  loadVersions(): void {
    if (!this.versions.length) {
      this.loading = true;
    }
    this.refreshView();
    const status = this.currentStatusFilter === 'All' ? undefined : this.currentStatusFilter.toLowerCase();
    this.service.getVersions(status).subscribe({
      next: (list) => {
        this.versions = asArray(list).map((v) => {
          const n = normalizeSalaryStructureVersion(v);
          return { ...n, effectiveDate: n.effectiveDate || null } as Record<string, unknown>;
        });
        this.loading = false;
        this.refreshView();
      },
      error: () => {
        this.loading = false;
        this.versions = [];
        this.toast('Failed to load salary structures', true);
        this.refreshView();
      },
    });
  }

  versionRowClass = (row: Record<string, unknown>): string => {
    if (row['hasAssignedEmployees'] === true && row['statusLabel'] === 'Archived') {
      return 'row-version-paid-archived';
    }
    return '';
  };

  onFilterChanged(filter: { value: string } | null): void {
    this.currentStatusFilter = filter?.value ?? 'All';
    this.closeManage();
    this.loadVersions();
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.SalaryStructure)) return;
    this.createVersionForm = {
      effectiveDate: '',
      cloneFromVersionId: '',
    };
    this.showCreateVersionModal = true;
    this.refreshView();
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    const version = normalizeSalaryStructureVersion(event.row);

    switch (event.action.label) {
      case 'Manage structure':
        this.openManage(id, 0);
        break;
      case 'Activate':
        this.activateVersion(id);
        break;
      case 'Create new version':
        this.createNewVersion(id);
        break;
      case 'Delete draft':
        this.deleteVersion(version);
        break;
    }
  }

  openManage(versionId: string, tab = 0): void {
    if (!this.permissionService.canView(MenuCodes.SalaryStructure)) return;
    this.selectedVersionId = versionId;
    this.manageInitialTab = tab;
    this.showManage = true;
    this.refreshView();
  }

  closeManage(): void {
    this.showManage = false;
    this.selectedVersionId = undefined;
    this.manageInitialTab = 0;
    this.refreshView();
  }

  onManageChanged(): void {
    this.loadVersions();
  }

  createVersion(): void {
    const body: Record<string, unknown> = {
      effectiveDate: this.createVersionForm.effectiveDate || null,
    };
    if (this.createVersionForm.cloneFromVersionId) {
      body['cloneFromVersionId'] = this.createVersionForm.cloneFromVersionId;
    }
    this.service.createVersion(body).subscribe({
      next: () => {
        this.showCreateVersionModal = false;
        this.loadVersions();
        this.toast('Salary structure created');
      },
      error: (e) => this.toast(extractApiError(e, 'Create failed'), true),
    });
  }

  private resolveVersion(id: string): ReturnType<typeof normalizeSalaryStructureVersion> | null {
    const raw = this.versions.find((v) => String(v['id'] ?? '') === id);
    if (raw) {
      return normalizeSalaryStructureVersion(raw);
    }
    return null;
  }

  activateVersion(id: string): void {
    const version = this.resolveVersion(id);
    if (!version) {
      this.toast('Version not found', true);
      return;
    }

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Activate salary structure?',
        description: 'Previous active structure will be archived.',
        recordName: version.versionLabel,
        recordMeta: `Status: ${version.statusLabel}`,
        initials: 'SS',
        confirmButtonText: 'Yes, activate',
        cancelButtonText: 'Cancel',
        variant: 'primary',
        headerIcon: 'check_circle',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.activateVersion(id).subscribe({
        next: () => {
          this.loadVersions();
          this.toast('Activated');
        },
        error: (e) => this.toast(extractApiError(e, 'Activate failed'), true),
      });
    });
  }

  createNewVersion(sourceId: string): void {
    this.service.createNewVersionFrom(sourceId).subscribe({
      next: () => {
        this.loadVersions();
        this.toast('New draft version created');
      },
      error: (e) => this.toast(extractApiError(e, 'Failed to create new version'), true),
    });
  }

  private isDraftVersion(version: ReturnType<typeof normalizeSalaryStructureVersion>): boolean {
    return version.status === SalaryStructureVersionStatus.Draft || version.statusLabel === 'Draft';
  }

  isVersionActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    const status = String(row['statusLabel'] ?? '');
    switch (action.label) {
      case 'Activate':
        return status === 'Published';
      case 'Create new version':
        return status === 'Published' || status === 'Active' || status === 'Archived';
      case 'Delete draft':
        return status === 'Draft';
      default:
        return true;
    }
  }

  deleteVersion(version: ReturnType<typeof normalizeSalaryStructureVersion>): void {
    if (!this.isDraftVersion(version)) {
      this.toast('Only draft structures can be deleted', true);
      return;
    }
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete draft salary structure?',
        description: 'This draft and its salary components will be removed.',
        recordName: version.versionLabel,
        initials: 'SS',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.deleteVersion(version.id).subscribe({
        next: () => {
          if (this.selectedVersionId === version.id) {
            this.closeManage();
          }
          this.loadVersions();
          this.toast('Deleted');
        },
        error: (e) => this.toast(extractApiError(e, 'Delete failed'), true),
      });
    });
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', { duration: 2800, panelClass: error ? 'snack-error' : 'snack-success' });
  }
}
