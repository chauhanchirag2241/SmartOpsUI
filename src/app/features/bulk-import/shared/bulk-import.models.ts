export interface ImportRowResult {
  rowNumber: number;
  admissionNo?: string | null;
  employeeCode?: string | null;
  displayName?: string | null;
  status: string;
  errors: string[];
}

export interface StudentImportValidateResult {
  fileError?: string | null;
  academicYearId?: string | null;
  academicYearName?: string | null;
  totalStudents: number;
  validStudents: number;
  invalidStudents: number;
  totalFeeAssignments: number;
  validFeeAssignments: number;
  invalidFeeAssignments: number;
  students: ImportRowResult[];
  feeAssignments: ImportRowResult[];
  errorFileBase64?: string | null;
  errorFileName: string;
}

export interface StudentImportCommitFailure {
  rowNumber?: number | null;
  admissionNo?: string | null;
  displayName?: string | null;
  message: string;
}

export interface StudentImportCreated {
  rowNumber?: number | null;
  admissionNo?: string | null;
  displayName?: string | null;
  username?: string | null;
  status: string;
}

export interface StudentImportCommitResult {
  fileError?: string | null;
  createdStudents: number;
  feeAssignmentsApplied: number;
  skippedInvalidStudents: number;
  skippedInvalidFeeAssignments: number;
  failures: StudentImportCommitFailure[];
  created: StudentImportCreated[];
  validation?: StudentImportValidateResult | null;
}

export interface EmployeeImportValidateResult {
  fileError?: string | null;
  totalEmployees: number;
  validEmployees: number;
  invalidEmployees: number;
  employees: ImportRowResult[];
  errorFileBase64?: string | null;
  errorFileName: string;
}

export interface EmployeeImportCommitFailure {
  rowNumber?: number | null;
  employeeCode?: string | null;
  displayName?: string | null;
  message: string;
}

export interface EmployeeImportCreated {
  rowNumber?: number | null;
  employeeCode?: string | null;
  displayName?: string | null;
  username?: string | null;
  status: string;
}

export interface EmployeeImportCommitResult {
  fileError?: string | null;
  createdEmployees: number;
  skippedInvalidEmployees: number;
  failures: EmployeeImportCommitFailure[];
  created: EmployeeImportCreated[];
  validation?: EmployeeImportValidateResult | null;
}
