import { AcademicYearContextService } from '../../core/services/academic-year-context.service';
import { PermissionService } from '../../core/services/permission.service';

export function isReadOnlyYear(ayContext: AcademicYearContextService): boolean {
  return ayContext.isReadOnlyScope();
}

export function canAddInScope(
  ayContext: AcademicYearContextService,
  permissionService: PermissionService,
  menuCode: string,
): boolean {
  return !ayContext.isReadOnlyScope() && permissionService.canAdd(menuCode);
}

export function canEditInScope(
  ayContext: AcademicYearContextService,
  permissionService: PermissionService,
  menuCode: string,
): boolean {
  return !ayContext.isReadOnlyScope() && permissionService.canEdit(menuCode);
}
