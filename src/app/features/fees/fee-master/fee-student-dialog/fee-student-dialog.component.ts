import { Component, ViewChild, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ErpDialogShellComponent } from '../../../../shared/components/erp-dialog-shell/erp-dialog-shell.component';
import { FEE_STUDENT_DIALOG_WIDTH, FEE_DIALOG_MAX_HEIGHT } from '../../../../shared/constants/dialog.constants';
import { FeeStudentFormComponent } from './fee-student-form.component';

export interface FeeStudentDialogData {
  mode: 'add' | 'edit';
  feeMasterId: string;
  studentId?: string;
  applicableTo: string;
}

@Component({
  selector: 'app-fee-student-dialog',
  standalone: true,
  imports: [ErpDialogShellComponent, FeeStudentFormComponent],
  template: `
    <app-erp-dialog-shell
      [title]="title"
      [subtitle]="subtitle"
      [width]="dialogWidth"
      [maxHeight]="dialogMaxHeight"
      [bodyScroll]="false"
      [showSave]="true"
      [saveLabel]="data.mode === 'edit' ? 'Update' : 'Save students'"
      savingLabel="Saving..."
      [saving]="saving"
      (cancel)="ref.close(false)"
      (save)="onSave()"
    >
      <app-fee-student-form
        #formComp
        [mode]="data.mode"
        [feeMasterId]="data.feeMasterId"
        [studentId]="data.studentId"
        [applicableTo]="data.applicableTo"
        (saved)="ref.close(true)"
        (busyChange)="saving = $event"
      />
    </app-erp-dialog-shell>
  `,
})
export class FeeStudentDialogComponent {
  readonly data = inject<FeeStudentDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<FeeStudentDialogComponent, boolean>);
  readonly dialogWidth = FEE_STUDENT_DIALOG_WIDTH;
  readonly dialogMaxHeight = FEE_DIALOG_MAX_HEIGHT;

  @ViewChild('formComp') formComp!: FeeStudentFormComponent;
  saving = false;

  get title(): string {
    return this.data.mode === 'edit' ? 'Edit student amounts' : 'Add students';
  }

  get subtitle(): string {
    return this.data.mode === 'edit'
      ? 'Update amounts for editable fee heads (period-wise when applicable)'
      : 'Filter by class, select students, set amounts, then save';
  }

  onSave(): void {
    this.formComp?.save();
  }
}
