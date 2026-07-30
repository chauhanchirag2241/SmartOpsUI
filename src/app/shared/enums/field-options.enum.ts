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

export enum FeeType {
  OneTime = 'OneTime',
  Monthly = 'Monthly',
  PeriodWise = 'PeriodWise',
}

export enum FeeApplicableTo {
  ClassWise = 'ClassWise',
  StudentWise = 'StudentWise',
}

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  [FeeType.OneTime]: 'One Time',
  [FeeType.Monthly]: 'Monthly',
  [FeeType.PeriodWise]: 'Period Wise',
};

export const FEE_APPLICABLE_TO_LABELS: Record<FeeApplicableTo, string> = {
  [FeeApplicableTo.ClassWise]: 'Class wise',
  [FeeApplicableTo.StudentWise]: 'Student wise',
};

export const enumToOptions = <T extends Record<string, string>>(enumObject: T, labelMapper?: (value: string) => string) => {
  return Object.values(enumObject).map((value) => ({
    label: labelMapper?.(value) ?? value,
    value,
  }));
};
