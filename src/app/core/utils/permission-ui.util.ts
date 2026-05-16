import { PermissionService } from '../services/permission.service';
import type {
  DataTableAction,
  DataTableBulkAction,
  DataTableConfig,
} from '../../shared/interfaces/data-table.interface';

export function applyModuleTablePermissions(
  config: DataTableConfig,
  permissionService: PermissionService,
  menuCode: string,
): DataTableConfig {
  const header = {
    title: config.header?.title ?? '',
    subtitle: config.header?.subtitle,
    addButtonText: config.header?.addButtonText,
    addButtonIcon: config.header?.addButtonIcon,
    addButtonClass: config.header?.addButtonClass,
    showAddButton: permissionService.canAdd(menuCode),
  };

  const actions = (config.actions ?? []).filter((action) =>
    isActionAllowed(action, permissionService, menuCode),
  );

  const bulkActions = (config.bulkActions ?? []).filter((action) =>
    isBulkActionAllowed(action, permissionService, menuCode),
  );

  return {
    ...config,
    header,
    actions,
    bulkActions,
    showExport: config.showExport !== false && permissionService.canExport(menuCode),
  };
}

function isActionAllowed(
  action: DataTableAction,
  permissionService: PermissionService,
  menuCode: string,
): boolean {
  if (action.danger || action.label.toLowerCase().includes('delete')) {
    return permissionService.canDelete(menuCode);
  }
  if (action.label.toLowerCase().includes('edit')) {
    return permissionService.canEdit(menuCode);
  }
  if (action.label.toLowerCase().includes('view')) {
    return permissionService.canView(menuCode);
  }
  return permissionService.canView(menuCode);
}

function isBulkActionAllowed(
  action: DataTableBulkAction,
  permissionService: PermissionService,
  menuCode: string,
): boolean {
  if (action.danger || action.label.toLowerCase().includes('delete')) {
    return permissionService.canDelete(menuCode);
  }
  if (action.label.toLowerCase().includes('edit')) {
    return permissionService.canEdit(menuCode);
  }
  return permissionService.canView(menuCode);
}
