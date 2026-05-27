import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NotificationService } from '../../../core/services/notification.service';
import { ClassFeeAmountService } from '../../../core/services/class-fee-amount.service';
import { FeeStructureService } from '../../../core/services/fee-structure.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import { ListPageHeaderComponent } from '../../../shared/components/list-page-header/list-page-header.component';
import { PageToolbarComponent } from '../../../shared/components/page-toolbar/page-toolbar.component';
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
  normalizeDropdownItem,
  normalizeFeeStructureVersion,
  versionStatusBadgeClass,
} from '../fees.shared';

type AmountEdits = {
  amount: number;
  semester1Amount: number;
  semester2Amount: number;
};

@Component({
  selector: 'app-class-fee-amounts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, ListPageHeaderComponent, PageToolbarComponent],
  templateUrl: './class-fee-amounts.component.html',
  styleUrl: '../fees.shared.css',
})
export class ClassFeeAmountsComponent implements OnInit {
  private readonly service = inject(ClassFeeAmountService);
  private readonly feeStructureService = inject(FeeStructureService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  readonly FeeCollectionType = FeeCollectionType;

  academicYears: ReturnType<typeof normalizeDropdownItem>[] = [];
  versions: ReturnType<typeof normalizeFeeStructureVersion>[] = [];
  academicYearId = '';
  feeStructureVersionId = '';
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
  private initialAcademicYearId = '';

  ngOnInit(): void {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        this.academicYears = asArray(years).map(normalizeDropdownItem);
        const first = this.academicYears[0];
        if (first?.id) {
          this.academicYearId = first.id;
          this.initialAcademicYearId = first.id;
          this.loadVersions();
        }
        this.refreshView();
      },
      error: () => {
        this.toast('Failed to load academic years', true);
        this.refreshView();
      },
    });
  }

  /** Draft/Published: always edit all classes. Active: only classes without saved amounts. */
  get canEditAmounts(): boolean {
    if (!this.amountData) return false;
    const status = this.amountData.versionStatusLabel;
    if (status === 'Draft' || status === 'Published') return true;
    return this.amountData.isEditable;
  }

  get isDraftOrPublished(): boolean {
    const s = this.amountData?.versionStatusLabel;
    return s === 'Draft' || s === 'Published';
  }

  get toolbarFilterActive(): boolean {
    return !!this.initialAcademicYearId && this.academicYearId !== this.initialAcademicYearId;
  }

  onToolbarFiltersCleared(): void {
    if (!this.initialAcademicYearId) return;
    this.academicYearId = this.initialAcademicYearId;
    this.onYearChange();
  }

  onYearChange(): void {
    this.selectedClassId = '';
    this.amountData = null;
    this.feeStructureVersionId = '';
    this.loadVersions();
  }

  onVersionChange(): void {
    this.selectedClassId = '';
    this.amountData = null;
    this.loadClasses();
  }

  loadVersions(): void {
    if (!this.academicYearId) return;
    this.loadingVersions = true;
    this.refreshView();
    this.feeStructureService.getVersions(this.academicYearId).subscribe({
      next: (list) => {
        this.versions = asArray(list).map(normalizeFeeStructureVersion);
        const draft = this.versions.find((v) => v.statusLabel === 'Draft');
        const published = this.versions.find((v) => v.statusLabel === 'Published');
        const active = this.versions.find((v) => v.statusLabel === 'Active');
        this.feeStructureVersionId =
          draft?.id || published?.id || active?.id || this.versions[0]?.id || '';
        this.loadingVersions = false;
        this.loadClasses();
        this.refreshView();
      },
      error: () => {
        this.loadingVersions = false;
        this.versions = [];
        this.toast('Failed to load fee structure versions', true);
        this.refreshView();
      },
    });
  }

  get selectedVersion(): ReturnType<typeof normalizeFeeStructureVersion> | undefined {
    return this.versions.find((v) => v.id === this.feeStructureVersionId);
  }

  loadClasses(): void {
    if (!this.academicYearId || !this.feeStructureVersionId) return;
    const keepSelection = this.selectedClassId;
    this.service.getClassSummaries(this.academicYearId, this.feeStructureVersionId).subscribe({
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
    if (!this.selectedClassId || !this.academicYearId || !this.feeStructureVersionId) return;
    this.loadingInstallments = true;
    this.refreshView();
    this.service
      .getInstallmentPreview(this.selectedClassId, this.academicYearId, this.feeStructureVersionId)
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
    if (!classId || !this.academicYearId || !this.feeStructureVersionId) return;
    this.loading = true;
    this.refreshView();

    this.service.getClassAmounts(classId, this.academicYearId, this.feeStructureVersionId).subscribe({
      next: (data) => {
        if (classId !== this.selectedClassId) return;
        this.amountData = normalizeClassAmounts(data);
        this.amountEdits = {};
        this.amountData.items.forEach((i) => {
          this.amountEdits[i.feeTypeId] = {
            amount: i.amount ?? 0,
            semester1Amount: i.semester1Amount ?? 0,
            semester2Amount: i.semester2Amount ?? 0,
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

  get hasSemesterWiseHeads(): boolean {
    return this.amountData?.items.some((i) => this.isSemesterWise(i.collectionType)) ?? false;
  }

  get totalAmount(): number {
    if (!this.amountData) return 0;
    return this.amountData.items.reduce(
      (sum, item) =>
        sum +
        signedFeeAmount(
          item.category,
          this.annualTotalFor(item.feeTypeId, item.collectionType),
          item.categoryLabel,
        ),
      0,
    );
  }

  amountEditFor(feeTypeId: string): AmountEdits {
    if (!this.amountEdits[feeTypeId]) {
      this.amountEdits[feeTypeId] = { amount: 0, semester1Amount: 0, semester2Amount: 0 };
    }
    return this.amountEdits[feeTypeId];
  }

  isSemesterWise(collectionType: number): boolean {
    return collectionType === FeeCollectionType.SemesterWise;
  }

  isOneTime(collectionType: number): boolean {
    return collectionType === FeeCollectionType.OneTime;
  }

  annualTotalFor(feeTypeId: string, collectionType: number): number {
    const edits = this.amountEdits[feeTypeId];
    if (!edits) return 0;
    const item = this.amountData?.items.find((i) => i.feeTypeId === feeTypeId);
    let annual = 0;
    if (collectionType === FeeCollectionType.SemesterWise) {
      annual = (Number(edits.semester1Amount) || 0) + (Number(edits.semester2Amount) || 0);
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

  onSemesterAmountChange(feeTypeId: string): void {
    const edits = this.amountEdits[feeTypeId];
    if (edits) {
      edits.amount = (Number(edits.semester1Amount) || 0) + (Number(edits.semester2Amount) || 0);
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
    const amounts = Object.entries(this.amountEdits).map(([feeTypeId, edits]) => ({
      feeTypeId,
      amount: Number(edits.amount) || 0,
      semester1Amount: Number(edits.semester1Amount) || 0,
      semester2Amount: Number(edits.semester2Amount) || 0,
    }));
    this.saving = true;
    this.refreshView();
    const classId = this.selectedClassId;
    this.service
      .saveClassAmounts(classId, {
        academicYearId: this.academicYearId,
        feeStructureVersionId: this.feeStructureVersionId,
        amounts,
      })
      .subscribe({
        next: (data) => {
          if (classId !== this.selectedClassId) return;
          this.amountData = normalizeClassAmounts(data);
          this.amountData.items.forEach((i) => {
            this.amountEdits[i.feeTypeId] = {
              amount: i.amount ?? 0,
              semester1Amount: i.semester1Amount ?? 0,
              semester2Amount: i.semester2Amount ?? 0,
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
