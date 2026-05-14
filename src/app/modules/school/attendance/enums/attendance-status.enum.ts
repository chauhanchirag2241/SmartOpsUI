export enum AttendanceStatus {
  Present = 1,
  Absent = 2,
  Leave = 3,
  Late = 4,
}

export const AttendanceStatusLabel: Record<AttendanceStatus, string> = {
  [AttendanceStatus.Present]: 'Present',
  [AttendanceStatus.Absent]: 'Absent',
  [AttendanceStatus.Leave]: 'Leave',
  [AttendanceStatus.Late]: 'Late',
};

export const AttendanceStatusList = Object.values(AttendanceStatus)
  .filter((v): v is AttendanceStatus => typeof v === 'number');
