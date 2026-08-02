import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../core/services/notification.service';
import { EmployeeSalaryService } from '../../../core/services/employee-salary.service';
import { UserTypeService, UserTypeDto } from '../../../core/services/user-type.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { ListPageHeaderComponent } from '../../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../../shared/components/page-toolbar/page-toolbar.component';
import { FormFieldComponent } from '../../../shared/form-controls/form-field';
import { MultiSelectChipsComponent } from '../../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../../shared/mapping/mapping.types';
import { ERP_FORM_DIALOG_WIDTH } from '../../../shared/constants/dialog.constants';
import {
  asArray,
  extractApiError,
  formatInr,
  formatValueDisplay,
  normalizeEmployeeDetail,
  normalizeEmployeeListItem,
  studentInitials,
} from '../salary.shared';
import {
  AssignEmployeeSalaryDialogComponent,
  AssignEmployeeSalaryDialogData,
} from './assign-employee-salary-dialog/assign-employee-salary-dialog.component';

/** Staff user types shown in Employee Salary filter (excludes Student / Admin). */
const STAFF_TYPE_NAMES = new Set(
  [
    'Teacher',
    'Accountant',
    'Non-academic staff',
    'Office staff',
    'Front Office Executive',
    'Principal',
  ].map((n) => n.toLowerCase()),
);

@Component({
  selector: 'app-employee-salary',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    ListPageHeaderComponent,
    PageToolbarComponent,
    FormFieldComponent,
    MultiSelectChipsComponent,
  ],
  templateUrl: './employee-salary.component.html',
  styleUrl: '../salary.shared.css',
})
export class EmployeeSalaryComponent implements OnInit {
  private readonly service = inject(EmployeeSalaryService);
  private readonly userTypeService = inject(UserTypeService);
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  employees: ReturnType<typeof normalizeEmployeeListItem>[] = [];
  selectedEmployeeId: string | null = null;
  detail: ReturnType<typeof normalizeEmployeeDetail> | null = null;

  search = '';
  /** Multi-select employee type ids — empty by default (list stays empty until selected). */
  selectedEmployeeTypeIds: string[] = [];
  employeeTypeOptions: MappingOption[] = [];

  loadingList = false;
  loadingDetail = false;

  formatInr = formatInr;
  formatValueDisplay = formatValueDisplay;
  studentInitials = studentInitials;

  ngOnInit(): void {
    this.userTypeService.getUserTypes().subscribe({
      next: (types) => {
        this.employeeTypeOptions = this.mapStaffTypeOptions(types ?? []);
        this.refresh();
      },
      error: () => {
        this.employeeTypeOptions = [];
        this.toast('Failed to load employee types', true);
        this.refresh();
      },
    });
  }

  onEmployeeTypesChange(): void {
    this.loadEmployees();
  }

  onToolbarSearchSubmit(q: string): void {
    this.search = q;
    this.loadEmployees();
  }

  loadEmployees(): void {
    if (!this.selectedEmployeeTypeIds.length) {
      this.employees = [];
      this.selectedEmployeeId = null;
      this.detail = null;
      this.loadingList = false;
      this.refresh();
      return;
    }

    this.loadingList = true;
    this.refresh();
    this.service.getEmployees(this.search, this.selectedEmployeeTypeIds).subscribe({
      next: (list) => {
        const items = asArray(list).map(normalizeEmployeeListItem);
        this.employees = items;
        if (this.selectedEmployeeId && !items.some((e) => e.employeeRecordId === this.selectedEmployeeId)) {
          this.selectedEmployeeId = null;
          this.detail = null;
        }
        this.loadingList = false;
        this.refresh();
      },
      error: () => {
        this.loadingList = false;
        this.employees = [];
        this.toast('Failed to load employees', true);
        this.refresh();
      },
    });
  }

  selectEmployee(employeeId: string): void {
    this.selectedEmployeeId = employeeId;
    this.loadingDetail = true;
    this.detail = null;
    this.refresh();
    this.service.getEmployeeDetail(employeeId).subscribe({
      next: (raw) => {
        this.detail = normalizeEmployeeDetail(raw);
        this.loadingDetail = false;
        this.refresh();
      },
      error: (e) => {
        this.loadingDetail = false;
        this.toast(extractApiError(e, 'Failed to load salary detail'), true);
        this.refresh();
      },
    });
  }

  openAssignModal(): void {
    if (!this.permissionService.canEdit(MenuCodes.SalaryEmployees) || !this.detail) return;

    const data: AssignEmployeeSalaryDialogData = {
      employeeId: this.detail.employeeRecordId,
      employeeName: this.detail.employeeName,
      existingSalaryStructureVersionId: this.detail.salaryStructureVersionId,
      existingEffectiveDate: this.detail.effectiveDate,
      existingComponentValues: this.detail.components.map((c) => ({
        salaryVersionComponentId: c.salaryVersionComponentId,
        value: c.value,
      })),
    };

    this.dialog
      .open(AssignEmployeeSalaryDialogComponent, {
        data,
        panelClass: 'erp-dialog',
        disableClose: true,
        width: ERP_FORM_DIALOG_WIDTH,
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (!saved || !this.selectedEmployeeId) return;
        this.selectEmployee(this.selectedEmployeeId);
        this.loadEmployees();
      });
  }

  canEdit(): boolean {
    return !this.ayContext.isReadOnlyScope() && this.permissionService.canEdit(MenuCodes.SalaryEmployees);
  }

  private mapStaffTypeOptions(types: UserTypeDto[]): MappingOption[] {
    return types
      .filter((t) => {
        const name = (t.name || t.code || '').trim().toLowerCase();
        return STAFF_TYPE_NAMES.has(name);
      })
      .map((t) => ({
        id: String(t.id),
        name: t.name || t.code || String(t.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private toast(msg: string, isError = false): void {
    this.snackBar.open(msg, 'Close', { duration: 3500, panelClass: isError ? 'snack-error' : undefined });
  }

  private refresh(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
