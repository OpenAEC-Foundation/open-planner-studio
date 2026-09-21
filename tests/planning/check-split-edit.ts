// check-split-edit.ts — het pure bewerkmodel voor gebruikerssplits (issue #146, spec
// 2026-09-19-taken-splitsen-bewerken-design.md). Fixtures zijn GECOMMIT: het .mpp-corpus staat
// niet in de repo en is dus geen poort.
import type { TaskSplitGap } from '@/types/task';
import { fromSplitPieces, isWellFormedSplit, toSplitPieces } from '@/engine/scheduler/splitEdit';

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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  split-edit: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  split-edit: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
