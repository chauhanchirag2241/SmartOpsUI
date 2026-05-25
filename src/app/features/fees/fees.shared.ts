export enum FeeCategory {
  Academic = 0,
  Development = 1,
  Transport = 2,
  Other = 3,
}

export enum FeeCollectionType {
  SemesterWise = 0,
  OneTime = 1,
}

export enum FeePaymentMode {
  Cash = 0,
  Upi = 1,
  BankTransfer = 2,
  Cheque = 3,
  Card = 4,
}

/** Matches backend FeeStructureVersionStatus */
export enum FeeStructureVersionStatus {
  Draft = 0,
  Published = 1,
  Active = 2,
  Archived = 3,
}

export const FEE_CATEGORY_OPTIONS = [
  { value: FeeCategory.Academic, label: 'Academic' },
  { value: FeeCategory.Development, label: 'Development' },
  { value: FeeCategory.Transport, label: 'Transport' },
  { value: FeeCategory.Other, label: 'Other' },
];

export const FEE_COLLECTION_TYPE_OPTIONS = [
  { value: FeeCollectionType.SemesterWise, label: 'Semester wise' },
  { value: FeeCollectionType.OneTime, label: 'One time' },
];

/** API uses JsonStringEnumConverter — collection type may arrive as number or string. */
/** Draft/Published: always editable per class until activate. Active: only new classes. */
export function resolveClassAmountsEditable(raw: unknown, versionStatusLabel: string): boolean {
  const status = versionStatusLabel.trim();
  if (status === 'Draft' || status === 'Published') {
    return true;
  }
  if (status === 'Active') {
    if (raw === true || raw === 1) return true;
    if (raw === false || raw === 0) return false;
    return Boolean(raw);
  }
  return false;
}

export function resolveCollectionType(raw: unknown, label?: string): FeeCollectionType {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return raw === FeeCollectionType.OneTime ? FeeCollectionType.OneTime : FeeCollectionType.SemesterWise;
  }
  if (typeof raw === 'string') {
    const s = raw.replace(/\s+/g, '').toLowerCase();
    if (s === 'onetime' || s === 'one_time' || s.includes('one')) {
      return FeeCollectionType.OneTime;
    }
    return FeeCollectionType.SemesterWise;
  }
  const l = (label ?? '').toLowerCase();
  if (l.includes('one time') || l.includes('one-time') || l === 'onetime') {
    return FeeCollectionType.OneTime;
  }
  return FeeCollectionType.SemesterWise;
}

export const FEE_PAYMENT_MODE_OPTIONS = [
  { value: FeePaymentMode.Cash, label: 'Cash' },
  { value: FeePaymentMode.Upi, label: 'UPI' },
  { value: FeePaymentMode.BankTransfer, label: 'Bank transfer / NEFT' },
  { value: FeePaymentMode.Cheque, label: 'Cheque' },
  { value: FeePaymentMode.Card, label: 'Card (POS)' },
];

export function categoryBadgeClass(cat: string): string {
  const m: Record<string, string> = {
    Academic: 'b-blue',
    Development: 'b-green',
    Transport: 'b-amber',
    Other: 'b-gray',
  };
  return m[cat] ?? 'b-gray';
}

export function collectionTypeBadgeClass(type: string): string {
  const m: Record<string, string> = {
    'Semester wise': 'b-blue',
    'One time': 'b-gray',
  };
  return m[type] ?? 'b-gray';
}

export function formatInr(n: number): string {
  return '₹' + (n ?? 0).toLocaleString('en-IN');
}

/** Read API error text from HttpErrorResponse (string body, { error }, or validation details). */
export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (!err || typeof err !== 'object' || !('error' in err)) {
    return fallback;
  }

  const body = (err as { error?: unknown; message?: string }).error;
  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const apiError = record['error'];
    if (typeof apiError === 'string' && apiError.trim()) {
      return apiError.trim();
    }
    const apiMessage = record['message'];
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage.trim();
    }
    const details = record['details'] ?? record['errors'];
    if (Array.isArray(details) && details.length) {
      return details.map(String).join(' ');
    }
  }

  const message = (err as { message?: string }).message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  return fallback;
}

export function studentInitials(name: string): string {
  const parts = (name ?? '').split(' ').filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name ?? '??').slice(0, 2).toUpperCase();
}

/** Read camelCase or PascalCase API fields. */
export function pick<T>(obj: any, camel: string, pascal?: string): T | undefined {
  if (obj == null) return undefined;
  const p = pascal ?? camel.charAt(0).toUpperCase() + camel.slice(1);
  return obj[camel] ?? obj[p];
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeDropdownItem(raw: any): { id: string; name: string } {
  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    name: String(pick(raw, 'name', 'Name') ?? pick(raw, 'label', 'Label') ?? ''),
  };
}

export function versionStatusBadgeClass(status: string): string {
  const m: Record<string, string> = {
    Draft: 'b-amber',
    Published: 'b-blue',
    Active: 'b-green',
    Archived: 'b-gray',
  };
  return m[status] ?? 'b-gray';
}

export function normalizeFeeStructureVersion(raw: any) {
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
    feeTypeCount: Number(pick(raw, 'feeTypeCount', 'FeeTypeCount') ?? 0),
    hasStudentPayments: Boolean(pick(raw, 'hasStudentPayments', 'HasStudentPayments')),
    isLocked: Boolean(pick(raw, 'isLocked', 'IsLocked')),
  };
}

export function normalizeFeeType(raw: any) {
  const collectionTypeLabel = String(
    pick(raw, 'collectionTypeLabel', 'CollectionTypeLabel') ??
      pick(raw, 'frequencyLabel', 'FrequencyLabel') ??
      '',
  );
  return {
    id: String(pick(raw, 'id', 'Id') ?? ''),
    feeStructureVersionId: String(pick(raw, 'feeStructureVersionId', 'FeeStructureVersionId') ?? ''),
    name: String(pick(raw, 'name', 'Name') ?? ''),
    categoryLabel: String(pick(raw, 'categoryLabel', 'CategoryLabel') ?? ''),
    collectionType: resolveCollectionType(
      pick(raw, 'collectionType', 'CollectionType') ?? pick(raw, 'frequency', 'Frequency'),
      collectionTypeLabel,
    ),
    collectionTypeLabel,
    isMandatory: Boolean(pick(raw, 'isMandatory', 'IsMandatory')),
    isRefundable: Boolean(pick(raw, 'isRefundable', 'IsRefundable')),
    studentWiseDifferentAmount: Boolean(
      pick(raw, 'studentWiseDifferentAmount', 'StudentWiseDifferentAmount'),
    ),
    isActive: pick(raw, 'isActive', 'IsActive') !== false,
    hasStudentPayments: Boolean(pick(raw, 'hasStudentPayments', 'HasStudentPayments')),
  };
}

export function normalizeFeeStats(raw: any) {
  return {
    feeTypeCount: Number(pick(raw, 'feeTypeCount', 'FeeTypeCount') ?? 0),
    classesConfigured: Number(pick(raw, 'classesConfigured', 'ClassesConfigured') ?? 0),
    lateFeePerDay: Number(pick(raw, 'lateFeePerDay', 'LateFeePerDay') ?? 0),
  };
}

export function normalizeClassSummary(raw: any) {
  return {
    classId: String(pick(raw, 'classId', 'ClassId') ?? ''),
    className: String(pick(raw, 'className', 'ClassName') ?? ''),
    studentCount: Number(pick(raw, 'studentCount', 'StudentCount') ?? 0),
    totalAmount: Number(pick(raw, 'totalAmount', 'TotalAmount') ?? 0),
  };
}

export function normalizeClassAmounts(raw: any) {
  const items = asArray<any>(pick(raw, 'items', 'Items')).map((i) => {
    const collectionTypeLabel = String(
      pick(i, 'collectionTypeLabel', 'CollectionTypeLabel') ??
        pick(i, 'frequencyLabel', 'FrequencyLabel') ??
        '',
    );
    const collectionType = resolveCollectionType(
      pick(i, 'collectionType', 'CollectionType') ?? pick(i, 'frequency', 'Frequency'),
      collectionTypeLabel,
    );
    const semester1 = Number(pick(i, 'semester1Amount', 'Semester1Amount') ?? 0);
    const semester2 = Number(pick(i, 'semester2Amount', 'Semester2Amount') ?? 0);
    const amount = Number(pick(i, 'amount', 'Amount') ?? 0);
    const annualTotal = Number(pick(i, 'annualTotal', 'AnnualTotal') ?? (collectionType === FeeCollectionType.SemesterWise ? semester1 + semester2 : amount));
    return {
      feeTypeId: String(pick(i, 'feeTypeId', 'FeeTypeId') ?? ''),
      feeTypeName: String(pick(i, 'feeTypeName', 'FeeTypeName') ?? ''),
      categoryLabel: String(pick(i, 'categoryLabel', 'CategoryLabel') ?? ''),
      collectionType,
      collectionTypeLabel,
      amount,
      semester1Amount: semester1,
      semester2Amount: semester2,
      annualTotal,
      isMandatory: Boolean(pick(i, 'isMandatory', 'IsMandatory') ?? true),
      studentWiseDifferentAmount: Boolean(pick(i, 'studentWiseDifferentAmount', 'StudentWiseDifferentAmount')),
    };
  });
  return {
    classId: String(pick(raw, 'classId', 'ClassId') ?? ''),
    className: String(pick(raw, 'className', 'ClassName') ?? ''),
    academicYearId: String(pick(raw, 'academicYearId', 'AcademicYearId') ?? ''),
    feeStructureVersionId: String(pick(raw, 'feeStructureVersionId', 'FeeStructureVersionId') ?? ''),
    versionNumber: Number(pick(raw, 'versionNumber', 'VersionNumber') ?? 0),
    versionStatusLabel: String(pick(raw, 'versionStatusLabel', 'VersionStatusLabel') ?? ''),
    isEditable: resolveClassAmountsEditable(
      pick(raw, 'isEditable', 'IsEditable'),
      String(pick(raw, 'versionStatusLabel', 'VersionStatusLabel') ?? ''),
    ),
    totalAmount: Number(pick(raw, 'totalAmount', 'TotalAmount') ?? 0),
    items,
  };
}

export function normalizeStudentListItem(raw: any) {
  return {
    studentId: String(pick(raw, 'studentId', 'StudentId') ?? ''),
    studentName: String(pick(raw, 'studentName', 'StudentName') ?? ''),
    rollNo: String(pick(raw, 'rollNo', 'RollNo') ?? ''),
    className: String(pick(raw, 'className', 'ClassName') ?? ''),
    totalFees: Number(pick(raw, 'totalFees', 'TotalFees') ?? 0),
    paidAmount: Number(pick(raw, 'paidAmount', 'PaidAmount') ?? 0),
    dueAmount: Number(pick(raw, 'dueAmount', 'DueAmount') ?? 0),
    paymentStatus: String(pick(raw, 'paymentStatus', 'PaymentStatus') ?? ''),
  };
}

export function normalizeInstallmentPreview(raw: any) {
  return {
    installmentId: String(pick(raw, 'installmentId', 'InstallmentId') ?? ''),
    feeTypeId: String(pick(raw, 'feeTypeId', 'FeeTypeId') ?? ''),
    feeTypeName: String(pick(raw, 'feeTypeName', 'FeeTypeName') ?? ''),
    collectionTypeLabel: String(
      pick(raw, 'collectionTypeLabel', 'CollectionTypeLabel') ??
        pick(raw, 'frequencyLabel', 'FrequencyLabel') ??
        '',
    ),
    periodIndex: Number(pick(raw, 'periodIndex', 'PeriodIndex') ?? 0),
    periodLabel: String(pick(raw, 'periodLabel', 'PeriodLabel') ?? ''),
    amount: Number(pick(raw, 'amount', 'Amount') ?? 0),
  };
}

export function normalizeStudentDetail(raw: any) {
  const feeHeads = asArray<any>(pick(raw, 'feeHeads', 'FeeHeads')).map((h) => {
    const installments = asArray<any>(pick(h, 'installments', 'Installments')).map((i) => ({
      installmentId: String(pick(i, 'installmentId', 'InstallmentId') ?? ''),
      feeTypeId: String(pick(i, 'feeTypeId', 'FeeTypeId') ?? ''),
      periodIndex: Number(pick(i, 'periodIndex', 'PeriodIndex') ?? 0),
      periodLabel: String(pick(i, 'periodLabel', 'PeriodLabel') ?? ''),
      totalAmount: Number(pick(i, 'totalAmount', 'TotalAmount') ?? 0),
      paidAmount: Number(pick(i, 'paidAmount', 'PaidAmount') ?? 0),
      dueAmount: Number(pick(i, 'dueAmount', 'DueAmount') ?? 0),
      status: String(pick(i, 'status', 'Status') ?? ''),
    }));
    return {
      feeTypeId: String(pick(h, 'feeTypeId', 'FeeTypeId') ?? ''),
      feeTypeName: String(pick(h, 'feeTypeName', 'FeeTypeName') ?? ''),
      collectionTypeLabel: String(
        pick(h, 'collectionTypeLabel', 'CollectionTypeLabel') ??
          pick(h, 'frequencyLabel', 'FrequencyLabel') ??
          '',
      ),
      totalAmount: Number(pick(h, 'totalAmount', 'TotalAmount') ?? 0),
      paidAmount: Number(pick(h, 'paidAmount', 'PaidAmount') ?? 0),
      dueAmount: Number(pick(h, 'dueAmount', 'DueAmount') ?? 0),
      status: String(pick(h, 'status', 'Status') ?? ''),
      installments,
      expanded: false,
    };
  });
  const semesterStatuses = asArray<any>(pick(raw, 'semesterStatuses', 'SemesterStatuses')).map((s) => ({
    semesterIndex: Number(pick(s, 'semesterIndex', 'SemesterIndex') ?? 0),
    semesterName: String(pick(s, 'semesterName', 'SemesterName') ?? ''),
    startDate: String(pick(s, 'startDate', 'StartDate') ?? ''),
    endDate: String(pick(s, 'endDate', 'EndDate') ?? ''),
    totalAmount: Number(pick(s, 'totalAmount', 'TotalAmount') ?? 0),
    paidAmount: Number(pick(s, 'paidAmount', 'PaidAmount') ?? 0),
    dueAmount: Number(pick(s, 'dueAmount', 'DueAmount') ?? 0),
    status: String(pick(s, 'status', 'Status') ?? ''),
  }));
  const payments = asArray<any>(pick(raw, 'payments', 'Payments')).map((p) => ({
    paymentId: String(pick(p, 'paymentId', 'PaymentId') ?? ''),
    paymentDate: String(pick(p, 'paymentDate', 'PaymentDate') ?? ''),
    paymentModeLabel: String(pick(p, 'paymentModeLabel', 'PaymentModeLabel') ?? ''),
    amount: Number(pick(p, 'amount', 'Amount') ?? 0),
    transactionNo: pick(p, 'transactionNo', 'TransactionNo') as string | null,
    feeHeadsSummary: String(pick(p, 'feeHeadsSummary', 'FeeHeadsSummary') ?? ''),
    receiptNo: pick(p, 'receiptNo', 'ReceiptNo') as string | null,
  }));
  return {
    studentId: String(pick(raw, 'studentId', 'StudentId') ?? ''),
    studentName: String(pick(raw, 'studentName', 'StudentName') ?? ''),
    rollNo: String(pick(raw, 'rollNo', 'RollNo') ?? ''),
    className: String(pick(raw, 'className', 'ClassName') ?? ''),
    totalFees: Number(pick(raw, 'totalFees', 'TotalFees') ?? 0),
    paidAmount: Number(pick(raw, 'paidAmount', 'PaidAmount') ?? 0),
    dueAmount: Number(pick(raw, 'dueAmount', 'DueAmount') ?? 0),
    paymentProgressPercent: Number(pick(raw, 'paymentProgressPercent', 'PaymentProgressPercent') ?? 0),
    paymentStatus: String(pick(raw, 'paymentStatus', 'PaymentStatus') ?? ''),
    feeHeads,
    semesterStatuses,
    payments,
  };
}
