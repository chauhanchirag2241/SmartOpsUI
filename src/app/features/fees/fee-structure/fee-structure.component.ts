import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FeeStructureService } from '../../../core/services/fee-structure.service';
import {
  FEE_CATEGORY_OPTIONS,
  FEE_FREQUENCY_OPTIONS,
  asArray,
  categoryBadgeClass,
  frequencyBadgeClass,
  FeeCategory,
  FeeFrequency,
  normalizeFeeStats,
  normalizeFeeType,
} from '../fees.shared';

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
  templateUrl: './fee-structure.component.html',
  styleUrl: '../fees.shared.css',
})
export class FeeStructureComponent implements OnInit {
  private readonly service = inject(FeeStructureService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  feeTypes: ReturnType<typeof normalizeFeeType>[] = [];
  stats = { feeTypeCount: 0, classesConfigured: 0, paymentCycleLabel: '—', lateFeePerDay: 0 };
  loading = true;

  showModal = false;
  categoryOptions = FEE_CATEGORY_OPTIONS;
  frequencyOptions = FEE_FREQUENCY_OPTIONS;
  form = {
    name: '',
    category: FeeCategory.Academic,
    frequency: FeeFrequency.Quarterly,
    isMandatory: true,
    isRefundable: false,
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.refreshView();

    this.service.getFeeTypes().subscribe({
      next: (types) => {
        this.feeTypes = asArray(types).map(normalizeFeeType);
        this.loading = false;
        this.refreshView();
      },
      error: () => {
        this.loading = false;
        this.feeTypes = [];
        this.toast('Failed to load fee types', true);
        this.refreshView();
      },
    });

    this.service.getStats().subscribe({
      next: (s) => {
        this.stats = normalizeFeeStats(s);
        this.refreshView();
      },
    });
  }

  openAdd(): void {
    this.form = {
      name: '',
      category: FeeCategory.Academic,
      frequency: FeeFrequency.Quarterly,
      isMandatory: true,
      isRefundable: false,
    };
    this.showModal = true;
    this.refreshView();
  }

  closeModal(): void {
    this.showModal = false;
    this.refreshView();
  }

  saveFeeType(): void {
    if (!this.form.name.trim()) {
      this.toast('Fee type name is required', true);
      return;
    }
    this.service.createFeeType(this.form).subscribe({
      next: () => {
        this.closeModal();
        this.load();
        this.toast(`"${this.form.name}" added`);
      },
      error: (e) => this.toast(e?.error ?? 'Failed to add fee type', true),
    });
  }

  toggleActive(item: ReturnType<typeof normalizeFeeType>, checked: boolean): void {
    this.service.setActive(item.id, checked).subscribe({
      next: () => {
        item.isActive = checked;
        this.refreshView();
      },
      error: () => this.toast('Failed to update status', true),
    });
  }

  deleteType(item: ReturnType<typeof normalizeFeeType>): void {
    if (!confirm(`Delete "${item.name}"?`)) return;
    this.service.deleteFeeType(item.id).subscribe({
      next: () => {
        this.load();
        this.toast('Fee type deleted');
      },
      error: (e) => this.toast(e?.error ?? 'Delete failed', true),
    });
  }

  catClass(c: string): string {
    return categoryBadgeClass(c);
  }

  freqClass(f: string): string {
    return frequencyBadgeClass(f);
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
