import { NgClass, NgStyle, NgTemplateOutlet, DatePipe } from '@angular/common';
import {
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  DataTableAction,
  DataTableBulkAction,
  DataTableColumn,
  DataTableConfig,
  DataTableFilter,
} from '../../interfaces/data-table.interface';
import { AvatarColorService } from '../../services/avatar-color.service';
import { isInsideFilterDrop, isNativeSelectInteraction } from '../../utils/filter-panel.util';

@Component({
  selector: 'app-smart-data-table',
  standalone: true,
  imports: [NgClass, NgStyle, NgTemplateOutlet, FormsModule, MatIconModule, DatePipe],
  templateUrl: './smart-data-table.component.html',
  styleUrl: './smart-data-table.component.css',
})
export class SmartDataTableComponent implements OnInit, OnChanges {
  private readonly avatarColor = inject(AvatarColorService);
  /** Table configuration object */
  @Input() config!: DataTableConfig;

  /** Data array to display */
  @Input() data: Record<string, unknown>[] = [];

  /** Total records (for server-side pagination) */
  @Input() totalRecords = 0;

  /** Enable server-side pagination/filtering */
  @Input() serverSide = false;

  /** Optional: callback to determine custom CSS class for a row */
  @Input() rowClassFn?: (row: Record<string, unknown>) => string;

  /** Optional: initial filter value to select */
  @Input() initialFilterValue?: string;

  /** Optional: custom cell template passed from parent */
  @ContentChild('customCell') customCellTemplate?: TemplateRef<unknown>;

  /** Emits when a context menu action is clicked: { action, row, rowIndex } */
  @Output() actionClicked = new EventEmitter<{
    action: DataTableAction;
    row: Record<string, unknown>;
    rowIndex: number;
  }>();

  /** Emits when export button is clicked */
  @Output() exportClicked = new EventEmitter<void>();

  /** Emits when a bulk action is clicked: { action, selectedRows } */
  @Output() bulkActionClicked = new EventEmitter<{
    action: DataTableBulkAction;
    selectedRows: Record<string, unknown>[];
  }>();

  /** Emits when a filter chip is clicked */
  @Output() filterChanged = new EventEmitter<DataTableFilter | null>();

  /** Emits when user clears filters from the toolbar panel */
  @Output() advancedFiltersCleared = new EventEmitter<void>();

  /** Highlights the Filter toolbar button when parent has active panel filters */
  @Input() filterPanelActive = false;

  /** Emits when page or search changes in server-side mode */
  @Output() pageChange = new EventEmitter<{
    pageIndex: number;
    pageSize: number;
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: string | null;
    currentFilter: string | null;
  }>();

  /** Emits when add button is clicked */
  @Output() addButtonClicked = new EventEmitter<void>();

  @ViewChild('ctxMenu') ctxMenuRef!: ElementRef<HTMLDivElement>;

  // --- Internal State ---
  searchQuery = '';
  activeFilter: DataTableFilter | null = null;
  filteredData: Record<string, unknown>[] = [];
  pagedData: Record<string, unknown>[] = [];

  // Selection
  selectedRows = new Set<number>();
  selectAll = false;
  indeterminate = false;

  // Sorting
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  // Column visibility
  columnVisibility: Record<string, boolean> = {};
  showColMenu = false;
  showFilterMenu = false;
  private suppressFilterOutsideClose = false;

  // Context menu
  ctxMenuVisible = false;
  ctxMenuTop = 0;
  ctxMenuLeft = 0;
  ctxMenuRowIndex = -1;

  get ctxMenuRow(): Record<string, unknown> {
    if (this.ctxMenuRowIndex < 0 || this.ctxMenuRowIndex >= this.pagedData.length) {
      return {};
    }
    const globalIdx = (this.currentPage - 1) * this.pageSize + this.ctxMenuRowIndex;
    return this.filteredData[globalIdx] ?? {};
  }

  get visibleColumns(): DataTableColumn[] {
    return this.config?.columns?.filter((col) => this.columnVisibility[col.key] !== false) ?? [];
  }

  get totalColumnsCount(): number {
    let count = this.visibleColumns.length;
    if (this.config?.selectable !== false) count++;
    if (this.config?.actions?.length) count++;
    return count;
  }

  get showingStart(): number {
    const total = this.serverSide ? this.totalRecords : this.filteredData.length;
    return total === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingEnd(): number {
    const total = this.serverSide ? this.totalRecords : this.filteredData.length;
    return Math.min(this.currentPage * this.pageSize, total);
  }

  get pageSizeOptions(): number[] {
    return this.config?.pageSizeOptions ?? [10, 25, 50, 100];
  }

  trackPagedRow(i: number, row: Record<string, unknown>): string {
    const id = row['id'] ?? row['admNo'] ?? row['name'];
    return `${this.currentPage}-${i}-${String(id)}`;
  }

  trackPaginationPage(index: number, page: number | '...'): string {
    return `${index}-${page}`;
  }

  trackBulkAction(index: number, ba: DataTableBulkAction): string {
    return `${index}-${ba.label}`;
  }

  trackContextAction(index: number, action: DataTableAction): string {
    return `${index}-${action.label}`;
  }

  get paginationPages(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (this.totalPages <= 7) {
      for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (this.currentPage > 3) pages.push('...');
      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(this.totalPages - 1, this.currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (this.currentPage < this.totalPages - 2) pages.push('...');
      pages.push(this.totalPages);
    }
    return pages;
  }

  ngOnInit(): void {
    this.initDefaults();
    this.applyFilters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['config'] || changes['totalRecords']) {
      this.initDefaults();
      if (this.serverSide) {
        this.filteredData = this.data;
        this.pagedData = this.data;
        this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
        this.updateSelectionState();
      } else {
        this.applyFilters();
      }
    }
  }

  private initDefaults(): void {
    if (!this.config) return;

    // Init column visibility
    this.config.columns.forEach((col) => {
      if (this.columnVisibility[col.key] === undefined) {
        this.columnVisibility[col.key] = col.visible !== false;
      }
    });

    // Init page size
    this.pageSize = this.config.defaultPageSize ?? this.config.pageSizeOptions?.[0] ?? 10;

    // Init default active filter
    if (this.config.filters?.length && !this.activeFilter) {
      if (this.initialFilterValue) {
        this.activeFilter = this.config.filters.find(f => f.value === this.initialFilterValue) || this.config.filters[0];
      } else {
        this.activeFilter = this.config.filters[0];
      }
    }
  }

  // ========================
  // SEARCH & FILTER
  // ========================

  onSearchInput(): void {
    if (this.serverSide) {
      return;
    }
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchSubmit(): void {
    this.currentPage = 1;
    if (this.serverSide) {
      this.emitPageChange();
    } else {
      this.applyFilters();
    }
  }

  setFilter(filter: DataTableFilter): void {
    if (this.activeFilter?.value === filter.value) return;

    this.activeFilter = filter;
    this.currentPage = 1;
    this.clearSelection();
    if (this.serverSide) {
      this.emitPageChange();
    } else {
      this.applyFilters();
    }
    this.filterChanged.emit(filter);
  }

  private emitPageChange(): void {
    this.pageChange.emit({
      pageIndex: this.currentPage,
      pageSize: this.pageSize,
      searchQuery: this.searchQuery,
      sortColumn: this.sortColumn,
      sortDirection: this.sortDirection,
      currentFilter: this.activeFilter?.value || null,
    });
  }

  applyFilters(): void {
    let rows = [...this.data];

    // Apply active filter (skip first "All" filter if it has no filterFn)
    if (this.activeFilter?.filterFn) {
      rows = rows.filter(this.activeFilter.filterFn);
    }

    // Apply search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      const searchKeys =
        this.config?.searchKeys ?? this.config?.columns?.map((c) => c.key) ?? [];
      rows = rows.filter((row) =>
        searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(q)),
      );
    }

    // Apply sort
    if (this.sortColumn && this.sortDirection) {
      const key = this.sortColumn;
      const dir = this.sortDirection;
      rows.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (typeof av === 'number' && typeof bv === 'number') {
          return dir === 'asc' ? av - bv : bv - av;
        }
        return dir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''));
      });
    }

    this.filteredData = rows;
    this.totalPages = Math.max(1, Math.ceil(rows.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    this.updatePage();
  }

  // ========================
  // SORTING
  // ========================

  sortCol(column: DataTableColumn): void {
    if (!column.sortable) return;

    if (this.sortColumn === column.key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column.key;
      this.sortDirection = 'asc';
    }
    if (this.serverSide) {
      // Sorting is not fully implemented for server-side in this snippet, but trigger page change if needed
      this.emitPageChange();
    } else {
      this.applyFilters();
    }
  }

  // ========================
  // SELECTION
  // ========================

  toggleSelectAll(checked: boolean): void {
    this.selectAll = checked;
    if (checked) {
      this.pagedData.forEach((_, i) => {
        const globalIndex = (this.currentPage - 1) * this.pageSize + i;
        this.selectedRows.add(globalIndex);
      });
    } else {
      this.pagedData.forEach((_, i) => {
        const globalIndex = (this.currentPage - 1) * this.pageSize + i;
        this.selectedRows.delete(globalIndex);
      });
    }
    this.updateSelectionState();
  }

  toggleRowSelection(globalIndex: number): void {
    if (this.selectedRows.has(globalIndex)) {
      this.selectedRows.delete(globalIndex);
    } else {
      this.selectedRows.add(globalIndex);
    }
    this.updateSelectionState();
  }

  isRowSelected(pageIndex: number): boolean {
    const globalIndex = (this.currentPage - 1) * this.pageSize + pageIndex;
    return this.selectedRows.has(globalIndex);
  }

  getGlobalIndex(pageIndex: number): number {
    return (this.currentPage - 1) * this.pageSize + pageIndex;
  }

  private updateSelectionState(): void {
    const pageIndices = this.pagedData.map(
      (_, i) => (this.currentPage - 1) * this.pageSize + i,
    );
    const selectedOnPage = pageIndices.filter((i) => this.selectedRows.has(i)).length;
    this.selectAll = selectedOnPage === this.pagedData.length && this.pagedData.length > 0;
    this.indeterminate = selectedOnPage > 0 && selectedOnPage < this.pagedData.length;
  }

  private clearSelection(): void {
    this.selectedRows.clear();
    this.selectAll = false;
    this.indeterminate = false;
  }

  getSelectedRows(): Record<string, unknown>[] {
    return Array.from(this.selectedRows)
      .filter((i) => i < this.filteredData.length)
      .map((i) => this.filteredData[i]);
  }

  // ========================
  // PAGINATION
  // ========================

  private updatePage(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedData = this.filteredData.slice(start, start + this.pageSize);
    this.updateSelectionState();
  }

  goToPage(page: number | '...'): void {
    if (page === '...' || page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    if (this.serverSide) {
      this.emitPageChange();
    } else {
      this.updatePage();
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.clearSelection();
    if (this.serverSide) {
      this.totalPages = Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
      this.emitPageChange();
    } else {
      this.applyFilters();
    }
  }

  // ========================
  // COLUMN VISIBILITY
  // ========================

  toggleFilterMenu(event: Event): void {
    event.stopPropagation();
    this.showFilterMenu = !this.showFilterMenu;
    if (this.showFilterMenu) {
      this.showColMenu = false;
    }
  }

  closeFilterMenu(event?: Event): void {
    event?.stopPropagation();
    this.showFilterMenu = false;
  }

  clearAdvancedFilters(): void {
    const first = this.config.filters?.[0];
    if (first) {
      this.setFilter(first);
    } else {
      this.activeFilter = null;
      this.filterChanged.emit(null);
    }
    this.advancedFiltersCleared.emit();
  }

  toggleColMenu(event: Event): void {
    event.stopPropagation();
    this.showColMenu = !this.showColMenu;
    if (this.showColMenu) {
      this.showFilterMenu = false;
    }
  }

  toggleColumnVisibility(key: string, visible: boolean): void {
    this.columnVisibility[key] = visible;
  }

  getToggleableColumns(): DataTableColumn[] {
    return this.config?.columns?.filter((col) => col.toggleable !== false) ?? [];
  }

  // ========================
  // CONTEXT MENU (3-DOT)
  // ========================

  openContextMenu(event: MouseEvent, rowIndex: number): void {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 180;

    let left = rect.right - menuWidth;
    let top = rect.bottom + 4;

    if (left < 8) left = 8;
    if (top + 240 > window.innerHeight) top = rect.top - 244;

    this.ctxMenuLeft = left;
    this.ctxMenuTop = top;
    this.ctxMenuRowIndex = rowIndex;
    this.ctxMenuVisible = true;
  }

  onActionClick(action: DataTableAction): void {
    this.ctxMenuVisible = false;
    if (this.ctxMenuRowIndex >= 0 && this.ctxMenuRowIndex < this.pagedData.length) {
      const globalIdx = (this.currentPage - 1) * this.pageSize + this.ctxMenuRowIndex;
      this.actionClicked.emit({
        action,
        row: this.filteredData[globalIdx],
        rowIndex: globalIdx,
      });
    }
  }

  onBulkAction(action: DataTableBulkAction): void {
    this.bulkActionClicked.emit({
      action,
      selectedRows: this.getSelectedRows(),
    });
  }

  onExportClick(): void {
    this.exportClicked.emit();
  }

  onAddButtonClick(): void {
    this.addButtonClicked.emit();
  }

  // ========================
  // CELL RENDERING HELPERS
  // ========================

  getCellValue(row: Record<string, unknown>, key: string): unknown {
    return row[key];
  }

  isEmptyCellValue(value: unknown): boolean {
    return value == null || value === '';
  }

  formatCellDisplay(value: unknown): string {
    return this.isEmptyCellValue(value) ? '—' : String(value);
  }

  getBadgeClass(column: DataTableColumn, value: unknown): string {
    if (this.isEmptyCellValue(value)) {
      return '';
    }
    const badge = column.badgeMap?.[String(value)];
    return badge?.cssClass ?? 'b-gray';
  }

  getBadgeIcon(column: DataTableColumn, value: unknown): string {
    if (this.isEmptyCellValue(value)) {
      return '';
    }
    const badge = column.badgeMap?.[String(value)];
    return badge?.icon ?? '';
  }

  getBadgeLabel(column: DataTableColumn, value: unknown): string {
    if (this.isEmptyCellValue(value)) {
      return '—';
    }
    const badge = column.badgeMap?.[String(value)];
    return badge?.label ?? String(value);
  }

  getProgressColor(column: DataTableColumn, value: unknown): string {
    const num = Number(value) || 0;
    if (!column.progressColors?.length) return '#639922';
    // Sort thresholds descending and find first match
    const sorted = [...column.progressColors].sort((a, b) => b.min - a.min);
    for (const threshold of sorted) {
      if (num >= threshold.min) return threshold.color;
    }
    return sorted[sorted.length - 1]?.color ?? '#E24B4A';
  }

  getAvatarInitials(name: unknown): string {
    return this.avatarColor.getInitials(name);
  }

  getAvatarClass(name: unknown): string {
    return this.avatarColor.getAvatarClass(name);
  }

  // ========================
  // GLOBAL CLICK HANDLER
  // ========================

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (isNativeSelectInteraction(event.target)) {
      this.suppressFilterOutsideClose = true;
      window.setTimeout(() => (this.suppressFilterOutsideClose = false), 250);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.ctx-menu') && !target.closest('.dot-btn')) {
      this.ctxMenuVisible = false;
    }
    if (!target.closest('.col-drop')) {
      this.showColMenu = false;
    }
    if (this.showFilterMenu && !this.suppressFilterOutsideClose && !isInsideFilterDrop(event)) {
      this.showFilterMenu = false;
    }
  }
}
