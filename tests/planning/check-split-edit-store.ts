// check-split-edit-store.ts — de STORE-kant van gebruikerssplits (issue #146, spec
// 2026-09-19-taken-splitsen-bewerken-design.md §2): de solver-fix voor een dag-taak op een
// kalender met werktijdbanden, en `taskSlice.setTaskSplits` als tijdbasis-bewerking.
//
// Elk scenario krijgt een EIGEN verse `createAppStoreContext()` — zelfde patroon als
// `check-commands.ts` — zodat undo-chronologie en meldingen van het ene geval niet in het
// volgende lekken.
//
// MOET de eerste import blijven: `@/i18n/config` raakt `document` bij het laden en imports worden
// gehoist. Zie domStub.ts.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import type { AppState } from '@/state/appStore';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void { checks++; if (!cond) diffs.push(label); }
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const BANDS = [{ start: 480, end: 960 }]; // 08:00–16:00
const WEEK: WorkTimeBands = { byWeekday: { 1: BANDS, 2: BANDS, 3: BANDS, 4: BANDS, 5: BANDS, 6: [], 7: [] } };
/** Kalender MÉT `workTime` ⇒ `CalendarEngine.isHourMode === true`, terwijl de taak zelf in DAGEN
 *  blijft rekenen: precies de tak van `addDurationChecked`/`subDuration` die bevinding 2a raakt. */
const BAND_CAL: WorkCalendar = {
  id: 'cal-banden', name: 'banden', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: WEEK,
};

function freshStore(calendar?: WorkCalendar): () => AppState {
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  if (calendar) S().setCalendar(calendar);
  return S;
}

// ═══════════════════════════════════════════════════════════════════════════
// Task 5 — solver-fix: een DAG-taak op een kalender met banden telt `splitGaps` mee.
// `addDurationChecked`s `eng.isHourMode`-tak (dag-taak, uur-kalender) rekende met de kale
// `task.time.scheduleDuration` en negeerde de gaten; `subDuration` spiegelde die fout.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- split-edit-store: solver-fix dag-taak op bandenkalender (T5) --');
{
  const S = freshStore(BAND_CAL);
  const id = S().addTask({
    name: 'Gesplitste dagtaak',
    time: createDefaultTaskTime('2026-06-01', 4),
    // 2 werkdagen werk, 2 werkdagen pauze, 2 werkdagen werk ⇒ spanne 6 werkdagen.
    splitGaps: [{ afterMinutes: 960, gapMinutes: 960, source: 'user' }],
  });
  S().runCPM();
  const t = S().tasks.find(x => x.id === id)!;
  eq('T5 earlyStart blijft de projectstart', t.time.earlyStart, '2026-06-01T08:00');
  eq('T5 earlyFinish telt de pauzedagen mee (4 werk + 2 pauze)', t.time.earlyFinish, '2026-06-08T16:00');
  // De backward-spiegel: zonder dezelfde gaten-bewuste aftrek in `subDuration` zou LS−ES afwijken
  // van LF−EF en ontstaat er spookfloat op de enige taak van het project.
  eq('T5 lateStart spiegelt de gaten-bewuste duur', t.time.lateStart, t.time.earlyStart);
  eq('T5 lateFinish spiegelt de gaten-bewuste duur', t.time.lateFinish, t.time.earlyFinish);
  eq('T5 enige taak ⇒ geen speling', t.time.totalFloat, 0);

  // Gatloos op dezelfde kalender: byte-identiek aan vóór de fix (4 werkdagen ⇒ do 06-04).
  const S2 = freshStore(BAND_CAL);
  const plainId = S2().addTask({
    name: 'Gatloze dagtaak',
    time: createDefaultTaskTime('2026-06-01', 4),
  });
  S2().runCPM();
  eq('T5 gatloze taak ongewijzigd', S2().tasks.find(x => x.id === plainId)!.time.earlyFinish, '2026-06-04T16:00');
  ok('T5 gatloze taak houdt een lege gatenlijst', S2().tasks.find(x => x.id === plainId)!.splitGaps === undefined);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) { console.log(`OK  split-edit-store: alle checks groen (${checks})`); process.exit(0); }
console.log(`XX  split-edit-store: ${diffs.length} afwijking(en) van ${checks}`);
for (const d of diffs) console.log(`   - ${d}`);
process.exit(1);
