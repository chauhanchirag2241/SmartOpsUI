export enum Section {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum StreamGroup {
  None = 'None',
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

export enum PaymentMode {
  OneTime = 'one-time',
  Quarterly = 'quarterly',
  Monthly = 'monthly',
}

export const enumToOptions = <T extends Record<string, string>>(enumObject: T, labelMapper?: (value: string) => string) => {
  return Object.values(enumObject).map((value) => ({
    label: labelMapper?.(value) ?? value,
    value,
  }));
};
