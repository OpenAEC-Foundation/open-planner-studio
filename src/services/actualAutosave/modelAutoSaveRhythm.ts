import { sameIFCSource, type IFCSaveSource } from '@/state/ifcSaveInput';

export const MODEL_AUTOSAVE_REST_MS = 30_000;
export const MODEL_AUTOSAVE_MAX_DELAY_MS = 5 * 60_000;
export const MODEL_AUTOSAVE_DUTY_FACTOR = 10;

export type ModelRoundOutcome = 'written' | 'yielded' | 'other';

export interface ModelAutoSaveRhythm {
  observe(id: string, source: IFCSaveSource, dirty: boolean): void;
  touch(id: string): void;
  forget(id: string): void;
  dueAt(id: string): number | null;
  isDue(id: string): boolean;
  nextDueAt(include?: (id: string) => boolean): number | null;
  roundStarted(id: string): void;
  roundEnded(id: string, outcome: ModelRoundOutcome): void;
}

interface DocRhythm {
  source: IFCSaveSource | null;
  dirty: boolean;
  lastChangeAt: number;
  firstUnsavedAt: number | null;
  notBefore: number;
  round: { startedAt: number; firstChangeAfter: number | null } | null;
}

export function createModelAutoSaveRhythm(now: () => number = Date.now): ModelAutoSaveRhythm {
  const docs = new Map<string, DocRhythm>();
  const dueOf = (doc: DocRhythm): number | null => {
    if (!doc.dirty || doc.firstUnsavedAt === null) return null;
    const wanted = Math.min(doc.lastChangeAt + MODEL_AUTOSAVE_REST_MS, doc.firstUnsavedAt + MODEL_AUTOSAVE_MAX_DELAY_MS);
    return Math.max(wanted, doc.notBefore);
  };
  return {
    observe: (id, source, dirty) => {
      const at = now();
      let doc = docs.get(id);
      if (!doc) {
        doc = { source: null, dirty: false, lastChangeAt: at, firstUnsavedAt: null, notBefore: 0, round: null };
        docs.set(id, doc);
      }
      const changed = doc.source === null || !sameIFCSource(doc.source, source);
      doc.source = source;
      doc.dirty = dirty;
      if (!dirty) {
        doc.firstUnsavedAt = null;
        return;
      }
      if (changed || doc.firstUnsavedAt === null) {
        doc.lastChangeAt = at;
        doc.firstUnsavedAt ??= at;
        if (doc.round) doc.round.firstChangeAfter ??= at;
      }
    },
    touch: id => {
      const doc = docs.get(id);
      if (doc?.dirty) doc.lastChangeAt = now();
    },
    forget: id => { docs.delete(id); },
    dueAt: id => { const doc = docs.get(id); return doc ? dueOf(doc) : null; },
    isDue: id => { const doc = docs.get(id), due = doc ? dueOf(doc) : null; return due !== null && due <= now(); },
    nextDueAt: include => {
      let next: number | null = null;
      for (const [id, doc] of docs) {
        const due = doc.round || (include && !include(id)) ? null : dueOf(doc);
        if (due !== null && (next === null || due < next)) next = due;
      }
      return next;
    },
    roundStarted: id => {
      const doc = docs.get(id);
      if (doc) doc.round = { startedAt: now(), firstChangeAfter: null };
    },
    roundEnded: (id, outcome) => {
      const doc = docs.get(id), round = doc?.round;
      if (!doc || !round) return;
      const at = now();
      doc.round = null;
      doc.notBefore = Math.max(doc.notBefore, round.startedAt + MODEL_AUTOSAVE_DUTY_FACTOR * (at - round.startedAt));
      if (outcome === 'yielded') doc.notBefore = Math.max(doc.notBefore, at + MODEL_AUTOSAVE_REST_MS);
      if (outcome === 'written') doc.firstUnsavedAt = round.firstChangeAfter;
    },
  };
}
