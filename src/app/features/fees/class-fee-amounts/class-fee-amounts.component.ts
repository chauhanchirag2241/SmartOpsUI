import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ClassFeeAmountService } from '../../../core/services/class-fee-amount.service';
import { FeeStructureService } from '../../../core/services/fee-structure.service';
import { AcademicYearService } from '../../../core/services/academic-year.service';
import {
  asArray,
  extractApiError,
  formatInr,
  normalizeClassAmounts,
  normalizeClassSummary,
  normalizeDropdownItem,
  normalizeFeeStructureVersion,
  versionStatusBadgeClass,
} from '../fees.shared';

@Component({
  selector: 'app-class-fee-amounts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './class-fee-amounts.component.html',
  styleUrl: '../fees.shared.css',
})
export class ClassFeeAmountsComponent implements OnInit {
  private readonly service = inject(ClassFeeAmountService);
  private readonly feeStructureService = inject(FeeStructureService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  academicYears: ReturnType<typeof normalizeDropdownItem>[] = [];
  versions: ReturnType<typeof normalizeFeeStructureVersion>[] = [];
  academicYearId = '';
  feeStructureVersionId = '';
  classes: ReturnType<typeof normalizeClassSummary>[] = [];
  selectedClassId = '';
  amountData: ReturnType<typeof normalizeClassAmounts> | null = null;
  amountEdits: Record<string, number> = {};
  private amountEditsSnapshot: Record<string, number> = {};
  isEditing = false;
  saving = false;
  loading = false;
  loadingVersions = false;

  ngOnInit(): void {
    this.academicYearService.getAcademicYearDropdown().subscribe({
      next: (years) => {
        this.academicYears = asArray(years).map(normalizeDropdownItem);
        const first = this.academicYears[0];
        if (first?.id) {
          this.academicYearId = first.id;
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

  onYearChange(): void {
    this.selectedClassId = '';
    this.amountData = null;
    this.feeStructureVersionId = '';
    this.isEditing = false;
    this.loadVersions();
  }

  onVersionChange(): void {
    this.selectedClassId = '';
    this.amountData = null;
    this.isEditing = false;
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
    this.service.getClassSummaries(this.academicYearId, this.feeStructureVersionId).subscribe({
      next: (list) => {
        this.classes = asArray(list).map(normalizeClassSummary);
        if (!this.selectedClassId && this.classes.length) {
          this.selectClass(this.classes[0].classId);
        } else if (this.selectedClassId) {
          this.loadAmounts();
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
    this.isEditing = false;
    this.loadAmounts();
  }

  startEdit(): void {
    if (!this.amountData?.isEditable || this.loading) return;
    this.amountEditsSnapshot = { ...this.amountEdits };
    this.isEditing = true;
    this.refreshView();
  }

  cancelEdit(): void {
    this.amountEdits = { ...this.amountEditsSnapshot };
    this.isEditing = false;
    this.refreshView();
  }

  loadAmounts(): void {
    if (!this.selectedClassId || !this.academicYearId || !this.feeStructureVersionId) return;
    this.loading = true;
    this.refreshView();

    this.service
      .getClassAmounts(this.selectedClassId, this.academicYearId, this.feeStructureVersionId)
      .subscribe({
        next: (data) => {
          this.amountData = normalizeClassAmounts(data);
          this.amountEdits = {};
          this.amountData.items.forEach((i) => {
            this.amountEdits[i.feeTypeId] = i.amount ?? 0;
          });
          this.amountEditsSnapshot = { ...this.amountEdits };
          this.isEditing = false;
          this.loading = false;
          this.refreshView();
        },
        error: () => {
          this.loading = false;
          this.toast('Failed to load amounts', true);
          this.refreshView();
        },
      });
  }

  get totalAmount(): number {
    return Object.values(this.amountEdits).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  saveAmounts(): void {
    if (!this.selectedClassId || !this.isEditing || this.saving || !this.amountData?.isEditable) return;
    const amounts = Object.entries(this.amountEdits).map(([feeTypeId, amount]) => ({
      feeTypeId,
      amount: Number(amount) || 0,
    }));
    this.saving = true;
    this.refreshView();
    this.service
      .saveClassAmounts(this.selectedClassId, {
        academicYearId: this.academicYearId,
        feeStructureVersionId: this.feeStructureVersionId,
        amounts,
      })
      .subscribe({
        next: (data) => {
          this.amountData = normalizeClassAmounts(data);
          this.amountData.items.forEach((i) => {
            this.amountEdits[i.feeTypeId] = i.amount ?? 0;
          });
          this.amountEditsSnapshot = { ...this.amountEdits };
          this.isEditing = false;
          this.saving = false;
          this.loadClasses();
          this.toast('Amounts saved');
          this.refreshView();
        },
        error: (e) => {
          this.saving = false;
          this.toast(extractApiError(e, 'Save failed'), true);
          this.refreshView();
        },
      });
  }

  amountFor(feeTypeId: string): number {
    return Number(this.amountEdits[feeTypeId]) || 0;
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
