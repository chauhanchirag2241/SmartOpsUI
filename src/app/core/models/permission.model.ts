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
