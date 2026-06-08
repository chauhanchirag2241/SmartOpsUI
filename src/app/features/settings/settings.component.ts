import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs/operators';
import { MenuCodes } from '../../core/constants/menu-codes';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { SettingsService } from '../../core/services/settings.service';
import { TenantService } from '../../core/services/tenant.service';
import { UserTypeDto, UserTypeService } from '../../core/services/user-type.service';

const LEAVE_KEYS = {
  staffApprovalMode: 'leave.staff.approvalMode',
  staffApproverUserTypes: 'leave.staff.approverUserTypes',
  studentApprovalMode: 'leave.student.approvalMode',
  studentLongLeaveMinDays: 'leave.student.longLeaveMinDays',
  studentLongLeaveApproverUserTypes: 'leave.student.longLeaveApproverUserTypes',
  studentLongLeaveTransferToPrincipal: 'leave.student.longLeaveTransferToPrincipal',
} as const;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly userTypeService = inject(UserTypeService);
  private readonly tenant = inject(TenantService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  private selectedStaffTypes = new Set<string>();
  private selectedLongLeaveTypes = new Set<string>();

  form!: FormGroup;
  userTypes: UserTypeDto[] = [];
  loading = false;
  saving = false;

  get canEdit(): boolean {
    return this.permissionService.canEdit(MenuCodes.Settings);
  }

  get schoolReady(): boolean {
    return this.tenant.isReady;
  }

  get selectedSchoolName(): string {
    return this.tenant.school?.name ?? '';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      staffApprovalMode: ['AnyOne', Validators.required],
      studentApprovalMode: ['AnyOne', Validators.required],
      studentLongLeaveMinDays: [4, [Validators.required, Validators.min(1)]],
      studentLongLeaveTransferToPrincipal: [true],
    });

    if (!this.canEdit) {
      this.form.disable();
    }

    this.userTypeService.getUserTypes().subscribe({
      next: (types) => {
        this.userTypes = types;
        this.cdr.markForCheck();
      },
    });

    this.loadSettings();
  }

  isStaffTypeSelected(code: string): boolean {
    return this.selectedStaffTypes.has(code);
  }

  isLongLeaveTypeSelected(code: string): boolean {
    return this.selectedLongLeaveTypes.has(code);
  }

  toggleStaffType(code: string): void {
    if (!this.canEdit) return;
    if (this.selectedStaffTypes.has(code)) {
      this.selectedStaffTypes.delete(code);
    } else {
      this.selectedStaffTypes.add(code);
    }
    this.cdr.markForCheck();
  }

  toggleLongLeaveType(code: string): void {
    if (!this.canEdit) return;
    if (this.selectedLongLeaveTypes.has(code)) {
      this.selectedLongLeaveTypes.delete(code);
    } else {
      this.selectedLongLeaveTypes.add(code);
    }
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    const schoolId = this.tenant.school?.id;
    if (!schoolId || !this.canEdit || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.selectedStaffTypes.size === 0) {
      this.snackBar.open('Select at least one staff approver user type', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const raw = this.form.getRawValue();
    const settings = [
      { key: LEAVE_KEYS.staffApprovalMode, value: String(raw.staffApprovalMode) },
      {
        key: LEAVE_KEYS.staffApproverUserTypes,
        value: [...this.selectedStaffTypes].join(','),
      },
      { key: LEAVE_KEYS.studentApprovalMode, value: String(raw.studentApprovalMode) },
      { key: LEAVE_KEYS.studentLongLeaveMinDays, value: String(raw.studentLongLeaveMinDays) },
      {
        key: LEAVE_KEYS.studentLongLeaveApproverUserTypes,
        value: [...this.selectedLongLeaveTypes].join(','),
      },
      {
        key: LEAVE_KEYS.studentLongLeaveTransferToPrincipal,
        value: raw.studentLongLeaveTransferToPrincipal ? 'true' : 'false',
      },
      { key: 'leave.student.defaultApprover', value: 'CLASS_TEACHER' },
    ];

    this.saving = true;
    this.settingsService
      .saveLeaveSettings(schoolId, settings)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Leave settings saved', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
        },
        error: () => {
          this.snackBar.open('Failed to save settings', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private loadSettings(): void {
    const schoolId = this.tenant.school?.id;
    if (!schoolId) {
      this.resetFormDefaults();
      return;
    }

    this.loading = true;
    this.settingsService
      .getLeaveSettings(schoolId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (rows) => {
          const map = new Map(rows.map((r) => [r.key, r.value]));
          this.form.patchValue({
            staffApprovalMode: map.get(LEAVE_KEYS.staffApprovalMode) ?? 'AnyOne',
            studentApprovalMode: map.get(LEAVE_KEYS.studentApprovalMode) ?? 'AnyOne',
            studentLongLeaveMinDays: Number(map.get(LEAVE_KEYS.studentLongLeaveMinDays) ?? 4),
            studentLongLeaveTransferToPrincipal:
              (map.get(LEAVE_KEYS.studentLongLeaveTransferToPrincipal) ?? 'true') === 'true',
          });
          this.selectedStaffTypes = new Set(
            (map.get(LEAVE_KEYS.staffApproverUserTypes) ?? 'SCHOOL_ADMIN')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          );
          this.selectedLongLeaveTypes = new Set(
            (map.get(LEAVE_KEYS.studentLongLeaveApproverUserTypes) ?? 'PRINCIPAL')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          );
        },
        error: () => {
          this.resetFormDefaults();
          this.snackBar.open('Could not load settings', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private resetFormDefaults(): void {
    this.form.patchValue({
      staffApprovalMode: 'AnyOne',
      studentApprovalMode: 'AnyOne',
      studentLongLeaveMinDays: 4,
      studentLongLeaveTransferToPrincipal: true,
    });
    this.selectedStaffTypes = new Set(['SCHOOL_ADMIN']);
    this.selectedLongLeaveTypes = new Set(['PRINCIPAL']);
  }
}
