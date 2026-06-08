import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../core/services/notification.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { PermissionService } from '../../core/services/permission.service';
import { TenantService } from '../../core/services/tenant.service';
import { UserService } from '../../core/services/user.service';
import { SmartDataTableComponent } from '../../shared/components/smart-data-table';
import { AddUserComponent } from './add-user/add-user.component';
import type { DataTableAction, DataTableConfig } from '../../shared/components/smart-data-table';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [SmartDataTableComponent, MatIconModule, MatSnackBarModule, AddUserComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly tenant = inject(TenantService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  showAddForm = false;
  formMode: 'add' | 'edit' | 'view' = 'add';
  selectedUserId?: string;
  users: Record<string, unknown>[] = [];

  tableConfig: DataTableConfig = {
    header: {
      title: 'Users',
      subtitle: 'Manage school portal users and roles',
      showAddButton: true,
      addButtonText: 'Add user',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
    },
    columns: [
      {
        key: 'user',
        label: 'User',
        sortable: true,
        cellType: 'avatar',
        toggleable: false,
        avatarConfig: { nameKey: 'username', subtitleKey: 'email' },
      },
      {
        key: 'userTypeName',
        label: 'User type',
        sortable: true,
      },
      {
        key: 'rolesDisplay',
        label: 'Roles',
        sortable: false,
      },
      {
        key: 'isActive',
        label: 'Status',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-green', label: 'Active' },
          false: { cssClass: 'b-red', label: 'Inactive' },
        },
      },
    ],
    actions: [
      { label: 'View', icon: 'visibility', iconColor: '#639922' },
      { label: 'Edit', icon: 'edit', iconColor: '#1E40AF' },
    ],
    searchPlaceholder: 'Search by username or email...',
    searchKeys: ['username', 'email'],
    itemLabel: 'users',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  };

  ngOnInit(): void {
    if (!this.permissionService.canAdd(MenuCodes.Users)) {
      this.tableConfig = {
        ...this.tableConfig,
        header: {
          title: 'Users',
          subtitle: 'Manage school portal users and roles',
          showAddButton: false,
        },
      };
    }

    this.loadUsers();
  }

  get schoolReady(): boolean {
    return this.tenant.isReady;
  }

  loadUsers(): void {
    if (!this.schoolReady) {
      this.users = [];
      this.cdr.detectChanges();
      return;
    }

    this.userService.getUsers().subscribe({
      next: (items) => {
        this.users = items.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          isActive: u.isActive,
          user: u.username,
          userTypeName: u.userTypeName ?? '—',
          rolesDisplay: (u.roles ?? []).join(', ') || '—',
          roles: u.roles,
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load users', 'Close', { duration: 3000, panelClass: 'snack-error' });
      },
    });
  }

  openAddForm(): void {
    this.formMode = 'add';
    this.selectedUserId = undefined;
    this.showAddForm = true;
  }

  closeAddForm(): void {
    this.showAddForm = false;
  }

  onUserSaved(): void {
    this.showAddForm = false;
    this.loadUsers();
  }

  onAddButtonClicked(): void {
    this.openAddForm();
  }

  onActionClicked(event: { action: DataTableAction; row: Record<string, unknown> }): void {
    const id = event.row['id'] as string;
    if (event.action.label === 'View') {
      this.formMode = 'view';
      this.selectedUserId = id;
      this.showAddForm = true;
    } else if (event.action.label === 'Edit') {
      this.formMode = 'edit';
      this.selectedUserId = id;
      this.showAddForm = true;
    }
  }
}
