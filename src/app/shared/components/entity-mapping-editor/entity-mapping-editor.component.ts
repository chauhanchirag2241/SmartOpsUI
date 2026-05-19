import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { MappingService } from '../../../core/services/mapping.service';
import { ClassService } from '../../../core/services/class.service';
import { SubjectService } from '../../../core/services/subject.service';
import { TeacherService } from '../../../core/services/teacher.service';
import { MappingOption, MappingPerspective } from '../../mapping/mapping.types';
import {
  classRowsToPayload,
  normalizeDropdownList,
  parseFlatRecords,
  parseTeacherAssignmentRows,
} from '../../mapping/mapping.util';

type BadgeSection = 'classes' | 'subjects' | 'teachers';

@Component({
  selector: 'app-entity-mapping-editor',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './entity-mapping-editor.component.html',
  styleUrl: './entity-mapping-editor.component.css',
})
export class EntityMappingEditorComponent implements OnInit, OnChanges {
  @Input() perspective!: MappingPerspective;
  @Input() entityId: string | null = null;
  @Input() readOnly = false;
  @Input() academicYearId?: string;
  @Input() entityDisplayName = '';

  lookupsReady = false;
  loadingMappings = false;
  loadError = '';

  classOptions: MappingOption[] = [];
  subjectOptions: MappingOption[] = [];
  teacherOptions: MappingOption[] = [];

  selectedClassIds = new Set<string>();
  selectedSubjectIds = new Set<string>();
  selectedTeacherIds = new Set<string>();
  classTeacherId = '';

  /** Teacher perspective: which class row is class teacher */
  classTeacherClassId = '';

  constructor(
    private mappingService: MappingService,
    private classService: ClassService,
    private subjectService: SubjectService,
    private teacherService: TeacherService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadLookups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entityId'] && this.entityId && this.lookupsReady) {
      this.loadMappings();
    }
    if (changes['academicYearId'] && this.entityId && this.lookupsReady && this.perspective === 'class') {
      this.loadMappings();
    }
  }

  get showClasses(): boolean {
    return this.perspective === 'teacher' || this.perspective === 'subject';
  }

  get showSubjects(): boolean {
    return this.perspective === 'teacher' || this.perspective === 'class';
  }

  get showTeachers(): boolean {
    return this.perspective === 'subject' || this.perspective === 'class';
  }

  get showClassTeacherPicker(): boolean {
    return false;
  }

  loadLookups(): void {
    this.lookupsReady = false;
    this.loadError = '';
    this.cdr.markForCheck();

    const requests: Record<string, Observable<unknown>> = {};

    if (this.showClasses) {
      requests['classes'] = this.classService.getClassDropdown().pipe(catchError(() => of([])));
    }
    if (this.showSubjects) {
      requests['subjects'] = this.subjectService.getSubjectDropdown().pipe(catchError(() => of([])));
    }
    if (this.showTeachers) {
      requests['teachers'] = this.teacherService.getClassTeacherDropdown().pipe(catchError(() => of([])));
    }

    if (Object.keys(requests).length === 0) {
      this.lookupsReady = true;
      this.cdr.markForCheck();
      return;
    }

    forkJoin(requests)
      .pipe(
        finalize(() => {
          this.lookupsReady = true;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          if ('classes' in result) {
            this.classOptions = normalizeDropdownList(result['classes']);
          }
          if ('subjects' in result) {
            this.subjectOptions = normalizeDropdownList(result['subjects']);
          }
          if ('teachers' in result) {
            this.teacherOptions = normalizeDropdownList(result['teachers']);
          }
          if (this.entityId) {
            this.loadMappings();
          }
        },
        error: () => {
          this.loadError = 'Failed to load mapping options';
        },
      });
  }

  loadMappings(): void {
    if (!this.entityId) return;
    this.loadingMappings = true;
    this.loadError = '';
    this.clearSelections();
    this.cdr.markForCheck();

    if (this.perspective === 'teacher') {
      this.mappingService.getByTeacher(this.entityId).subscribe({
        next: (data) => {
          const rows = parseTeacherAssignmentRows(data);
          for (const row of rows) {
            if (row.rowKeyId) this.selectedClassIds.add(row.rowKeyId);
            row.valueIds.forEach((id) => this.selectedSubjectIds.add(id));
            if (row.isClassTeacher) this.classTeacherClassId = row.rowKeyId;
          }
          this.finishMappingLoad();
        },
        error: () => this.onLoadError(),
      });
      return;
    }

    if (this.perspective === 'subject') {
      this.mappingService.getBySubject(this.entityId, this.academicYearId).subscribe({
        next: (data) => {
          for (const r of parseFlatRecords(data)) {
            if (r.classId) this.selectedClassIds.add(r.classId);
            if (r.teacherId) this.selectedTeacherIds.add(r.teacherId);
          }
          this.finishMappingLoad();
        },
        error: () => this.onLoadError(),
      });
      return;
    }

    this.mappingService.getByClass(this.entityId, this.academicYearId).subscribe({
      next: (data) => {
        const flat = parseFlatRecords(data);
        for (const r of flat) {
          if (r.subjectId) this.selectedSubjectIds.add(r.subjectId);
          if (r.teacherId) this.selectedTeacherIds.add(r.teacherId);
          if (r.isClassTeacher) this.classTeacherId = r.teacherId;
        }
        this.finishMappingLoad();
      },
      error: () => this.onLoadError(),
    });
  }

  private finishMappingLoad(): void {
    this.selectedClassIds = new Set(this.selectedClassIds);
    this.selectedSubjectIds = new Set(this.selectedSubjectIds);
    this.selectedTeacherIds = new Set(this.selectedTeacherIds);
    this.loadingMappings = false;
    this.cdr.markForCheck();
  }

  private onLoadError(): void {
    this.loadError = 'Failed to load saved mappings';
    this.loadingMappings = false;
    this.cdr.markForCheck();
  }

  onClassTeacherIdChange(teacherId: string): void {
    this.classTeacherId = teacherId || '';
  }

  private clearSelections(): void {
    this.selectedClassIds = new Set();
    this.selectedSubjectIds = new Set();
    this.selectedTeacherIds = new Set();
    this.classTeacherId = '';
    this.classTeacherClassId = '';
  }

  isSelected(section: BadgeSection, id: string): boolean {
    switch (section) {
      case 'classes':
        return this.selectedClassIds.has(id);
      case 'subjects':
        return this.selectedSubjectIds.has(id);
      case 'teachers':
        return this.selectedTeacherIds.has(id);
    }
  }

  toggle(section: BadgeSection, id: string): void {
    if (this.readOnly || !id) return;
    const set =
      section === 'classes'
        ? this.selectedClassIds
        : section === 'subjects'
          ? this.selectedSubjectIds
          : this.selectedTeacherIds;

    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }

    if (section === 'classes') this.selectedClassIds = new Set(this.selectedClassIds);
    if (section === 'subjects') this.selectedSubjectIds = new Set(this.selectedSubjectIds);
    if (section === 'teachers') this.selectedTeacherIds = new Set(this.selectedTeacherIds);
    this.cdr.markForCheck();
  }

  toggleClassTeacherForClass(classId: string): void {
    if (this.readOnly) return;
    this.classTeacherClassId = this.classTeacherClassId === classId ? '' : classId;
    this.cdr.markForCheck();
  }

  isClassTeacherClass(classId: string): boolean {
    return this.classTeacherClassId === classId;
  }

  save(entityId: string): Observable<void> {
    if (this.perspective === 'teacher') {
      const classAssignments = [...this.selectedClassIds].map((classId) => ({
        classId,
        subjectIds: [...this.selectedSubjectIds],
        isClassTeacher: this.classTeacherClassId === classId,
      }));
      return this.mappingService.saveTeacherMappings(entityId, {
        academicYearId: this.academicYearId,
        classAssignments,
      });
    }

    if (this.perspective === 'subject') {
      const rows = [...this.selectedClassIds].map((classId) => ({
        classId,
        teacherIds: [...this.selectedTeacherIds],
      }));
      return this.mappingService.saveSubjectMappings(entityId, {
        academicYearId: this.academicYearId,
        rows,
      });
    }

    const gridRows = [...this.selectedSubjectIds].map((subjectId) => ({
      rowKeyId: subjectId,
      valueIds: [...this.selectedTeacherIds],
    }));
    return this.mappingService.saveClassMappings(
      entityId,
      classRowsToPayload(gridRows, this.classTeacherId || undefined, this.academicYearId)
    );
  }

  onClassTeacherChange(teacherId: string): void {
    this.classTeacherId = teacherId;
  }
}
