export enum Section {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum StreamGroup {
  Primary = 'Primary',
  Science = 'Science',
  Commerce = 'Commerce',
  Arts = 'Arts',
  Regional = 'Regional',
}

export enum Shift {
  Morning = 'Morning',
  Afternoon = 'Afternoon',
  Evening = 'Evening',
}

export enum Medium {
  English = 'English',
  Hindi = 'Hindi',
  Gujarati = 'Gujarati',
}

export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}

export enum BloodGroup {
  APos = 'A+',
  ANeg = 'A-',
  BPos = 'B+',
  BNeg = 'B-',
  OPos = 'O+',
  ONeg = 'O-',
  ABPos = 'AB+',
  ABNeg = 'AB-',
}

export enum SubjectType {
  Theory = 'Theory',
  Practical = 'Practical',
  Both = 'Both',
}

export enum SubjectCategory {
  Core = 'Core',
  Elective = 'Elective',
  CoCurricular = 'Co-curricular',
}

export enum PeriodDuration {
  M30 = '30',
  M45 = '45',
  M50 = '50',
  M60 = '60',
}

export enum GradeSystem {
  Marks = 'marks',
  Grade = 'grade',
  CGPA = 'cgpa',
}

export enum Curriculum {
  CBSE = 'CBSE',
  GSEB = 'GSEB',
  ICSE = 'ICSE',
  IB = 'IB',
  StateBoard = 'state',
}

export const enumToOptions = <T extends Record<string, string>>(enumObject: T, labelMapper?: (value: string) => string) => {
  return Object.values(enumObject).map((value) => ({
    label: labelMapper?.(value) ?? value,
    value,
  }));
};
