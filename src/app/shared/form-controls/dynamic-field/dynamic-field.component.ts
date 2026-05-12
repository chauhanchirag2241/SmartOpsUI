import { Component, HostBinding, Input } from '@angular/core';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { FormGroup } from '@angular/forms';

import { DatepickerFieldComponent } from '../datepicker-field/datepicker-field.component';
import { InputFieldComponent } from '../input-field/input-field.component';
import { SelectFieldComponent } from '../select-field/select-field.component';
import { TextareaFieldComponent } from '../textarea-field/textarea-field.component';
import { FormFieldConfig } from '../../interfaces/form-field-config';

@Component({
  selector: 'app-dynamic-field',
  standalone: true,
  imports: [
    NgSwitch,
    NgSwitchCase,
    InputFieldComponent,
    DatepickerFieldComponent,
    SelectFieldComponent,
    TextareaFieldComponent,
  ],
  template: `
    <ng-container [ngSwitch]="config.type">
      <app-input-field
        *ngSwitchCase="'input'"
        [config]="config"
        [group]="group"
      ></app-input-field>

      <app-datepicker-field
        *ngSwitchCase="'datepicker'"
        [config]="config"
        [group]="group"
      ></app-datepicker-field>

      <app-select-field
        *ngSwitchCase="'select'"
        [config]="config"
        [group]="group"
      ></app-select-field>

      <app-textarea-field
        *ngSwitchCase="'textarea'"
        [config]="config"
        [group]="group"
      ></app-textarea-field>
    </ng-container>
  `,
})
export class DynamicFieldComponent {
  @Input({ required: true }) config!: FormFieldConfig;
  @Input({ required: true }) group!: FormGroup;
  @Input() full = false;

  @HostBinding('class.field') readonly fieldClass = true;

  @HostBinding('class.full')
  get fullClass(): boolean {
    return this.full;
  }
}
