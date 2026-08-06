import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MenuCodes } from '../../core/constants/menu-codes';
import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { AcademicYearDropdownItem } from '../../core/services/academic-year.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { SettingsService } from '../../core/services/settings.service';
import { TenantService } from '../../core/services/tenant.service';
import { UserTypeDto, UserTypeService } from '../../core/services/user-type.service';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { ToggleSwitchComponent } from '../../shared/components/toggle-switch';
import { PageChromeDirective } from '../../shared/directives/page-chrome.directive';
import { DynamicFieldComponent } from '../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../shared/interfaces/form-field-config';

const LEAVE_KEYS = {
  staffEnabled: 'leave.staff.enabled',
  staffApprovalMode: 'leave.staff.approvalMode',
  staffApproverUserTypes: 'leave.staff.approverUserTypes',
  studentEnabled: 'leave.student.enabled',
  studentApprovalMode: 'leave.student.approvalMode',
  studentLongLeaveMinDays: 'leave.student.longLeaveMinDays',
  studentLongLeaveApproverUserTypes: 'leave.student.longLeaveApproverUserTypes',
  studentLongLeaveTransferToPrincipal: 'leave.student.longLeaveTransferToPrincipal',
} as const;

const ATTENDANCE_KEYS = {
  enabled: 'attendance.employee.enabled',
  defaultWorkingHours: 'attendance.employee.defaultWorkingHours',
} as const;

type SettingsSectionId = 'year' | 'staffleave' | 'studentleave' | 'attendance';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    PageChromeDirective,
    DynamicFieldComponent,
    ToggleSwitchComponent,
    ActionButtonComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly userTypeService = inject(UserTypeService);
  private readonly tenant = inject(TenantService);
  private readonly permissionService = inject(PermissionService);
  readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  private selectedStaffTypes = new Set<string>();
  private selectedLongLeaveTypes = new Set<string>();
  private formSub?: Subscription;
  private snapshotJson = '';

  form!: FormGroup;
  fieldConfigs: Record<string, FormFieldConfig> = {};
  userTypes: UserTypeDto[] = [];
  loading = false;
  saving = false;
  selectedYearId: string | null = null;
  yearsLoading = false;
  dirty = false;
  activeSection: SettingsSectionId = 'year';

  readonly sections: { id: SettingsSectionId; label: string; icon: string; toggleKey?: string }[] = [
    { id: 'year', label: 'Academic year', icon: 'calendar_month', toggleKey: 'academicYearEditable' },
    { id: 'staffleave', label: 'Staff leave approval', icon: 'groups', toggleKey: 'staffLeaveEnabled' },
    { id: 'studentleave', label: 'Student leave approval', icon: 'school', toggleKey: 'studentLeaveEnabled' },
    { id: 'attendance', label: 'Staff attendance', icon: 'schedule', toggleKey: 'attendanceEnabled' },
  ];

  get canEdit(): boolean {
    return this.permissionService.canEdit(MenuCodes.Settings);
  }

  get schoolReady(): boolean {
    return this.tenant.isReady;
  }

  get selectedSchoolName(): string {
    return this.tenant.school?.name ?? '';
  }

  get settingsChromeSubtitle(): string {
    return this.selectedSchoolName
      ? `School configuration for ${this.selectedSchoolName}`
      : 'Loading school configuration…';
  }

  get canSwitchYear(): boolean {
    return this.ayContext.canSwitchYear();
  }

  get academicYears(): AcademicYearDropdownItem[] {
    return this.ayContext.dropdownYears();
  }

  get staffLeaveEnabled(): boolean {
    return !!this.form?.get('staffLeaveEnabled')?.value;
  }

  get studentLeaveEnabled(): boolean {
    return !!this.form?.get('studentLeaveEnabled')?.value;
  }

  get attendanceEnabled(): boolean {
    return !!this.form?.get('attendanceEnabled')?.value;
  }

  get academicYearEditable(): boolean {
    return !!this.form?.get('academicYearEditable')?.value;
  }

  get longLeaveTransferOn(): boolean {
    return !!this.form?.get('studentLongLeaveTransferToPrincipal')?.value;
  }

  get saveStatusText(): string {
    if (this.saving) return 'Saving…';
    if (this.dirty) return 'Unsaved changes';
    return 'All changes saved';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      academicYearEditable: [false],
      academicYearId: [{ value: '', disabled: true }],
      staffLeaveEnabled: [true],
      staffApprovalMode: ['AnyOne', Validators.required],
      studentLeaveEnabled: [true],
      studentApprovalMode: ['AnyOne', Validators.required],
      studentLongLeaveMinDays: [4, [Validators.required, Validators.min(1)]],
      studentLongLeaveTransferToPrincipal: [true],
      attendanceEnabled: [true],
      defaultWorkingHours: [8, [Validators.required, Validators.min(1), Validators.max(24)]],
    });

    this.fieldConfigs = {
      academicYearId: {
        type: 'select',
        label: 'Active year',
        controlName: 'academicYearId',
        options: [],
      },
      staffApprovalMode: {
        type: 'select',
        label: 'Approval mode',
        controlName: 'staffApprovalMode',
        options: [
          { label: 'Any one approver', value: 'AnyOne' },
          { label: 'All approvers must agree', value: 'AllMust' },
        ],
      },
      studentApprovalMode: {
        type: 'select',
        label: 'Approval mode',
        controlName: 'studentApprovalMode',
        options: [
          { label: 'Any one approver', value: 'AnyOne' },
          { label: 'All approvers must agree', value: 'AllMust' },
        ],
      },
      studentLongLeaveMinDays: {
        type: 'number',
        label: 'Long leave threshold',
        controlName: 'studentLongLeaveMinDays',
        inputType: 'number',
      },
      defaultWorkingHours: {
        type: 'number',
        label: 'Default working hours',
        controlName: 'defaultWorkingHours',
        inputType: 'number',
      },
    };

    if (!this.canEdit) {
      this.form.disable();
    }

    this.formSub = new Subscription();
    this.formSub.add(this.form.valueChanges.subscribe(() => this.refreshDirty()));
    this.formSub.add(
      this.form.get('academicYearEditable')!.valueChanges.subscribe((editable) => {
        this.syncAcademicYearControlState(!!editable);
      }),
    );
    this.formSub.add(
      this.form.get('academicYearId')!.valueChanges.subscribe((yearId) => {
        if (!this.academicYearEditable || !yearId) return;
        this.onAcademicYearChange(String(yearId));
      }),
    );

    this.userTypeService.getUserTypes().subscribe({
      next: (types) => {
        this.userTypes = types;
        this.cdr.markForCheck();
      },
    });

    this.loadSettings();
    this.loadAcademicYears();
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  isSectionOn(section: (typeof this.sections)[number]): boolean {
    if (!section.toggleKey) return true;
    return !!this.form.get(section.toggleKey)?.value;
  }

  scrollToSection(id: SettingsSectionId, event?: Event): void {
    event?.preventDefault();
    this.activeSection = id;
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  isStaffTypeSelected(code: string): boolean {
    return this.selectedStaffTypes.has(code);
  }

  isLongLeaveTypeSelected(code: string): boolean {
    return this.selectedLongLeaveTypes.has(code);
  }

  toggleStaffType(code: string): void {
    if (!this.canEdit || !this.staffLeaveEnabled) return;
    if (this.selectedStaffTypes.has(code)) {
      this.selectedStaffTypes.delete(code);
    } else {
      this.selectedStaffTypes.add(code);
    }
    this.refreshDirty();
    this.cdr.markForCheck();
  }

  toggleLongLeaveType(code: string): void {
    if (!this.canEdit || !this.studentLeaveEnabled) return;
    if (this.selectedLongLeaveTypes.has(code)) {
      this.selectedLongLeaveTypes.delete(code);
    } else {
      this.selectedLongLeaveTypes.add(code);
    }
    this.refreshDirty();
    this.cdr.markForCheck();
  }

  onAcademicYearChange(yearId: string): void {
    if (
      !this.academicYearEditable ||
      !this.canSwitchYear ||
      !yearId ||
      yearId === this.ayContext.effectiveYearId()
    ) {
      const current = this.ayContext.effectiveYearId();
      this.selectedYearId = current;
      if (current && this.form.get('academicYearId')?.value !== current) {
        this.form.patchValue({ academicYearId: current }, { emitEvent: false });
      }
      return;
    }
    this.selectedYearId = yearId;
    this.ayContext.switchAcademicYear(yearId);
    this.snackBar.open('Academic year switched', 'Close', {
      duration: 2500,
      panelClass: 'snack-success',
    });
  }

  discardChanges(): void {
    if (!this.dirty || this.saving) return;
    this.loadSettings();
  }

  onSubmit(): void {
    const schoolId = this.tenant.school?.id;
    if (!schoolId || !this.canEdit || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (raw.staffLeaveEnabled && this.selectedStaffTypes.size === 0) {
      this.snackBar.open('Select at least one staff approver user type', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const hours = Number(raw.defaultWorkingHours);
    if (raw.attendanceEnabled && (!Number.isFinite(hours) || hours < 1 || hours > 24)) {
      this.snackBar.open('Default working hours must be between 1 and 24', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    const settings = [
      { key: LEAVE_KEYS.staffEnabled, value: raw.staffLeaveEnabled ? 'true' : 'false' },
      { key: LEAVE_KEYS.staffApprovalMode, value: String(raw.staffApprovalMode) },
      {
        key: LEAVE_KEYS.staffApproverUserTypes,
        value: [...this.selectedStaffTypes].join(','),
      },
      { key: LEAVE_KEYS.studentEnabled, value: raw.studentLeaveEnabled ? 'true' : 'false' },
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
      { key: ATTENDANCE_KEYS.enabled, value: raw.attendanceEnabled ? 'true' : 'false' },
      { key: ATTENDANCE_KEYS.defaultWorkingHours, value: String(hours) },
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
          this.captureSnapshot();
          this.dirty = false;
          this.snackBar.open('Settings saved', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.cdr.markForCheck();
        },
        error: () => {
          this.snackBar.open('Failed to save settings', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private loadAcademicYears(): void {
    this.yearsLoading = true;
    this.ayContext
      .loadDropdown()
      .pipe(
        finalize(() => {
          this.yearsLoading = false;
          this.syncAcademicYearOptions();
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        error: () => {
          this.snackBar.open('Could not load academic years', 'Close', {
            duration: 3000,
            panelClass: 'snack-error',
          });
        },
      });
  }

  private syncAcademicYearOptions(): void {
    const years = this.academicYears;
    this.selectedYearId = this.ayContext.effectiveYearId();
    this.fieldConfigs = {
      ...this.fieldConfigs,
      academicYearId: {
        ...this.fieldConfigs['academicYearId'],
        options: years.map((year) => ({
          label: `${year.name}${year.isCurrent ? ' (current)' : ''}`,
          value: year.id,
        })),
        disabled: !this.canSwitchYear || !this.academicYearEditable,
      },
    };

    const yearCtrl = this.form.get('academicYearId');
    const editableCtrl = this.form.get('academicYearEditable');
    if (!this.canSwitchYear) {
      editableCtrl?.setValue(false, { emitEvent: false });
      editableCtrl?.disable({ emitEvent: false });
      yearCtrl?.disable({ emitEvent: false });
    } else if (this.canEdit) {
      editableCtrl?.enable({ emitEvent: false });
      this.syncAcademicYearControlState(this.academicYearEditable);
    }

    if (this.selectedYearId) {
      yearCtrl?.setValue(this.selectedYearId, { emitEvent: false });
    }
  }

  private syncAcademicYearControlState(editable: boolean): void {
    const yearCtrl = this.form.get('academicYearId');
    if (!yearCtrl) return;

    const canEditYear = this.canEdit && this.canSwitchYear && editable;
    if (canEditYear) {
      yearCtrl.enable({ emitEvent: false });
    } else {
      yearCtrl.disable({ emitEvent: false });
    }

    if (this.fieldConfigs['academicYearId']) {
      this.fieldConfigs = {
        ...this.fieldConfigs,
        academicYearId: {
          ...this.fieldConfigs['academicYearId'],
          disabled: !canEditYear,
        },
      };
    }
    this.cdr.markForCheck();
  }

  private loadSettings(): void {
    const schoolId = this.tenant.school?.id;
    if (!schoolId) {
      this.resetFormDefaults();
      this.captureSnapshot();
      this.dirty = false;
      return;
    }

    this.loading = true;
    this.settingsService
      .getPortalSettings(schoolId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.captureSnapshot();
          this.dirty = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (rows) => {
          const map = new Map(rows.map((r) => [r.key, r.value]));
          this.form.patchValue(
            {
              staffLeaveEnabled: (map.get(LEAVE_KEYS.staffEnabled) ?? 'true') === 'true',
              staffApprovalMode: map.get(LEAVE_KEYS.staffApprovalMode) ?? 'AnyOne',
              studentLeaveEnabled: (map.get(LEAVE_KEYS.studentEnabled) ?? 'true') === 'true',
              studentApprovalMode: map.get(LEAVE_KEYS.studentApprovalMode) ?? 'AnyOne',
              studentLongLeaveMinDays: Number(map.get(LEAVE_KEYS.studentLongLeaveMinDays) ?? 4),
              studentLongLeaveTransferToPrincipal:
                (map.get(LEAVE_KEYS.studentLongLeaveTransferToPrincipal) ?? 'true') === 'true',
              attendanceEnabled: (map.get(ATTENDANCE_KEYS.enabled) ?? 'true') === 'true',
              defaultWorkingHours: Number(map.get(ATTENDANCE_KEYS.defaultWorkingHours) ?? 8),
            },
            { emitEvent: false },
          );
          this.selectedStaffTypes = new Set(
            (map.get(LEAVE_KEYS.staffApproverUserTypes) ?? 'Principal')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          );
          this.selectedLongLeaveTypes = new Set(
            (map.get(LEAVE_KEYS.studentLongLeaveApproverUserTypes) ?? 'Office staff')
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
    this.form.patchValue(
      {
        staffLeaveEnabled: true,
        staffApprovalMode: 'AnyOne',
        studentLeaveEnabled: true,
        studentApprovalMode: 'AnyOne',
        studentLongLeaveMinDays: 4,
        studentLongLeaveTransferToPrincipal: true,
        attendanceEnabled: true,
        defaultWorkingHours: 8,
      },
      { emitEvent: false },
    );
    this.selectedStaffTypes = new Set(['Principal']);
    this.selectedLongLeaveTypes = new Set(['Office staff']);
  }

  private captureSnapshot(): void {
    this.snapshotJson = this.serializeState();
  }

  private refreshDirty(): void {
    this.dirty = this.serializeState() !== this.snapshotJson;
    this.cdr.markForCheck();
  }

  private serializeState(): string {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const { academicYearEditable: _e, academicYearId: _y, ...settingsForm } = raw;
    return JSON.stringify({
      form: settingsForm,
      staff: [...this.selectedStaffTypes].sort(),
      long: [...this.selectedLongLeaveTypes].sort(),
    });
  }
}
