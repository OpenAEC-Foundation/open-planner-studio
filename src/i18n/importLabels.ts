import type { ImportLabels } from '@/services/importTypes';

export type ImportLabelT = (key: any) => string;

export function buildImportLabels(t: ImportLabelT): ImportLabels {
  return {
    importedProject: t('project.imported'),
    ifcxPlanSuffix: t('ifcx.planSuffix'),
    unassignedResource: t('project.unassignedResource'),
    ifcBuildingModelUnsupported: t('project.ifcBuildingModelUnsupported'),
  };
}
