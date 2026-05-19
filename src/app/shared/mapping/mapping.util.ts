import {
  ClassMappingPayload,
  MappingFlatRecord,
  MappingGridRow,
  MappingOption,
  MappingPerspective,
  SubjectMappingPayload,
  TeacherMappingPayload,
} from './mapping.types';

/** Normalize API dropdown payloads (array, paged wrapper, or PascalCase fields). */
export function normalizeDropdownList(data: unknown): MappingOption[] {
  let list: unknown[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested = obj['items'] ?? obj['Items'] ?? obj['data'] ?? obj['Data'] ?? obj['results'] ?? obj['Results'];
    if (Array.isArray(nested)) {
      list = nested;
    }
  }

  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = row['id'] ?? row['Id'];
      if (id == null || id === '') return null;
      const name =
        row['name'] ??
        row['Name'] ??
        row['subjectName'] ??
        row['SubjectName'] ??
        row['label'] ??
        row['Label'];
      const first = row['firstName'] ?? row['FirstName'] ?? '';
      const last = row['lastName'] ?? row['LastName'] ?? '';
      const fullName = `${first} ${last}`.trim();
      return {
        id: String(id),
        name: String(name ?? fullName ?? row['employeeId'] ?? row['EmployeeId'] ?? 'Item'),
      };
    })
    .filter((x): x is MappingOption => x != null);
}

/** Flat API rows → grid rows for the active perspective. */
export function flatToGridRows(
  perspective: MappingPerspective,
  records: MappingFlatRecord[]
): MappingGridRow[] {
  if (perspective === 'teacher') {
    const byClass = new Map<string, MappingGridRow>();
    for (const r of records) {
      if (!r.classId) continue;
      let row = byClass.get(r.classId);
      if (!row) {
        row = { rowKeyId: r.classId, valueIds: [], isClassTeacher: false };
        byClass.set(r.classId, row);
      }
      if (r.subjectId && !row.valueIds.includes(r.subjectId)) {
        row.valueIds.push(r.subjectId);
      }
      if (r.isClassTeacher) {
        row.isClassTeacher = true;
      }
    }
    return [...byClass.values()];
  }

  if (perspective === 'subject') {
    const byClass = new Map<string, MappingGridRow>();
    for (const r of records) {
      if (!r.classId) continue;
      let row = byClass.get(r.classId);
      if (!row) {
        row = { rowKeyId: r.classId, valueIds: [] };
        byClass.set(r.classId, row);
      }
      if (r.teacherId && !row.valueIds.includes(r.teacherId)) {
        row.valueIds.push(r.teacherId);
      }
    }
    return [...byClass.values()];
  }

  // class: group by subject
  const bySubject = new Map<string, MappingGridRow>();
  for (const r of records) {
    if (!r.subjectId) continue;
    let row = bySubject.get(r.subjectId);
    if (!row) {
      row = { rowKeyId: r.subjectId, valueIds: [] };
      bySubject.set(r.subjectId, row);
    }
    if (r.teacherId && !row.valueIds.includes(r.teacherId)) {
      row.valueIds.push(r.teacherId);
    }
  }
  return [...bySubject.values()];
}

export function teacherRowsToPayload(
  rows: MappingGridRow[],
  academicYearId?: string
): TeacherMappingPayload {
  return {
    academicYearId,
    classAssignments: rows
      .filter((r) => r.rowKeyId)
      .map((r) => ({
        classId: r.rowKeyId,
        subjectIds: r.valueIds,
        isClassTeacher: !!r.isClassTeacher,
      })),
  };
}

export function subjectRowsToPayload(
  rows: MappingGridRow[],
  academicYearId?: string
): SubjectMappingPayload {
  return {
    academicYearId,
    rows: rows
      .filter((r) => r.rowKeyId)
      .map((r) => ({ classId: r.rowKeyId, teacherIds: r.valueIds })),
  };
}

export function classRowsToPayload(
  rows: MappingGridRow[],
  classTeacherId: string | undefined,
  academicYearId?: string
): ClassMappingPayload {
  return {
    academicYearId,
    classTeacherId: classTeacherId || undefined,
    rows: rows
      .filter((r) => r.rowKeyId)
      .map((r) => ({ subjectId: r.rowKeyId, teacherIds: r.valueIds })),
  };
}

/** Parse API list response into flat records. */
export function parseFlatRecords(data: any[]): MappingFlatRecord[] {
  return (data || []).map((r) => ({
    classId: String(r.classId ?? r.ClassId ?? ''),
    subjectId: String(r.subjectId ?? r.SubjectId ?? ''),
    teacherId: String(r.teacherId ?? r.TeacherId ?? ''),
    isClassTeacher: !!(r.isClassTeacher ?? r.IsClassTeacher),
  }));
}

/** Parse teacher assignments API response. */
export function parseTeacherAssignmentRows(data: any): MappingGridRow[] {
  const assignments = data?.classAssignments ?? data?.ClassAssignments ?? [];
  return assignments.map((row: any) => ({
    rowKeyId: String(row.classId ?? row.ClassId ?? ''),
    valueIds: (row.subjectIds ?? row.SubjectIds ?? []).map((id: any) => String(id)),
    isClassTeacher: !!(row.isClassTeacher ?? row.IsClassTeacher),
  }));
}
