import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import {
  AcademicPeriodClassSummary,
  AcademicPeriodService,
} from '../../core/services/academic-period.service';
import { NotificationService } from '../../core/services/notification.service';
import { PermissionService } from '../../core/services/permission.service';
import { MenuCodes } from '../../core/constants/menu-codes';
import { ListPageHeaderComponent } from '../../shared/components/list-page-header/list-page-header.component';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';
import { DynamicFieldComponent } from '../../shared/form-controls/dynamic-field/dynamic-field.component';
import { FormFieldConfig } from '../../shared/interfaces/form-field-config';

@Component({
  selector: 'app-academic-period-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    ListPageHeaderComponent,
    ActionButtonComponent,
    DynamicFieldComponent,
  ],
  templateUrl: './academic-period-management.component.html',
  styleUrl: './academic-period-management.component.css',
})
export class AcademicPeriodManagementComponent implements OnInit {
  private readonly periodService = inject(AcademicPeriodService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);

  classes: AcademicPeriodClassSummary[] = [];
  selectedClassId = '';
  loading = false;
  saving = false;
  errorMessage = '';

  readonly editorForm = this.fb.group({
    periods: this.fb.array<FormGroup>([]),
  });

  readonly periodNameConfig: FormFieldConfig = {
    type: 'input',
    controlName: 'name',
    label: '',
    placeholder: 'Period 1',
  };

  get canEdit(): boolean {
    return this.permissionService.canEdit(MenuCodes.AcademicPeriods);
  }

  get selectedClass(): AcademicPeriodClassSummary | undefined {
    return this.classes.find((item) => item.classId === this.selectedClassId);
  }

  get periodsArray(): FormArray<FormGroup> {
    return this.editorForm.get('periods') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.loadClasses();
  }

  loadClasses(keepClassId = ''): void {
    this.loading = true;
    this.periodService.getClasses()
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (classes) => {
          this.classes = classes ?? [];
          const nextClassId =
            (keepClassId && this.classes.some((item) => item.classId === keepClassId)
              ? keepClassId
              : this.classes[0]?.classId) ?? '';
          if (nextClassId) this.selectClass(nextClassId);
        },
        error: () => this.showError('Failed to load classes'),
      });
  }

  selectClass(classId: string): void {
    this.selectedClassId = classId;
    this.errorMessage = '';
    this.loading = true;
    this.periodService.getClassSetup(classId)
      .pipe(finalize(() => {
        this.loading = false;
        this.syncEditorDisabledState();
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (setup) => {
          this.periodsArray.clear();
          const rows = setup.periods ?? [];
          if (rows.length) {
            rows.forEach((period) => {
              this.periodsArray.push(this.createPeriodGroup(period.name));
            });
          } else if (this.canEdit) {
            this.addPeriod();
          }
        },
        error: () => this.showError('Failed to load academic periods'),
      });
  }

  addPeriod(): void {
    const periodIndex = this.periodsArray.length + 1;
    this.periodsArray.push(this.createPeriodGroup(`Period ${periodIndex}`));
  }

  removePeriod(index: number): void {
    this.periodsArray.removeAt(index);
  }

  movePeriod(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.periodsArray.length) return;
    const current = this.periodsArray.at(index);
    this.periodsArray.removeAt(index);
    this.periodsArray.insert(target, current);
  }

  save(): void {
    if (!this.selectedClassId || !this.canEdit || this.saving) return;
    const error = this.validate();
    if (error) {
      this.errorMessage = error;
      this.showError(error);
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const rows = this.periodsArray.getRawValue();
    this.periodService.saveClassSetup(this.selectedClassId, {
      periods: rows.map((period, index) => ({
        periodIndex: index + 1,
        name: String(period['name'] ?? '').trim(),
      })),
    })
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.notification.open('Academic periods saved successfully', 'Close', {
            duration: 3000,
            panelClass: 'snack-success',
          });
          this.loadClasses(this.selectedClassId);
        },
        error: (error) => this.showError(
          error?.error?.message
          || (typeof error?.error === 'string' ? error.error : 'Failed to save academic periods'),
        ),
      });
  }

  private createPeriodGroup(name: string): FormGroup {
    return this.fb.group({
      name: [name, Validators.required],
    });
  }

  private syncEditorDisabledState(): void {
    if (this.canEdit) {
      this.editorForm.enable({ emitEvent: false });
    } else {
      this.editorForm.disable({ emitEvent: false });
    }
  }

  private validate(): string | null {
    if (!this.periodsArray.length) return 'Add at least one academic period';
    const names = this.periodsArray.getRawValue().map((period) =>
      String(period['name'] ?? '').trim());
    if (names.some((name) => !name)) return 'Fill all period names';
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
      return 'Period names must be unique';
    }
    return null;
  }

  private showError(message: string): void {
    this.notification.open(message, 'Close', { duration: 4000, panelClass: 'snack-error' });
    this.cdr.detectChanges();
  }
}
