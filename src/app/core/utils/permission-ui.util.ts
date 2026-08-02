import { PermissionService } from '../services/permission.service';
import type {
  DataTableAction,
  DataTableActionPermission,
  DataTableBulkAction,
  DataTableConfig,
} from '../../shared/interfaces/data-table.interface';

/**
 * Stamps permission metadata and filters Add / actions / bulk / export
 * for the given menu. Prefer passing the result to `app-smart-data-table`
 * so it can re-apply when the session permissions refresh.
 */
export function applyModuleTablePermissions(
  config: DataTableConfig,
  permissionService: PermissionService,
  menuCode: string,
  readOnlyYear = false,
): DataTableConfig {
  const sourceActions = config.permissionSourceActions ?? config.actions;
  const sourceBulk = config.permissionSourceBulkActions ?? config.bulkActions;
  const sourceShowAdd =
    config.permissionSourceShowAdd ?? config.header?.showAddButton !== false;
  const sourceShowExport =
    config.permissionSourceShowExport ?? config.showExport !== false;

  return filterTableConfigByPermissions(
    {
      ...config,
      permissionMenuCode: menuCode,
      permissionSourceActions: sourceActions ? [...sourceActions] : undefined,
      permissionSourceBulkActions: sourceBulk ? [...sourceBulk] : undefined,
      permissionSourceShowAdd: sourceShowAdd,
      permissionSourceShowExport: sourceShowExport,
      actions: sourceActions,
      bulkActions: sourceBulk,
      showExport: sourceShowExport,
      header: {
        ...config.header,
        title: config.header?.title ?? '',
        showAddButton: sourceShowAdd,
      },
    },
    permissionService,
    menuCode,
    readOnlyYear,
  );
}

/** Live filter used by smart-data-table when `permissionMenuCode` is set. */
export function filterTableConfigByPermissions(
  config: DataTableConfig,
  permissionService: PermissionService,
  menuCode: string,
  readOnlyYear = false,
): DataTableConfig {
  const sourceActions = config.permissionSourceActions ?? config.actions ?? [];
  const sourceBulk = config.permissionSourceBulkActions ?? config.bulkActions ?? [];
  const sourceShowAdd =
    config.permissionSourceShowAdd ?? config.header?.showAddButton !== false;
  const sourceShowExport =
    config.permissionSourceShowExport ?? config.showExport !== false;

  const header = {
    ...config.header,
    title: config.header?.title ?? '',
    subtitle: config.header?.subtitle,
    addButtonText: config.header?.addButtonText,
    addButtonIcon: config.header?.addButtonIcon,
    addButtonClass: config.header?.addButtonClass,
    showAddButton:
      sourceShowAdd && !readOnlyYear && permissionService.canAdd(menuCode),
  };

  const actions = sourceActions.filter((action) =>
    isActionAllowed(action, permissionService, menuCode, readOnlyYear),
  );

  const bulkActions = sourceBulk.filter((action) =>
    isBulkActionAllowed(action, permissionService, menuCode, readOnlyYear),
  );

  return {
    ...config,
    permissionMenuCode: menuCode,
    permissionSourceActions: config.permissionSourceActions ?? [...sourceActions],
    permissionSourceBulkActions: config.permissionSourceBulkActions ?? [...sourceBulk],
    permissionSourceShowAdd: sourceShowAdd,
    permissionSourceShowExport: sourceShowExport,
    header,
    actions,
    bulkActions,
    showExport: sourceShowExport && permissionService.canExport(menuCode),
  };
}

export function isActionAllowed(
  action: DataTableAction,
  permissionService: PermissionService,
  menuCode: string,
  readOnlyYear: boolean,
): boolean {
  const kind = resolveActionPermission(action);
  if (readOnlyYear) {
    return kind === 'view';
  }
  return hasPermissionKind(permissionService, menuCode, kind);
}

function isBulkActionAllowed(
  action: DataTableBulkAction,
  permissionService: PermissionService,
  menuCode: string,
  readOnlyYear: boolean,
): boolean {
  if (readOnlyYear) {
    return false;
  }
  const kind = resolveBulkActionPermission(action);
  return hasPermissionKind(permissionService, menuCode, kind);
}

function hasPermissionKind(
  permissionService: PermissionService,
  menuCode: string,
  kind: DataTableActionPermission,
): boolean {
  switch (kind) {
    case 'add':
      return permissionService.canAdd(menuCode);
    case 'edit':
      return permissionService.canEdit(menuCode);
    case 'delete':
      return permissionService.canDelete(menuCode);
    case 'export':
      return permissionService.canExport(menuCode);
    case 'view':
    default:
      return permissionService.canView(menuCode);
  }
}

function resolveActionPermission(action: DataTableAction): DataTableActionPermission {
  if (action.permission) {
    return action.permission;
  }
  if (action.danger) {
    return 'delete';
  }
  const label = action.label.toLowerCase();
  if (/\b(delete|remove|archive)\b/.test(label)) {
    return 'delete';
  }
  if (
    /\b(edit|update|recover|restore|unarchive|assign|promote|collect|approve|reject|process)\b/.test(
      label,
    )
  ) {
    return 'edit';
  }
  if (/\b(add|create|new)\b/.test(label)) {
    return 'add';
  }
  if (/\b(export|download)\b/.test(label)) {
    return 'export';
  }
  // view / history / profile / details / report / payslip / etc.
  return 'view';
}

function resolveBulkActionPermission(action: DataTableBulkAction): DataTableActionPermission {
  if (action.permission) {
    return action.permission;
  }
  if (action.danger) {
    return 'delete';
  }
  const label = action.label.toLowerCase();
  if (/\b(delete|remove)\b/.test(label)) {
    return 'delete';
  }
  if (/\b(edit|promote|assign|update)\b/.test(label)) {
    return 'edit';
  }
  if (/\b(add|create)\b/.test(label)) {
    return 'add';
  }
  return 'view';
}
