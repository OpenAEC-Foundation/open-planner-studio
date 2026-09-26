// "(geen)"-bandlabel-doorgeefluik. De view-engine blijft
// i18n-onafhankelijk (ViewContext.noneLabel is een gewone string); de consument (App)
// zet hier de vertaalde `t('task:structure.none')` neer en de store-recompute leest hem.
// Dependency-vrij zodat de headless testharness geen i18n hoeft te bundelen.
// Ook de vertaalde resourcetype-labels (bandkop bij groeperen op Resourcetype) reizen mee.
import type { ResourceType } from '@/types/resource';

let noneLabel = '(geen)';

export function setNoneLabelValue(label: string): void {
  if (label) noneLabel = label;
}

export function getNoneLabelValue(): string {
  return noneLabel;
}

let resourceTypeLabels: Partial<Record<ResourceType, string>> = {};

export function setResourceTypeLabelsValue(labels: Partial<Record<ResourceType, string>>): void {
  resourceTypeLabels = { ...labels };
}

export function getResourceTypeLabelsValue(): Partial<Record<ResourceType, string>> {
  return resourceTypeLabels;
}
