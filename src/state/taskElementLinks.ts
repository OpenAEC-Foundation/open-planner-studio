import type { ElementLink } from '@/services/ifc/foreign/elementLinks';
import type { IfcSource } from '@/services/ifc/foreign/ifcSource';
import { ifcForeignContentEnabled, ifcxEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import { ifcxModelSession } from '@/services/ifc/ifcxModelSession';
import type { IfcxModelReferences } from '@/services/ifc/ifcx/modelReferences';

interface ElementLinkState {
  readonly ui: { readonly featureFlags: Readonly<FeatureFlagValues> };
  readonly ifcSource: IfcSource | null;
  readonly ifcxReferences?: IfcxModelReferences | null;
}

export interface ElementLinkCounts {
  readonly elements: number;
  readonly notFound: number;
}

export function taskElementLinks(state: ElementLinkState, taskId: string): readonly ElementLink[] | undefined {
  if (state.ifcxReferences && ifcxEnabled(state.ui.featureFlags)) {
    return (ifcxModelSession(state.ifcxReferences)?.checkedLinks ?? state.ifcxReferences.elementLinks)?.get(taskId);
  }
  if (!ifcForeignContentEnabled(state.ui.featureFlags)) return undefined;
  return state.ifcSource?.elementLinks.get(taskId) ?? state.ifcSource?.detached?.objects.get(`task:${taskId}`)?.links;
}

export function elementLinkCounts(links: readonly ElementLink[]): ElementLinkCounts {
  const found = new Set<string>(), notFound = new Set<string>();
  for (const link of links) (link.found ? found : notFound).add(link.target);
  return { elements: found.size + notFound.size, notFound: notFound.size };
}

export function uncheckedModelLinks(state: ElementLinkState): boolean {
  return !!state.ifcxReferences && ifcxEnabled(state.ui.featureFlags) && !ifcxModelSession(state.ifcxReferences)?.elements;
}
