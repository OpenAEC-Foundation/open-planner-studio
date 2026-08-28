// check-resource-load-splits.ts — computeResourceLoad wordt split- en taakkalender-bewust
// (B1c-W0.1). Drie groepen:
//
// (a) Splits: pauzedagen dragen geen last. `computeResourceLoad` mapte de curve-array vóór deze
//     wijziging op AANEENGESLOTEN werkdagen van de projectkalender tussen earlyStart/earlyFinish
//     (`enumerateWorkDays`) — dat slaat de `splitGaps`-pauzedagen van de taak zelf niet over, dus
//     een gesplitste taak boekte ten onrechte op de pauzedag. Referentiegeval identiek aan
//     `check-split-walk.ts`: taak 06-01..06-05, twee gaten van 1 werkdag na resp. dag 1 en
//     aspositie 1440 ⇒ de taak werkt op 06-01/06-03/06-05, niet op 06-02/06-04. Een FRONT_LOADED-
//     variant toetst daarbovenop dat de CURVE-VOLGORDE de echte werkdagen volgt (werkdag k draagt
//     gewicht k), niet de kalenderdagen inclusief de gaten.
//
// (b) Taakkalender: de dag-mapping moet de kalender van de TAAK volgen (dezelfde engine als de CPM-
//     duur/splits, `CPMSolver.calendarFor`/`resolveCalendar`), niet onvoorwaardelijk de project-
//     kalender. Een taak op een 6-daagse kalender (zaterdag werkdag) moet dus ook op zaterdag boeken
//     — én de CAPACITEITSZIJDE (die op de RESOURCE-kalender rekent, niet de taakkalender) moet die
//     zaterdag als een echt conflict zien: de resource kán daar simpelweg niet werken.
//
// (c) ELAPSEDTIME: `scheduleDuration` is voor zo'n taak KALENDERdagen, niet werkdagen
//     (`duration.ts`'s `elapsedMinutesOf`-docblok). De mapping moet dat getal dus NIET als
//     werkdagen-telling lezen (dat zou voorbij `earlyFinish` doorlopen), maar terugvallen op de
//     oude, op de spanne geklemde mapping. Reviewbevinding (reviewronde taak 3): duur 10, spanne
//     06-01..06-10 (met een weekend erin) belastte t/m 06-12 — twee dagen voorbij `earlyFinish`.
//
// Draait via run.sh. Exit 0 = alles groen.

import { computeResourceLoad } from '@/engine/scheduler/ResourceLoad';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// Projectkalender: ma-vr, 8u/dag — zelfde vorm als `check-split-walk.ts`s `DAY_CAL`.
const PROJECT_CAL: WorkCalendar = {
  id: 'cal-project', name: 'project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

/** Leaf-taak met doorgerekende datums (earlyStart/earlyFinish sturen de dag-mapping), zelfde
 *  veldvorm als `tests/library/check-occupancy.ts`s `task()`. */
function task(id: string, earlyStart: string, earlyFinish: string, durationDays: number, extra?: Partial<Task>): Task {
  return {
    id, name: id, description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: durationDays,
      scheduleStart: earlyStart, scheduleFinish: earlyFinish,
      earlyStart, earlyFinish, lateStart: earlyStart, lateFinish: earlyFinish,
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    ...extra,
  };
}

function res(id: string, maxUnits = 1, extra?: Partial<Resource>): Resource {
  return { id, name: id, type: 'LABOR', description: '', maxUnits, ...extra };
}

function assign(id: string, taskId: string, resourceId: string, unitsPerDay: number): ResourceAssignment {
  return { id, taskId, resourceId, unitsPerDay, curve: 'UNIFORM' };
}

// ═══════════════════════════════════════════════════════════════════════════
// (a) Splits: pauzedagen dragen geen last.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- resource-load-splits: splits slaan pauzedagen over --');
{
  const taskA = task('t-a', '2026-06-01', '2026-06-05', 3, {
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  const resourceR = res('r-a', 1);
  const assignments = [assign('a-a', 't-a', 'r-a', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskA], PROJECT_CAL, []);
  const daily = result.load['r-a'] ?? {};

  eq('06-01 belast met 1', daily['2026-06-01'], 1);
  eq('06-03 belast met 1', daily['2026-06-03'], 1);
  eq('06-05 belast met 1', daily['2026-06-05'], 1);
  eq('06-02 (pauzedag) draagt geen last', daily['2026-06-02'], undefined);
  eq('06-04 (pauzedag) draagt geen last', daily['2026-06-04'], undefined);
  eq('geen extra dagen dan de drie werkdagen', Object.keys(daily).sort(), ['2026-06-01', '2026-06-03', '2026-06-05']);
}

// FRONT_LOADED-variant: de curve moet de ECHTE werkdagen aflopen (index i → i-de werkdag), niet de
// kalenderdagen mét gaten erin — anders zou de piek op een pauzedag terechtkomen of verschuiven.
// distributeUnits(1, 3, FRONT_LOADED) = [2, 1, 0] (aflopend); die drie waarden horen dus exact op
// de drie werkdagen 06-01/06-03/06-05 te landen, in die volgorde.
console.log('-- resource-load-splits: FRONT_LOADED-curve volgt de echte werkdagen (niet de kalenderdagen) --');
{
  const taskAFront = task('t-a-front', '2026-06-01', '2026-06-05', 3, {
    splitGaps: [
      { afterMinutes: 480, gapMinutes: 480 },
      { afterMinutes: 1440, gapMinutes: 480 },
    ],
  });
  const resourceR = res('r-a-front', 5);
  const assignments = [{ id: 'a-a-front', taskId: 't-a-front', resourceId: 'r-a-front', unitsPerDay: 1, curve: 'FRONT_LOADED' as const }];

  const result = computeResourceLoad([resourceR], assignments, [taskAFront], PROJECT_CAL, []);
  const daily = result.load['r-a-front'] ?? {};

  eq('werkdag 1 (06-01) draagt het hoogste gewicht (2)', daily['2026-06-01'], 2);
  eq('werkdag 2 (06-03, ná het eerste gat) draagt het middelste gewicht (1)', daily['2026-06-03'], 1);
  eq('werkdag 3 (06-05, ná het tweede gat) draagt het laagste gewicht (0)', daily['2026-06-05'], 0);
  eq('pauzedagen blijven buiten de mapping', [daily['2026-06-02'], daily['2026-06-04']], [undefined, undefined]);
}

// ═══════════════════════════════════════════════════════════════════════════
// (b) Taakkalender: de last volgt de kalender van de taak, niet de projectkalender.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- resource-load-splits: taak met eigen (6-daagse) kalender --');
{
  // 6-daagse kalender: ma-za werkdagen (za = 6 is werkdag, zo = 7 is vrij).
  const SIX_DAY_CAL: WorkCalendar = {
    id: 'cal-six-day', name: 'zesdaags', description: '', workDays: [1, 2, 3, 4, 5, 6],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  // Taak B: 3 werkdagen vanaf vrijdag 2026-06-05 op de 6-daagse kalender ⇒ vr 06-05, za 06-06
  // (projectkalender zou hier overslaan), ma 06-08 (zondag 06-07 is vrij ook op de 6-daagse
  // kalender). `earlyFinish` (06-09) is bewust ruimer dan de drie werkdagen die de mapping oplevert
  // — dat is GEEN toeval-vermijding meer maar het echte, sinds W0.1 bewuste gedrag: de mapping
  // negeert `earlyFinish` volledig en loopt exact `scheduleDuration` (3) werkdagen vanaf `earlyStart`
  // op de taakkalender (zie het earlyFinish-besluit in `ResourceLoad.ts`'s docblok). Was de mapping
  // wél op `earlyFinish` geklemd geweest, dan had 06-09 nog binnen de spanne gevallen; de test op
  // "di 06-09 draagt geen last" hieronder bewijst dus specifiek dát de mapping earlyFinish negeert.
  const taskB = task('t-b', '2026-06-05', '2026-06-09', 3, { calendarId: 'cal-six-day' });
  // Resource B heeft BEWUST géén eigen calendarId: haar capaciteit rekent dus op de projectkalender
  // (ma-vr) — een andere kalender dan de taak (6-daags). Dat maakt za 06-06 een taak-werkdag waarop
  // de RESOURCE niet kan werken: een gewenst, geen vals-positief conflict (zie docblok punt 4).
  const resourceR = res('r-b', 1);
  const assignments = [assign('a-b', 't-b', 'r-b', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskB], PROJECT_CAL, [SIX_DAY_CAL]);
  const daily = result.load['r-b'] ?? {};

  eq('vr 06-05 belast met 1', daily['2026-06-05'], 1);
  eq('za 06-06 (werkdag op de taakkalender) belast met 1', daily['2026-06-06'], 1);
  eq('ma 06-08 belast met 1', daily['2026-06-08'], 1);
  eq('di 06-09 draagt geen last (earlyFinish wordt genegeerd, de duur is al verbruikt)', daily['2026-06-09'], undefined);
  eq('zo 06-07 draagt geen last (vrij, ook op de taakkalender)', daily['2026-06-07'], undefined);
  eq('geen extra dagen dan de drie werkdagen', Object.keys(daily).sort(), ['2026-06-05', '2026-06-06', '2026-06-08']);

  // Capaciteitszijde: za 06-06 is 0 op de RESOURCE-kalender (projectkalender, ma-vr) en dus een
  // conflictdag — de resource kan er simpelweg niet werken, ongeacht wat de taak plant.
  eq('capaciteit op za 06-06 (resource-kalender) is 0', result.capacity['r-b']?.['2026-06-06'], 0);
  ok('za 06-06 is overallocated (taak werkt, resource-kalender niet)',
    (result.overallocatedDays['r-b'] ?? []).includes('2026-06-06'));
}

// ═══════════════════════════════════════════════════════════════════════════
// (c) ELAPSEDTIME: scheduleDuration is kalenderdagen — de mapping mag niet voorbij earlyFinish lopen.
// ═══════════════════════════════════════════════════════════════════════════
console.log('-- resource-load-splits: ELAPSEDTIME — belasting stopt op earlyFinish --');
{
  // 2026-06-01 is een maandag (zelfde ankerdag als groep a/check-split-walk.ts). Spanne 06-01..06-10
  // bevat één weekend (06-06/06-07) ⇒ 8 werkdagen (01,02,03,04,05,08,09,10). scheduleDuration=10 is
  // hier KALENDERdagen (ELAPSEDTIME) — géén werkdagen-telling. Vóór deze fix las de mapping 10 als
  // werkdagen-telling en liep door tot en met 06-12 (twee werkdagen voorbij earlyFinish).
  const base = task('t-c', '2026-06-01', '2026-06-10', 10);
  const taskC: Task = { ...base, time: { ...base.time, durationType: 'ELAPSEDTIME' } };
  const resourceR = res('r-c', 10);
  const assignments = [assign('a-c', 't-c', 'r-c', 1)];

  const result = computeResourceLoad([resourceR], assignments, [taskC], PROJECT_CAL, []);
  const daily = result.load['r-c'] ?? {};

  eq('laatste werkdag binnen de spanne (06-10) draagt last', daily['2026-06-10'], 1);
  eq('06-11 (voorbij earlyFinish) draagt geen last', daily['2026-06-11'], undefined);
  eq('06-12 (voorbij earlyFinish, de oude bug) draagt geen last', daily['2026-06-12'], undefined);
  eq(
    'exact de 8 werkdagen binnen 06-01..06-10, geen dag erbuiten',
    Object.keys(daily).sort(),
    ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09', '2026-06-10'],
  );
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  resource-load-splits: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  resource-load-splits: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
