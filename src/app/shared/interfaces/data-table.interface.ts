/**
 * Defines how a single column is rendered in the data table.
 */
export interface DataTableColumn {
  /** Unique key matching the data property name */
  key: string;
  /** Display label shown in the header */
  label: string;
  /** Whether this column is sortable (default: false) */
  sortable?: boolean;
  /** Whether this column can be toggled on/off via column visibility menu (default: true) */
  toggleable?: boolean;
  /** Whether this column is visible by default (default: true) */
  visible?: boolean;
  /** Optional width CSS value (e.g. '120px', '15%') */
  width?: string;
  /** Cell render type – determines how data is displayed */
  cellType?: 'text' | 'badge' | 'progress' | 'avatar' | 'custom' | 'date';
  /** For badge type: maps data values to badge styles */
  badgeMap?: Record<string, DataTableBadge>;
  /** For progress type: color thresholds */
  progressColors?: DataTableProgressColor[];
  /** For avatar type: config for avatar cell */
  avatarConfig?: DataTableAvatarConfig;
  /** CSS text-align for the cell (default: 'left') */
  align?: 'left' | 'center' | 'right';
}

export interface DataTableBadge {
  /** CSS class name for the badge */
  cssClass: 'b-green' | 'b-red' | 'b-amber' | 'b-gray' | string;
  /** Material icon name to show inside the badge */
  icon?: string;
  /** Optional display label (overrides raw value) */
  label?: string;
}

export interface DataTableProgressColor {
  /** Minimum value (inclusive) for this color to apply */
  min: number;
  /** Color hex/css value */
  color: string;
}

export interface DataTableAvatarConfig {
  /** Key of the data property for the display name */
  nameKey: string;
  /** Key of the data property for the subtitle (e.g. email) */
  subtitleKey?: string;
  /** Key of the data property for avatar initials */
  initialsKey?: string;
  /** Key of the data property for avatar CSS class */
  avatarClassKey?: string;
}

/**
 * A filter chip shown in the toolbar.
 */
export interface DataTableFilter {
  /** Display label */
  label: string;
  /** Material icon name */
  icon: string;
  /** Unique value identifier for this filter */
  value: string;
  /** Filter function applied to data rows */
  filterFn?: (row: Record<string, unknown>) => boolean;
}

/**
 * A single context menu item (3-dot menu action).
 */
export interface DataTableAction {
  /** Display label */
  label: string;
  /** Material icon name */
  icon: string;
  /** Icon color CSS value */
  iconColor?: string;
  /** Whether this is a danger/destructive action (shows red) */
  danger?: boolean;
  /** Whether to show a separator before this item */
  separatorBefore?: boolean;
}

/**
 * A single bulk action shown when rows are selected.
 */
export interface DataTableBulkAction {
  /** Display label */
  label: string;
  /** Material icon name */
  icon: string;
  /** Whether this is a danger/destructive action */
  danger?: boolean;
}

/**
 * Header configuration for the data table.
 */
export interface DataTableHeader {
  /** Main title to display in the header */
  title: string;
  /** Subtitle/description to display below the title */
  subtitle?: string;
  /** Whether to show the add button */
  showAddButton?: boolean;
  /** Text for the add button (default: 'Add') */
  addButtonText?: string;
  /** Material icon for the add button (default: 'add') */
  addButtonIcon?: string;
  /** CSS class for the add button (default: 'btn-primary') */
  addButtonClass?: string;
}

/**
 * Main configuration object passed to the smart-data-table component.
 */
export interface DataTableConfig {
  /** Array of column definitions */
  columns: DataTableColumn[];
  /** Array of filter chips (first one is default active) */
  filters?: DataTableFilter[];
  /** Context menu (3-dot) actions per row */
  actions?: DataTableAction[];
  /** Bulk actions shown when rows are selected */
  bulkActions?: DataTableBulkAction[];
  /** Placeholder text for the search box */
  searchPlaceholder?: string;
  /** Keys to search within when user types in search box */
  searchKeys?: string[];
  /** Page size options */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
  /** Whether to show checkbox selection column (default: true) */
  selectable?: boolean;
  /** Whether to show the search box (default: true) */
  showSearch?: boolean;
  /** Whether to show the export button (default: true) */
  showExport?: boolean;
  /** Whether to show column visibility toggle (default: true) */
  showColumnToggle?: boolean;
  /** Label for footer info text, e.g. 'students', 'records' */
  itemLabel?: string;
  /** Header configuration */
  header?: DataTableHeader;
}
