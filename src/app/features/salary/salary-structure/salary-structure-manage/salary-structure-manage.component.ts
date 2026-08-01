import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NotificationService } from '../../../../core/services/notification.service';
import { SalaryStructureService } from '../../../../core/services/salary-structure.service';
import { AcademicYearContextService } from '../../../../core/services/academic-year-context.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { MenuCodes } from '../../../../core/constants/menu-codes';
import { applyModuleTablePermissions } from '../../../../core/utils/permission-ui.util';
import { PageChromeDirective } from '../../../../shared/directives/page-chrome.directive';
import { SmartDataTableComponent } from '../../../../shared/components/smart-data-table/smart-data-table.component';
import { DeleteConfirmDialogComponent } from '../../../../shared/components/delete-confirm-dialog/delete-confirm-dialog.component';
import {
  FormDialogComponent,
  FormDialogData,
} from '../../../../shared/components/form-dialog/form-dialog.component';
import { ActionButtonComponent } from '../../../../shared/components/action-button/action-button.component';
import type {
  DataTableAction,
  DataTableConfig,
} from '../../../../shared/components/smart-data-table';
import { FormFieldConfig } from '../../../../shared/interfaces/form-field-config';
import { SELECT_PLACEHOLDER } from '../../../../shared/constants/form.constants';
import { ERP_FORM_DIALOG_WIDTH } from '../../../../shared/constants/dialog.constants';
import {
  formatDateOnlyDisplay,
  parseDateOnly,
  toDateOnlyString,
  todayDateOnlyString,
} from '../../../../shared/utils/date-only.util';
import {
  CALCULATION_TYPE_OPTIONS,
  COMPONENT_TYPE_OPTIONS,
  SalaryCalculationType,
  SalaryComponentType,
  asArray,
  extractApiError,
  formatValueDisplay,
  normalizeSalaryStructureVersion,
  normalizeSalaryVersionComponent,
  versionStatusBadgeClass,
} from '../../salary.shared';

@Component({
  selector: 'app-salary-structure-manage',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatDialogModule,
    PageChromeDirective,
    SmartDataTableComponent,
    ActionButtonComponent,
  ],
  templateUrl: './salary-structure-manage.component.html',
  styleUrl: './salary-structure-manage.component.css',
  host: { class: 'salary-structure-manage-page form-page-shell' },
})
export class SalaryStructureManageComponent implements OnInit {
  @Input({ required: true }) versionId!: string;
  @Input() initialTab = 0;
  @Output() cancel = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();

  private readonly service = inject(SalaryStructureService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  readonly tabs = [{ label: 'Salary Structure' }, { label: 'Components' }];
  currentTab = 0;
  loading = true;
  editingBasic = false;
  isSavingBasic = false;
  editEffectiveDate = '';

  version: ReturnType<typeof normalizeSalaryStructureVersion> | null = null;
  components: Record<string, unknown>[] = [];
  componentTableConfig!: DataTableConfig;

  statusClass = versionStatusBadgeClass;

  private readonly baseComponentTableConfig: DataTableConfig = {
    header: {
      title: 'Components',
      subtitle: 'Earnings and deductions for this salary structure',
      showAddButton: true,
      addButtonText: 'Add component',
      addButtonIcon: 'add',
      addButtonClass: 'btn-primary',
      syncPageChrome: false,
    },
    columns: [
      { key: 'name', label: 'Component', sortable: true, cellType: 'text' },
      { key: 'shortCode', label: 'Code', sortable: true, cellType: 'text' },
      {
        key: 'componentTypeLabel',
        label: 'Type',
        cellType: 'badge',
        badgeMap: {
          Earning: { cssClass: 'b-green', label: 'Earning' },
          Deduction: { cssClass: 'b-red', label: 'Deduction' },
        },
      },
      {
        key: 'calculationTypeLabel',
        label: 'Calculation',
        cellType: 'badge',
        badgeMap: {
          'Fixed amount': { cssClass: 'b-gray', label: 'Fixed amount' },
          '% of basic': { cssClass: 'b-gray', label: '% of basic' },
          '% of gross': { cssClass: 'b-gray', label: '% of gross' },
        },
      },
      { key: 'valueDisplay', label: 'Default value', sortable: false, cellType: 'text' },
      {
        key: 'isTaxable',
        label: 'Taxable',
        cellType: 'badge',
        badgeMap: {
          true: { cssClass: 'b-amber', label: 'Yes' },
          false: { cssClass: 'b-gray', label: 'No' },
        },
      },
    ],
    actions: [{ label: 'Delete', icon: 'delete', danger: true }],
    searchPlaceholder: 'Search component or code...',
    searchKeys: ['name', 'shortCode'],
    itemLabel: 'components',
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
    showExport: false,
    selectable: false,
  };

  get pageTitle(): string {
    return this.tabs[this.currentTab]?.label ?? 'Manage structure';
  }

  get pageSubtitle(): string {
    const label = this.version?.versionLabel;
    const status = this.version?.statusLabel;
    if (label && status) return `${label} · ${status}`;
    return 'Salary Structure';
  }

  /** Locked once effective date has started (or archived). */
  get isEffectiveLocked(): boolean {
    if (!this.version) return false;
    if (this.version.statusLabel === 'Archived') return true;
    const effective = parseDateOnly(this.version.effectiveDate);
    if (!effective) return false;
    const today = parseDateOnly(new Date())!;
    return effective.getTime() <= today.getTime();
  }

  get canEditBasic(): boolean {
    return (
      !this.ayContext.isReadOnlyScope() &&
      !!this.version &&
      !this.isEffectiveLocked &&
      this.permissionService.canEdit(MenuCodes.SalaryStructure)
    );
  }

  get canAddComponent(): boolean {
    return (
      !this.ayContext.isReadOnlyScope() &&
      !!this.version &&
      !this.isEffectiveLocked &&
      this.permissionService.canAdd(MenuCodes.SalaryStructure)
    );
  }

  get canDeleteComponent(): boolean {
    return (
      !this.ayContext.isReadOnlyScope() &&
      !!this.version &&
      !this.isEffectiveLocked &&
      this.permissionService.canDelete(MenuCodes.SalaryStructure)
    );
  }

  get minEffectiveDate(): string {
    return todayDateOnlyString();
  }

  ngOnInit(): void {
    this.currentTab = Math.min(Math.max(0, this.initialTab || 0), this.tabs.length - 1);
    this.rebuildComponentTableConfig();
    this.loadVersion();
  }

  goTab(index: number): void {
    this.currentTab = index;
    if (index === 0 && this.editingBasic) {
      this.cancelBasicEdit();
    }
    if (index === 1) {
      this.rebuildComponentTableConfig();
    }
    this.refreshView();
  }

  formatDate(value: string | null | undefined): string {
    return formatDateOnlyDisplay(value);
  }

  startBasicEdit(): void {
    if (!this.canEditBasic || !this.version) return;
    this.editEffectiveDate = toDateOnlyString(this.version.effectiveDate) ?? '';
    this.editingBasic = true;
    this.refreshView();
  }

  cancelBasicEdit(): void {
    this.editingBasic = false;
    this.isSavingBasic = false;
    this.refreshView();
  }

  saveBasic(): void {
    if (!this.version || this.isSavingBasic) return;
    this.isSavingBasic = true;
    this.service
      .updateVersionBasic(this.version.id, {
        effectiveDate: this.editEffectiveDate || null,
      })
      .subscribe({
        next: () => {
          this.isSavingBasic = false;
          this.editingBasic = false;
          this.loadVersion();
          this.changed.emit();
          this.toast('Salary structure updated');
        },
        error: (e) => {
          this.isSavingBasic = false;
          this.toast(extractApiError(e, 'Failed to update salary structure'), true);
          this.refreshView();
        },
      });
  }

  loadVersion(): void {
    this.loading = true;
    this.refreshView();
    this.service.getVersionDetail(this.versionId).subscribe({
      next: (detail) => {
        this.version = normalizeSalaryStructureVersion(detail);
        this.components = asArray(detail?.components ?? detail?.Components)
          .map(normalizeSalaryVersionComponent)
          .map((c) => ({
            ...c,
            shortCode: c.shortCode || '—',
            valueDisplay: formatValueDisplay(c.calculationTypeLabel, c.value),
          }));
        this.loading = false;
        this.rebuildComponentTableConfig();
        this.refreshView();
      },
      error: (e) => {
        this.loading = false;
        this.toast(extractApiError(e, 'Failed to load salary structure'), true);
        this.refreshView();
      },
    });
  }

  openAddComponent(): void {
    if (!this.canAddComponent) return;

    const fields: FormFieldConfig[] = [
      {
        type: 'input',
        controlName: 'name',
        label: 'Component name',
        placeholder: 'e.g. Basic, HRA, PF',
        validations: [
          { name: 'required', message: 'Component name is required', validator: Validators.required },
        ],
      },
      {
        type: 'input',
        controlName: 'shortCode',
        label: 'Short code',
        placeholder: 'e.g. BASIC',
      },
      {
        type: 'select',
        controlName: 'componentType',
        label: 'Type',
        placeholder: SELECT_PLACEHOLDER,
        options: COMPONENT_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
        validations: [
          { name: 'required', message: 'Type is required', validator: Validators.required },
        ],
      },
      {
        type: 'select',
        controlName: 'calculationType',
        label: 'Calculation',
        placeholder: SELECT_PLACEHOLDER,
        options: CALCULATION_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
        validations: [
          { name: 'required', message: 'Calculation is required', validator: Validators.required },
        ],
      },
      {
        type: 'number',
        controlName: 'value',
        label: 'Default value',
        placeholder: '0',
        inputType: 'number',
      },
      {
        type: 'checkbox',
        controlName: 'isTaxable',
        label: 'Taxable',
      },
    ];

    const data: FormDialogData = {
      title: 'Add salary component',
      subtitle: 'Create an earning or deduction for this structure',
      saveLabel: 'Add component',
      sectionTitle: 'Component details',
      sectionIcon: 'payments',
      fields,
      layout: 'grid2',
      width: ERP_FORM_DIALOG_WIDTH,
      initialValue: {
        name: '',
        shortCode: '',
        componentType: SalaryComponentType.Earning,
        calculationType: SalaryCalculationType.PercentOfBasic,
        value: 0,
        isTaxable: true,
      },
    };

    this.dialog
      .open(FormDialogComponent, {
        data,
        panelClass: 'erp-dialog',
        disableClose: true,
        width: ERP_FORM_DIALOG_WIDTH,
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((value) => {
        if (!value || !this.version) return;
        const name = String(value['name'] ?? '').trim();
        if (!name) {
          this.toast('Component name is required', true);
          return;
        }

        const payload = {
          name,
          shortCode: String(value['shortCode'] ?? '').trim(),
          componentType: Number(value['componentType']) as SalaryComponentType,
          calculationType: Number(value['calculationType']) as SalaryCalculationType,
          value: Number(value['value'] ?? 0) || 0,
          isTaxable: Boolean(value['isTaxable']),
        };

        this.service.createComponent(this.version.id, payload).subscribe({
          next: () => {
            this.loadVersion();
            this.changed.emit();
            this.toast('Component added');
          },
          error: (e) => this.toast(extractApiError(e, 'Failed to add component'), true),
        });
      });
  }

  onComponentAction(event: {
    action: DataTableAction;
    row: Record<string, unknown>;
  }): void {
    if (event.action.label === 'Delete') {
      this.deleteComponent(event.row);
    }
  }

  deleteComponent(row: Record<string, unknown>): void {
    if (!this.canDeleteComponent || !this.version) return;

    const name = String(row['name'] ?? 'Component');
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      data: {
        title: 'Delete salary component?',
        description: 'This component will be removed from the salary structure.',
        recordName: name,
        recordMeta: String(row['componentTypeLabel'] ?? ''),
        initials: this.initialsFrom(name),
        warningMessage: 'This action cannot be undone for this version.',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
      },
      panelClass: 'erp-dialog',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.deleteComponent(String(row['id'])).subscribe({
        next: () => {
          this.loadVersion();
          this.changed.emit();
          this.toast('Component removed');
        },
        error: (e) => this.toast(extractApiError(e, 'Delete failed'), true),
      });
    });
  }

  private rebuildComponentTableConfig(): void {
    const config: DataTableConfig = {
      ...this.baseComponentTableConfig,
      header: {
        ...this.baseComponentTableConfig.header!,
        showAddButton: this.canAddComponent,
      },
      actions: this.canDeleteComponent
        ? [{ label: 'Delete', icon: 'delete', danger: true }]
        : [],
    };
    this.componentTableConfig = applyModuleTablePermissions(
      config,
      this.permissionService,
      MenuCodes.SalaryStructure,
      this.ayContext.isReadOnlyScope() || this.isEffectiveLocked,
    );
  }

  private initialsFrom(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'SC';
    return parts
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
  }

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', {
      duration: 2800,
      panelClass: error ? 'snack-error' : 'snack-success',
    });
  }
}
