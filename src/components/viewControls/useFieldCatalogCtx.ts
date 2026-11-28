import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import type { FieldCatalogCtx } from './fieldCatalog';

export function useFieldCatalogCtx(): FieldCatalogCtx {
  const { t: tTask } = useTranslation('task');
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const resources = useAppStore(s => s.resources);
  const { labels: taskTypeLabels } = useTaskTypeLabels();

  return useMemo<FieldCatalogCtx>(() => ({
    activityCodeTypes, customFieldDefs, resources,
    builtinLabels: {
      wbsCode: tTask('table.wbs'), name: tTask('table.name'), duration: tTask('table.duration'),
      start: tTask('table.start'), finish: tTask('table.finish'), taskType: tTask('table.type'),
      isCritical: tTask('table.critical'), totalFloat: tTask('table.totalFloat'),
      completion: tTask('table.completion'), isMilestone: tTask('table.milestone'),
      freeFloat: tTask('table.freeFloat'), interferingFloat: tTask('table.interferingFloat'),
      isNearCritical: tTask('table.isNearCritical'), floatPath: tTask('table.floatPath'),
      activeDuring: tTask('table.activeDuring'),
    },
    taskTypeLabels,
    resourceLabel: tTask('column.resource'),
    resourceTypeLabel: tTask('column.resourceType'),
    activityCodeSuffix: tTask('column.activityCodeSuffix'),
    customFieldSuffix: tTask('column.customFieldSuffix'),
  }), [activityCodeTypes, customFieldDefs, resources, taskTypeLabels, tTask]);
}
