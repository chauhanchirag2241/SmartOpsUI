import { IRoleMenuPermission } from '../../core/models/permission.model';

export type MenuPermField = 'canView' | 'canAdd' | 'canEdit' | 'canDelete' | 'canExport';

export const MENU_PERM_FIELDS: readonly MenuPermField[] = [
  'canView',
  'canAdd',
  'canEdit',
  'canDelete',
  'canExport',
] as const;

export type GroupColState = 'none' | 'some' | 'all';

export interface MenuPermissionTreeNode {
  menu: IRoleMenuPermission;
  depth: number;
  children: MenuPermissionTreeNode[];
}

export interface MenuPermissionDisplayRow {
  menu: IRoleMenuPermission;
  depth: number;
  hasChildren: boolean;
  /** Granted menus in subtree (self + descendants with any perm) / total in subtree */
  grantedBadge?: { granted: number; total: number };
}

export interface MenuPermissionSummary {
  totalMenus: number;
  menusWithAnyPermission: number;
  menusWithView: number;
}

function sortMenus(a: IRoleMenuPermission, b: IRoleMenuPermission): number {
  return (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.menuName.localeCompare(b.menuName);
}

/** Build tree from API menus. Orphans (missing parent) become roots so add/remove stays dynamic. */
export function buildMenuPermissionTree(menus: IRoleMenuPermission[]): MenuPermissionTreeNode[] {
  const idSet = new Set(menus.map((m) => m.menuId));
  const childrenByParent = new Map<string | null, IRoleMenuPermission[]>();

  for (const menu of menus) {
    const parentKey =
      menu.parentMenuId && idSet.has(menu.parentMenuId) ? menu.parentMenuId : null;
    const bucket = childrenByParent.get(parentKey) ?? [];
    bucket.push(menu);
    childrenByParent.set(parentKey, bucket);
  }

  for (const bucket of childrenByParent.values()) {
    bucket.sort(sortMenus);
  }

  const buildNodes = (parentId: string | null, depth: number): MenuPermissionTreeNode[] =>
    (childrenByParent.get(parentId) ?? []).map((menu) => ({
      menu,
      depth,
      children: buildNodes(menu.menuId, depth + 1),
    }));

  return buildNodes(null, 0);
}

function nodeMatchesSearch(node: MenuPermissionTreeNode, q: string): boolean {
  if (node.menu.menuName.toLowerCase().includes(q) || node.menu.menuCode.toLowerCase().includes(q)) {
    return true;
  }
  return node.children.some((c) => nodeMatchesSearch(c, q));
}

function countGrantedInSubtree(node: MenuPermissionTreeNode): { granted: number; total: number } {
  let granted = rowHasAnyPermission(node.menu) ? 1 : 0;
  let total = 1;
  for (const child of node.children) {
    const sub = countGrantedInSubtree(child);
    granted += sub.granted;
    total += sub.total;
  }
  return { granted, total };
}

export function flattenVisibleMenuRows(
  nodes: MenuPermissionTreeNode[],
  expandedMenuIds: ReadonlySet<string>,
  searchQuery = '',
): MenuPermissionDisplayRow[] {
  const rows: MenuPermissionDisplayRow[] = [];
  const q = searchQuery.trim().toLowerCase();
  const searching = q.length > 0;

  const walk = (items: MenuPermissionTreeNode[]): void => {
    for (const node of items) {
      if (searching && !nodeMatchesSearch(node, q)) {
        continue;
      }
      const hasChildren = node.children.length > 0;
      const badge = hasChildren ? countGrantedInSubtree(node) : undefined;
      rows.push({
        menu: node.menu,
        depth: node.depth,
        hasChildren,
        grantedBadge: badge,
      });
      // While searching, auto-expand matching branches
      if (hasChildren && (searching || expandedMenuIds.has(node.menu.menuId))) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return rows;
}

export function collectSubtreeMenus(
  menus: IRoleMenuPermission[],
  menuId: string,
): IRoleMenuPermission[] {
  const byParent = new Map<string, IRoleMenuPermission[]>();
  for (const menu of menus) {
    if (!menu.parentMenuId) continue;
    const bucket = byParent.get(menu.parentMenuId) ?? [];
    bucket.push(menu);
    byParent.set(menu.parentMenuId, bucket);
  }

  const result: IRoleMenuPermission[] = [];
  const walk = (id: string): void => {
    for (const child of byParent.get(id) ?? []) {
      result.push(child);
      walk(child.menuId);
    }
  };
  walk(menuId);
  return result;
}

/** @deprecated Prefer collectSubtreeMenus — kept for existing call sites */
export function collectMenuDescendants(
  menus: IRoleMenuPermission[],
  menuId: string,
): IRoleMenuPermission[] {
  return collectSubtreeMenus(menus, menuId);
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

export function rowHasAnyPermission(menu: IRoleMenuPermission): boolean {
  return MENU_PERM_FIELDS.some((f) => menu[f]);
}

export function rowPermissionCount(menu: IRoleMenuPermission): number {
  return MENU_PERM_FIELDS.filter((f) => menu[f]).length;
}

export function findTreeNode(
  nodes: MenuPermissionTreeNode[],
  menuId: string,
): MenuPermissionTreeNode | null {
  for (const node of nodes) {
    if (node.menu.menuId === menuId) return node;
    const found = findTreeNode(node.children, menuId);
    if (found) return found;
  }
  return null;
}

function collectNodeMenus(node: MenuPermissionTreeNode): IRoleMenuPermission[] {
  return [node.menu, ...node.children.flatMap(collectNodeMenus)];
}

export function groupColState(node: MenuPermissionTreeNode, field: MenuPermField): GroupColState {
  const menus = collectNodeMenus(node);
  const checked = menus.filter((m) => m[field]).length;
  if (checked === 0) return 'none';
  if (checked === menus.length) return 'all';
  return 'some';
}

export function isSubtreeFullyGranted(node: MenuPermissionTreeNode): boolean {
  return collectNodeMenus(node).every((m) => rowPermissionCount(m) === MENU_PERM_FIELDS.length);
}

/** Apply a single permission change with View dependency rules (reference UX). */
export function applyPermChange(
  menu: IRoleMenuPermission,
  field: MenuPermField,
  value: boolean,
): void {
  menu[field] = value;
  if (value && field !== 'canView') {
    menu.canView = true;
  }
  if (field === 'canView' && !value) {
    for (const f of MENU_PERM_FIELDS) {
      menu[f] = false;
    }
  }
}

export function setSubtreePermission(
  node: MenuPermissionTreeNode,
  field: MenuPermField,
  value: boolean,
): void {
  for (const menu of collectNodeMenus(node)) {
    applyPermChange(menu, field, value);
  }
}

export function setSubtreeAllPermissions(node: MenuPermissionTreeNode, value: boolean): void {
  for (const menu of collectNodeMenus(node)) {
    for (const f of MENU_PERM_FIELDS) {
      menu[f] = value;
    }
  }
}

export function computeMenuPermissionSummary(
  menus: IRoleMenuPermission[],
): MenuPermissionSummary {
  let menusWithAnyPermission = 0;
  let menusWithView = 0;
  for (const m of menus) {
    if (rowHasAnyPermission(m)) menusWithAnyPermission++;
    if (m.canView) menusWithView++;
  }
  return {
    totalMenus: menus.length,
    menusWithAnyPermission,
    menusWithView,
  };
}
