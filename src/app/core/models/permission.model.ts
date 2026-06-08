export interface IMenuPermission {
  menuCode: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface IUserPermissionResponse {
  userId: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  permissions: IMenuPermission[];
}

export interface IRoleMenuPermission {
  menuId: string;
  menuCode: string;
  menuName: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface IRoleDashboardWidgetPermission {
  widgetId: string;
  widgetCode: string;
  widgetName: string;
  category: string;
  requiredMenuCode: string;
  displayOrder: number;
  defaultSize: string;
  canView: boolean;
}
