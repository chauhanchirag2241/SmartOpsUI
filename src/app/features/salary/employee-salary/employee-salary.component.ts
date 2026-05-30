import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { EmployeeSalaryService } from '../../../core/services/employee-salary.service';
import { SalaryStructureService } from '../../../core/services/salary-structure.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PermissionService } from '../../../core/services/permission.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { ListPageHeaderComponent } from '../../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../../shared/components/page-toolbar/page-toolbar.component';
import {
  asArray,
  extractApiError,
  formatInr,
  formatValueDisplay,
  normalizeEmployeeDetail,
  normalizeEmployeeListItem,
  normalizeSalaryStructureVersion,
  normalizeSalaryVersionComponent,
  studentInitials,
} from '../salary.shared';

@Component({
  selector: 'app-employee-salary',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, ListPageHeaderComponent, PageToolbarComponent],
  templateUrl: './employee-salary.component.html',
  styleUrl: '../salary.shared.css',
})
export class EmployeeSalaryComponent implements OnInit {
  private readonly service = inject(EmployeeSalaryService);
  private readonly structureService = inject(SalaryStructureService);
  private readonly permissionService = inject(PermissionService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  employees: ReturnType<typeof normalizeEmployeeListItem>[] = [];
  assignableVersions: ReturnType<typeof normalizeSalaryStructureVersion>[] = [];
  selectedTeacherId: string | null = null;
  detail: ReturnType<typeof normalizeEmployeeDetail> | null = null;

  search = '';
  designationFilter = 'All';
  departmentFilter = 'All';
  designations: string[] = [];
  departments: string[] = [];

  loadingList = false;
  loadingDetail = false;
  loadingAssignVersions = false;
  showAssignModal = false;
  assignForm = {
    salaryStructureVersionId: '',
    effectiveDate: '',
    componentValues: [] as {
      salaryVersionComponentId: string;
      value: number;
      name: string;
      calculationTypeLabel: string;
      defaultValue: number;
    }[],
  };

  formatInr = formatInr;
  formatValueDisplay = formatValueDisplay;
  studentInitials = studentInitials;

  ngOnInit(): void {
    this.assignForm.effectiveDate = new Date().toISOString().split('T')[0];
    this.loadAssignableVersions();
    this.loadEmployees();
  }

  get toolbarFilterActive(): boolean {
    return this.departmentFilter !== 'All' || this.designationFilter !== 'All';
  }

  onToolbarFiltersCleared(): void {
    this.departmentFilter = 'All';
    this.designationFilter = 'All';
    this.loadEmployees();
  }

  onToolbarSearchSubmit(q: string): void {
    this.search = q;
    this.loadEmployees();
  }

  loadAssignableVersions(): void {
    this.loadingAssignVersions = true;
    this.structureService.getVersions().subscribe({
      next: (list) => {
        this.assignableVersions = asArray(list)
          .map(normalizeSalaryStructureVersion)
          .filter((v) => v.statusLabel === 'Published' || v.statusLabel === 'Active');
        this.loadingAssignVersions = false;
        this.refresh();
      },
      error: () => {
        this.loadingAssignVersions = false;
        this.assignableVersions = [];
        this.refresh();
      },
    });
  }

  loadEmployees(): void {
    this.loadingList = true;
    this.refresh();
    this.service.getEmployees(this.search, undefined, this.designationFilter).subscribe({
      next: (list) => {
        let items = asArray(list).map(normalizeEmployeeListItem);
        if (this.departmentFilter !== 'All') {
          items = items.filter((e) => e.department === this.departmentFilter);
        }
        this.employees = items;
        this.designations = [
          ...new Set(items.map((e) => e.designation).filter((d): d is string => !!d)),
        ].sort();
        this.departments = [
          ...new Set(items.map((e) => e.department).filter((d): d is string => !!d)),
        ].sort();
        if (this.selectedTeacherId && !items.some((e) => e.teacherId === this.selectedTeacherId)) {
          this.selectedTeacherId = null;
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

  selectEmployee(teacherId: string): void {
    this.selectedTeacherId = teacherId;
    this.loadingDetail = true;
    this.detail = null;
    this.refresh();
    this.service.getEmployeeDetail(teacherId).subscribe({
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
    if (!this.assignableVersions.length) {
      this.toast('Publish a salary structure first (Salary Structure page)', true);
      return;
    }

    const versionId =
      this.detail.salaryStructureVersionId &&
      this.assignableVersions.some((v) => v.id === this.detail!.salaryStructureVersionId)
        ? this.detail.salaryStructureVersionId!
        : this.assignableVersions[0].id;

    this.assignForm = {
      salaryStructureVersionId: versionId,
      effectiveDate: this.detail.effectiveDate || new Date().toISOString().split('T')[0],
      componentValues: [],
    };
    this.showAssignModal = true;
    this.loadAssignComponents(versionId);
  }

  onAssignVersionChange(): void {
    this.loadAssignComponents(this.assignForm.salaryStructureVersionId);
  }

  private loadAssignComponents(versionId: string): void {
    if (!versionId || !this.detail) return;
    this.structureService.getVersionDetail(versionId).subscribe({
      next: (raw) => {
        const components = asArray(raw?.components ?? raw?.Components).map(normalizeSalaryVersionComponent);
        const existing = new Map(
          this.detail!.components.map((c) => [c.salaryVersionComponentId, c.value]),
        );
        this.assignForm.componentValues = components.map((m) => ({
          salaryVersionComponentId: m.id,
          name: m.name,
          calculationTypeLabel: m.calculationTypeLabel,
          defaultValue: m.value,
          value: existing.get(m.id) ?? m.value,
        }));
        this.refresh();
      },
      error: (e) => this.toast(extractApiError(e, 'Failed to load structure components'), true),
    });
  }

  assignVersionLabel(versionId: string): string {
    const v = this.assignableVersions.find((x) => x.id === versionId);
    return v ? `${v.academicYearTitle} — ${v.versionLabel} (${v.statusLabel})` : '—';
  }

  saveAssignment(): void {
    if (!this.selectedTeacherId) return;
    if (!this.assignForm.salaryStructureVersionId) {
      this.toast('Select a salary structure version', true);
      return;
    }
    const components = this.assignForm.componentValues
      .filter((c) => c.value > 0)
      .map((c) => ({ salaryVersionComponentId: c.salaryVersionComponentId, value: c.value }));
    if (!components.length) {
      this.toast('Enter at least one component value', true);
      return;
    }
    this.service
      .assignOrUpdate(this.selectedTeacherId, {
        salaryStructureVersionId: this.assignForm.salaryStructureVersionId,
        effectiveDate: this.assignForm.effectiveDate,
        components,
      })
      .subscribe({
        next: (raw) => {
          this.detail = normalizeEmployeeDetail(raw);
          this.showAssignModal = false;
          this.loadEmployees();
          this.toast('Employee salary saved');
        },
        error: (e) => this.toast(extractApiError(e, 'Save failed'), true),
      });
  }

  canEdit(): boolean {
    return !this.ayContext.isReadOnlyScope() && this.permissionService.canEdit(MenuCodes.SalaryEmployees);
  }

  private toast(msg: string, isError = false): void {
    this.snackBar.open(msg, 'Close', { duration: 3500, panelClass: isError ? 'snack-error' : undefined });
  }

  private refresh(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }
}
