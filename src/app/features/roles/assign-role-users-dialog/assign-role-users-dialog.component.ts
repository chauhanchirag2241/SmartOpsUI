import { Component, ViewChild, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ErpDialogShellComponent } from '../../../shared/components/erp-dialog-shell/erp-dialog-shell.component';
import {
  FEE_DIALOG_MAX_HEIGHT,
  ROLE_ASSIGN_USERS_DIALOG_WIDTH,
} from '../../../shared/constants/dialog.constants';
import { AssignRoleUsersFormComponent } from './assign-role-users-form.component';

export interface AssignRoleUsersDialogData {
  roleId: string;
  roleName?: string;
  /** Already mapped user IDs — excluded from picker. */
  excludeUserIds: string[];
}

@Component({
  selector: 'app-assign-role-users-dialog',
  standalone: true,
  imports: [ErpDialogShellComponent, AssignRoleUsersFormComponent],
  template: `
    <app-erp-dialog-shell
      title="Assign users"
      [subtitle]="subtitle"
      [width]="dialogWidth"
      [maxHeight]="dialogMaxHeight"
      [bodyScroll]="false"
      [showSave]="true"
      saveLabel="Save"
      savingLabel="Saving..."
      [saving]="saving"
      [saveDisabled]="stagedCount === 0"
      (cancel)="ref.close(null)"
      (save)="onSave()"
    >
      <app-assign-role-users-form
        #formComp
        [excludeUserIds]="data.excludeUserIds"
        (saved)="onFormSaved($event)"
        (busyChange)="saving = $event"
        (stagedCountChange)="stagedCount = $event"
      />
    </app-erp-dialog-shell>
  `,
})
export class AssignRoleUsersDialogComponent {
  readonly data = inject<AssignRoleUsersDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AssignRoleUsersDialogComponent, string[] | null>);
  readonly dialogWidth = ROLE_ASSIGN_USERS_DIALOG_WIDTH;
  readonly dialogMaxHeight = FEE_DIALOG_MAX_HEIGHT;

  @ViewChild('formComp') formComp!: AssignRoleUsersFormComponent;
  saving = false;
  stagedCount = 0;

  get subtitle(): string {
    const name = this.data.roleName?.trim();
    return name
      ? `Select user types, pick users for “${name}”, then save`
      : 'Select user types, pick users, then save';
  }

  onSave(): void {
    this.formComp?.save();
  }

  onFormSaved(userIds: string[]): void {
    this.ref.close(userIds);
  }
}
