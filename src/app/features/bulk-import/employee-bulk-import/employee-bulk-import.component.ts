import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs';

import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { MenuCodes } from '../../../core/constants/menu-codes';
import { PageChromeDirective } from '../../../shared/directives/page-chrome.directive';
import {
  FileUploadComponent,
  type SelectedUploadFile,
} from '../../../shared/components/file-upload/file-upload.component';
import { SmartDataTableComponent } from '../../../shared/components/smart-data-table';
import {
  ProgressBarComponent,
  type ProgressSegment,
} from '../../../shared/components/progress-bar';
import { DeleteConfirmDialogComponent } from '../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import type { DataTableConfig } from '../../../shared/interfaces/data-table.interface';
import {
  downloadBase64File,
  downloadBlob,
  isExcelFile,
} from '../shared/bulk-import-file.util';
import type {
  EmployeeImportCommitResult,
  EmployeeImportValidateResult,
  ImportRowResult,
} from '../shared/bulk-import.models';
import { EmployeeImportService } from './employee-import.service';

type IssueCount = { label: string; count: number };

@Component({
  selector: 'app-employee-bulk-import',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    PageChromeDirective,
    FileUploadComponent,
    SmartDataTableComponent,
    ProgressBarComponent,
  ],
  templateUrl: './employee-bulk-import.component.html',
  styleUrl: '../shared/bulk-import-page.css',
})
export class EmployeeBulkImportComponent {
  @ViewChild(FileUploadComponent) private fileUpload?: FileUploadComponent;
  @ViewChild('summaryCard') private summaryCard?: ElementRef<HTMLElement>;

  private readonly importApi = inject(EmployeeImportService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  readonly permissionService = inject(PermissionService);

  readonly menuCode = MenuCodes.EmployeeBulkImport;

  selectedFile: File | null = null;
  validating = false;
  importing = false;
  validation: EmployeeImportValidateResult | null = null;
  commitResult: EmployeeImportCommitResult | null = null;

  invalidRows: ImportRowResult[] = [];
  employeeTableData: Record<string, unknown>[] = [];
  failureTableData: Record<string, unknown>[] = [];
  importedTableData: Record<string, unknown>[] = [];
  commonIssues: IssueCount[] = [];
  importResultTab: 'failures' | 'imported' = 'failures';

  employeeTableConfig!: DataTableConfig;
  failureTableConfig!: DataTableConfig;
  importedTableConfig!: DataTableConfig;

  readonly validationRowClass = (row: Record<string, unknown>): string =>
    String(row['status'] ?? '') !== 'Valid' ? 'row-invalid' : '';

  readonly failureRowClass = (_row: Record<string, unknown>): string => 'row-invalid';

  readonly importedRowClass = (row: Record<string, unknown>): string =>
    String(row['status'] ?? '') === 'Inactive' ? 'row-inactive' : '';

  constructor() {
    this.employeeTableConfig = this.buildEmployeeTableConfig();
    this.failureTableConfig = this.buildFailureTableConfig();
    this.importedTableConfig = this.buildImportedTableConfig();
  }

  get canAdd(): boolean {
    return this.permissionService.canAdd(this.menuCode);
  }

  get stepIndex(): number {
    if (this.commitResult && !this.commitResult.fileError) return 2;
    if (this.validation && !this.validation.fileError) return 1;
    if (this.selectedFile) return 0;
    return 0;
  }

  get step1Done(): boolean {
    return !!this.selectedFile;
  }

  get step2Done(): boolean {
    return !!this.validation && !this.validation.fileError;
  }

  get step3Done(): boolean {
    return !!this.commitResult && !this.commitResult.fileError;
  }

  get progressSegments(): ProgressSegment[] {
    const v = this.validation;
    if (!v || v.totalEmployees < 1) return [];
    const validPct = (v.validEmployees / v.totalEmployees) * 100;
    const invalidPct = (v.invalidEmployees / v.totalEmployees) * 100;
    return [
      { percent: validPct, tone: 'success' },
      { percent: invalidPct, tone: 'danger' },
    ];
  }

  get progressLeftCaption(): string {
    const v = this.validation;
    if (!v || v.totalEmployees < 1) return '';
    const pct = ((v.validEmployees / v.totalEmployees) * 100).toFixed(0);
    return `${v.validEmployees} valid (${pct}%)`;
  }

  get progressRightCaption(): string {
    const v = this.validation;
    if (!v || v.totalEmployees < 1) return '';
    const pct = ((v.invalidEmployees / v.totalEmployees) * 100).toFixed(0);
    return `${v.invalidEmployees} invalid (${pct}%)`;
  }

  get canImport(): boolean {
    return (
      !!this.validation &&
      !this.validation.fileError &&
      this.validation.invalidEmployees === 0 &&
      this.validation.validEmployees > 0 &&
      !this.importing &&
      !this.validating &&
      this.canAdd
    );
  }

  get showImportResults(): boolean {
    return !!this.commitResult && !this.commitResult.fileError;
  }

  switchImportResultTab(tab: 'failures' | 'imported'): void {
    this.importResultTab = tab;
    this.refreshView();
  }

  onFileSelected(selected: SelectedUploadFile): void {
    const file = selected.file;
    this.commitResult = null;
    this.clearValidationState();
    if (!isExcelFile(file)) {
      this.selectedFile = null;
      this.notify.error('Only .xlsx Excel files are supported.');
      this.fileUpload?.reset();
      this.refreshView();
      return;
    }
    this.selectedFile = file;
    this.refreshView();
  }

  downloadTemplate(): void {
    this.importApi.downloadTemplate().subscribe({
      next: (blob) => {
        downloadBlob(blob, 'employee-import-template.xlsx');
        this.notify.success('Template downloaded');
      },
      error: () => this.notify.error('Failed to download template.'),
    });
  }

  validate(): void {
    if (!this.selectedFile) {
      this.notify.error('Select an Excel file first.');
      return;
    }

    this.validating = true;
    this.commitResult = null;
    this.refreshView();

    this.importApi
      .validate(this.selectedFile)
      .pipe(
        finalize(() => {
          this.validating = false;
          this.refreshView();
        }),
      )
      .subscribe({
        next: (result) => {
          this.applyValidation(this.normalizeValidate(result));
          if (this.validation?.fileError) {
            this.notify.error(this.validation.fileError);
            return;
          }
          this.notify.success(
            `Validated: ${this.validation?.validEmployees ?? 0} valid, ${this.validation?.invalidEmployees ?? 0} invalid employees.`,
          );
          setTimeout(() => this.summaryCard?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        },
        error: (err) => {
          this.clearValidationState();
          const msg = err?.error?.message || 'Validation failed.';
          this.notify.error(msg);
        },
      });
  }

  downloadErrorFile(): void {
    const v = this.validation;
    if (!v?.errorFileBase64) {
      this.notify.error('No error file available.');
      return;
    }
    downloadBase64File(v.errorFileBase64, v.errorFileName || 'employee-import-errors.xlsx');
    this.notify.success('Error file downloaded');
  }

  importAll(): void {
    if (!this.selectedFile || !this.canImport || !this.validation) {
      this.notify.error('Import is only allowed when the entire file is valid.');
      return;
    }

    const total = this.validation.totalEmployees;
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Import employees?',
        description: 'Only valid records will be saved. Do you want to continue?',
        recordName: `${total} employee record${total === 1 ? '' : 's'}`,
        recordMeta: 'Entire file is valid — all rows will be imported',
        initials: 'IM',
        warningMessage: 'Do you want to continue?',
        confirmButtonText: 'Yes',
        cancelButtonText: 'No',
        variant: 'primary',
        headerIcon: 'upload',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.runCommit();
    });
  }

  private runCommit(): void {
    if (!this.selectedFile) return;

    this.importing = true;
    this.refreshView();

    this.importApi
      .commit(this.selectedFile)
      .pipe(
        finalize(() => {
          this.importing = false;
          this.refreshView();
        }),
      )
      .subscribe({
        next: (result) => {
          this.commitResult = this.normalizeCommit(result);
          if (this.commitResult.fileError) {
            this.notify.error(this.commitResult.fileError);
            if (this.commitResult.validation) {
              this.applyValidation(this.normalizeValidate(this.commitResult.validation));
            }
            this.refreshView();
            return;
          }
          this.applyCommitResult(this.commitResult);
          this.notify.success(`Imported ${this.commitResult.createdEmployees} employees.`);
          this.refreshView();
        },
        error: (err) => {
          const msg = err?.error?.message || 'Import failed.';
          this.notify.error(msg);
        },
      });
  }

  private applyCommitResult(result: EmployeeImportCommitResult): void {
    this.failureTableData = (result.failures ?? []).map((f, i) => ({
      id: `fail-${f.rowNumber ?? i}`,
      rowNumber: f.rowNumber ?? '—',
      employeeCode: f.employeeCode || '—',
      name: f.displayName || '—',
      status: 'Invalid',
      errors: f.message || '',
    }));
    this.importedTableData = (result.created ?? []).map((c, i) => ({
      id: `ok-${c.rowNumber ?? i}`,
      rowNumber: c.rowNumber ?? '—',
      employeeCode: c.employeeCode || '—',
      name: c.displayName || '—',
      username: c.username || '—',
      status: c.status === 'Inactive' ? 'Inactive' : 'Active',
    }));
    this.importResultTab = this.failureTableData.length > 0 ? 'failures' : 'imported';
    this.employeeTableData = [];
  }

  private applyValidation(result: EmployeeImportValidateResult): void {
    this.validation = result;
    this.invalidRows = (result.employees ?? []).filter((r) => r.status !== 'Valid');
    this.employeeTableData = (result.employees ?? []).map((r) => ({
      id: `e-${r.rowNumber}`,
      rowNumber: r.rowNumber,
      employeeCode: r.employeeCode || '—',
      name: r.displayName || '—',
      status: r.status === 'Valid' ? 'Valid' : 'Invalid',
      errors: r.status === 'Valid' ? '' : (r.errors ?? []).join(', '),
    }));
    this.commonIssues = this.buildCommonIssues(this.invalidRows);
    this.refreshView();
  }

  private clearValidationState(): void {
    this.validation = null;
    this.invalidRows = [];
    this.employeeTableData = [];
    this.failureTableData = [];
    this.importedTableData = [];
    this.commonIssues = [];
    this.importResultTab = 'failures';
  }

  private buildCommonIssues(rows: ImportRowResult[]): IssueCount[] {
    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const err of row.errors ?? []) {
        const key = err.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private buildEmployeeTableConfig(): DataTableConfig {
    return {
      header: {
        title: 'Validation results',
        subtitle: 'All rows from the Employees sheet — invalid rows are highlighted in red',
        showAddButton: false,
        syncPageChrome: false,
      },
      columns: [
        { key: 'rowNumber', label: 'Row', sortable: true, width: '80px' },
        {
          key: 'status',
          label: 'Status',
          sortable: true,
          width: '110px',
          cellType: 'badge',
          badgeMap: {
            Valid: { cssClass: 'b-green', label: 'Valid' },
            Invalid: { cssClass: 'b-red', label: 'Invalid' },
          },
        },
        { key: 'employeeCode', label: 'Employee code', sortable: true },
        { key: 'name', label: 'Name', sortable: true },
        { key: 'errors', label: 'Error messages', sortable: false, cellType: 'custom' },
      ],
      filters: [
        { label: 'All', icon: 'list', value: 'all' },
        {
          label: 'Valid',
          icon: 'check_circle',
          value: 'valid',
          filterFn: (row) => String(row['status'] ?? '') === 'Valid',
        },
        {
          label: 'Invalid',
          icon: 'error',
          value: 'invalid',
          filterFn: (row) => String(row['status'] ?? '') !== 'Valid',
        },
      ],
      filtersInPanel: false,
      actions: [],
      bulkActions: [],
      searchPlaceholder: 'Search employee code or name...',
      searchKeys: ['employeeCode', 'name', 'errors', 'status'],
      itemLabel: 'rows',
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100],
      selectable: false,
      showExport: false,
      showColumnToggle: false,
    };
  }

  private buildFailureTableConfig(): DataTableConfig {
    return {
      header: {
        title: 'Import failures',
        subtitle: 'Rows that failed during import',
        showAddButton: false,
        syncPageChrome: false,
      },
      columns: [
        { key: 'rowNumber', label: 'Row', sortable: true, width: '80px' },
        {
          key: 'status',
          label: 'Status',
          sortable: true,
          width: '110px',
          cellType: 'badge',
          badgeMap: { Invalid: { cssClass: 'b-red', label: 'Invalid' } },
        },
        { key: 'employeeCode', label: 'Employee code', sortable: true },
        { key: 'name', label: 'Name', sortable: true },
        { key: 'errors', label: 'Error messages', sortable: false, cellType: 'custom' },
      ],
      filters: [],
      filtersInPanel: false,
      actions: [],
      bulkActions: [],
      searchPlaceholder: 'Search employee code or name...',
      searchKeys: ['employeeCode', 'name', 'errors'],
      itemLabel: 'failures',
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50],
      selectable: false,
      showExport: false,
      showColumnToggle: false,
    };
  }

  private buildImportedTableConfig(): DataTableConfig {
    return {
      header: {
        title: 'Imported employees',
        subtitle: 'Successfully imported records (Active / Inactive)',
        showAddButton: false,
        syncPageChrome: false,
      },
      columns: [
        { key: 'rowNumber', label: 'Row', sortable: true, width: '80px' },
        {
          key: 'status',
          label: 'Status',
          sortable: true,
          width: '110px',
          cellType: 'badge',
          badgeMap: {
            Active: { cssClass: 'b-green', label: 'Active' },
            Inactive: { cssClass: 'b-red', label: 'Inactive' },
          },
        },
        { key: 'employeeCode', label: 'Employee code', sortable: true },
        { key: 'name', label: 'Name', sortable: true },
        { key: 'username', label: 'Username', sortable: true },
      ],
      filters: [
        { label: 'All', icon: 'list', value: 'all' },
        {
          label: 'Active',
          icon: 'check_circle',
          value: 'active',
          filterFn: (row) => String(row['status'] ?? '') === 'Active',
        },
        {
          label: 'Inactive',
          icon: 'block',
          value: 'inactive',
          filterFn: (row) => String(row['status'] ?? '') === 'Inactive',
        },
      ],
      filtersInPanel: false,
      actions: [],
      bulkActions: [],
      searchPlaceholder: 'Search code, name or username...',
      searchKeys: ['employeeCode', 'name', 'username', 'status'],
      itemLabel: 'employees',
      defaultPageSize: 10,
      pageSizeOptions: [10, 25, 50, 100],
      selectable: false,
      showExport: false,
      showColumnToggle: false,
    };
  }

  private normalizeValidate(raw: any): EmployeeImportValidateResult {
    return {
      fileError: raw.fileError ?? raw.FileError ?? null,
      totalEmployees: Number(raw.totalEmployees ?? raw.TotalEmployees ?? 0),
      validEmployees: Number(raw.validEmployees ?? raw.ValidEmployees ?? 0),
      invalidEmployees: Number(raw.invalidEmployees ?? raw.InvalidEmployees ?? 0),
      employees: this.normalizeRows(raw.employees ?? raw.Employees),
      errorFileBase64: raw.errorFileBase64 ?? raw.ErrorFileBase64 ?? null,
      errorFileName: raw.errorFileName ?? raw.ErrorFileName ?? 'employee-import-errors.xlsx',
    };
  }

  private normalizeCommit(raw: any): EmployeeImportCommitResult {
    return {
      fileError: raw.fileError ?? raw.FileError ?? null,
      createdEmployees: Number(raw.createdEmployees ?? raw.CreatedEmployees ?? 0),
      skippedInvalidEmployees: Number(raw.skippedInvalidEmployees ?? raw.SkippedInvalidEmployees ?? 0),
      failures: (raw.failures ?? raw.Failures ?? []).map((f: any) => ({
        rowNumber: f.rowNumber ?? f.RowNumber ?? null,
        employeeCode: f.employeeCode ?? f.EmployeeCode ?? null,
        displayName: f.displayName ?? f.DisplayName ?? null,
        message: f.message ?? f.Message ?? '',
      })),
      created: (raw.created ?? raw.Created ?? []).map((c: any) => ({
        rowNumber: c.rowNumber ?? c.RowNumber ?? null,
        employeeCode: c.employeeCode ?? c.EmployeeCode ?? null,
        displayName: c.displayName ?? c.DisplayName ?? null,
        username: c.username ?? c.Username ?? null,
        status: c.status ?? c.Status ?? 'Active',
      })),
      validation: raw.validation || raw.Validation
        ? this.normalizeValidate(raw.validation ?? raw.Validation)
        : null,
    };
  }

  private normalizeRows(rows: any): ImportRowResult[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      rowNumber: Number(r.rowNumber ?? r.RowNumber ?? 0),
      employeeCode: r.employeeCode ?? r.EmployeeCode ?? null,
      displayName: r.displayName ?? r.DisplayName ?? null,
      status: r.status ?? r.Status ?? 'Invalid',
      errors: r.errors ?? r.Errors ?? [],
    }));
  }
}
