import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../../core/services/notification.service';
import { forkJoin, switchMap } from 'rxjs';
import { MenuCodes } from '../../../core/constants/menu-codes';
import {
  IRoleDashboardWidgetPermission,
  IRoleMenuPermission,
} from '../../../core/models/permission.model';
import { PermissionService } from '../../../core/services/permission.service';
import { TenantService } from '../../../core/services/tenant.service';
import { RoleDto, RoleService } from '../../../core/services/role.service';
import { SchoolUserDto, UserService } from '../../../core/services/user.service';
import { applyModuleTablePermissions } from '../../../core/utils/permission-ui.util';
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../shared/components/smart-data-table';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  GroupColState,
  MenuPermField,
  MenuPermissionDisplayRow,
  MenuPermissionSummary,
  MenuPermissionTreeNode,
  applyPermChange,
  buildMenuPermissionTree,
  collectExpandableMenuIds,
  computeMenuPermissionSummary,
  findTreeNode,
  flattenVisibleMenuRows,
  groupColState,
  isSubtreeFullyGranted,
  rowPermissionCount,
  setSubtreeAllPermissions,
  setSubtreePermission,
} from '../menu-permission-tree.util';
import { getUserFacingApiError } from '../../../shared/utils/api-error.util';
import {
  AssignRoleUsersDialogComponent,
  AssignRoleUsersDialogData,
} from '../assign-role-users-dialog/assign-role-users-dialog.component';

@Component({
  selector: 'app-add-role',
  standalone: true,
  host: { class: 'add-role-page form-page-shell role-page' },
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    MatDialogModule,
    DynamicFieldComponent,
    ActionButtonComponent,
    PageChromeDirective,
    SmartDataTableComponent,
  ],
  templateUrl: './add-role.component.html',
  styleUrl: './add-role.component.css',
})
export class AddRoleComponent implements OnInit {
  @Input() mode: 'add' | 'edit' | 'view' = 'add';
  @Input() roleId?: string;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly userService = inject(UserService);
  private readonly tenant = inject(TenantService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  activeTab: 'details' | 'permissions' | 'widgets' | 'users' = 'details';
  loading = true;
  saving = false;
  errorMessage = '';
  mappedUsers: Record<string, unknown>[] = [];
  loadingUsers = false;
  roleUsersTableConfig!: DataTableConfig;
  menuPermissions: IRoleMenuPermission[] = [];
  menuPermissionTree: MenuPermissionTreeNode[] = [];
  menuPermissionRows: MenuPermissionDisplayRow[] = [];
  expandedMenuIds = new Set<string>();
  menuSearchQuery = '';
  menuPermissionSummary: MenuPermissionSummary = {
    totalMenus: 0,
    menusWithAnyPermission: 0,
    menusWithView: 0,
  };
  dashboardWidgetPermissions: IRoleDashboardWidgetPermission[] = [];

  private readonly baseRoleUsersTableConfig: DataTableConfig = {
    header: {
      title: 'Mapped users',
      subtitle: 'Users assigned to this role',
      showAddButton: true,
      addButtonText: 'Add users',
      addButtonIcon: 'person_add',
      syncPageChrome: false,
    },
    columns: [
      { key: 'username', label: 'Username', sortable: true },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'userTypeName', label: 'User type', sortable: true },
    ],
    actionsLayout: 'inline',
    actions: [{ label: 'Remove', icon: 'delete', danger: true }],
    searchPlaceholder: 'Search users…',
    searchKeys: ['username', 'email', 'userTypeName'],
    itemLabel: 'users',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    selectable: false,
    showExport: false,
    showColumnToggle: false,
    filtersInPanel: false,
  };

  readonly configs: Record<string, FormFieldConfig> = {
    name: {
      type: 'input',
      controlName: 'name',
      label: 'Role name',
      placeholder: 'e.g. Class Teacher',
      maxLength: 100,
      validations: [
        { name: 'required', validator: Validators.required, message: 'Role name is required' },
      ],
    },
    description: {
      type: 'textarea',
      controlName: 'description',
      label: 'Description',
      placeholder: 'What this role can do…',
      maxLength: 256,
    },
    isActive: {
      type: 'checkbox',
      controlName: 'isActive',
      label: 'Active role',
    },
  };

  get pageTitle(): string {
    if (this.mode === 'add') {
      return 'Add role';
    }
    if (this.mode === 'edit') {
      return 'Edit role';
    }
    return 'Role details';
  }

  get canEdit(): boolean {
    return this.mode !== 'view' && this.permissionService.canEdit(MenuCodes.Roles);
  }

  get schoolReady(): boolean {
    return this.tenant.isReady;
  }

  get selectedSchoolName(): string {
    return this.tenant.school?.name ?? '';
  }

  get isEditMode(): boolean {
    return this.mode === 'edit' && !!this.roleId;
  }

  get enabledPermissionCount(): number {
    return this.menuPermissions.reduce(
      (sum, m) =>
        sum +
        Number(m.canView) +
        Number(m.canAdd) +
        Number(m.canEdit) +
        Number(m.canDelete) +
        Number(m.canExport),
      0,
    );
  }

  get enabledWidgetCount(): number {
    return this.dashboardWidgetPermissions.filter((w) => w.canView).length;
  }

  get widgetCategories(): string[] {
    return [...new Set(this.dashboardWidgetPermissions.map((w) => w.category))];
  }

  ngOnInit(): void {
    this.rebuildRoleUsersTableConfig();
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(256)],
      isActive: [true],
    });

    forkJoin({
      menus: this.roleService.getMenuTemplates(),
      widgets: this.roleService.getDashboardWidgetTemplates(),
    }).subscribe({
      next: ({ menus, widgets }) => {
        this.menuPermissions = menus.map((m) => ({ ...m }));
        this.rebuildMenuPermissionTree();
        this.dashboardWidgetPermissions = widgets.map((w) => ({ ...w }));
        if (this.roleId && this.mode !== 'add') {
          this.loadRole(this.roleId);
        } else {
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.errorMessage = 'Failed to load permissions.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });

  }

  setTab(tab: 'details' | 'permissions' | 'widgets' | 'users'): void {
    this.activeTab = tab;
    if (tab === 'users' && this.roleId && this.schoolReady) {
      this.loadRoleUsers();
    }
  }

  setMenuPermission(menu: IRoleMenuPermission, field: MenuPermField, checked: boolean): void {
    if (!this.canEdit) {
      return;
    }
    const node = findTreeNode(this.menuPermissionTree, menu.menuId);
    if (node?.children.length) {
      setSubtreePermission(node, field, checked);
    } else {
      applyPermChange(menu, field, checked);
    }
    this.refreshMenuPermissionUi();
  }

  onGroupColToggle(menuId: string, field: MenuPermField, checked: boolean): void {
    if (!this.canEdit) return;
    const node = findTreeNode(this.menuPermissionTree, menuId);
    if (!node) return;
    setSubtreePermission(node, field, checked);
    this.refreshMenuPermissionUi();
  }

  rowGrantAll(menuId: string): void {
    if (!this.canEdit) return;
    const node = findTreeNode(this.menuPermissionTree, menuId);
    if (!node) return;
    if (node.children.length > 0) {
      setSubtreeAllPermissions(node, !isSubtreeFullyGranted(node));
    } else {
      const grant = rowPermissionCount(node.menu) !== 5;
      setSubtreeAllPermissions(node, grant);
    }
    this.refreshMenuPermissionUi();
  }

  isRowFullyGranted(row: MenuPermissionDisplayRow): boolean {
    if (row.hasChildren) {
      const node = findTreeNode(this.menuPermissionTree, row.menu.menuId);
      return !!node && isSubtreeFullyGranted(node);
    }
    return rowPermissionCount(row.menu) === 5;
  }

  groupCheckboxState(menuId: string, field: MenuPermField): GroupColState | 'leaf' {
    const node = findTreeNode(this.menuPermissionTree, menuId);
    if (!node || node.children.length === 0) return 'leaf';
    return groupColState(node, field);
  }

  onMenuSearch(query: string): void {
    this.menuSearchQuery = query;
    this.rebuildMenuPermissionRows();
  }

  toggleMenuExpand(menuId: string): void {
    if (this.expandedMenuIds.has(menuId)) {
      this.expandedMenuIds.delete(menuId);
    } else {
      this.expandedMenuIds.add(menuId);
    }
    this.rebuildMenuPermissionRows();
  }

  isMenuExpanded(menuId: string): boolean {
    return this.expandedMenuIds.has(menuId);
  }

  expandAllMenuGroups(): void {
    collectExpandableMenuIds(this.menuPermissionTree).forEach((id) =>
      this.expandedMenuIds.add(id),
    );
    this.rebuildMenuPermissionRows();
  }

  collapseAllMenuGroups(): void {
    this.expandedMenuIds.clear();
    this.rebuildMenuPermissionRows();
  }

  selectAllPermissions(checked: boolean): void {
    if (!this.canEdit) return;
    this.menuPermissions.forEach((m) => {
      m.canView = checked;
      m.canAdd = checked;
      m.canEdit = checked;
      m.canDelete = checked;
      m.canExport = checked;
    });
    this.refreshMenuPermissionUi();
  }

  setWidgetPermission(widget: IRoleDashboardWidgetPermission, checked: boolean): void {
    if (!this.canEdit) return;
    widget.canView = checked;
  }

  selectAllWidgets(checked: boolean): void {
    if (!this.canEdit) return;
    this.dashboardWidgetPermissions.forEach((w) => (w.canView = checked));
  }

  widgetsForCategory(category: string): IRoleDashboardWidgetPermission[] {
    return this.dashboardWidgetPermissions.filter((w) => w.category === category);
  }

  menuHasView(menuCode: string): boolean {
    return this.menuPermissions.some(
      (m) => m.menuCode === menuCode && m.canView,
    );
  }

  openAssignUsersDialog(): void {
    if (!this.canEdit || !this.roleId) return;
    const data: AssignRoleUsersDialogData = {
      roleId: this.roleId,
      roleName: String(this.form.get('name')?.value ?? ''),
      excludeUserIds: this.mappedUsers.map((u) => String(u['id'])),
    };
    this.dialog
      .open(AssignRoleUsersDialogComponent, {
        data,
        panelClass: ['erp-dialog'],
        disableClose: true,
      })
      .afterClosed()
      .subscribe((addedIds: string[] | null) => {
        if (!addedIds?.length || !this.roleId) return;
        const nextIds = [
          ...new Set([...this.mappedUsers.map((u) => String(u['id'])), ...addedIds]),
        ];
        this.persistMappedUsers(nextIds, 'Users assigned');
      });
  }

  onMappedUsersAction(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    if (event.action.label !== 'Remove' || !this.canEdit) return;
    const userId = String(event.row['id'] ?? '');
    const name = String(event.row['username'] ?? 'this user');
    if (!userId) return;

    this.dialog
      .open(DeleteConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Unmap user',
          description: `Remove "${name}" from this role?`,
          confirmButtonText: 'Yes, remove',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok || !this.roleId) return;
        const nextIds = this.mappedUsers
          .map((u) => String(u['id']))
          .filter((id) => id !== userId);
        this.persistMappedUsers(nextIds, 'User unmapped');
      });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onSubmit(): void {
    if (!this.canEdit || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description, isActive } = this.form.getRawValue();
    this.saving = true;
    this.errorMessage = '';

    if (this.mode === 'add') {
      this.roleService
        .createRole({
          name: String(name).trim(),
          description: String(description || '').trim() || undefined,
          menuPermissions: this.menuPermissions,
          dashboardWidgetPermissions: this.dashboardWidgetPermissions,
        })
        .subscribe({
          next: () => {
            this.saving = false;
            this.snackBar.open('Role created', 'Close', { duration: 3000, panelClass: 'snack-success' });
            this.saved.emit();
          },
          error: (err) => {
            this.saving = false;
            this.errorMessage = getUserFacingApiError(err, 'Failed to create role.');
            this.cdr.markForCheck();
          },
        });
      return;
    }

    if (!this.roleId) return;

    this.roleService
      .updateRole(this.roleId, {
        name: String(name).trim(),
        description: String(description || '').trim() || undefined,
        isActive: !!isActive,
      })
      .pipe(
        switchMap(() =>
          this.roleService.updateRolePermissions(this.roleId!, this.menuPermissions),
        ),
        switchMap(() =>
          this.roleService.updateRoleDashboardWidgets(
            this.roleId!,
            this.dashboardWidgetPermissions,
          ),
        ),
      )
      .subscribe({
        next: () => this.finishSave(),
        error: (err) => {
          this.saving = false;
          this.errorMessage = getUserFacingApiError(err, 'Failed to update role.');
          this.cdr.markForCheck();
        },
      });
  }

  trackMenu(index: number, menu: IRoleMenuPermission): string {
    return menu.menuId || `${menu.menuCode}-${index}`;
  }

  depthPads(depth: number): number[] {
    return depth > 0 ? Array.from({ length: depth }, (_, i) => i) : [];
  }

  readonly permFields: MenuPermField[] = [
    'canView',
    'canAdd',
    'canEdit',
    'canDelete',
    'canExport',
  ];

  private loadRole(id: string): void {
    this.roleService.getRole(id).subscribe({
      next: (role) => {
        this.form.patchValue({
          name: role.name,
          description: role.description ?? '',
          isActive: true,
        });
        this.applyRolePermissions(role);
        if (!this.canEdit) {
          this.form.disable();
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Failed to load role.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadRoleUsers(): void {
    if (!this.roleId) return;
    this.loadingUsers = true;
    forkJoin({
      allUsers: this.userService.getUsers(),
      roleUsers: this.roleService.getUsersInRole(this.roleId),
    }).subscribe({
      next: ({ allUsers, roleUsers }) => {
        const byId = new Map((allUsers ?? []).map((u) => [u.id, u]));
        this.mappedUsers = (roleUsers ?? []).map((ru) => {
          const full: SchoolUserDto | undefined = byId.get(ru.id);
          return {
            id: ru.id,
            username: ru.username || full?.username || '—',
            email: ru.email || full?.email || '—',
            userTypeName: full?.userTypeName || full?.userTypeCode || '—',
          };
        });
        this.loadingUsers = false;
        this.rebuildRoleUsersTableConfig();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingUsers = false;
        this.errorMessage = 'Failed to load users for role.';
        this.cdr.markForCheck();
      },
    });
  }

  private persistMappedUsers(userIds: string[], successMessage: string): void {
    if (!this.roleId) return;
    this.saving = true;
    this.roleService.assignUsersToRole(this.roleId, userIds).subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(successMessage, 'Close', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.loadRoleUsers();
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = getUserFacingApiError(err, 'Failed to update user assignments.');
        this.cdr.markForCheck();
      },
    });
  }

  private rebuildRoleUsersTableConfig(): void {
    const config: DataTableConfig = {
      ...this.baseRoleUsersTableConfig,
      header: {
        ...this.baseRoleUsersTableConfig.header!,
        showAddButton: this.canEdit,
        subtitle: `${this.mappedUsers.length} user${this.mappedUsers.length === 1 ? '' : 's'} mapped`,
      },
      actions: this.canEdit
        ? [{ label: 'Remove', icon: 'delete', danger: true }]
        : [],
    };
    this.roleUsersTableConfig = applyModuleTablePermissions(
      config,
      this.permissionService,
      MenuCodes.Roles,
    );
  }

  private applyRolePermissions(role: RoleDto): void {
    const source = role.menuPermissions ?? [];
    const byMenuId = new Map(source.map((p) => [p.menuId, p]));
    const byCode = new Map(source.map((p) => [p.menuCode, p]));
    this.menuPermissions = this.menuPermissions.map((template) => {
      const existing = byMenuId.get(template.menuId) ?? byCode.get(template.menuCode);
      if (!existing) {
        return { ...template };
      }
      return {
        ...template,
        menuId: existing.menuId || template.menuId,
        canView: !!existing.canView,
        canAdd: !!existing.canAdd,
        canEdit: !!existing.canEdit,
        canDelete: !!existing.canDelete,
        canExport: !!existing.canExport,
      };
    });

    const widgetSource = role.dashboardWidgetPermissions ?? [];
    const widgetsByCode = new Map(widgetSource.map((p) => [p.widgetCode, p]));
    this.dashboardWidgetPermissions = this.dashboardWidgetPermissions.map((template) => {
      const existing = widgetsByCode.get(template.widgetCode);
      if (!existing) {
        return { ...template };
      }
      return {
        ...template,
        widgetId: existing.widgetId || template.widgetId,
        canView: !!existing.canView,
      };
    });
    this.rebuildMenuPermissionTree();
  }

  private rebuildMenuPermissionTree(): void {
    this.menuPermissionTree = buildMenuPermissionTree(this.menuPermissions);
    // Default collapsed — user can Expand all when needed.
    this.refreshMenuPermissionUi();
  }

  private rebuildMenuPermissionRows(): void {
    this.menuPermissionRows = flattenVisibleMenuRows(
      this.menuPermissionTree,
      this.expandedMenuIds,
      this.menuSearchQuery,
    );
    this.cdr.markForCheck();
  }

  private refreshMenuPermissionUi(): void {
    this.menuPermissionSummary = computeMenuPermissionSummary(this.menuPermissions);
    this.rebuildMenuPermissionRows();
  }

  private finishSave(): void {
    this.saving = false;
    this.snackBar.open('Role saved', 'Close', { duration: 3000, panelClass: 'snack-success' });
    this.saved.emit();
  }
}
