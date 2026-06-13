import {
  asArray,
  extractApiError,
  formatInr,
  normalizeDropdownItem,
  pick,
  studentInitials,
  versionStatusBadgeClass,
} from '../fees/fees.shared';

export { asArray, extractApiError, formatInr, normalizeDropdownItem, studentInitials, versionStatusBadgeClass };

/** Matches backend SalaryStructureVersionStatus */
export enum SalaryStructureVersionStatus {
  Draft = 0,
  Published = 1,
  Active = 2,
  Archived = 3,
}

export enum SalaryComponentType {
  Earning = 0,
  Deduction = 1,
}

export enum SalaryCalculationType {
  PercentOfBasic = 0,
  PercentOfGross = 1,
  Fixed = 2,
}

export enum PayrollRunStatus {
  Draft = 0,
  Processed = 1,
}

export enum PayrollEntryStatus {
  Draft = 0,
  Processed = 1,
  Paid = 2,
}

export const COMPONENT_TYPE_OPTIONS = [
  { value: SalaryComponentType.Earning, label: 'Earning' },
  { value: SalaryComponentType.Deduction, label: 'Deduction' },
];

export const CALCULATION_TYPE_OPTIONS = [
  { value: SalaryCalculationType.PercentOfBasic, label: '% of basic' },
  { value: SalaryCalculationType.PercentOfGross, label: '% of gross' },
  { value: SalaryCalculationType.Fixed, label: 'Fixed amount' },
];

export function componentTypeBadgeClass(type: string): string {
  return type === 'Deduction' || type === '1' ? 'b-red' : 'b-green';
}

export function payrollStatusBadgeClass(status: string): string {
  const m: Record<string, string> = {
    Draft: 'b-amber',
    Processed: 'b-blue',
    Paid: 'b-green',
  };
  return m[status] ?? 'b-gray';
}

export function formatValueDisplay(calcLabel: string, value: number): string {
  if (calcLabel?.includes('%') || calcLabel === '% of basic' || calcLabel === '% of gross') {
    return `${value}%`;
  }
  return formatInr(value);
}

export function normalizeSalaryStructureVersion(raw: any) {
  const versionNumber = Number(pick(raw, 'versionNumber', 'VersionNumber') ?? 0);
  const statusLabel = String(pick(raw, 'statusLabel', 'StatusLabel') ?? '');
  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    academicYearId: String(pick(raw, 'academicYearId', 'AcademicYearId') ?? ''),
    academicYearTitle: String(pick(raw, 'academicYearTitle', 'AcademicYearTitle') ?? ''),
    versionNumber,
    versionLabel: `V${versionNumber}`,
    status: Number(pick(raw, 'status', 'Status') ?? 0),
    statusLabel,
    effectiveDate: String(pick(raw, 'effectiveDate', 'EffectiveDate') ?? ''),
    publishedOn: pick(raw, 'publishedOn', 'PublishedOn') as string | null,
    activatedOn: pick(raw, 'activatedOn', 'ActivatedOn') as string | null,
    componentCount: Number(pick(raw, 'componentCount', 'ComponentCount') ?? 0),
    hasAssignedEmployees: Boolean(pick(raw, 'hasAssignedEmployees', 'HasAssignedEmployees')),
    isLocked: Boolean(pick(raw, 'isLocked', 'IsLocked')),
  };
}

export function normalizeSalaryVersionComponent(raw: any) {
  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    salaryStructureVersionId: String(pick(raw, 'salaryStructureVersionId', 'SalaryStructureVersionId') ?? ''),
    name: String(pick(raw, 'name', 'Name') ?? ''),
    shortCode: String(pick(raw, 'shortCode', 'ShortCode') ?? ''),
    componentType: Number(pick(raw, 'componentType', 'ComponentType') ?? 0),
    componentTypeLabel: String(pick(raw, 'componentTypeLabel', 'ComponentTypeLabel') ?? ''),
    calculationType: Number(pick(raw, 'calculationType', 'CalculationType') ?? 0),
    calculationTypeLabel: String(pick(raw, 'calculationTypeLabel', 'CalculationTypeLabel') ?? ''),
    value: Number(pick(raw, 'value', 'Value') ?? 0),
    isTaxable: Boolean(pick(raw, 'isTaxable', 'IsTaxable')),
    isActive: pick(raw, 'isActive', 'IsActive') !== false,
  };
}

export function normalizeSalaryModuleStats(raw: any) {
  return {
    componentCount: Number(pick(raw, 'componentCount', 'ComponentCount') ?? 0),
    employeesMapped: Number(pick(raw, 'employeesMapped', 'EmployeesMapped') ?? 0),
    earningComponentCount: Number(pick(raw, 'earningComponentCount', 'EarningComponentCount') ?? 0),
    deductionComponentCount: Number(pick(raw, 'deductionComponentCount', 'DeductionComponentCount') ?? 0),
  };
}

export function normalizeEmployeeListItem(raw: any) {
  return {
    employeeId: String(
      pick(raw, 'employeeId', 'EmployeeId') ?? pick(raw, 'teacherId', 'TeacherId') ?? '',
    ),
    employeeName: String(pick(raw, 'employeeName', 'EmployeeName') ?? ''),
    department: String(pick(raw, 'department', 'Department') ?? ''),
    designation: String(pick(raw, 'designation', 'Designation') ?? ''),
    netSalary: pick(raw, 'netSalary', 'NetSalary') as number | null,
    hasAssignment: Boolean(pick(raw, 'hasAssignment', 'HasAssignment')),
  };
}

export function normalizeEmployeeDetail(raw: any) {
  const mapLine = (l: any) => ({
    componentId: pick(l, 'componentId', 'ComponentId') as string | null,
    name: String(pick(l, 'name', 'Name') ?? ''),
    componentTypeLabel: String(pick(l, 'componentTypeLabel', 'ComponentTypeLabel') ?? ''),
    amount: Number(pick(l, 'amount', 'Amount') ?? 0),
    isEarning: Boolean(pick(l, 'isEarning', 'IsEarning')),
  });
  return {
    employeeId: String(
      pick(raw, 'employeeId', 'EmployeeId') ?? pick(raw, 'teacherId', 'TeacherId') ?? '',
    ),
    employeeName: String(pick(raw, 'employeeName', 'EmployeeName') ?? ''),
    department: String(pick(raw, 'department', 'Department') ?? ''),
    designation: String(pick(raw, 'designation', 'Designation') ?? ''),
    employeeSalaryId: pick(raw, 'employeeSalaryId', 'EmployeeSalaryId') as string | null,
    salaryStructureVersionId: pick(raw, 'salaryStructureVersionId', 'SalaryStructureVersionId') as string | null,
    basicSalary: Number(pick(raw, 'basicSalary', 'BasicSalary') ?? 0),
    grossSalary: Number(pick(raw, 'grossSalary', 'GrossSalary') ?? 0),
    totalDeductions: Number(pick(raw, 'totalDeductions', 'TotalDeductions') ?? 0),
    netSalary: Number(pick(raw, 'netSalary', 'NetSalary') ?? 0),
    effectiveDate: String(pick(raw, 'effectiveDate', 'EffectiveDate') ?? ''),
    components: asArray<any>(pick(raw, 'components', 'Components')).map((c) => ({
      salaryVersionComponentId: String(pick(c, 'salaryVersionComponentId', 'SalaryVersionComponentId') ?? ''),
      name: String(pick(c, 'name', 'Name') ?? ''),
      shortCode: String(pick(c, 'shortCode', 'ShortCode') ?? ''),
      componentTypeLabel: String(pick(c, 'componentTypeLabel', 'ComponentTypeLabel') ?? ''),
      calculationTypeLabel: String(pick(c, 'calculationTypeLabel', 'CalculationTypeLabel') ?? ''),
      value: Number(pick(c, 'value', 'Value') ?? 0),
      defaultValue: Number(pick(c, 'defaultValue', 'DefaultValue') ?? 0),
      isTaxable: Boolean(pick(c, 'isTaxable', 'IsTaxable')),
    })),
    earnings: asArray<any>(pick(raw, 'earnings', 'Earnings')).map(mapLine),
    deductions: asArray<any>(pick(raw, 'deductions', 'Deductions')).map(mapLine),
  };
}

export function normalizePayrollRun(raw: any) {
  const entries = asArray<any>(pick(raw, 'entries', 'Entries')).map((e) => ({
    id: String(pick(e, 'id', 'Id') ?? ''),
    employeeId: String(
      pick(e, 'employeeId', 'EmployeeId') ?? pick(e, 'teacherId', 'TeacherId') ?? '',
    ),
    employeeName: String(pick(e, 'employeeName', 'EmployeeName') ?? ''),
    department: String(pick(e, 'department', 'Department') ?? ''),
    basicSalary: Number(pick(e, 'basicSalary', 'BasicSalary') ?? 0),
    hraAmount: Number(pick(e, 'hraAmount', 'HraAmount') ?? 0),
    allowances: Number(pick(e, 'allowances', 'Allowances') ?? 0),
    grossSalary: Number(pick(e, 'grossSalary', 'GrossSalary') ?? 0),
    totalDeductions: Number(pick(e, 'totalDeductions', 'TotalDeductions') ?? 0),
    netSalary: Number(pick(e, 'netSalary', 'NetSalary') ?? 0),
    status: Number(pick(e, 'status', 'Status') ?? 0),
    statusLabel: String(pick(e, 'statusLabel', 'StatusLabel') ?? ''),
  }));
  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    payYear: Number(pick(raw, 'payYear', 'PayYear') ?? 0),
    payMonth: Number(pick(raw, 'payMonth', 'PayMonth') ?? 0),
    status: Number(pick(raw, 'status', 'Status') ?? 0),
    statusLabel: String(pick(raw, 'statusLabel', 'StatusLabel') ?? ''),
    useAttendanceWiseSalary: Boolean(pick(raw, 'useAttendanceWiseSalary', 'UseAttendanceWiseSalary')),
    totalGross: Number(pick(raw, 'totalGross', 'TotalGross') ?? 0),
    totalDeductions: Number(pick(raw, 'totalDeductions', 'TotalDeductions') ?? 0),
    totalNet: Number(pick(raw, 'totalNet', 'TotalNet') ?? 0),
    employeeCount: Number(pick(raw, 'employeeCount', 'EmployeeCount') ?? 0),
    processedOn: pick(raw, 'processedOn', 'ProcessedOn') as string | null,
    entries,
  };
}

export function normalizePayslip(raw: any) {
  const mapLine = (l: any) => ({
    name: String(pick(l, 'name', 'Name') ?? ''),
    amount: Number(pick(l, 'amount', 'Amount') ?? 0),
  });
  return {
    entryId: String(pick(raw, 'entryId', 'EntryId') ?? ''),
    payYear: Number(pick(raw, 'payYear', 'PayYear') ?? 0),
    payMonth: Number(pick(raw, 'payMonth', 'PayMonth') ?? 0),
    employeeName: String(pick(raw, 'employeeName', 'EmployeeName') ?? ''),
    employeeId: String(
      pick(raw, 'employeeId', 'EmployeeId') ?? pick(raw, 'teacherId', 'TeacherId') ?? '',
    ),
    department: String(pick(raw, 'department', 'Department') ?? ''),
    designation: String(pick(raw, 'designation', 'Designation') ?? ''),
    workingDays: Number(pick(raw, 'workingDays', 'WorkingDays') ?? 0),
    presentDays: Number(pick(raw, 'presentDays', 'PresentDays') ?? 0),
    basicSalary: Number(pick(raw, 'basicSalary', 'BasicSalary') ?? 0),
    grossSalary: Number(pick(raw, 'grossSalary', 'GrossSalary') ?? 0),
    totalDeductions: Number(pick(raw, 'totalDeductions', 'TotalDeductions') ?? 0),
    netSalary: Number(pick(raw, 'netSalary', 'NetSalary') ?? 0),
    bankName: String(pick(raw, 'bankName', 'BankName') ?? ''),
    bankAccountNumber: String(pick(raw, 'bankAccountNumber', 'BankAccountNumber') ?? ''),
    bankIfscCode: String(pick(raw, 'bankIfscCode', 'BankIfscCode') ?? ''),
    earnings: asArray<any>(pick(raw, 'earnings', 'Earnings')).map(mapLine),
    deductions: asArray<any>(pick(raw, 'deductions', 'Deductions')).map(mapLine),
  };
}

export const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];
