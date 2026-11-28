import type { ActivityEntry } from './contracts';

export const MAX_ENTRIES = 500;

export const FIELD_CAP = 20 * 1024;

export const TRUNCATE_MARKER = '… truncated';

let buffer: ActivityEntry[] = [];
const listeners = new Set<(entries: ActivityEntry[]) => void>();

export function capField(s: string): string {
  if (s.length <= FIELD_CAP) return s;
  return s.slice(0, FIELD_CAP) + TRUNCATE_MARKER;
}

function notify(): void {
  const snapshot = buffer.slice();
  for (const fn of listeners) {
    try { fn(snapshot); }
    catch { }
  }
}

export function record(entry: ActivityEntry): void {
  const capped: ActivityEntry = {
    ...entry,
    argsJson: capField(entry.argsJson),
    resultJson: capField(entry.resultJson),
  };
  buffer.push(capped);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  notify();
}

export function getEntries(): ActivityEntry[] {
  return buffer.slice();
}

export function clear(): void {
  buffer = [];
  notify();
}

export function subscribe(fn: (entries: ActivityEntry[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
