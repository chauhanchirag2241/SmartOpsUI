export type MappingPerspective = 'teacher' | 'subject' | 'class';

export interface MappingOption {
  id: string;
  name: string;
}

/** One row in the shared mapping grid editor. */
export interface MappingGridRow {
  rowKeyId: string;
  valueIds: string[];
  isClassTeacher?: boolean;
}

export interface MappingFlatRecord {
  classId: string;
  subjectId: string;
  employeeId: string;
  isClassTeacher?: boolean;
}

export interface TeacherMappingPayload {
  academicYearId?: string;
  classAssignments: {
    classId: string;
    subjectIds: string[];
    isClassTeacher: boolean;
  }[];
}

export interface SubjectMappingPayload {
  academicYearId?: string;
  rows: { classId: string; employeeIds: string[] }[];
}

export interface ClassMappingPayload {
  academicYearId?: string;
  classTeacherId?: string;
  rows: { subjectId: string; employeeIds: string[] }[];
}
