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
import { ActionButtonComponent } from '../../../shared/components/action-button/action-button.component';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
interface RoleUserRow {
  id: string;
  username: string;
  email: string;
  assigned: boolean;
}

@Component({
  selector: 'app-add-role',
  standalone: true,
  host: { class: 'add-role-page form-page-shell role-page' },
  imports: [ReactiveFormsModule, MatIconModule, DynamicFieldComponent, ActionButtonComponent],
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
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  activeTab: 'details' | 'permissions' | 'widgets' | 'users' = 'details';
  loading = true;
  saving = false;
  errorMessage = '';
  roleUserRows: RoleUserRow[] = [];
  loadingUsers = false;
  menuPermissions: IRoleMenuPermission[] = [];
  dashboardWidgetPermissions: IRoleDashboardWidgetPermission[] = [];

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
    code: {
      type: 'input',
      controlName: 'code',
      label: 'Role code',
      placeholder: 'e.g. CLASS_TEACHER',
      maxLength: 50,
      validations: [
        { name: 'required', validator: Validators.required, message: 'Role code is required' },
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

  get assignedUserCount(): number {
    return this.roleUserRows.filter((r) => r.assigned).length;
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
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      code: ['', [Validators.required, Validators.maxLength(50)]],
      description: ['', Validators.maxLength(256)],
      isActive: [true],
    });

    forkJoin({
      menus: this.roleService.getMenuTemplates(),
      widgets: this.roleService.getDashboardWidgetTemplates(),
    }).subscribe({
      next: ({ menus, widgets }) => {
        this.menuPermissions = menus.map((m) => ({ ...m }));
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

  setMenuPermission(
    menu: IRoleMenuPermission,
    field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete' | 'canExport',
    checked: boolean,
  ): void {
    if (!this.canEdit) {
      return;
    }
    menu[field] = checked;
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

  toggleRoleUser(row: RoleUserRow): void {
    if (!this.canEdit) return;
    row.assigned = !row.assigned;
    this.cdr.markForCheck();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onSubmit(): void {
    if (!this.canEdit || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, code, description, isActive } = this.form.getRawValue();
    this.saving = true;
    this.errorMessage = '';

    if (this.mode === 'add') {
      this.roleService
        .createRole({
          name: String(name).trim(),
          code: String(code).trim().toUpperCase(),
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
            this.errorMessage = String(err?.error ?? 'Failed to create role.');
            this.cdr.markForCheck();
          },
        });
      return;
    }

    if (!this.roleId) return;

    this.roleService
      .updateRole(this.roleId, {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
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
        next: () => {
          if (this.activeTab === 'users' && this.schoolReady) {
            this.saveRoleUsersAndFinish();
          } else {
            this.finishSave();
          }
        },
        error: () => {
          this.saving = false;
          this.errorMessage = 'Failed to update role.';
          this.cdr.markForCheck();
        },
      });
  }

  saveRoleUsers(): void {
    if (!this.roleId || !this.schoolReady || !this.canEdit) return;
    this.saving = true;
    this.saveRoleUsersAndFinish();
  }

  trackMenu(index: number, menu: IRoleMenuPermission): string {
    return `${menu.menuCode}-${index}`;
  }

  private loadRole(id: string): void {
    this.roleService.getRole(id).subscribe({
      next: (role) => {
        this.form.patchValue({
          name: role.name,
          code: role.code,
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
        const assignedIds = new Set(roleUsers.map((u) => u.id));
        this.roleUserRows = allUsers.map((u) => this.toRoleUserRow(u, assignedIds.has(u.id)));
        this.loadingUsers = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingUsers = false;
        this.errorMessage = 'Failed to load users for role.';
        this.cdr.markForCheck();
      },
    });
  }

  private toRoleUserRow(user: SchoolUserDto, assigned: boolean): RoleUserRow {
    return { id: user.id, username: user.username, email: user.email, assigned };
  }

  private applyRolePermissions(role: RoleDto): void {
    const source = role.menuPermissions ?? [];
    const byCode = new Map(source.map((p) => [p.menuCode, p]));
    this.menuPermissions = this.menuPermissions.map((template) => {
      const existing = byCode.get(template.menuCode);
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
  }

  private saveRoleUsersAndFinish(): void {
    if (!this.roleId) {
      this.finishSave();
      return;
    }
    const userIds = this.roleUserRows.filter((r) => r.assigned).map((r) => r.id);
    this.roleService.assignUsersToRole(this.roleId, userIds).subscribe({
      next: () => this.finishSave(),
      error: () => {
        this.saving = false;
        this.errorMessage = 'Role saved but user assignment failed.';
        this.cdr.markForCheck();
      },
    });
  }

  private finishSave(): void {
    this.saving = false;
    this.snackBar.open('Role saved', 'Close', { duration: 3000, panelClass: 'snack-success' });
    this.saved.emit();
  }

  private readApiError(err: unknown, fallback: string): string {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (Array.isArray(body) && body.length > 0) {
      return String(body[0]);
    }
    return fallback;
  }
}
