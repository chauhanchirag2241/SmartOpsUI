export enum StudentFilter {
  All = 0,
  Active = 1,
  Inactive = 2,
}

export enum StaffFilter {
  All = 0,
  Active = 1,
  Inactive = 2,
  OnLeave = 3
}

export enum ClassFilter {
  All = 0,
  Active = 1,
  Inactive = 2
}

export enum AcademicYearFilter {
  All = 0,
  Active = 1,
  Inactive = 2,
  Current = 3,
  /** Upcoming years (start date after today). */
  Draft = 4,
  /** Past years (end date before today). */
  Archived = 5,
}
