export type TaskGridMenuNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

/** Volgende focuspositie voor een verticaal contextmenu, met omloop aan beide uiteinden. */
export function nextTaskGridMenuIndex(
  key: TaskGridMenuNavigationKey,
  currentIndex: number,
  itemCount: number,
): number | null {
  if (itemCount <= 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  const normalized = currentIndex >= 0 ? currentIndex : 0;
  return key === 'ArrowDown'
    ? (normalized + 1) % itemCount
    : (normalized - 1 + itemCount) % itemCount;
}
