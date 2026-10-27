import './domStub';
// Uren per dag bij een wissel van werkdagen (review PR #352, punt 1).
//
// `hoursPerDay` is de omrekening tussen dagen en uren (P6 `day_hr_cnt`) en mag afwijken van de blokken:
// XER "Late ploeg" 14:00–24:00 (10 klokuren) met `day_hr_cnt` 8. Een werkdagknop in het kalendervenster
// (`workDayTogglePatch`), de knop *Ma–vr* en MCP met alleen `workDays` (`workDaysSetPatch`) zetten
// `hoursPerDay` op de modale dagsom van de nieuwe blokken. Zo werd Late ploeg na *Za* aan stil 10. De
// datums bleven gelijk (de motor rekent met de blokken), maar de P6-export (`HoursPerDay`) en de dagwaarde
// van urentaken na opslaan en heropenen volgden 10.
//
// Besluit orkestrator: een afwijkende `hoursPerDay` is projectdata en blijft staan. Hij volgt de blokken
// alleen als hij bij de beginstand gelijk was aan de modale dagsom. De beginstand is de kalender zoals het
// venster hem opende (of na de laatste preset); één MCP-call is één sessie. Alle wissels in een sessie samen
// tellen als één wissel, ook die in het blok *Werktijden*. Eén regel voor venster en MCP
// (`hoursPerDayFollowsBlocks`/`hoursPerDayForBlocks` in `src/services/subdayIo.ts`).
//
//  §1 `workDayTogglePatch` (één werkdagknop): afwijkend blijft staan, gelijk volgt de blokken, ook als de
//     modale dagsom verandert; een week zonder blok volgt de nieuwe blokken.
//  §2 `workDaysSetPatch` (*Ma–vr*, MCP): dezelfde regel; de hele zet telt als één wissel.
//  §3 één werkdag erbij of eraf geeft via beide functies precies hetzelfde.
//  §4 de route van het venster (Toepassen = `commitCalendarLibrary` + doorrekenen), daarna opslaan als IFC
//     en heropenen: uren per dag, dagwaarde, getoonde duur, datums en de P6-export gelijk.
//  §5 (alleen met `OPS_XER_CORPUS`) hetzelfde op de echte Roads_Project_TEC.xer (wissel Do: die kalenders
//     werken al op zaterdag).
//  §6 de sessieregel (review #354): de klikvolgorde telt niet, een lege tussenweek verzint geen pauze, het
//     blok *Werktijden* volgt dezelfde regel, en de vergelijking is strikt.
//  §7 XER zonder `day_hr_cnt`: het gemiddelde in minuten, zonder kommaruis (7,6 u is 7.6, geen afwijking).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  deriveHoursPerDay, hoursPerDayFollowsBlocks, hoursPerDayForBlocks, workDayTogglePatch, workDaysSetPatch,
  type WorkTimeSessionStart,
} from '@/services/subdayIo';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { effectiveCalendarOf, formatTaskDurationDisplay } from '@/utils/taskDuration';
import { writeP6XMLWithReport } from '@/services/p6/p6xmlWriter';
import type { DocumentPayload } from '@/state/documentContract';
import type { OpenedImport } from '@/services/importTypes';
import type { WorkCalendar } from '@/types/calendar';
import { buildProject, CASES, on, week, type Band, type Day } from './urenperdagBlokken';

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

let checks = 0;
const failures: string[] = [];
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}\n        verwacht ${JSON.stringify(want).slice(0, 600)}\n        kreeg    ${JSON.stringify(got).slice(0, 600)}`);
  }
}

const LATE: Band[] = [{ start: 840, end: 1440 }]; // 14:00–24:00, 10 klokuren
const H8: Band[] = [{ start: 420, end: 900 }]; // 07:00–15:00
const H10: Band[] = [{ start: 420, end: 1020 }]; // 07:00–17:00
const H6: Band[] = [{ start: 420, end: 780 }]; // 07:00–13:00
const H9: Band[] = [{ start: 420, end: 960 }]; // 07:00–16:00
const H0818: Band[] = [{ start: 480, end: 1080 }]; // 08:00–18:00
const H76: Band[] = [{ start: 420, end: 876 }]; // 07:00–14:36, 7,6 uur
const MA_VR: readonly Day[] = [1, 2, 3, 4, 5];

function hourCal(name: string, byDay: Partial<Record<Day, Band[]>>, hoursPerDay: number): WorkCalendar {
  const workTime = week(byDay);
  const workDays = ([1, 2, 3, 4, 5, 6, 7] as Day[]).filter((d) => workTime.byWeekday[d].length > 0);
  return { id: `cal-${name}`, name, description: '', workDays, holidays: [], workTime, workStartHour: 7, workEndHour: 17, hoursPerDay };
}
const view = (p: Partial<WorkCalendar>) => ({ workDays: p.workDays, hoursPerDay: p.hoursPerDay, byWeekday: p.workTime?.byWeekday });

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §1 Eén werkdagknop (`workDayTogglePatch`)
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const late = hourCal('Late ploeg', on(MA_VR, LATE), 8);
  const za = workDayTogglePatch(late, 6, late);
  same('§1 Late ploeg (8 u/dag), Za aan: werkdagen ma–za, za 14–24, uren per dag blijven 8',
    [za.workDays, za.workTime?.byWeekday[6], za.hoursPerDay], [[1, 2, 3, 4, 5, 6], LATE, 8]);
  const vr = workDayTogglePatch(late, 5, late);
  same('§1 Late ploeg (8 u/dag), Vr uit: uren per dag blijven 8', [vr.workDays, vr.workTime?.byWeekday[5], vr.hoursPerDay],
    [[1, 2, 3, 4], [], 8]);
  const back = workDayTogglePatch({ ...late, ...za }, 6, late);
  same('§1 Late ploeg, Za aan en weer uit: alles terug zoals het was', view({ ...late, ...back }), view(late));

  // Gelijk aan de blokken: de uren per dag volgen de blokken.
  const lateGelijk = hourCal('Late ploeg 10', on(MA_VR, LATE), 10);
  same('§1 Late ploeg (10 u/dag = blokken), Za aan: 10', workDayTogglePatch(lateGelijk, 6).hoursPerDay, 10);

  // De modale dagsom verandert door de wissel: ma–wo 8 u, do–vr 10 u (modaal 8). Ma uit ⇒ di/wo 8, do/vr 10:
  // gelijkspel, de hoogste wint ⇒ 10.
  const gemengd = { ...on([1, 2, 3], H8), ...on([4, 5], H10) };
  same('§1 gelijk (8 = modaal 8), Ma uit ⇒ modaal 10: de uren per dag volgen naar 10',
    workDayTogglePatch(hourCal('Gemengd 8', gemengd, 8), 1).hoursPerDay, 10);
  same('§1 afwijkend (7,5 ≠ modaal 8), Ma uit ⇒ modaal 10: de uren per dag blijven 7,5',
    workDayTogglePatch(hourCal('Gemengd 7,5', gemengd, 7.5), 1).hoursPerDay, 7.5);
  // Afwijkend en de wissel maakt de blokken gelijk aan de uren per dag: hij bleef staan, dus 10 blijft 10.
  // Geopend als ma–wo 8 u, do/vr 10 u met 10 u/dag (modaal 8); do ging uit en gaat nu weer aan (10 u).
  const geopend = hourCal('Afwijkend 10', { ...on([1, 2, 3], H8), ...on([4, 5], H10) }, 10);
  same('§1 afwijkend (10 ≠ modaal 8), Do aan met zijn eigen 10 u: blijft 10',
    workDayTogglePatch(hourCal('Afwijkend 10', { ...on([1, 2, 3], H8), ...on([5], H10) }, 10), 4, geopend).hoursPerDay, 10);

  // Een week zonder enig blok heeft geen dagsom: de nieuwe blokken bepalen de uren per dag. Netto 10 u in een
  // spanne van 9 u levert geen blokken uit de enkelvoudige werkdag, dus de standaardwerkdag (8 u).
  const leeg = { ...hourCal('Leeg', {}, 10), workStartHour: 7, workEndHour: 16 };
  const ma = workDayTogglePatch(leeg, 1);
  same('§1 week zonder blok (10 u/dag), Ma aan: standaardwerkdag, uren per dag volgen naar 8',
    [ma.workDays, ma.workTime?.byWeekday[1], ma.hoursPerDay], [[1], [{ start: 420, end: 720 }, { start: 780, end: 960 }], 8]);

  // Dagkalender: alleen de werkdagen, de uren per dag blijven buiten de patch.
  same('§1 dagkalender: alleen workDays', workDayTogglePatch({ ...late, workTime: undefined }, 6), { workDays: [1, 2, 3, 4, 5, 6] });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §2 Werkdagen in één keer (`workDaysSetPatch`: knop Ma–vr, MCP met alleen workDays)
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const late = hourCal('Late ploeg', on(MA_VR, LATE), 8);
  const six = workDaysSetPatch(late, [1, 2, 3, 4, 5, 6]);
  same('§2 Late ploeg (8 u/dag), workDays [1..6] (het voorbeeld van de review): za 14–24, uren per dag 8',
    [six.workDays, six.workTime?.byWeekday[6], six.hoursPerDay], [[1, 2, 3, 4, 5, 6], LATE, 8]);
  same('§2 Late ploeg, Ma–vr terwijl ma–vr al aan staat: niets verandert', view({ ...late, ...workDaysSetPatch(late, MA_VR) }), view(late));
  same('§2 Late ploeg, workDays [1..4]: uren per dag 8', workDaysSetPatch(late, [1, 2, 3, 4]).hoursPerDay, 8);
  same('§2 Late ploeg (10 u/dag = blokken), workDays [1..6]: 10',
    workDaysSetPatch(hourCal('Late ploeg 10', on(MA_VR, LATE), 10), [1, 2, 3, 4, 5, 6]).hoursPerDay, 10);

  const gemengd = { ...on([1, 2, 3], H8), ...on([4, 5], H10) };
  same('§2 gelijk (8 = modaal 8), workDays [2..5] ⇒ modaal 10: volgt naar 10',
    workDaysSetPatch(hourCal('Gemengd 8', gemengd, 8), [2, 3, 4, 5]).hoursPerDay, 10);
  same('§2 afwijkend (7,5), workDays [2..5]: blijft 7,5',
    workDaysSetPatch(hourCal('Gemengd 7,5', gemengd, 7.5), [2, 3, 4, 5]).hoursPerDay, 7.5);

  // De hele zet is één wissel. Geopend als ma 10 u, di/wo 8 u, do/vr/za 6 u met 8 u/dag (modaal 6: afwijkend);
  // daarna stonden alleen ma aan. Naar di–za met hun eigen blokken. Per dag doorgerekend raakte de tussenstand
  // ma 10 + di/wo 8 de 8 (modaal 8) en volgde de rest naar 6. Als één wissel: de 8 week af, dus hij blijft 8.
  const alleenMa = hourCal('Alleen ma', { 1: H10 }, 8);
  const opened = { workTime: week({ 1: H10, 2: H8, 3: H8, 4: H6, 5: H6, 6: H6 }), hoursPerDay: 8 };
  const zet = workDaysSetPatch(alleenMa, [2, 3, 4, 5, 6], opened);
  same('§2 de hele zet is één wissel: afwijkend (8 bij modaal 6), naar di–za (8, 8, 6, 6, 6): blijft 8',
    [zet.workDays, zet.workTime?.byWeekday[1], zet.workTime?.byWeekday[4], zet.hoursPerDay], [[2, 3, 4, 5, 6], [], H6, 8]);
  // Zonder beginstand (MCP) is de kalender zelf de beginstand: alleen ma 10 u met 8 u/dag week af, dus 8.
  same('§2 zonder beginstand: de kalender vóór de zet telt (ma 10 u, 8 u/dag), naar di–vr: blijft 8',
    workDaysSetPatch(alleenMa, [2, 3, 4, 5]).hoursPerDay, 8);

  same('§2 dagkalender: alleen workDays', workDaysSetPatch({ ...late, workTime: undefined }, [1, 2, 3, 4, 5, 6]),
    { workDays: [1, 2, 3, 4, 5, 6] });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §3 Eén werkdag erbij of eraf: venster (werkdagknop) en MCP (workDaysSetPatch) geven hetzelfde
// ════════════════════════════════════════════════════════════════════════════════════════════════
{
  const cals: WorkCalendar[] = [
    ...CASES.map((c) => c.cal),
    hourCal('Gemengd 8', { ...on([1, 2, 3], H8), ...on([4, 5], H10) }, 8),
    hourCal('Gemengd 7,5', { ...on([1, 2, 3], H8), ...on([4, 5], H10) }, 7.5),
  ];
  for (const cal of cals) {
    for (const day of [1, 4, 6, 7]) {
      const days = cal.workDays.includes(day) ? cal.workDays.filter((d) => d !== day) : [...cal.workDays, day];
      same(`§3 ${cal.name}, dag ${day} wisselt: werkdagknop = workDaysSetPatch`,
        view(workDaysSetPatch(cal, days, cal)), view(workDayTogglePatch(cal, day, cal)));
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §4 De route van het venster, daarna opslaan als IFC en heropenen
// ════════════════════════════════════════════════════════════════════════════════════════════════
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
const quiet = <T>(fn: () => T): T => {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
};

function openInStore(parsed: OpenedImport) {
  const ctx = createAppStoreContext();
  ctx.store.getState().applyOpenedImport(parsed, OPEN);
  return ctx;
}
type Ctx = ReturnType<typeof openInStore>;
const payloadOf = (ctx: Ctx): DocumentPayload => {
  const s = ctx.store.getState();
  return s.getOpenDocumentPayloads().find((d) => d.payload.project.id === s.project.id)!.payload;
};

/** Toepassen in het kalendervenster: per kalender de werkdagknop van dag `day`, dan in één keer de hele
 *  bibliotheek vastleggen (`commitCalendarLibrary`) en doorrekenen — zoals `CalendarDialog.confirm`. */
function toggleInDialog(ctx: Ctx, names: ReadonlySet<string>, day: number): void {
  const s = ctx.store.getState();
  const next = s.calendars.map((c) => (names.has(c.name) ? { ...c, ...workDayTogglePatch(c, day, c) } : c));
  if (!s.commitCalendarLibrary(next, s.project.calendarId)) failures.push('§4/§5 commitCalendarLibrary legde niets vast');
  s.runCPM();
}

const calView = (p: DocumentPayload) => Object.fromEntries([p.calendar, ...p.calendars].map((c) => [c.name, {
  workDays: c.workDays, hoursPerDay: c.hoursPerDay, za: c.workTime?.byWeekday[6] ?? null,
}]));
const taskView = (p: DocumentPayload) => Object.fromEntries(p.tasks.map((t) => {
  const cal = effectiveCalendarOf(t, p.calendar, p.calendars);
  const x = t.time;
  return [t.id, {
    dur: x.scheduleDuration, min: x.durationMinutes ?? null,
    days: formatTaskDurationDisplay(t, cal, 'days'),
    dates: [x.scheduleStart, x.scheduleFinish, x.earlyStart, x.earlyFinish, x.lateStart, x.lateFinish],
  }];
}));
/** `Naam | HoursPerDay` per kalender van de P6-export, gesorteerd. */
const p6Hours = (p: DocumentPayload): string[] => {
  const xml = quiet(() => writeP6XMLWithReport(p.project, p.calendar, p.tasks, p.sequences, p.resources, p.assignments,
    p.calendars, p.customTaskTypes).xml);
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? '';
  return [...xml.matchAll(/<Calendar>([\s\S]*?)<\/Calendar>/g)].map((m) => `${tag(m[1], 'Name')} | ${tag(m[1], 'HoursPerDay')}`).sort();
};
const changedIds = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  Object.keys(a).filter((id) => JSON.stringify(a[id]) !== JSON.stringify(b[id]));

{
  // Alle gevallen behalve de kalender die de writer anders schrijft (`written`, zie urenperdagBlokken.ts).
  const stable = CASES.filter((c) => !c.written);
  const ctx = openInStore(buildProject(stable));
  const names = new Set(stable.map((c) => c.cal.name));
  toggleInDialog(ctx, names, 6);
  const before = payloadOf(ctx);
  const cals = calView(before);
  // Zaterdag wisselt overal (Fractie had al za: die gaat uit); de uren per dag blijven bij elk geval staan.
  same('§4 na Za in het venster: de uren per dag van elke kalender ongewijzigd',
    stable.map((c) => [c.cal.name, cals[c.cal.name]?.hoursPerDay]), stable.map((c) => [c.cal.name, c.cal.hoursPerDay]));
  same('§4 na Za in het venster: Late ploeg werkt ma–za, za 14–24', [cals['Late ploeg']?.workDays, cals['Late ploeg']?.za],
    [[1, 2, 3, 4, 5, 6], LATE]);
  const lateTask = before.tasks.find((t) => t.id === 't-late')!;
  // Eigenaarsbesluit 2026-10-15, optie 2: de dagwaarde is werkminuten ÷ de werktijd per dag van de blokken
  // (40 / 10), net als de getoonde duur en de motor; de uren per dag (8) blijven alleen voor de export.
  same('§4 urentaak van 40 u op Late ploeg: dagwaarde 4 (40 / 10 klokuren), getoond 4d',
    [lateTask.time.scheduleDuration, formatTaskDurationDisplay(lateTask, before.calendar, 'days')], [4, '4d(40h)']);

  const afterCtx = openInStore(await parseOpenedFile({ name: 'dagwissel.ifc', text: writeIFC(buildWriteIFCInput(before)) }));
  const after = payloadOf(afterCtx);
  same('§4 kalenders (werkdagen, uren per dag, za) gelijk na opslaan en heropenen', calView(after), cals);
  const tb = taskView(before);
  const ta = taskView(after);
  same('§4 taken met een andere dagwaarde, getoonde duur of datums na opslaan en heropenen',
    changedIds(tb, ta).map((id) => ({ id, voor: tb[id], na: ta[id] })), []);
  same('§4 uren per dag in de P6-export gelijk vóór en na opslaan', p6Hours(after), p6Hours(before));
  same('§4 P6-export: Late ploeg HoursPerDay 8', p6Hours(before).find((l) => l.startsWith('Late ploeg |')), 'Late ploeg | 8');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §5 (OPS_XER_CORPUS) De echte Roads_Project_TEC.xer: drie kalenders met day_hr_cnt 8 en 9–10 klokuren.
//    Gemeten op main a40561fa9 (zonder de fix): na Do in het venster werden de uren per dag 10 (5d/Week),
//    9 (OCEC) en 10 (7d/W), en na opslaan en heropenen veranderde de dagwaarde van de urentaken (233,75 → 187).
// ════════════════════════════════════════════════════════════════════════════════════════════════
const root = process.env.OPS_XER_CORPUS;
const ROADS = { name: 'Roads_Project_TEC.xer', sha256: 'a2ef7b35c00d8cf8ba75230d71d69b96130f7f689495e86a4cf5f8fcd34431ae' };
function findByName(dir: string, name: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findByName(full, name));
    else if (entry.isFile() && entry.name === name) out.push(full);
  }
  return out;
}
let corpus = 'niet aanwezig (OPS_XER_CORPUS)';
if (root && !existsSync(root)) {
  same('§5 OPS_XER_CORPUS bestaat', false, true);
} else if (root) {
  const path = findByName(root, ROADS.name)
    .find((p) => createHash('sha256').update(readFileSync(p)).digest('hex') === ROADS.sha256);
  if (!path) {
    same(`§5 ${ROADS.name} met de gepinde sha256 in het corpus`, null, ROADS.sha256);
  } else {
    const parsed = await parseOpenedFile({ name: ROADS.name, bytes: new Uint8Array(readFileSync(path)) });
    const ctx = quiet(() => openInStore(parsed));
    const start = payloadOf(ctx);
    const deviating = [start.calendar, ...start.calendars]
      .filter((c) => c.workTime && c.hoursPerDay !== deriveHoursPerDay(c.workTime, NaN));
    const names = new Set(deviating.map((c) => c.name));
    same('§5 Roads: uurkalenders met uren per dag ≠ blokken (testvoorwaarde)',
      [...new Set(deviating.map((c) => `${c.name} | ${c.hoursPerDay} | ${deriveHoursPerDay(c.workTime!, NaN)}`))].sort(),
      ['OCEC All Items-5d/Week | 8 | 10', 'OCEC Procurment/Curing-7d/W | 8 | 10', 'OCEC | 8 | 9']);
    // Deze kalenders werken al op zaterdag (week za–wo). Donderdag wisselt in beide richtingen: bij 5d/Week en
    // OCEC gaat hij aan (kopie van de eerste werkdag met blokken), bij 7d/W gaat hij uit.
    quiet(() => toggleInDialog(ctx, names, 4));
    const before = payloadOf(ctx);
    const cals = calView(before);
    same('§5 Roads na Do in het venster: de uren per dag blijven 8', [...names].sort().map((n) => [n, cals[n]?.hoursPerDay]),
      [...names].sort().map((n) => [n, 8]));
    same('§5 Roads na Do in het venster: do is gewisseld (5d/Week en OCEC aan, 7d/W uit)',
      [...names].sort().map((n) => [n, cals[n]?.workDays.includes(4)]),
      [['OCEC', true], ['OCEC All Items-5d/Week', true], ['OCEC Procurment/Curing-7d/W', false]]);
    // Opslaan als IFC en heropenen via de echte openroute.
    const reparsed = await parseOpenedFile({ name: 'roads.ifc', text: writeIFC(buildWriteIFCInput(before)) });
    const after = payloadOf(quiet(() => openInStore(reparsed)));
    same('§5 Roads: kalenders (werkdagen, uren per dag, za) gelijk na opslaan en heropenen', calView(after), cals);
    const tb = taskView(before);
    const ta = taskView(after);
    const hourTasks = before.tasks.filter((t) => t.time.durationUnit === 'hours' && t.childIds.length === 0
      && names.has(effectiveCalendarOf(t, before.calendar, before.calendars).name)).length;
    same('§5 Roads: urentaken (geen samenvattingen) op die kalenders (testvoorwaarde: de toets raakt ze echt)', hourTasks, 1193);
    same(`§5 Roads: taken met een andere dagwaarde, getoonde duur of datums na opslaan en heropenen (van ${Object.keys(tb).length})`,
      changedIds(tb, ta).slice(0, 5).map((id) => ({ id, voor: tb[id], na: ta[id] })), []);
    same('§5 Roads: uren per dag in de P6-export gelijk vóór en na opslaan', p6Hours(after), p6Hours(before));
    corpus = `Roads: ${names.size} kalenders, ${hourTasks} urentaken`;
  }
}
console.log(`-- urenperdag-dagwissel: corpus ${corpus}`);

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §6 De sessieregel (review #354): beginstand, klikvolgorde, lege tussenweek, blok Werktijden, strikt
// ════════════════════════════════════════════════════════════════════════════════════════════════
/** Het venster: elke klik is één `workDayTogglePatch` op de draft van dat moment, met de beginstand van de
 *  sessie (`CalendarForm.toggleWorkDay`). */
function clicks(cal: WorkCalendar, days: readonly number[], start: WorkTimeSessionStart = cal): WorkCalendar {
  let cur = cal;
  for (const d of days) cur = { ...cur, ...workDayTogglePatch(cur, d, start) };
  return cur;
}
{
  // a. De klikvolgorde telt niet. P6-kalender ma–do 9 u, vr 8 u, day_hr_cnt 8 (modaal 9: afwijkend). Per klik
  //    vergeleken gaf "ma t/m do uit, ma weer aan" 9 (de tussenstand alleen vr 8 u leek gelijk), en "di, wo,
  //    do uit" 8. Met de beginstand van de sessie geven beide 8.
  const p6 = hourCal('P6 9/8', { ...on([1, 2, 3, 4], H9), 5: H8 }, 8);
  const a = clicks(p6, [2, 3, 4]);
  const b = clicks(p6, [1, 2, 3, 4, 1]);
  same('§6a klikvolgorde: "di, wo, do uit" en "ma t/m do uit, ma weer aan" geven dezelfde kalender, 8 u/dag',
    [view(b), b.hoursPerDay], [view(a), 8]);
  same('§6a ma krijgt zijn eigen 9 u terug', b.workTime?.byWeekday[1], H9);
  const late = hourCal('Late ploeg', on(MA_VR, LATE), 8);
  same('§6a Late ploeg: ma t/m vr uit en weer aan geeft de beginstand terug (8 u/dag)',
    view(clicks(late, [1, 2, 3, 4, 5, 1, 2, 3, 4, 5])), view(late));
  const volgt = hourCal('Volgt 9/8', { ...on([1, 2, 3, 4], H9), 5: H8 }, 9);
  same('§6a volgt (9 = modaal 9): beide volgordes naar ma + vr geven 9',
    [clicks(volgt, [2, 3, 4]).hoursPerDay, clicks(volgt, [1, 2, 3, 4, 1]).hoursPerDay], [9, 9]);

  // b. Een lege tussenweek. Volgt (ma–vr 07–15, 8 u/dag): alles uit ⇒ geen dagsom, de uren per dag blijven 8.
  const gewoon = hourCal('Gewoon', on(MA_VR, H8), 8);
  const leeg = clicks(gewoon, [1, 2, 3, 4, 5]);
  same('§6b volgt, alles uit: geen werkdag, de uren per dag blijven 8', [leeg.workDays, leeg.hoursPerDay], [[], 8]);
  const zaG = clicks(leeg, [6], gewoon);
  same('§6b volgt, daarna Za aan: za krijgt 07–15 van de beginstand, 8 u/dag',
    [zaG.workDays, zaG.workTime?.byWeekday[6], zaG.hoursPerDay], [[6], H8, 8]);
  same('§6b volgt, alles uit en dan Ma–vr: de beginstand terug',
    view({ ...leeg, ...workDaysSetPatch(leeg, MA_VR, gewoon) }), view(gewoon));
  // Afwijkend (XER ma–vr 08–18 met day_hr_cnt 8; enkelvoudige werkdag 8–18): alles uit, dan Za aan. In de vorige
  // stand van #354 zaaide de enkelvoudige werkdag met 8 u en verzon hij een pauze (08–12 + 14–18). Op main a40561fa9
  // werd het 08–18 met 10 u/dag. Nu: 08–18, de werkdag van het openen, en 8 u/dag.
  const p6Dag = { ...hourCal('P6 08–18', on(MA_VR, H0818), 8), workStartHour: 8, workEndHour: 18 };
  const zaP = clicks(p6Dag, [1, 2, 3, 4, 5, 6]);
  same('§6b afwijkend (08–18, 8 u/dag), ma t/m vr uit en Za aan: za 08–18, 8 u/dag',
    [zaP.workDays, zaP.workTime?.byWeekday[6], zaP.hoursPerDay], [[6], H0818, 8]);

  // c. Het blok Werktijden (`CalendarForm.applyBands`) volgt dezelfde regel als de dagknoppen.
  const lateZaBlok = week({ ...on(MA_VR, LATE), 6: [{ start: 480, end: 960 }] });
  same('§6c afwijkend (Late ploeg 8 u/dag), + blok op za (08–16): blijft 8', hoursPerDayForBlocks(late, late, lateZaBlok), 8);
  const lateGelijk = hourCal('Late ploeg 10', on(MA_VR, LATE), 10);
  same('§6c volgt (Late ploeg 10 u/dag), + blok op za: modaal 10', hoursPerDayForBlocks(lateGelijk, lateGelijk, lateZaBlok), 10);
  const gemengd8 = hourCal('Gemengd 8', { ...on([1, 2, 3], H8), ...on([4, 5], H10) }, 8);
  same('§6c volgt (8 = modaal 8), ma wordt 10 u: volgt naar 10',
    hoursPerDayForBlocks(gemengd8, gemengd8, week({ ...on([1, 4, 5], H10), ...on([2, 3], H8) })), 10);
  // Een dagkalender bij openen heeft geen dagsom van blokken (*Per weekdag instellen…* maakt er in de sessie een
  // uurkalender van): de uren per dag volgen de blokken. Net zo een week zonder enig blok bij openen.
  same('§6c dagkalender bij openen, daarna blokken 07–17: volgt naar 10',
    hoursPerDayForBlocks({ workTime: undefined, hoursPerDay: 8 }, { hoursPerDay: 8 }, week(on(MA_VR, H10))), 10);
  same('§6c week zonder blok bij openen (10 u/dag), daarna blokken 07–15: volgt naar 8',
    hoursPerDayForBlocks({ workTime: week({}), hoursPerDay: 10 }, { hoursPerDay: 10 }, week(on(MA_VR, H8))), 8);
  same('§6c volgt, alle blokken weg: geen dagsom, de uren per dag blijven 8',
    hoursPerDayForBlocks(gewoon, gewoon, week({})), 8);

  // d. Strikt vergeleken, zoals de IFC-schrijver: 8,005 u/dag bij blokken van 8 u is een afwijking (0,3 minuut).
  //    Za aan verandert de modale dagsom niet (8); volgen zou 8 geven, blijven staan geeft 8,005.
  const bijna = hourCal('Bijna 8', on(MA_VR, H8), 8.005);
  same('§6d strikt: 8,005 u/dag bij blokken van 8 u blijft 8,005 na Za aan', workDayTogglePatch(bijna, 6, bijna).hoursPerDay, 8.005);
  // En 7,6 u/dag bij blokken van 7:36 (456 minuten) is wél gelijk: 456 / 60 === 7.6.
  const zesKomma = hourCal('7,6', { ...on([1, 2, 3], H76), ...on([4, 5], H10) }, 7.6);
  same('§6d 7,6 u/dag bij blokken van 7:36 volgt (gelijk), Ma uit ⇒ modaal 10', [hoursPerDayFollowsBlocks(zesKomma),
    workDayTogglePatch(zesKomma, 1, zesKomma).hoursPerDay], [true, 10]);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// §7 XER zonder day_hr_cnt: het gemiddelde in minuten, zonder kommaruis
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Ma–za 07:00–14:36 (7,6 u) zonder `day_hr_cnt`: de lezer neemt het gemiddelde. In uren gerekend was dat
// (6 × 7,6) / 6 = 7.6000000000000005, en dat telde als afwijking van de blokken (modaal 7.6).
{
  const dayData = (n: number, band?: string) => (band ? `(0||${n}()((0||0(${band})())))` : `(0||${n}()())`);
  const data = `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7]
    .map((n) => dayData(n, n >= 2 ? 's|07:00|f|14:36' : undefined)).join('')}))(0||Exceptions()())))`;
  const xer = [
    'ERMHDR\t8.4\t2026-07-18\t\t\t\t\t\tEUR',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tZes dagen 7,6\tCA_Base\t\t\t${data}`,
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP1\tZesDagen\tC1\t2026-06-01\t2026-06-01',
    '%T\tPROJWBS', '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
    '%R\t1\tP1\t0\t1\tZD\tZes dagen',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA1\tP1\t1\tC1\tA-1\tTaak\tTT_Task\tTK_NotStart\t38\t38\t2026-06-01 07:00\t2026-06-05 14:36',
    '%E',
  ].join('\n');
  const parsed = await parseOpenedFile({ name: 'zes-dagen.xer', bytes: new TextEncoder().encode(xer) });
  const cal = payloadOf(quiet(() => openInStore(parsed))).calendar;
  same('§7 XER zonder day_hr_cnt, ma–za 7,6 u: uurkalender, 7.6 u/dag precies, volgt de blokken',
    [cal.name, cal.workDays, cal.workTime?.byWeekday[1], cal.hoursPerDay, hoursPerDayFollowsBlocks(cal)],
    ['Zes dagen 7,6', [1, 2, 3, 4, 5, 6], H76, 7.6, true]);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX  urenperdag-dagwissel: ${f}`);
  console.log(`XX  urenperdag-dagwissel: ${failures.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  urenperdag-dagwissel: alle ${checks} checks groen`);
