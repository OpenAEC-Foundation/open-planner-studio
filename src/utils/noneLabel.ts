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
