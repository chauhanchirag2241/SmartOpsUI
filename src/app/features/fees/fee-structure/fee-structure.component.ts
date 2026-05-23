import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FeeStructureService } from '../../../core/services/fee-structure.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table/smart-data-table.component';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import type { DataTableAction, DataTableConfig } from '../../../shared/components/smart-data-table';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import {
  FEE_CATEGORY_OPTIONS,
  FEE_FREQUENCY_OPTIONS,
  FeeCategory,
  FeeFrequency,
  FeeStructureVersionStatus,
  asArray,
  categoryBadgeClass,
  extractApiError,
  frequencyBadgeClass,
  normalizeDropdownItem,
  normalizeFeeStats,
  normalizeFeeStructureVersion,
  normalizeFeeType,
  versionStatusBadgeClass,
} from '../fees.shared';

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    SmartDataTableComponent,
  ],
  templateUrl: './fee-structure.component.html',
  styleUrl: '../fees.shared.css',
})
export class FeeStructureComponent implements OnInit {
  private readonly service = inject(FeeStructureService);
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

  stats = { feeTypeCount: 0, classesConfigured: 0, paymentCycleLabel: '—', lateFeePerDay: 0 };

  selectedVersion: ReturnType<typeof normalizeFeeStructureVersion> | null = null;
  feeTypes: ReturnType<typeof normalizeFeeType>[] = [];
  loadingTypes = false;

  showCreateVersionModal = false;
  showFeeTypeModal = false;
  createVersionForm = { academicYearId: '', effectiveDate: '', cloneFromVersionId: '' };
  categoryOptions = FEE_CATEGORY_OPTIONS;
  frequencyOptions = FEE_FREQUENCY_OPTIONS;
  feeTypeForm = {
    name: '',
    category: FeeCategory.Academic,
    frequency: FeeFrequency.Quarterly,
    isMandatory: true,
    isRefundable: false,
  };

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Fee structure versions',
      subtitle: 'Academic year wise fee structures with draft, publish and activate workflow',
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
      { key: 'feeTypeCount', label: 'Fee heads', sortable: true, align: 'right', width: '90px' },
    ],
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      { label: 'Draft', icon: 'edit_note', value: 'Draft' },
      { label: 'Published', icon: 'lock', value: 'Published' },
      { label: 'Active', icon: 'check_circle', value: 'Active' },
      { label: 'Archived', icon: 'inventory_2', value: 'Archived' },
    ],
    actions: [
      { label: 'Manage fee heads', icon: 'list_alt', iconColor: '#639922' },
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
  };

  ngOnInit(): void {
    this.tableConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.FeesStructure,
    );
    this.loadAcademicYears();
    this.loadStats();
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

  onAcademicYearFilterChange(): void {
    this.closeManagePanel();
    this.loadVersions();
  }

  loadVersions(): void {
    this.loading = true;
    this.refreshView();
    const status = this.currentStatusFilter === 'All' ? undefined : this.currentStatusFilter.toLowerCase();
    this.service.getVersions(this.academicYearFilter || undefined, status).subscribe({
      next: (list) => {
        this.versions = asArray(list).map((v) => {
          const n = normalizeFeeStructureVersion(v);
          return {
            ...n,
            effectiveDate: n.effectiveDate || null,
          } as Record<string, unknown>;
        });
        this.loading = false;
        this.refreshView();
      },
      error: () => {
        this.loading = false;
        this.versions = [];
        this.toast('Failed to load fee structures', true);
        this.refreshView();
      },
    });
  }

  loadStats(): void {
    this.service.getStats().subscribe({
      next: (s) => {
        this.stats = normalizeFeeStats(s);
        this.refreshView();
      },
    });
  }

  versionRowClass = (row: Record<string, unknown>): string => {
    if (row['hasStudentPayments'] === true && row['statusLabel'] === 'Archived') {
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
    if (!this.permissionService.canAdd(MenuCodes.FeesStructure)) return;
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
    const version = normalizeFeeStructureVersion(event.row);

    switch (event.action.label) {
      case 'Manage fee heads':
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
    this.loadingTypes = true;
    this.selectedVersion = null;
    this.feeTypes = [];
    this.refreshView();

    this.service.getVersionDetail(versionId).subscribe({
      next: (detail) => {
        this.selectedVersion = normalizeFeeStructureVersion(detail);
        this.feeTypes = asArray(detail?.feeTypes ?? detail?.FeeTypes).map(normalizeFeeType);
        this.loadingTypes = false;
        this.refreshView();
      },
      error: (e) => {
        this.loadingTypes = false;
        this.toast(extractApiError(e, 'Failed to load fee heads'), true);
        this.refreshView();
      },
    });
  }

  closeManagePanel(): void {
    this.selectedVersion = null;
    this.feeTypes = [];
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
        this.toast('Fee structure created');
      },
      error: (e) => this.toast(extractApiError(e, 'Create failed'), true),
    });
  }

  publishVersion(id: string): void {
    if (!confirm('Publish this fee structure? It will be locked for editing.')) return;
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
    if (!confirm('Activate this fee structure? Previous active structure for this year will be archived.')) return;
    this.service.activateVersion(id).subscribe({
      next: () => {
        this.loadVersions();
        this.loadStats();
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

  deleteVersion(version: ReturnType<typeof normalizeFeeStructureVersion>): void {
    if (version.status !== FeeStructureVersionStatus.Draft) {
      this.toast('Only draft structures can be deleted', true);
      return;
    }
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete draft fee structure?',
        description: 'This draft and its fee heads will be removed.',
        recordName: `${version.academicYearTitle} ${version.versionLabel}`,
        initials: 'FS',
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

  openAddFeeType(): void {
    if (!this.selectedVersion || this.selectedVersion.isLocked) return;
    this.feeTypeForm = {
      name: '',
      category: FeeCategory.Academic,
      frequency: FeeFrequency.Quarterly,
      isMandatory: true,
      isRefundable: false,
    };
    this.showFeeTypeModal = true;
    this.refreshView();
  }

  saveFeeType(): void {
    if (!this.selectedVersion || !this.feeTypeForm.name.trim()) {
      this.toast('Fee type name is required', true);
      return;
    }
    this.service.createFeeType(this.selectedVersion.id, this.feeTypeForm).subscribe({
      next: () => {
        this.showFeeTypeModal = false;
        this.openManagePanel(this.selectedVersion!.id);
        this.loadVersions();
        this.toast('Fee head added');
      },
      error: (e) => this.toast(extractApiError(e, 'Failed to add fee head'), true),
    });
  }

  deleteFeeType(ft: ReturnType<typeof normalizeFeeType>): void {
    if (!this.selectedVersion || this.selectedVersion.isLocked) return;
    if (!confirm(`Delete fee head "${ft.name}"?`)) return;
    this.service.deleteFeeType(ft.id).subscribe({
      next: () => {
        this.openManagePanel(this.selectedVersion!.id);
        this.loadVersions();
        this.toast('Fee head removed');
      },
      error: (e) => this.toast(extractApiError(e, 'Delete failed'), true),
    });
  }

  catClass = categoryBadgeClass;
  freqClass = frequencyBadgeClass;
  statusClass = versionStatusBadgeClass;

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', { duration: 2800, panelClass: error ? 'snack-error' : 'snack-success' });
  }
}
