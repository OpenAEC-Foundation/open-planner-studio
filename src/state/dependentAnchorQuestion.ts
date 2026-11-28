import type { TightAnchor } from '@/engine/dependentProjects';

export type DependentAnchorAsker = (anchors: TightAnchor[]) => Promise<boolean>;

const saveAnyway: DependentAnchorAsker = () => Promise.resolve(true);

let asker: DependentAnchorAsker = saveAnyway;

export function setDependentAnchorAsker(fn: DependentAnchorAsker): void {
  asker = fn;
}

export function resetDependentAnchorAsker(): void {
  asker = saveAnyway;
}

export function askDependentAnchors(anchors: TightAnchor[]): Promise<boolean> {
  return asker(anchors);
}
