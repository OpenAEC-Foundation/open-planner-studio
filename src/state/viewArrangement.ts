import type { AppState } from './appStore';

export function clearViewArrangement(s: Pick<AppState, 'setFilter' | 'setGroup' | 'setSort'>): void {
  s.setFilter(null);
  s.setGroup([]);
  s.setSort([]);
}
