// "(geen)"-bandlabel-doorgeefluik (fase 2.7, §4.1/§7.1). De view-engine blijft
// i18n-onafhankelijk (ViewContext.noneLabel is een gewone string); de consument (App)
// zet hier de vertaalde `t('task:structure.none')` neer en de store-recompute leest hem.
// Dependency-vrij zodat de headless testharness geen i18n hoeft te bundelen.

let noneLabel = '(geen)';

export function setNoneLabelValue(label: string): void {
  if (label) noneLabel = label;
}

export function getNoneLabelValue(): string {
  return noneLabel;
}
