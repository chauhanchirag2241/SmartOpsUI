import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { AddPeriodTemplateComponent } from './add-period-template/add-period-template.component';
import { PeriodTemplateService } from '../../../core/services/period-template.service';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';

import type {
  DataTableAction,
  DataTableConfig,
  DataTableFilter,
} from '../../../shared/components/smart-data-table';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';

@Component({
  selector: 'app-periods',
  standalone: true,
  imports: [
    CommonModule,
    SmartDataTableComponent,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    AddPeriodTemplateComponent,
  ],
  templateUrl: './periods.component.html',
  styleUrl: './periods.component.css',
})
export class PeriodsComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly router = inject(Router);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedTemplateId?: string;
  totalTemplates = 0;
  currentFilter = 'All';
  templates: Record<string, unknown>[] = [];
  tableConfig!: DataTableConfig;

  private readonly baseTableConfig: DataTableConfig = {
    header: {
      title: 'Period Templates',
      subtitle: 'Create bell-schedule templates (e.g. 2 periods for Class 1–2, full day for others)',
      showAddButton: true,
      addButtonText: 'Add template',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      { key: 'name', label: 'Template', sortable: true },
      { key: 'description', label: 'Description' },
      { key: 'periodCount', label: 'Periods', sortable: true },
      { key: 'teachingPeriodCount', label: 'Teaching', sortable: true },
      {
        key: 'isActive',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-green', label: 'Active' },
          false: { cssClass: 'b-red', label: 'Inactive' },
        },
      },
    ],
    filtersInPanel: true,
    filters: [
      { label: 'All', icon: 'list', value: 'All' },
      { label: 'Active', icon: 'check_circle', value: 'Active' },
      { label: 'Inactive', icon: 'cancel', value: 'Inactive' },
    ],
    actions: [
      { label: 'View details', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit details', icon: 'edit', iconColor: '#1E40AF' },
      { label: 'Show history', icon: 'history', iconColor: '#639922' },
      { label: 'Delete', icon: 'delete', danger: true, separatorBefore: true },
    ],
    actionVisibleFn: (action, row) => this.isActionVisible(action, row),
    searchPlaceholder: 'Search templates...',
    searchKeys: ['name', 'description'],
    itemLabel: 'templates',
    defaultPageSize: 10,
  };

  constructor(
    private snackBar: NotificationService,
    private templateService: PeriodTemplateService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.tableConfig = this.buildTableConfig();
    this.loadTemplates();
  }

  loadTemplates(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter: string = this.currentFilter,
  ): void {
    this.templateService.getList(pageIndex, pageSize, searchQuery, sortColumn, sortDirection, filter).subscribe({
      next: (res: any) => {
        this.templates = res?.items || [];
        this.totalTemplates = res?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load period templates', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canAdd(MenuCodes.PeriodMaster)) return;
    this.formMode = 'add';
    this.selectedTemplateId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onSaved(): void {
    this.showAddForm = false;
    this.loadTemplates();
  }

  onPageChange(event: any): void {
    this.loadTemplates(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
      event.currentFilter || this.currentFilter,
    );
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    this.currentFilter = filter ? filter.value : 'All';
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View details') {
      if (!this.permissionService.canView(MenuCodes.PeriodMaster)) return;
      this.formMode = 'view';
      this.selectedTemplateId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit details') {
      if (!this.permissionService.canEdit(MenuCodes.PeriodMaster)) return;
      this.formMode = 'edit';
      this.selectedTemplateId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Show history') {
      if (!this.permissionService.canView(MenuCodes.PeriodMaster)) return;
      this.router.navigate(['/timetable/periods', id, 'history']);
    } else if (event.action.label === 'Delete') {
      if (!this.permissionService.canDelete(MenuCodes.PeriodMaster)) return;
      const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
        data: {
          title: 'Delete period template?',
          description: 'This removes the template and its periods.',
          recordName: event.row['name'] as string,
          recordMeta: `${event.row['periodCount'] ?? 0} periods`,
          initials: String(event.row['name'] || 'T').substring(0, 2).toUpperCase(),
          warningMessage: 'Class timetables using this template may be affected.',
        },
        panelClass: 'erp-dialog',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe((confirmed: any) => {
        if (confirmed) {
          this.templateService.delete(id).subscribe({
            next: () => {
              this.snackBar.open('Template deleted', 'Close', { duration: 3000, panelClass: 'snack-success' });
              this.loadTemplates();
            },
            error: () =>
              this.snackBar.open('Failed to delete template', 'Close', { duration: 3000, panelClass: 'snack-error' }),
          });
        }
      });
    }
  }

  rowClass = (row: Record<string, unknown>): string => (row['isActive'] === false ? 'row-inactive' : '');

  private isActionVisible(action: DataTableAction, row: Record<string, unknown>): boolean {
    if (row['isActive'] !== false) return true;
    return action.label === 'View details' || action.label === 'Show history';
  }

  private buildTableConfig(): DataTableConfig {
    const permittedConfig = applyModuleTablePermissions(
      this.baseTableConfig,
      this.permissionService,
      MenuCodes.PeriodMaster,
      this.ayContext.isReadOnlyScope(),
    );
    return {
      ...permittedConfig,
      columns: permittedConfig.columns.filter((col) => col.key !== 'isActive'),
    };
  }
}
