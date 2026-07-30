import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';

import { ClassGroupDetailComponent } from './class-group-detail/class-group-detail.component';
import { ClassService } from '../../core/services/class.service';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table/smart-data-table.component';
import type {
  DataTableAction,
  DataTableConfig,
  DataTableFilter,
} from '../../shared/components/smart-data-table';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { applyModuleTablePermissions } from '../../core/utils/permission-ui.util';
import { naturalTextCompare } from '../../shared/utils/natural-sort.util';

@Component({
  selector: 'app-class-management',
  standalone: true,
  imports: [SmartDataTableComponent, ClassGroupDetailComponent],
  templateUrl: './class-management.component.html',
  styleUrl: './class-management.component.css',
})
export class ClassManagementComponent implements OnInit {
  private readonly classService = inject(ClassService);
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor(
    private snackBar: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  showDetail = false;
  detailMode: 'edit' | 'view' = 'edit';
  selectedClassGroupId?: string;
  detailInitialTab = 0;
  totalGroups = 0;
  currentFilter = 'Active';

  groups: Record<string, unknown>[] = [];
  private allGroups: Record<string, unknown>[] = [];

  ngOnInit(): void {
    this.classConfig = this.buildClassConfig();
    this.route.queryParamMap.subscribe((params) => {
      const groupId = (params.get('groupId') ?? '').trim();
      if (!groupId) {
        if (this.showDetail && !this.selectedClassGroupId) {
          this.showDetail = false;
        }
        return;
      }
      const tabRaw = Number(params.get('tab') ?? '0');
      const mode = params.get('mode');
      this.selectedClassGroupId = groupId;
      this.detailInitialTab = Number.isFinite(tabRaw) ? Math.max(0, Math.min(3, tabRaw)) : 0;
      this.detailMode = mode === 'view' ? 'view' : 'edit';
      this.showDetail = true;
      this.cdr.detectChanges();
    });
    this.loadGroups();
  }

  loadGroups(
    pageIndex = 1,
    pageSize = 10,
    searchQuery = '',
    sortColumn: string | null = null,
    sortDirection: string | null = null,
    filter = this.currentFilter,
  ): void {
    this.classService
      .getClassGroups(1, 1000, searchQuery, sortColumn, sortDirection, filter)
      .subscribe({
        next: (res: any) => {
          const rawItems = (res?.items || []) as Record<string, unknown>[];
          this.allGroups = rawItems.map((row) => ({
            ...row,
            descriptionDisplay: row['description'] || '—',
          }));
          const sorted = this.applySorting(this.allGroups, sortColumn, sortDirection);
          this.totalGroups = sorted.length;
          const start = Math.max(0, (pageIndex - 1) * pageSize);
          this.groups = sorted.slice(start, start + pageSize);
          this.cdr.detectChanges();
        },
        error: () => {
          this.snackBar.open('Failed to load classes', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private applySorting(
    rows: Record<string, unknown>[],
    sortColumn: string | null,
    sortDirection: string | null,
  ): Record<string, unknown>[] {
    const dir = sortDirection === 'desc' ? -1 : 1;
    const sorted = [...rows];
    if (!sortColumn) {
      return sorted;
    }

    sorted.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return naturalTextCompare(av, bv) * dir;
    });

    return sorted;
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedClassGroupId = undefined;
    this.detailInitialTab = 0;
    void this.router.navigate(['/classes'], { queryParams: {} });
    this.loadGroups();
  }

  onPageChange(event: {
    pageIndex: number;
    pageSize: number;
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: string | null;
    currentFilter: string | null;
  }): void {
    const filterValue = event.currentFilter ?? this.currentFilter;
    this.loadGroups(
      event.pageIndex,
      event.pageSize,
      event.searchQuery,
      event.sortColumn,
      event.sortDirection,
      filterValue,
    );
  }

  onFilterChanged(filter: DataTableFilter | null): void {
    if (filter) {
      this.currentFilter = String(filter.value);
    } else {
      this.currentFilter = 'All';
    }
  }

  classConfig!: DataTableConfig;

  private readonly baseClassConfig: DataTableConfig = {
    header: {
      title: 'Classes',
      subtitle: 'Open a class to manage its sections and subjects. Class groups are created in Config.',
      showAddButton: false,
    },
    columns: [
      { key: 'className', label: 'Class', sortable: true },
      { key: 'sectionCount', label: 'Sections', sortable: true },
      { key: 'subjectCount', label: 'Subjects', sortable: true },
      { key: 'descriptionDisplay', label: 'Description', sortable: false },
      {
        key: 'status',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          Active: { cssClass: 'b-green', label: 'Active' },
          Inactive: { cssClass: 'b-red', label: 'Inactive' },
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
      { label: 'View class', icon: 'visibility', iconColor: '#639922' },
      { label: 'Manage class', icon: 'edit', iconColor: '#1E40AF' },
    ],
    searchPlaceholder: 'Search by class name...',
    searchKeys: ['className', 'description'],
    itemLabel: 'classes',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50, 100],
  };

  classRowClass = (row: Record<string, unknown>): string => {
    return row['isActive'] === false ? 'row-inactive' : '';
  };

  private buildClassConfig(): DataTableConfig {
    const permittedConfig = applyModuleTablePermissions(
      this.baseClassConfig,
      this.permissionService,
      MenuCodes.Classes,
      this.ayContext.isReadOnlyScope(),
    );
    return {
      ...permittedConfig,
      header: {
        ...permittedConfig.header!,
        showAddButton: false,
      },
      columns: permittedConfig.columns.filter((col) => col.key !== 'status'),
    };
  }

  onActionClicked(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }): void {
    const id = event.row['id'] as string;

    if (event.action.label === 'View class') {
      if (!this.permissionService.canView(MenuCodes.Classes)) return;
      this.openDetail(id, 'view', 0);
    } else if (event.action.label === 'Manage class') {
      if (!this.permissionService.canEdit(MenuCodes.Classes) && !this.permissionService.canAdd(MenuCodes.Classes)) {
        if (!this.permissionService.canView(MenuCodes.Classes)) return;
        this.openDetail(id, 'view', 0);
      } else {
        this.openDetail(id, 'edit', 0);
      }
    }
  }

  private openDetail(groupId: string, mode: 'edit' | 'view', tab: number): void {
    this.detailMode = mode;
    this.selectedClassGroupId = groupId;
    this.detailInitialTab = tab;
    this.showDetail = true;
    void this.router.navigate(['/classes'], {
      queryParams: { groupId, tab, mode },
      replaceUrl: true,
    });
  }

  onExportClicked(): void {
    this.snackBar.open('Exporting class data...', 'Close', {
      duration: 3000,
      panelClass: 'snack-success',
    });
  }
}
