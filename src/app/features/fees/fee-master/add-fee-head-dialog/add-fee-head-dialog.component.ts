import { Component, ViewChild, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ErpDialogShellComponent } from '../../../../shared/components/erp-dialog-shell/erp-dialog-shell.component';
import { FEE_HEAD_DIALOG_WIDTH, FEE_DIALOG_MAX_HEIGHT } from '../../../../shared/constants/dialog.constants';
import { AddFeeHeadFormComponent } from './add-fee-head-form.component';

export interface AddFeeHeadDialogData {
  mode: 'add' | 'edit' | 'view';
  feeMasterId: string;
  feeHeadId?: string;
  feeType: string;
  applicableTo: string;
}

@Component({
  selector: 'app-add-fee-head-dialog',
  standalone: true,
  imports: [ErpDialogShellComponent, AddFeeHeadFormComponent],
  template: `
    <app-erp-dialog-shell
      [title]="title"
      [subtitle]="'Configure fee head for this fee master'"
      [width]="dialogWidth"
      [maxHeight]="dialogMaxHeight"
      [bodyScroll]="false"
      [showSave]="data.mode !== 'view'"
      [saveLabel]="data.mode === 'edit' ? 'Update fee head' : 'Save fee head'"
      savingLabel="Saving fee head..."
      [saving]="saving"
      (cancel)="ref.close(false)"
      (save)="onSave()"
    >
      <app-add-fee-head-form
        #formComp
        [mode]="data.mode"
        [feeMasterId]="data.feeMasterId"
        [feeHeadId]="data.feeHeadId"
        [feeType]="data.feeType"
        [applicableTo]="data.applicableTo"
        (saved)="ref.close(true)"
        (busyChange)="saving = $event"
      />
    </app-erp-dialog-shell>
  `,
})
export class AddFeeHeadDialogComponent {
  readonly data = inject<AddFeeHeadDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AddFeeHeadDialogComponent, boolean>);
  readonly dialogWidth = FEE_HEAD_DIALOG_WIDTH;
  readonly dialogMaxHeight = FEE_DIALOG_MAX_HEIGHT;

  @ViewChild('formComp') formComp!: AddFeeHeadFormComponent;
  saving = false;

  get title(): string {
    if (this.data.mode === 'edit') return 'Edit fee head';
    if (this.data.mode === 'view') return 'View fee head';
    return 'Add fee head';
  }

  onSave(): void {
    this.formComp?.save();
  }
}
