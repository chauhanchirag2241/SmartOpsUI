import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { ClassFeeAmountService } from '../../../core/services/class-fee-amount.service';
import { FeeStructureService } from '../../../core/services/fee-structure.service';
import { AcademicYearContextService } from '../../../core/services/academic-year-context.service';
import { ListPageHeaderComponent } from '../../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../../shared/components/page-toolbar/page-toolbar.component';
import { DynamicFieldComponent } from '../../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../../shared/interfaces/form-field-config';
import {
  asArray,
  extractApiError,
  FeeCollectionType,
  formatInr,
  isDiscountCategory,
  normalizeClassAmounts,
  signedFeeAmount,
  normalizeClassSummary,
  normalizeInstallmentPreview,
  normalizeFeeStructureVersion,
  versionStatusBadgeClass,
} from '../fees.shared';

type AmountEdits = {
  amount: number;
  periodAmounts: Record<number, number>;
};

@Component({
  selector: 'app-class-fee-amounts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSnackBarModule,
    ListPageHeaderComponent,
    PageToolbarComponent,
    DynamicFieldComponent,
  ],
  templateUrl: './class-fee-amounts.component.html',
  styleUrl: '../fees.shared.css',
})
export class ClassFeeAmountsComponent implements OnInit, OnDestroy {
  private readonly service = inject(ClassFeeAmountService);
  private readonly feeStructureService = inject(FeeStructureService);
  private readonly ayContext = inject(AcademicYearContextService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly fb = inject(FormBuilder);
  private readonly subs = new Subscription();

  readonly FeeCollectionType = FeeCollectionType;

  versions: ReturnType<typeof normalizeFeeStructureVersion>[] = [];
  classes: ReturnType<typeof normalizeClassSummary>[] = [];
  selectedClassId = '';
  amountData: ReturnType<typeof normalizeClassAmounts> | null = null;
  amountEdits: Record<string, AmountEdits> = {};
  saving = false;
  loading = false;
  loadingVersions = false;
  installmentPreview: ReturnType<typeof normalizeInstallmentPreview>[] = [];
  showInstallmentPreview = false;
  loadingInstallments = false;

  readonly filterForm = this.fb.group({
    feeStructureId: [''],
  });

  versionConfig: FormFieldConfig = {
    type: 'select',
    controlName: 'feeStructureId',
    label: 'Fee structure',
    placeholder: 'Select fee structure',
    options: [],
    disabled: true,
  };

  get academicYearId(): string {
    return this.ayContext.effectiveYearId() ?? '';
  }

  get feeStructureId(): string {
    return String(this.filterForm.get('feeStructureId')?.value ?? '');
  }

  ngOnInit(): void {
    this.subs.add(
      this.filterForm
        .get('feeStructureId')!
        .valueChanges.subscribe(() => this.onVersionChange()),
    );

    this.loadVersions();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /** Draft/Published: always edit all classes. Active: only classes without saved amounts. */
  get canEditAmounts(): boolean {
    if (this.ayContext.isReadOnlyScope()) return false;
    if (!this.amountData) return false;
    const status = this.amountData.versionStatusLabel;
    if (status === 'Draft' || status === 'Published') return true;
    return this.amountData.isEditable;
  }

  get isDraftOrPublished(): boolean {
    const s = this.amountData?.versionStatusLabel;
    return s === 'Draft' || s === 'Published';
  }

  onVersionChange(): void {
    this.selectedClassId = '';
    this.amountData = null;
    this.loadClasses();
  }

  loadVersions(): void {
    this.loadingVersions = true;
    this.syncVersionConfig([], true);
    this.refreshView();
    this.feeStructureService.getVersions().subscribe({
      next: (list) => {
        this.versions = asArray(list).map(normalizeFeeStructureVersion);
        const draft = this.versions.find((v) => v.statusLabel === 'Draft');
        const published = this.versions.find((v) => v.statusLabel === 'Published');
        const active = this.versions.find((v) => v.statusLabel === 'Active');
        const nextVersionId =
          draft?.id || published?.id || active?.id || this.versions[0]?.id || '';
        this.syncVersionConfig(this.versions, !this.versions.length);
        this.filterForm.patchValue(
          { feeStructureId: nextVersionId },
          { emitEvent: false },
        );
        this.loadingVersions = false;
        this.loadClasses();
        this.refreshView();
      },
      error: () => {
        this.loadingVersions = false;
        this.versions = [];
        this.syncVersionConfig([], true);
        this.toast('Failed to load fee structure versions', true);
        this.refreshView();
      },
    });
  }

  private syncVersionConfig(
    versions: ReturnType<typeof normalizeFeeStructureVersion>[],
    disabled: boolean,
  ): void {
    this.versionConfig = {
      ...this.versionConfig,
      disabled,
      options: versions.map((v) => ({
        label: `${v.versionLabel} — ${v.statusLabel}`,
        value: v.id,
      })),
    };
    const control = this.filterForm.get('feeStructureId');
    if (disabled) {
      control?.disable({ emitEvent: false });
    } else {
      control?.enable({ emitEvent: false });
    }
  }

  get selectedVersion(): ReturnType<typeof normalizeFeeStructureVersion> | undefined {
    return this.versions.find((v) => v.id === this.feeStructureId);
  }

  loadClasses(): void {
    if (!this.academicYearId || !this.feeStructureId) return;
    const keepSelection = this.selectedClassId;
    this.service.getClassSummaries(this.academicYearId, this.feeStructureId).subscribe({
      next: (list) => {
        this.classes = asArray(list).map(normalizeClassSummary);
        if (keepSelection && this.classes.some((c) => c.classId === keepSelection)) {
          this.loadAmounts(keepSelection);
        } else if (this.classes.length) {
          this.selectClass(this.classes[0].classId);
        } else {
          this.selectedClassId = '';
          this.amountData = null;
        }
        this.refreshView();
      },
      error: () => {
        this.toast('Failed to load classes', true);
        this.refreshView();
      },
    });
  }

  selectClass(classId: string): void {
    this.selectedClassId = classId;
    this.showInstallmentPreview = false;
    this.installmentPreview = [];
    this.loadAmounts(classId);
  }

  toggleInstallmentPreview(): void {
    this.showInstallmentPreview = !this.showInstallmentPreview;
    if (this.showInstallmentPreview && !this.installmentPreview.length) {
      this.loadInstallmentPreview();
    }
    this.refreshView();
  }

  loadInstallmentPreview(): void {
    if (!this.selectedClassId || !this.academicYearId || !this.feeStructureId) return;
    this.loadingInstallments = true;
    this.refreshView();
    this.service
      .getInstallmentPreview(this.selectedClassId, this.academicYearId, this.feeStructureId)
      .subscribe({
        next: (list) => {
          this.installmentPreview = asArray(list).map(normalizeInstallmentPreview);
          this.loadingInstallments = false;
          this.refreshView();
        },
        error: () => {
          this.loadingInstallments = false;
          this.installmentPreview = [];
          this.toast('Failed to load installment preview', true);
          this.refreshView();
        },
      });
  }

  loadAmounts(classId: string = this.selectedClassId): void {
    if (!classId || !this.academicYearId || !this.feeStructureId) return;
    this.loading = true;
    this.refreshView();

    this.service.getClassAmounts(classId, this.academicYearId, this.feeStructureId).subscribe({
      next: (data) => {
        if (classId !== this.selectedClassId) return;
        this.amountData = normalizeClassAmounts(data);
        this.amountEdits = {};
        this.amountData.items.forEach((i) => {
          this.amountEdits[i.feeHeadId] = {
            amount: i.amount ?? 0,
            periodAmounts: Object.fromEntries(
              this.amountData!.periods.map((period) => [
                period.periodIndex,
                i.periodAmounts.find((value) => value.periodIndex === period.periodIndex)?.amount ?? 0,
              ]),
            ),
          };
        });
        this.loading = false;
        this.syncClassSummaryTotal(classId);
        this.refreshView();
      },
      error: () => {
        if (classId !== this.selectedClassId) return;
        this.loading = false;
        this.toast('Failed to load amounts', true);
        this.refreshView();
      },
    });
  }

  get hasPeriodWiseHeads(): boolean {
    return this.amountData?.items.some((i) => this.isPeriodWise(i.collectionType)) ?? false;
  }

  get totalAmount(): number {
    if (!this.amountData) return 0;
    return this.amountData.items.reduce(
      (sum, item) =>
        sum +
        signedFeeAmount(
          item.category,
          this.annualTotalFor(item.feeHeadId, item.collectionType),
          item.categoryLabel,
        ),
      0,
    );
  }

  amountEditFor(feeHeadId: string): AmountEdits {
    if (!this.amountEdits[feeHeadId]) {
      this.amountEdits[feeHeadId] = { amount: 0, periodAmounts: {} };
    }
    return this.amountEdits[feeHeadId];
  }

  isPeriodWise(collectionType: number): boolean {
    return collectionType === FeeCollectionType.PeriodWise;
  }

  isOneTime(collectionType: number): boolean {
    return collectionType === FeeCollectionType.OneTime;
  }

  annualTotalFor(feeHeadId: string, collectionType: number): number {
    const edits = this.amountEdits[feeHeadId];
    if (!edits) return 0;
    const item = this.amountData?.items.find((i) => i.feeHeadId === feeHeadId);
    let annual = 0;
    if (collectionType === FeeCollectionType.PeriodWise) {
      annual = Object.values(edits.periodAmounts).reduce(
        (sum, amount) => sum + (Number(amount) || 0),
        0,
      );
    } else {
      annual = Number(edits.amount) || 0;
    }
    return item ? signedFeeAmount(item.category, annual, item.categoryLabel) : annual;
  }

  isDiscountItem(item: { category: number; categoryLabel: string }): boolean {
    return isDiscountCategory(item.category, item.categoryLabel);
  }

  onOneTimeAmountChange(): void {
    this.syncClassSummaryTotal(this.selectedClassId);
    this.refreshView();
  }

  onPeriodAmountChange(feeHeadId: string): void {
    const edits = this.amountEdits[feeHeadId];
    if (edits) {
      edits.amount = Object.values(edits.periodAmounts).reduce(
        (sum, amount) => sum + (Number(amount) || 0),
        0,
      );
    }
    this.syncClassSummaryTotal(this.selectedClassId);
    this.refreshView();
  }

  classListTotal(classId: string, apiTotal: number): number {
    if (classId === this.selectedClassId && this.amountData) {
      return this.totalAmount;
    }
    return apiTotal;
  }

  private syncClassSummaryTotal(classId: string): void {
    const idx = this.classes.findIndex((c) => c.classId === classId);
    if (idx < 0 || !this.amountData) {
      return;
    }
    this.classes[idx] = { ...this.classes[idx], totalAmount: this.totalAmount };
  }

  saveAmounts(): void {
    if (!this.selectedClassId || !this.canEditAmounts || this.saving || this.loading) return;
    if (this.hasPeriodWiseHeads && !this.amountData?.periods.length) {
      this.toast('Configure Academic Periods for this class before saving amounts', true);
      return;
    }
    const amounts = Object.entries(this.amountEdits).map(([feeHeadId, edits]) => ({
      feeHeadId,
      amount: Number(edits.amount) || 0,
      periodAmounts: this.isPeriodWise(
        this.amountData?.items.find((item) => item.feeHeadId === feeHeadId)?.collectionType ?? FeeCollectionType.OneTime,
      )
        ? Object.entries(edits.periodAmounts).map(([periodIndex, amount]) => ({
            periodIndex: Number(periodIndex),
            amount: Number(amount) || 0,
          }))
        : [],
    }));
    this.saving = true;
    this.refreshView();
    const classId = this.selectedClassId;
    this.service
      .saveClassAmounts(classId, {
        academicYearId: this.academicYearId,
        feeStructureId: this.feeStructureId,
        amounts,
      })
      .subscribe({
        next: (data) => {
          if (classId !== this.selectedClassId) return;
          this.amountData = normalizeClassAmounts(data);
          this.amountData.items.forEach((i) => {
            this.amountEdits[i.feeHeadId] = {
              amount: i.amount ?? 0,
              periodAmounts: Object.fromEntries(
                this.amountData!.periods.map((period) => [
                  period.periodIndex,
                  i.periodAmounts.find((value) => value.periodIndex === period.periodIndex)?.amount ?? 0,
                ]),
              ),
            };
          });
          this.saving = false;
          this.showInstallmentPreview = false;
          this.installmentPreview = [];
          this.loadClasses();
          this.toast('Amounts saved');
          this.refreshView();
        },
        error: (e) => {
          if (classId !== this.selectedClassId) return;
          this.saving = false;
          this.toast(extractApiError(e, 'Save failed'), true);
          this.refreshView();
        },
      });
  }

  formatInr = formatInr;
  versionStatusClass = versionStatusBadgeClass;

  private refreshView(): void {
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  private toast(msg: string, error = false): void {
    this.snackBar.open(msg, 'Close', { duration: 2800, panelClass: error ? 'snack-error' : 'snack-success' });
  }
}
