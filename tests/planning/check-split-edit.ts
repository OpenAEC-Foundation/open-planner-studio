// check-split-edit.ts — het pure bewerkmodel voor gebruikerssplits (issue #146, spec
// 2026-09-19-taken-splitsen-bewerken-design.md). Fixtures zijn GECOMMIT: het .mpp-corpus staat
// niet in de repo en is dus geen poort.
import type { Task, TaskSplitGap, TaskTime } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  adoptLevelingGaps, canSplitTask, clipUserGapsToWork, completedWorkMinutes, fromSplitPieces,
  isWellFormedSplit, removeAllGaps, setGapLength, setWorkLength, splitAt, toSplitPieces,
  workOffsetAtDate,
} from '@/engine/scheduler/splitEdit';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import type { WorkCalendar } from '@/types/calendar';
import { parseDate, parseInstant } from '@/utils/dateUtils';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// ── T1: het type draagt 'user' ───────────────────────────────────────────────
const userGap: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480, source: 'user' };
eq('T1 source user typeert', userGap.source, 'user');
const importGap: TaskSplitGap = { afterMinutes: 480, gapMinutes: 480 };
ok('T1 source blijft optioneel', importGap.source === undefined);

// ── T2: wélgevormdheid en de heen-en-terug-vertaling ─────────────────────────
const NEAT: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 480 }, { afterMinutes: 1440, gapMinutes: 480 }];
const WITH_SOURCE: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 960, source: 'leveling' }];
const SUBDAY: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 100 }];
const FRACTION: TaskSplitGap[] = [{ afterMinutes: 0.1 + 0.2, gapMinutes: 0.7 }, { afterMinutes: 3.3, gapMinutes: 1.1 }];
const OVERLAP: TaskSplitGap[] = [{ afterMinutes: 480, gapMinutes: 960 }, { afterMinutes: 960, gapMinutes: 480 }];
const BEYOND: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 5760 }]; // werk = 960
const UNSORTED: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 480 }, { afterMinutes: 480, gapMinutes: 480 }];

ok('T2 netjes wélgevormd', isWellFormedSplit(NEAT, 1440));
ok('T2 overlap niet', !isWellFormedSplit(OVERLAP, 1440));
ok('T2 voorbij werktotaal niet', !isWellFormedSplit(BEYOND, 960));
ok('T2 ongesorteerd niet', !isWellFormedSplit(UNSORTED, 1440));
ok('T2 NaN niet', !isWellFormedSplit([{ afterMinutes: NaN, gapMinutes: 1 }], 100));
ok('T2 gat op positie 0 niet', !isWellFormedSplit([{ afterMinutes: 0, gapMinutes: 60 }], 100));
ok('T2 leeg wélgevormd', isWellFormedSplit(undefined, 480) && isWellFormedSplit([], 480));

eq('T2 stukken NEAT', toSplitPieces(NEAT, 1440), [
  { kind: 'work', minutes: 480 }, { kind: 'gap', minutes: 480 },
  { kind: 'work', minutes: 480 }, { kind: 'gap', minutes: 480 }, { kind: 'work', minutes: 480 },
]);
eq('T2 zonder gaten = één werkstuk', toSplitPieces(undefined, 960), [{ kind: 'work', minutes: 960 }]);
ok('T2 niet-wélgevormd ⇒ null', toSplitPieces(BEYOND, 960) === null);

for (const [name, g, w] of [['NEAT', NEAT, 1440], ['WITH_SOURCE', WITH_SOURCE, 960],
  ['SUBDAY', SUBDAY, 960], ['FRACTION', FRACTION, 10]] as const) {
  const back = fromSplitPieces(toSplitPieces(g, w)!, g);
  eq(`T2 round-trip ${name}: gaten`, back.gaps, g);
  ok(`T2 round-trip ${name}: werk`, Math.abs(back.totalWorkMinutes - w) < 1e-6);
}

// ── T3: de bewerkingen ───────────────────────────────────────────────────────
const U = 480; // dag-eenheid bij 8u
const one = toSplitPieces(undefined, 4800)!; // 10 werkdagen
const s1 = splitAt(one, 2400, 2400, U);
ok('T3 splitAt ok', s1.ok);
eq('T3 splitAt 5+5+5', s1.ok && s1.pieces, [
  { kind: 'work', minutes: 2400 }, { kind: 'gap', minutes: 2400, source: 'user' }, { kind: 'work', minutes: 2400 }]);
eq('T3 splitAt snapt positie en pauze', (() => { const r = splitAt(one, 2500, 100, U); return r.ok && r.pieces; })(), [
  { kind: 'work', minutes: 2400 }, { kind: 'gap', minutes: 480, source: 'user' }, { kind: 'work', minutes: 2400 }]);
eq('T3 splitAt op 0 geweigerd', splitAt(one, 0, U, U), { ok: false, reason: 'position-out-of-range' });
eq('T3 splitAt op eind geweigerd', splitAt(one, 4800, U, U), { ok: false, reason: 'position-out-of-range' });
eq('T3 splitAt vóór voltooid werk geweigerd', splitAt(one, 960, U, U, 1440), { ok: false, reason: 'before-completed-work' });
const p5 = s1.ok ? s1.pieces : [];
eq('T3 tweede split in het tweede stuk', (() => { const r = splitAt(p5, 3360, U, U); return r.ok && r.pieces.map(p => p.minutes); })(), [2400, 2400, 960, 480, 1440]);
eq('T3 split precies op een bestaande pauze geweigerd', splitAt(p5, 2400, U, U), { ok: false, reason: 'position-on-gap' });

eq('T3 pauze langer', (() => { const r = setGapLength(p5, 0, 3000, U); return r.ok && r.pieces.map(p => p.minutes); })(), [2400, 2880, 2400]);
eq('T3 pauze naar 0 = samenvoegen', (() => { const r = setGapLength(p5, 0, 0, U); return r.ok && r.pieces; })(), [{ kind: 'work', minutes: 4800 }]);
eq('T3 werkstuk korter verandert totaal', (() => { const r = setWorkLength(p5, 0, 1440, U); return r.ok && fromSplitPieces(r.pieces).totalWorkMinutes; })(), 3840);
eq('T3 werkstuk minimaal één eenheid', (() => { const r = setWorkLength(p5, 0, 10, U); return r.ok && r.pieces[0].minutes; })(), 480);
eq('T3 onbekende index', setGapLength(p5, 3, U, U), { ok: false, reason: 'index-out-of-range' });
eq('T3 removeAllGaps', removeAllGaps(p5), [{ kind: 'work', minutes: 4800 }]);

// Alleen het BEWERKTE stuk wordt gesnapt: een sub-dag-importgat blijft 100 minuten.
const sub = toSplitPieces([{ afterMinutes: 480, gapMinutes: 100 }, { afterMinutes: 1540, gapMinutes: 480 }], 2400)!;
eq('T3 onaangeraakt sub-dag-gat blijft', (() => { const r = setGapLength(sub, 1, 960, U); return r.ok && r.pieces.map(p => p.minutes); })(), [480, 100, 960, 960, 960]);
ok('T3 onaangeraakt gat houdt (geen) source', (() => { const r = setGapLength(sub, 1, 960, U); return r.ok && !('source' in r.pieces[1]); })());

// Adoptie: na een gebruikersbewerking zijn nivelleergaten van de gebruiker.
const lev = toSplitPieces([{ afterMinutes: 480, gapMinutes: 480, source: 'leveling' }, { afterMinutes: 1440, gapMinutes: 480 }], 1440)!;
eq('T3 adoptLevelingGaps', adoptLevelingGaps(lev).filter(p => p.kind === 'gap').map(p => (p as { source?: string }).source), ['user', undefined]);

// ── T4: splitsbaarheid, voltooid werk en de gat-klip ─────────────────────────
/** Minimale, volledige `Task` — zelfde vorm als `mkTask` in `check-advanced-cpm.ts`. */
function mk(o: {
  days: number; isMilestone?: boolean; isHammock?: boolean; manuallyScheduled?: boolean;
  durationType?: TaskTime['durationType']; splitGaps?: TaskSplitGap[];
  remainingTime?: number; completion?: number;
}): Task {
  return {
    id: 't', name: 't', description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: o.isMilestone ?? false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      ...createDefaultTaskTime('2026-06-01', o.days),
      ...(o.durationType ? { durationType: o.durationType } : {}),
      ...(o.remainingTime !== undefined ? { remainingTime: o.remainingTime } : {}),
      ...(o.completion !== undefined ? { completion: o.completion } : {}),
    },
    ...(o.isHammock ? { isHammock: true } : {}),
    ...(o.manuallyScheduled ? { manuallyScheduled: true } : {}),
    ...(o.splitGaps ? { splitGaps: o.splitGaps } : {}),
  };
}

eq('T4 gewone taak', canSplitTask(mk({ days: 10 }), 8, false), null);
eq('T4 mijlpaal', canSplitTask(mk({ days: 0, isMilestone: true }), 8, false), 'milestone');
eq('T4 verzameltaak', canSplitTask(mk({ days: 10 }), 8, true), 'summary');
eq('T4 hammock', canSplitTask(mk({ days: 10, isHammock: true }), 8, false), 'hammock');
eq('T4 elapsed', canSplitTask(mk({ days: 10, durationType: 'ELAPSEDTIME' }), 8, false), 'elapsed');
eq('T4 handmatig', canSplitTask(mk({ days: 10, manuallyScheduled: true }), 8, false), 'manual');
eq('T4 te kort', canSplitTask(mk({ days: 1 }), 8, false), 'too-short');
eq('T4 niet-bewerkbare importsplit', canSplitTask(mk({ days: 2, splitGaps: BEYOND }), 8, false), 'not-editable');
eq('T4 voltooid uit remainingTime', completedWorkMinutes(mk({ days: 10, remainingTime: 4 }), 8), 2880);
eq('T4 voltooid uit completion', completedWorkMinutes(mk({ days: 10, completion: 0.5 }), 8), 2400);
eq('T4 klip: gat voorbij nieuw werk vervalt', clipUserGapsToWork([{ afterMinutes: 480, gapMinutes: 480, source: 'user' }, { afterMinutes: 2400, gapMinutes: 480, source: 'user' }], 960),
  [{ afterMinutes: 480, gapMinutes: 480, source: 'user' }]);
eq('T4 klip raakt importgat niet', clipUserGapsToWork(BEYOND, 960), BEYOND);

// ── T5: datum → positie op de werk-as (etappe 2, het splitsgebaar) ───────────
// Dag-kalender ma–vr 8u zonder `workTime` — zelfde vorm als `check-split-walk.ts`s `DAY_CAL`
// (dwingt het `addWorkingDaysSigned`/`workDaysBetween`-pad af).
const T5_DAY_CAL: WorkCalendar = {
  id: 'cal-day-split-edit', name: 'dag', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const t5Eng = new CalendarEngine(T5_DAY_CAL);
const T5_HOUR_CAL: WorkCalendar = {
  ...T5_DAY_CAL, id: 'cal-hour-split-edit', name: 'uur',
  workTime: { byWeekday: {
    1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
  } },
};
const t5HourEng = new CalendarEngine(T5_HOUR_CAL);

const t5Start = parseDate('2026-06-01');            // maandag
const t5Ten = toSplitPieces(undefined, 4800)!;      // 10 werkdagen, geen gaten
const offs = (at: string, pieces = t5Ten) => workOffsetAtDate(pieces, t5Start, parseDate(at), t5Eng, false);

eq('T5 start zelf ⇒ 0', offs('2026-06-01'), { workMinutes: 0, inGap: false });
eq('T5 woensdag ⇒ twee werkdagen', offs('2026-06-03'), { workMinutes: 960, inGap: false });
eq('T5 zaterdag telt het weekend niet mee', offs('2026-06-06'), { workMinutes: 2400, inGap: false });
eq('T5 vóór de taakstart ⇒ 0', offs('2026-05-28'), { workMinutes: 0, inGap: false });

// Met een pauze van 5 werkdagen in het midden: [2400 werk][2400 pauze][2400 werk].
const t5Split = splitAt(t5Ten, 2400, 2400, 480);
ok('T5 fixture splitst', t5Split.ok);
const t5Pieces = t5Split.ok ? t5Split.pieces : t5Ten;
eq('T5 eerste pauzedag ⇒ inGap', offs('2026-06-08', t5Pieces), { workMinutes: 2400, inGap: true });
eq('T5 midden in de pauze ⇒ inGap', offs('2026-06-10', t5Pieces), { workMinutes: 2400, inGap: true });
eq('T5 eerste werkdag ná de pauze', offs('2026-06-15', t5Pieces), { workMinutes: 2400, inGap: false });
eq('T5 tweede werkdag ná de pauze', offs('2026-06-16', t5Pieces), { workMinutes: 2880, inGap: false });
eq('T5 voorbij het taakeinde klemt op het werktotaal', offs('2026-08-01', t5Pieces), { workMinutes: 4800, inGap: false });

// Uur-modus: de as is de werkminutenafstand, niet het aantal dagen.
eq('T5 uur-modus middaginstant', workOffsetAtDate(toSplitPieces(undefined, 2400)!, parseInstant('2026-06-01T08:00'),
  parseInstant('2026-06-01T12:00'), t5HourEng, true), { workMinutes: 240, inGap: false });

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  split-edit: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  split-edit: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
