const closers = new WeakMap<object, () => void>();

type Closest = { closest?: (selector: string) => object | null };
const panelOf = (target: EventTarget | null): object | null =>
  (target as Closest | null)?.closest?.('[data-ops-date-picker]') ?? null;

export function registerDatePickerPanel(panel: object, close: () => void): () => void {
  closers.set(panel, close);
  return () => { closers.delete(panel); };
}

export function isInDatePicker(target: EventTarget | null): boolean {
  return panelOf(target) !== null;
}

export function leaveDatePicker(target: EventTarget | null): EventTarget | null {
  const panel = panelOf(target);
  const close = panel ? closers.get(panel) : undefined;
  if (!close) return target;
  close();
  return document.activeElement;
}
