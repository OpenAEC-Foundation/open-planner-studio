import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import type { FieldCatalogCtx } from './fieldCatalog';

/** Bouwt de gedeelde `FieldCatalogCtx` (§6.2/§7.4) uit de store + i18n — hergebruikt door de
 *  filter-editor, groepeer-/sorteer-popovers. */
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
      completion: tTask('table.completion'), isMilestone: tTask('table.type'),
    },
    taskTypeLabels,
    resourceLabel: tTask('column.resource'),
  }), [activityCodeTypes, customFieldDefs, resources, taskTypeLabels, tTask]);
}
