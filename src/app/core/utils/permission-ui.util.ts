import type { AuthService } from '../services/auth.service';
import type { ModulePermissionKey, ModulePermissionSet } from '../config/permission-ui.config';
import { MODULE_PERMISSIONS } from '../config/permission-ui.config';
import type {
  DataTableAction,
  DataTableBulkAction,
  DataTableConfig,
} from '../../shared/interfaces/data-table.interface';

export function canShowNavItem(
  auth: AuthService,
  permissions?: string[],
  singlePermission?: string,
): boolean {
  if (permissions?.length) {
    return auth.hasAnyPermission(...permissions);
  }
  return auth.hasPermission(singlePermission);
}

export function applyModuleTablePermissions(
  config: DataTableConfig,
  auth: AuthService,
  moduleKey: ModulePermissionKey,
): DataTableConfig {
  const perms: ModulePermissionSet = MODULE_PERMISSIONS[moduleKey];

  const header = {
    title: config.header?.title ?? '',
    subtitle: config.header?.subtitle,
    addButtonText: config.header?.addButtonText,
    addButtonIcon: config.header?.addButtonIcon,
    addButtonClass: config.header?.addButtonClass,
    showAddButton: false,
  };
  if (perms.create) {
    header.showAddButton = auth.hasPermission(perms.create);
  }

  const actions = (config.actions ?? []).filter((action) =>
    isActionAllowed(action, auth, perms),
  );

  const bulkActions = (config.bulkActions ?? []).filter((action) =>
    isBulkActionAllowed(action, auth, perms),
  );

  return {
    ...config,
    header,
    actions,
    bulkActions,
    showExport: config.showExport !== false && auth.hasPermission(perms.read),
  };
}

function isActionAllowed(
  action: DataTableAction,
  auth: AuthService,
  perms: ModulePermissionSet,
): boolean {
  if (action.permission) {
    return auth.hasPermission(action.permission);
  }
  if (action.danger || action.label.toLowerCase().includes('delete')) {
    return perms.delete ? auth.hasPermission(perms.delete) : false;
  }
  if (action.label.toLowerCase().includes('edit')) {
    return perms.update ? auth.hasPermission(perms.update) : false;
  }
  if (action.label.toLowerCase().includes('view')) {
    return auth.hasPermission(perms.read);
  }
  return auth.hasPermission(perms.read);
}

function isBulkActionAllowed(
  action: DataTableBulkAction,
  auth: AuthService,
  perms: ModulePermissionSet,
): boolean {
  if (action.permission) {
    return auth.hasPermission(action.permission);
  }
  if (action.danger || action.label.toLowerCase().includes('delete')) {
    return perms.delete ? auth.hasPermission(perms.delete) : false;
  }
  if (action.label.toLowerCase().includes('edit')) {
    return perms.update ? auth.hasPermission(perms.update) : false;
  }
  return auth.hasPermission(perms.read);
}
