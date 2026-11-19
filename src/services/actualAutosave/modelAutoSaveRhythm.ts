// #804 stap 8: het ritme van Automatisch opslaan voor een document met een gebouwmodel (besluit van de eigenaar, 17 november
// 2026): "Na 30 seconden rust opslaan, en als je onafgebroken doorwerkt uiterlijk na 5 minuten. […] Het bestand loopt
// nooit meer dan 5 minuten achter." Met de ondergrens uit het onderzoek: een ronde neemt nooit meer dan ongeveer een tiende
// van de tijd in (rekent en schrijft een ronde 18 s, dan begint de volgende hoogstens 180 s na het begin van die ronde).
// Per document; een gewoon document houdt zijn 10 s (`actualAutoSaveDelay`). Puur en met een injecteerbare klok, zodat een
// proef het ritme zonder wachten bewijst; `fileAutoSave.ts` voedt het en `useAutoSave` zet er de wekker op.
import { sameIFCSource, type IFCSaveSource } from '@/state/ifcSaveInput';

/** Zoveel rust na de laatste wijziging. */
export const MODEL_AUTOSAVE_REST_MS = 30_000;
/** Uiterlijk zo lang na de eerste niet-opgeslagen wijziging, ook bij onafgebroken doorwerken. */
export const MODEL_AUTOSAVE_MAX_DELAY_MS = 5 * 60_000;
/** Een ronde neemt hoogstens een tiende van de tijd: de volgende begint niet vóór tien keer haar duur na haar begin. */
export const MODEL_AUTOSAVE_DUTY_FACTOR = 10;

/** Hoe een ronde afliep, voor het ritme. `written`: geschreven en vastgelegd; `yielded`: geweken voor een handmatige
 *  actie (opnieuw na de volgende rustperiode); `other`: niets geschreven (weigering, fout, verouderd). */
export type ModelRoundOutcome = 'written' | 'yielded' | 'other';

export interface ModelAutoSaveRhythm {
  /** Na elke wijziging in de store: de stand van één document met een gebouwmodel. */
  observe(id: string, source: IFCSaveSource, dirty: boolean): void;
  /** Het document is dicht, of heeft geen gebouwmodel meer. */
  forget(id: string): void;
  /** Wanneer dit document aan de beurt is (ms, de klok van het ritme); `null`: niets op te slaan. */
  dueAt(id: string): number | null;
  isDue(id: string): boolean;
  /** Het vroegste moment over alle documenten, voor de wekker; `null`: geen. */
  nextDueAt(): number | null;
  /** De ronde van dit document begint (onder het schrijfslot); de klok loopt. */
  roundStarted(id: string): void;
  /** De ronde van dit document is klaar; de duur is de tijd sinds `roundStarted`. */
  roundEnded(id: string, outcome: ModelRoundOutcome): void;
}

interface DocRhythm {
  source: IFCSaveSource | null;
  dirty: boolean;
  /** De laatste wijziging (rust telt vanaf hier). */
  lastChangeAt: number;
  /** De eerste wijziging die nog niet in het bestand staat; `null` als het document schoon is. */
  firstUnsavedAt: number | null;
  /** Niet vóór dit moment (ondergrens van de vorige ronde, of de rust na het wijken). */
  notBefore: number;
  /** Een lopende ronde: haar begin, en de eerste wijziging die erna kwam (die staat niet in haar momentopname). */
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
    forget: id => { docs.delete(id); },
    dueAt: id => { const doc = docs.get(id); return doc ? dueOf(doc) : null; },
    isDue: id => { const doc = docs.get(id), due = doc ? dueOf(doc) : null; return due !== null && due <= now(); },
    nextDueAt: () => {
      let next: number | null = null;
      for (const doc of docs.values()) {
        const due = doc.round ? null : dueOf(doc);
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
      // Geweken: opnieuw na de volgende rustperiode, ook als de bovengrens van 5 minuten al voorbij is.
      if (outcome === 'yielded') doc.notBefore = Math.max(doc.notBefore, at + MODEL_AUTOSAVE_REST_MS);
      // Geschreven: wat na de momentopname kwam, staat er nog niet in; de bovengrens telt vanaf die eerste latere wijziging.
      if (outcome === 'written') doc.firstUnsavedAt = round.firstChangeAfter;
    },
  };
}
