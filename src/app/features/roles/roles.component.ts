import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { RoleDto, RoleService } from '../../core/services/role.service';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { AddRoleComponent } from './add-role/add-role.component';
import type { DataTableAction, DataTableConfig } from '../../shared/components/smart-data-table';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [SmartDataTableComponent, MatIconModule, MatSnackBarModule, AddRoleComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css',
})
export class RolesComponent implements OnInit {
  private readonly roleService = inject(RoleService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedRoleId?: string;
  roles: Record<string, unknown>[] = [];

  tableConfig: DataTableConfig = {
    header: {
      title: 'Roles',
      subtitle: 'Manage roles and permissions for school users',
      showAddButton: true,
      addButtonText: 'Add role',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'role',
        label: 'Role',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: { nameKey: 'name', subtitleKey: 'description' },
      },
      {
        key: 'permissionCount',
        label: 'Permissions',
        sortable: true,
      },
      {
        key: 'permissionsPreview',
        label: 'Access',
        sortable: false,
      },
    ],
    actions: [
      { label: 'View', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
    ],
    searchPlaceholder: 'Search by role name...',
    searchKeys: ['name', 'description', 'permissionsPreview'],
    itemLabel: 'roles',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  };

  ngOnInit(): void {
    if (!this.permissionService.canEdit(MenuCodes.Roles)) {
      this.tableConfig = {
        ...this.tableConfig,
        header: {
          title: 'Roles',
          subtitle: 'Manage roles and permissions for school users',
          showAddButton: false,
        },
      };
    }
    this.loadRoles();
  }

  loadRoles(): void {
    this.roleService.getRoles().subscribe({
      next: (items) => {
        this.roles = items.map((r) => this.toRow(r));
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load roles', 'Close', { duration: 3000, panelClass: 'snack-error' });
      },
    });
  }

  onAddButtonClicked(): void {
    if (!this.permissionService.canEdit(MenuCodes.Roles)) return;
    this.formMode = 'add';
    this.selectedRoleId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onRoleSaved(): void {
    this.showAddForm = false;
    this.loadRoles();
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = event.row['id'] as string;
    if (event.action.label === 'View') {
      this.formMode = 'view';
      this.selectedRoleId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit') {
      if (!this.permissionService.canEdit(MenuCodes.Roles)) return;
      this.formMode = 'edit';
      this.selectedRoleId = id;
      this.showAddForm = true;
    }
  }

  private toRow(role: RoleDto): Record<string, unknown> {
    const enabledMenus = (role.menuPermissions ?? []).filter(
      (p) => p.canView || p.canAdd || p.canEdit || p.canDelete || p.canExport,
    );
    const preview = enabledMenus.map((p) => p.menuCode);
    return {
      id: role.id,
      name: role.name,
      description: role.description || '—',
      role: role.name,
      permissionCount: enabledMenus.length,
      permissionsPreview:
        preview.slice(0, 4).join(', ') + (preview.length > 4 ? '…' : ''),
    };
  }
}
