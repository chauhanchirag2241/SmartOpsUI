import { IRoleMenuPermission } from '../../core/models/permission.model';

export interface MenuPermissionTreeNode {
  menu: IRoleMenuPermission;
  depth: number;
  children: MenuPermissionTreeNode[];
}

export interface MenuPermissionDisplayRow {
  menu: IRoleMenuPermission;
  depth: number;
  hasChildren: boolean;
}

export function buildMenuPermissionTree(menus: IRoleMenuPermission[]): MenuPermissionTreeNode[] {
  const childrenByParent = new Map<string | null, IRoleMenuPermission[]>();

  for (const menu of menus) {
    const parentKey = menu.parentMenuId ?? null;
    const bucket = childrenByParent.get(parentKey) ?? [];
    bucket.push(menu);
    childrenByParent.set(parentKey, bucket);
  }

  for (const bucket of childrenByParent.values()) {
    bucket.sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.menuName.localeCompare(b.menuName),
    );
  }

  const buildNodes = (parentId: string | null, depth: number): MenuPermissionTreeNode[] =>
    (childrenByParent.get(parentId) ?? []).map((menu) => ({
      menu,
      depth,
      children: buildNodes(menu.menuId, depth + 1),
    }));

  return buildNodes(null, 0);
}

export function flattenVisibleMenuRows(
  nodes: MenuPermissionTreeNode[],
  expandedMenuIds: ReadonlySet<string>,
): MenuPermissionDisplayRow[] {
  const rows: MenuPermissionDisplayRow[] = [];

  const walk = (items: MenuPermissionTreeNode[]): void => {
    for (const node of items) {
      const hasChildren = node.children.length > 0;
      rows.push({ menu: node.menu, depth: node.depth, hasChildren });
      if (hasChildren && expandedMenuIds.has(node.menu.menuId)) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return rows;
}

export function collectMenuDescendants(
  menus: IRoleMenuPermission[],
  menuId: string,
): IRoleMenuPermission[] {
  const descendants: IRoleMenuPermission[] = [];

  const collect = (parentId: string): void => {
    for (const menu of menus) {
      if (menu.parentMenuId === parentId) {
        descendants.push(menu);
        collect(menu.menuId);
      }
    }
  };

  collect(menuId);
  return descendants;
}

export function collectExpandableMenuIds(nodes: MenuPermissionTreeNode[]): string[] {
  const ids: string[] = [];

  const walk = (items: MenuPermissionTreeNode[]): void => {
    for (const node of items) {
      if (node.children.length > 0) {
        ids.push(node.menu.menuId);
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return ids;
}
