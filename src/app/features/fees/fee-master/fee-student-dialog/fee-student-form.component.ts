import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  FeeMasterService,
  FeeStudentHeadAmountDto,
} from '../../../../core/services/fee-master.service';
import { StudentService } from '../../../../core/services/student.service';
import { ClassService } from '../../../../core/services/class.service';
import { StudentFilter } from '../../../../shared/enums/table-filters.enum';
import { getUserFacingApiError } from '../../../../shared/utils/api-error.util';
import { FeeApplicableTo } from '../../../../shared/enums/field-options.enum';
import { MultiSelectChipsComponent } from '../../../../shared/components/multi-select-chips/multi-select-chips.component';
import { MappingOption } from '../../../../shared/mapping/mapping.types';

interface StagedStudent {
  id: string;
  name: string;
  classLabel: string;
  amounts: Record<string, number | null>;
}

@Component({
  selector: 'app-fee-student-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MultiSelectChipsComponent],
  templateUrl: './fee-student-form.component.html',
  styleUrl: './fee-student-form.component.css',
})
export class FeeStudentFormComponent implements OnInit {
  @Input() mode: 'add' | 'edit' = 'add';
  @Input({ required: true }) feeMasterId!: string;
  @Input() studentId?: string;
  @Input() applicableTo = '';
  @Output() saved = new EventEmitter<void>();
  @Output() busyChange = new EventEmitter<boolean>();

  private readonly fb = inject(FormBuilder);
  private readonly feeMasterService = inject(FeeMasterService);
  private readonly studentService = inject(StudentService);
  private readonly classService = inject(ClassService);
  private readonly snackBar = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  classGroupOptions: MappingOption[] = [];
  selectedClassGroupIds: string[] = [];
  studentOptions: MappingOption[] = [];
  pendingStudentIds: string[] = [];
  sectionClassIds: string[] = [];
  alreadyAssignedIds = new Set<string>();

  heads: FeeStudentHeadAmountDto[] = [];
  staged: StagedStudent[] = [];

  form: FormGroup = this.fb.group({});
  studentName = '';

  get studentInitial(): string {
    return (this.studentName || 'S').trim().charAt(0).toUpperCase() || 'S';
  }

  get isStudentWise(): boolean {
    return (
      this.applicableTo === FeeApplicableTo.StudentWise || this.applicableTo === 'StudentWise'
    );
  }

  isExcluded(feeHeadId: string): boolean {
    return !!this.form.get(`ex_${feeHeadId}`)?.value;
  }

  toggleExcluded(feeHeadId: string): void {
    const ctrl = this.form.get(`ex_${feeHeadId}`);
    if (!ctrl) return;
    ctrl.setValue(!ctrl.value);
  }

  ngOnInit(): void {
    if (this.mode === 'add') {
      this.loadAddContext();
    } else if (this.studentId) {
      this.loadStudentDetail(this.studentId);
    }
  }

  onClassGroupIdsChange(ids: string[]): void {
    this.selectedClassGroupIds = ids;
    this.pendingStudentIds = [];
    this.studentOptions = [];
    if (!ids.length) {
      this.sectionClassIds = [];
      this.cdr.detectChanges();
      return;
    }

    forkJoin(
      ids.map((gid) =>
        this.classService.getClasses(1, 500, '', null, null, 'Active', gid).pipe(
          catchError(() => of({ items: [] })),
        ),
      ),
    ).subscribe({
      next: (pages) => {
        this.sectionClassIds = pages.flatMap((p: any) =>
          (p?.items || []).map((c: any) => String(c.id)),
        );
        this.reloadStudentOptions();
      },
    });
  }

  onPendingStudentIdsChange(ids: string[]): void {
    this.pendingStudentIds = ids;
  }

  addPendingStudents(): void {
    if (!this.pendingStudentIds.length) {
      this.snackBar.open('Select at least one student', 'Close', {
        duration: 2500,
        panelClass: 'snack-error',
      });
      return;
    }

    const stagedIds = new Set(this.staged.map((s) => s.id));
    const toAdd = this.pendingStudentIds.filter((id) => !stagedIds.has(id));
    if (!toAdd.length) {
      this.pendingStudentIds = [];
      return;
    }

    for (const id of toAdd) {
      const opt = this.studentOptions.find((o) => o.id === id);
      const amounts: Record<string, number | null> = {};
      for (const h of this.heads) {
        amounts[h.feeHeadId] = h.amount ?? h.defaultAmount ?? null;
      }
      this.staged.push({
        id,
        name: opt?.name?.split(' · ')[0] || 'Student',
        classLabel: opt?.name?.includes(' · ') ? opt.name.split(' · ').slice(1).join(' · ') : '',
        amounts,
      });
    }

    this.pendingStudentIds = [];
    this.reloadStudentOptions();
    this.cdr.detectChanges();
  }

  removeStaged(studentId: string): void {
    this.staged = this.staged.filter((s) => s.id !== studentId);
    this.reloadStudentOptions();
    this.cdr.detectChanges();
  }

  setStagedAmount(studentId: string, feeHeadId: string, value: string): void {
    const row = this.staged.find((s) => s.id === studentId);
    if (!row) return;
    if (value === '' || value == null) {
      row.amounts[feeHeadId] = null;
      return;
    }
    const n = Number(value);
    row.amounts[feeHeadId] = Number.isFinite(n) ? n : null;
  }

  save(): void {
    if (this.mode === 'add') {
      this.saveStaged();
      return;
    }
    this.saveEdit();
  }

  private saveStaged(): void {
    if (!this.staged.length) {
      this.snackBar.open('Add at least one student to the list', 'Close', {
        duration: 3000,
        panelClass: 'snack-error',
      });
      return;
    }

    this.busyChange.emit(true);
    const calls = this.staged.map((s) =>
      this.feeMasterService.addFeeStudent(this.feeMasterId, {
        studentId: s.id,
        amounts: this.heads.map((h) => ({
          feeHeadId: h.feeHeadId,
          amount: s.amounts[h.feeHeadId] ?? null,
        })),
      }),
    );

    forkJoin(calls).subscribe({
      next: () => {
        this.busyChange.emit(false);
        this.snackBar.open(
          this.staged.length === 1 ? 'Student added' : `${this.staged.length} students added`,
          'Close',
          { duration: 3000, panelClass: 'snack-success' },
        );
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.busyChange.emit(false);
        this.snackBar.open(getUserFacingApiError(err, 'Failed to add students'), 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private saveEdit(): void {
    if (!this.studentId) return;

    const amounts = this.heads.map((h) => {
      const excluded = !!this.form.get(`ex_${h.feeHeadId}`)?.value;
      const amount = this.readAmount(h.feeHeadId);
      return {
        feeHeadId: h.feeHeadId,
        amount: excluded ? null : amount,
        isExcluded: !h.isMandatory ? excluded : false,
      };
    });

    this.busyChange.emit(true);
    this.feeMasterService.updateFeeStudent(this.feeMasterId, this.studentId, { amounts }).subscribe({
      next: () => {
        this.busyChange.emit(false);
        this.snackBar.open('Amounts updated', 'Close', {
          duration: 3000,
          panelClass: 'snack-success',
        });
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.busyChange.emit(false);
        this.snackBar.open(getUserFacingApiError(err, 'Failed to update'), 'Close', {
          duration: 3500,
          panelClass: 'snack-error',
        });
        this.cdr.detectChanges();
      },
    });
  }

  private readAmount(feeHeadId: string): number | null {
    const raw = this.form.get(`amt_${feeHeadId}`)?.value;
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  private loadAddContext(): void {
    forkJoin({
      fee: this.feeMasterService.getFee(this.feeMasterId),
      heads: this.feeMasterService.getFeeHeads(this.feeMasterId, 1, 200, '', null, null, 'Active'),
      assigned: this.feeMasterService
        .getFeeStudents(this.feeMasterId, 1, 500, '', null, null, null)
        .pipe(catchError(() => of({ items: [] }))),
      groups: this.classService.getClassDropdown(undefined, 'group').pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ fee, heads, assigned, groups }) => {
        const feeGroupIds = new Set(
          ((fee.classGroupIds ?? []) as unknown[]).map((x) => String(x)),
        );
        const allGroups = (groups || []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
        }));
        this.classGroupOptions = feeGroupIds.size
          ? allGroups.filter((g) => feeGroupIds.has(g.id))
          : allGroups;

        this.heads = (heads?.items || []).map((h: any) => ({
          feeHeadId: String(h.id),
          feeHeadName: String(h.feeHeadName ?? ''),
          isMandatory: !!h.isMandatory,
          isEditable: true,
          defaultAmount: h.amount,
          amount: h.amount,
          isExcluded: false,
          hasOverride: false,
        }));

        this.alreadyAssignedIds = new Set(
          (assigned?.items || []).map((s: any) => String(s.studentId ?? s.id)),
        );
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load fee students context', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private reloadStudentOptions(): void {
    if (!this.sectionClassIds.length) {
      this.studentOptions = [];
      this.cdr.detectChanges();
      return;
    }

    const exclude = new Set([...this.alreadyAssignedIds, ...this.staged.map((s) => s.id)]);
    this.studentService
      .getStudents(1, 300, '', null, null, StudentFilter.Active, this.sectionClassIds)
      .subscribe({
        next: (res: any) => {
          this.studentOptions = (res?.items || [])
            .map((s: any) => ({
              id: String(s.id),
              name: [String(s.name ?? ''), String(s.class ?? s.className ?? '')]
                .filter(Boolean)
                .join(' · '),
            }))
            .filter((o: MappingOption) => !exclude.has(o.id));
          this.pendingStudentIds = this.pendingStudentIds.filter((id) =>
            this.studentOptions.some((o) => o.id === id),
          );
          this.cdr.detectChanges();
        },
        error: () => {
          this.studentOptions = [];
          this.cdr.detectChanges();
        },
      });
  }

  private loadStudentDetail(studentId: string): void {
    this.feeMasterService.getFeeStudent(this.feeMasterId, studentId).subscribe({
      next: (detail) => {
        this.studentName = detail.studentName;
        this.heads = detail.heads || [];
        this.buildFormControls();
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load student fee details', 'Close', {
          duration: 3000,
          panelClass: 'snack-error',
        });
      },
    });
  }

  private buildFormControls(): void {
    const group: Record<string, FormControl> = {};
    for (const h of this.heads) {
      const editable = this.mode === 'add' || h.isEditable;
      group[`amt_${h.feeHeadId}`] = new FormControl({
        value: h.amount ?? h.defaultAmount ?? null,
        disabled: !editable,
      });
      if (!h.isMandatory && this.mode === 'edit') {
        group[`ex_${h.feeHeadId}`] = new FormControl(h.isExcluded);
      }
    }
    this.form = this.fb.group(group);
  }
}
