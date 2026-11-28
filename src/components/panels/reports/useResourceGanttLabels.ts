import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResourceType } from '@/types/resource';
import type { AssignmentCurveState } from '@/engine/contour/curveState';

export function useResourceTypeLabels(): Partial<Record<ResourceType, string>> {
  const { t: tCommon } = useTranslation('common');
  return useMemo(() => ({
    LABOR: tCommon('resource.type.labor'), CREW: tCommon('resource.type.crew'),
    SUBCONTRACTOR: tCommon('resource.type.subcontractor'), EQUIPMENT: tCommon('resource.type.equipment'),
    MATERIAL: tCommon('resource.type.material'), COST: tCommon('resource.type.cost'),
  }), [tCommon]);
}

export function useCurveLabels(): Record<AssignmentCurveState, string> {
  const { t: tCommon } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  return useMemo(() => ({
    UNIFORM: tCommon('resource.curve.uniform'), FRONT_LOADED: tCommon('resource.curve.frontLoaded'),
    BACK_LOADED: tCommon('resource.curve.backLoaded'), BELL: tCommon('resource.curve.bell'),
    EARLY_PEAK: tCommon('resource.curve.earlyPeak'), LATE_PEAK: tCommon('resource.curve.latePeak'),
    DOUBLE_PEAK: tCommon('resource.curve.doublePeak'), TURTLE: tCommon('resource.curve.turtle'),
    contoured: tTask('properties.assignments.contoured'), imported: tTask('properties.assignments.importedCurve'),
  }), [tCommon, tTask]);
}
