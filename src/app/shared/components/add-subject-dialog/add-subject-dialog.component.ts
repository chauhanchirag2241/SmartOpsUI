import { Component, ViewChild, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AddSubjectComponent } from '../../../features/subjects/add-subject/add-subject.component';
import { ErpDialogShellComponent } from '../erp-dialog-shell/erp-dialog-shell.component';
import { ERP_FORM_DIALOG_WIDTH } from '../../constants/dialog.constants';

export interface AddSubjectDialogData {
  mode: 'add' | 'edit' | 'view';
  classGroupId: string;
  subjectId?: string;
}

@Component({
  selector: 'app-add-subject-dialog',
  standalone: true,
  imports: [ErpDialogShellComponent, AddSubjectComponent],
  template: `
    <app-erp-dialog-shell
      [title]="title"
      [subtitle]="'Subject will be linked to this class'"
      [width]="dialogWidth"
      [showSave]="data.mode !== 'view'"
      [saveLabel]="data.mode === 'edit' ? 'Update subject' : 'Save subject'"
      savingLabel="Saving subject..."
      [saving]="saving"
      (cancel)="ref.close(false)"
      (save)="onSave()"
    >
      <app-add-subject
        #subjectComp
        [mode]="data.mode"
        [subjectId]="data.subjectId"
        [classGroupId]="data.classGroupId"
        [embeddedInDialog]="true"
        (cancel)="ref.close(false)"
        (saved)="ref.close(true)"
        (busyChange)="saving = $event"
      />
    </app-erp-dialog-shell>
  `,
})
export class AddSubjectDialogComponent {
  readonly data = inject<AddSubjectDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AddSubjectDialogComponent, boolean>);
  readonly dialogWidth = ERP_FORM_DIALOG_WIDTH;

  @ViewChild('subjectComp') subjectComp!: AddSubjectComponent;
  saving = false;

  get title(): string {
    if (this.data.mode === 'edit') return 'Edit subject';
    if (this.data.mode === 'view') return 'View subject';
    return 'Add subject';
  }

  onSave(): void {
    this.subjectComp?.saveSubject();
  }
}
