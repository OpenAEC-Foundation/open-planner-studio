// Uren als "10u" (nl) en "10h" (en), zonder spatie (eigenaarsbesluit 2026-10-20).
//
// AANLEIDING. De kolom Duur toonde in het Nederlands "80h" (de suffix `common:duration.suffixHour` was
// "h"), de restwerkmelding schreef "320 u → 88 u" met een spatie, en de lag stond in elke taal als
// "+2u" (ook in het Engels). Nu volgt alles de taal: nl "80u", "320u → 88u", "+2u"; en "80h",
// "320h → 88h", "+2h". De invoer blijft taalonafhankelijk: "80u" en "80h" werken allebei.
//
// Deze check draait met de ECHTE locale-bestanden (setLocale) en dezelfde labelkoppeling als het
// taakraster (`FullTaskGrid`: `duration.`-sleutels uit `common`).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import i18n, { setLocale } from '@/i18n/config';
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { parseDuration } from '@/utils/durationFormat';
import { parseTaskDurationInput } from '@/utils/taskDurationInput';
import { parseLagInput } from '@/utils/lagFormat';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { parseableHourSuffix } from '@/utils/durationFormat';
import type { TaskColumnId } from '@/types/taskGrid';
import type { TaskTime } from '@/types/task';

const S = () => useAppStore.getState();
const H = 60;

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

function adapter() {
  const s = S();
  return createTaskGridAdapter({
    projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
    assignments: s.assignments, resources: s.resources, baselines: s.baselines,
    activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
    scheduleStale: s.scheduleStale, wbsAutoNumber: false,
    effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
    labelForColumn: k => k,
    // Dezelfde koppeling als FullTaskGrid: `duration.`-sleutels uit `common`, de rest uit `task`.
    labelForText: (key, values) => (key.startsWith('duration.')
      ? i18n.t(`common:${key}`, { ...values, defaultValue: key })
      : i18n.t(`task:${key}`, { ...values, defaultValue: key })) as string,
    numberLocale: i18n.language,
    surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: [],
  });
}

function rowKeyOf(taskId: string): string {
  return S().viewRows.find(r => r.kind === 'task' && r.task.id === taskId)!.rowKey;
}

const DURATION = taskColumnId('task.time.scheduleDuration') as TaskColumnId;
const PREDECESSORS = 'relation.predecessors' as TaskColumnId;

/** De ene relatie A → B. */
const seqAB = () => S().sequences.find(q => q.predecessorId === A && q.successorId === B)!.id;
const lagOf = () => {
  const q = S().sequences.find(x => x.id === seqAB())!;
  return { lagDays: q.lagDays, lagMinutes: q.lagMinutes };
};

/** Plak `text` in de cel Voorgangers van B zoals de gebruiker doet (planEdit → gridtransactie). */
function pasteRelation(text: string): { lagDays: number; lagMinutes?: number } | string {
  const plan = adapter().planEdit(rowKeyOf(B), PREDECESSORS, text);
  if (!plan.ok) return `geweigerd: ${plan.errors.map(e => e.code).join(',')}`;
  const res = runGridMutation(plan.value);
  if (!res.ok) return 'transactie geweigerd';
  return lagOf();
}

/** CSV-export zoals `fileSlice` hem aanroept, met het uurteken van de huidige app-taal. */
function exportCsv(): string {
  const s = S();
  return writeCSV(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments, s.customTaskTypes,
    undefined, parseableHourSuffix(i18n.t('common:duration.suffixHour')));
}

/** De lag van de ene relatie na `readCSV`. */
function csvLag(csv: string): { lagDays: number; lagMinutes?: number } | string {
  const result = readCSV(csv);
  if (result.sequences.length !== 1) return `${result.sequences.length} relaties`;
  const q = result.sequences[0];
  return { lagDays: q.lagDays, lagMinutes: q.lagMinutes };
}

function durationCell(taskId: string) {
  const a = adapter();
  return a.getCell(rowKeyOf(taskId), DURATION);
}

/** Typ `text` in de Duur-cel zoals de gebruiker doet (planEdit → gridtransactie); geeft de minuten terug. */
function typeDuration(taskId: string, text: string): number | string {
  const plan = adapter().planEdit(rowKeyOf(taskId), DURATION, text);
  if (!plan.ok) return `geweigerd: ${plan.errors.map(e => e.code).join(',')}`;
  const res = runGridMutation(plan.value);
  if (!res.ok) return 'transactie geweigerd';
  return S().tasks.find(t => t.id === taskId)!.time.durationMinutes ?? -1;
}

// ── Opzet: urenplanning aan, een urentaak van 80 uur en een opvolger met 2 uur lag ──
S().newProject();
S().setProject({ startDate: '2026-06-01', name: 'Uren zonder spatie' });
const A = S().addTask({ name: 'A ontwerp', time: { durationUnit: 'hours', durationMinutes: 80 * H } as TaskTime });
const B = S().addTask({ name: 'B uitvoering', time: { scheduleDuration: 3 } as TaskTime });
S().addSequence({ predecessorId: A, successorId: B, type: 'FINISH_START', lagDays: 0, lagMinutes: 2 * H });
S().runCPM();
const wbsA = S().tasks.find(t => t.id === A)!.wbsCode;

for (const [lang, u] of [['nl', 'u'], ['en', 'h']] as const) {
  await setLocale(lang);
  eq(`${lang} 0 taal staat goed`, i18n.language, lang);

  // 1. Weergave: kolom Duur, kopieertekst, voorgangerscel.
  const cell = durationCell(A)!;
  eq(`${lang} 1a kolom Duur toont 80${u}`, cell.text, `80${u}`);
  eq(`${lang} 1b kopieertekst Duur is 80${u}`, cell.copyText, `80${u}`);
  const pred = adapter().getCell(rowKeyOf(B), PREDECESSORS)!;
  eq(`${lang} 1c voorgangerscel toont de lag als +2${u}`, pred.text, `${wbsA} FS+2${u}`);
  // 1d. De getoonde tekst terugplakken in de cel geeft weer precies 2 uur (review-VERVOLG a). Eerst de
  //     lag op 0 zetten, zodat de plak echt iets moet doen.
  S().updateSequence(seqAB(), { lagDays: 0, lagMinutes: undefined });
  eq(`${lang} 1d0 lag eerst op 0`, lagOf(), { lagDays: 0, lagMinutes: undefined });
  eq(`${lang} 1d terugplakken van "${pred.text}" ⇒ lagMinutes 120`, pasteRelation(pred.text), { lagDays: 0, lagMinutes: 120 });

  // 2. Restwerkmelding (de tekst van het meldingenkanaal met de parameters uit de store).
  eq(`${lang} 2 restwerkmelding zonder spatie`,
    i18n.t('common:notifications.remainingWorkRecomputed', { name: 'A', before: 320, after: 88 }).includes(`320${u} → 88${u}`),
    true);

  // 3. Invoer blijft taalonafhankelijk: "80u" én "80h" werken, ook in de cel.
  eq(`${lang} 3a cel: "72u" ⇒ 72 uur`, typeDuration(A, '72u'), 72 * H);
  eq(`${lang} 3b cel: "80h" ⇒ 80 uur`, typeDuration(A, '80h'), 80 * H);
  eq(`${lang} 3c cel: "72h" ⇒ 72 uur`, typeDuration(A, '72h'), 72 * H);
  eq(`${lang} 3d cel: "80u" ⇒ 80 uur`, typeDuration(A, '80u'), 80 * H);
  eq(`${lang} 3e na de invoer toont de cel 80${u}`, durationCell(A)!.text, `80${u}`);
}

// 4. De parsers zelf (taalonafhankelijk).
eq('4a parseDuration "80u"', parseDuration('80u', 8), 80 * H);
eq('4b parseDuration "80h"', parseDuration('80h', 8), 80 * H);
eq('4c parseTaskDurationInput "80u"', parseTaskDurationInput('80u', 'hours'), { unit: 'hours', durationMinutes: 80 * H, explicitUnit: true });
eq('4d parseTaskDurationInput "80h"', parseTaskDurationInput('80h', 'days'), { unit: 'hours', durationMinutes: 80 * H, explicitUnit: true });
// Tegen een vaste waarde, niet tegen elkaar: tweemaal `null` mag niet slagen (review-VERVOLG b).
const LAG_2H = { lagDays: 0, lagUnit: undefined, lagPercent: undefined, lagMinutes: 120 };
eq('4e parseLagInput "+2u" ⇒ 120 minuten', parseLagInput('+2u'), LAG_2H);
eq('4f parseLagInput "+2h" ⇒ 120 minuten', parseLagInput('+2h'), LAG_2H);
eq('4g parseLagInput "+3eh" ⇒ 180 elapsed minuten', parseLagInput('+3eh'),
  { lagDays: 0, lagUnit: 'ELAPSEDTIME', lagPercent: undefined, lagMinutes: 180 });

// 5. Andere talen volgen in de vertaalronde: een afkorting die de parser niet kent ("ч") houdt de lag
//    leesbaar als "+2u", zodat bewerken en plakken blijven werken.
await setLocale('ru');
const ruPred = adapter().getCell(rowKeyOf(B), PREDECESSORS)!;
eq('5 ru: lag blijft parsebaar (+2u)', ruPred.text, `${wbsA} FS+2u`);
S().updateSequence(seqAB(), { lagDays: 0, lagMinutes: undefined });
eq('5b ru: terugplakken van "+2u" ⇒ lagMinutes 120', pasteRelation(ruPred.text), { lagDays: 0, lagMinutes: 120 });

// 6. CSV-export (eigenaarsbesluit 2026-10-20, optie 2): het uurteken van de lag volgt de app-taal.
//    Elk bestand leest in elke app-taal terug als precies 120 minuten.
const csvByLang: Record<string, string> = {};
for (const [lang, u] of [['nl', 'u'], ['en', 'h'], ['ru', 'u']] as const) {
  await setLocale(lang);
  const csv = exportCsv();
  csvByLang[lang] = csv;
  eq(`6a ${lang}: CSV-voorganger is ${wbsA}FS+2${u}`, csv.includes(`;${wbsA}FS+2${u};`), true);
  eq(`6b ${lang}: geen ander uurteken in de CSV`, csv.includes(`${wbsA}FS+2${u === 'u' ? 'h' : 'u'}`), false);
}
// 6d. Dezelfde keuze via de echte route: de store (`exportAs('csv')`, zoals de knop Exporteren), die
//     het uurteken zelf uit de app-taal haalt. De download wordt opgevangen (web-backend → Blob).
const g = globalThis as unknown as Record<string, any>;
const captured: string[] = [];
const saved = { Blob: g.Blob, URL: g.URL, createElement: g.document.createElement };
g.Blob = class { constructor(parts: unknown[]) { captured.push(parts.join('')); } };
g.URL = { createObjectURL: () => 'blob:uren', revokeObjectURL: () => undefined };
g.document.createElement = () => ({ href: '', download: '', click: () => undefined });
for (const [lang, u] of [['nl', 'u'], ['en', 'h'], ['ru', 'u']] as const) {
  await setLocale(lang);
  const before = captured.length;
  const res = await S().exportAs('csv');
  const csv = captured.length > before ? captured[captured.length - 1] : '';
  eq(`6d ${lang}: exportAs('csv') slaagt`, res.ok, true);
  eq(`6d ${lang}: exportAs('csv') schrijft ${wbsA}FS+2${u}`, csv.includes(`;${wbsA}FS+2${u};`), true);
  eq(`6d ${lang}: die export leest terug als 120 minuten`, csvLag(csv), { lagDays: 0, lagMinutes: 120 });
}
g.Blob = saved.Blob; g.URL = saved.URL; g.document.createElement = saved.createElement;

for (const readLang of ['nl', 'en', 'ru'] as const) {
  await setLocale(readLang);
  for (const writeLang of ['nl', 'en', 'ru'] as const) {
    eq(`6c CSV uit ${writeLang}, gelezen in ${readLang} ⇒ lagMinutes 120`, csvLag(csvByLang[writeLang]), { lagDays: 0, lagMinutes: 120 });
  }
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX  uren-zonder-spatie: ${d}`);
  console.log(`XX  uren-zonder-spatie: ${diffs.length} van ${checks} checks faalden`);
  process.exit(1);
}
console.log(`OK  uren-zonder-spatie: ${checks} checks groen`);
