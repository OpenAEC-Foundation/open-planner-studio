import type { ElementLink } from '@/services/ifc/foreign/elementLinks';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled, type FeatureFlagValues } from '@/utils/featureFlags';

interface ElementLinkState {
  readonly ui: { readonly featureFlags: Readonly<FeatureFlagValues> };
  readonly ifcSource: IfcSource | null;
}

export interface ElementLinkCounts {
  readonly elements: number;
  readonly notFound: number;
}

export function taskElementLinks(state: ElementLinkState, taskId: string): readonly ElementLink[] | undefined {
  if (!ifcForeignContentEnabled(state.ui.featureFlags)) return undefined;
  return state.ifcSource?.elementLinks[taskId];
}

export function elementLinkCounts(links: readonly ElementLink[]): ElementLinkCounts {
  const found = new Set<string>(), notFound = new Set<string>();
  for (const link of links) (link.found ? found : notFound).add(link.target);
  return { elements: found.size + notFound.size, notFound: notFound.size };
}
