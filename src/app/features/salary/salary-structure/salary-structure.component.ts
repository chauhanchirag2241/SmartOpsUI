import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SalaryStructureService } from '../../../core/services/salary-structure.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table/smart-data-table.component';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import type { DataTableAction, DataTableConfig } from '../../../shared/components/smart-data-table';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import {
  CALCULATION_TYPE_OPTIONS,
  COMPONENT_TYPE_OPTIONS,
  SalaryCalculationType,
  SalaryComponentType,
  SalaryStructureVersionStatus,
  asArray,
  componentTypeBadgeClass,
  extractApiError,
  formatValueDisplay,
  normalizeDropdownItem,
  normalizeSalaryStructureVersion,
  normalizeSalaryVersionComponent,
  versionStatusBadgeClass,
} from '../salary.shared';

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
  ],
  templateUrl: './salary-structure.component.html',
  styleUrl: '../salary.shared.css',
})
export class SalaryStructureComponent implements OnInit {
  private readonly service = inject(SalaryStructureService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  tableConfig!: DataTableConfig;
  versions: Record<string, unknown>[] = [];
  academicYears: ReturnType<typeof normalizeDropdownItem>[] = [];
  academicYearFilter = '';
  currentStatusFilter = 'All';
  loading = false;

  selectedVersion: ReturnType<typeof normalizeSalaryStructureVersion> | null = null;
  components: ReturnType<typeof normalizeSalaryVersionComponent>[] = [];
  loadingComponents = false;

  showCreateVersionModal = false;
  showComponentModal = false;
  createVersionForm = { academicYearId: '', effectiveDate: '', cloneFromVersionId: '' };
  componentTypeOptions = COMPONENT_TYPE_OPTIONS;
  calculationTypeOptions = CALCULATION_TYPE_OPTIONS;
  componentForm = {
    name: '',
    shortCode: '',
    componentType: SalaryComponentType.Earning,
    calculationType: SalaryCalculationType.PercentOfBasic,
    value: 0,
    isTaxable: true,
  };

  formatValueDisplay = formatValueDisplay;
  typeClass = componentTypeBadgeClass;
  statusClass = versionStatusBadgeClass;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Salary Management — Salary Structure',
      subtitle: 'Academic year wise versions · Draft → Publish → Activate',
      showAddButton: true,
      addButtonText: 'New structure',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'academicYearTitle', label: 'Academic year', sortable: true },
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
      { label: 'Manage components', icon: 'list_alt', iconColor: '#639922' },
      { label: 'Publish', icon: 'publish', iconColor: '#1E40AF' },
      { label: 'Activate', icon: 'play_circle', iconColor: '#639922' },
      { label: 'Create new version', icon: 'content_copy', iconColor: '#854f0b' },
      { label: 'Delete draft', icon: 'delete', danger: true, separatorBefore: true },
    ],
    searchPlaceholder: 'Search academic year or version...',
    searchKeys: ['academicYearTitle', 'versionLabel', 'statusLabel'],
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
    );
    this.loadAcademicYears();
  }

  loadAcademicYears(): void {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        this.academicYears = asArray(years).map(normalizeDropdownItem);
        this.loadVersions();
      },
      error: () => this.toast('Failed to load academic years', true),
    });
  }

  get tableFilterPanelActive(): boolean {
    return !!this.academicYearFilter || this.currentStatusFilter !== 'All';
  }

  onAcademicYearFilterChange(): void {
    this.closeManagePanel();
    this.loadVersions();
  }

  onTableFiltersCleared(): void {
    this.academicYearFilter = '';
    this.currentStatusFilter = 'All';
    this.closeManagePanel();
    this.loadVersions();
  }

  loadVersions(): void {
    if (!this.versions.length) {
      this.loading = true;
    }
    this.refreshView();
    const status = this.currentStatusFilter === 'All' ? undefined : this.currentStatusFilter.toLowerCase();
    this.service.getVersions(this.academicYearFilter || undefined, status).subscribe({
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
    this.closeManagePanel();
    this.loadVersions();
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.SalaryStructure)) return;
    this.createVersionForm = {
      academicYearId: this.academicYearFilter || this.academicYears[0]?.id || '',
      effectiveDate: new Date().toISOString().split('T')[0],
      cloneFromVersionId: '',
    };
    this.showCreateVersionModal = true;
    this.refreshView();
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = String(event.row['id'] ?? '');
    const version = normalizeSalaryStructureVersion(event.row);

    switch (event.action.label) {
      case 'Manage components':
        this.openManagePanel(id);
        break;
      case 'Publish':
        this.publishVersion(id);
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

  openManagePanel(versionId: string): void {
    this.loadingComponents = true;
    this.selectedVersion = null;
    this.components = [];
    this.refreshView();

    this.service.getVersionDetail(versionId).subscribe({
      next: (detail) => {
        this.selectedVersion = normalizeSalaryStructureVersion(detail);
        this.components = asArray(detail?.components ?? detail?.Components).map(normalizeSalaryVersionComponent);
        this.loadingComponents = false;
        this.refreshView();
      },
      error: (e) => {
        this.loadingComponents = false;
        this.toast(extractApiError(e, 'Failed to load components'), true);
        this.refreshView();
      },
    });
  }

  closeManagePanel(): void {
    this.selectedVersion = null;
    this.components = [];
    this.refreshView();
  }

  createVersion(): void {
    if (!this.createVersionForm.academicYearId) {
      this.toast('Select academic year', true);
      return;
    }
    const body: Record<string, unknown> = {
      academicYearId: this.createVersionForm.academicYearId,
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

  publishVersion(id: string): void {
    if (
      !confirm(
        'Publish this salary structure? The current published version for this academic year will be archived.',
      )
    ) {
      return;
    }
    this.service.publishVersion(id).subscribe({
      next: () => {
        this.loadVersions();
        if (this.selectedVersion?.id === id) this.openManagePanel(id);
        this.toast('Published');
      },
      error: (e) => this.toast(extractApiError(e, 'Publish failed'), true),
    });
  }

  activateVersion(id: string): void {
    if (!confirm('Activate this salary structure? Previous active structure for this year will be archived.')) {
      return;
    }
    this.service.activateVersion(id).subscribe({
      next: () => {
        this.loadVersions();
        if (this.selectedVersion?.id === id) this.openManagePanel(id);
        this.toast('Activated');
      },
      error: (e) => this.toast(extractApiError(e, 'Activate failed'), true),
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
      case 'Publish':
        return status === 'Draft';
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
        recordName: `${version.academicYearTitle} ${version.versionLabel}`,
        initials: 'SS',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.deleteVersion(version.id).subscribe({
        next: () => {
          this.closeManagePanel();
          this.loadVersions();
          this.toast('Deleted');
        },
        error: (e) => this.toast(extractApiError(e, 'Delete failed'), true),
      });
    });
  }

  openAddComponent(): void {
    if (!this.selectedVersion || this.selectedVersion.isLocked) return;
    this.componentForm = {
      name: '',
      shortCode: '',
      componentType: SalaryComponentType.Earning,
      calculationType: SalaryCalculationType.PercentOfBasic,
      value: 0,
      isTaxable: true,
    };
    this.showComponentModal = true;
    this.refreshView();
  }

  saveComponent(): void {
    if (!this.selectedVersion || !this.componentForm.name.trim()) {
      this.toast('Component name is required', true);
      return;
    }
    this.service.createComponent(this.selectedVersion.id, this.componentForm).subscribe({
      next: () => {
        this.showComponentModal = false;
        this.openManagePanel(this.selectedVersion!.id);
        this.loadVersions();
        this.toast('Component added');
      },
      error: (e) => this.toast(extractApiError(e, 'Failed to add component'), true),
    });
  }

  deleteComponent(c: ReturnType<typeof normalizeSalaryVersionComponent>): void {
    if (!this.selectedVersion || this.selectedVersion.isLocked) return;
    if (!confirm(`Delete component "${c.name}"?`)) return;
    this.service.deleteComponent(c.id).subscribe({
      next: () => {
        this.openManagePanel(this.selectedVersion!.id);
        this.loadVersions();
        this.toast('Component removed');
      },
      error: (e) => this.toast(extractApiError(e, 'Delete failed'), true),
    });
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', { duration: 2800, panelClass: error ? 'snack-error' : 'snack-success' });
  }
}
