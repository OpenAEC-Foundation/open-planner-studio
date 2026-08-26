// Gantt-renderopties: karakterisering + gedragscontract (K-item 33).
//
// WAAROM DEZE BATTERIJ BESTAAT. De zes bestaande renderer-batterijen (arrow-routing,
// axis-consolidation, drag-duration-badge, gantt-float-cull, header-compress, renderer-dateless)
// draaien de ECHTE `GanttRenderer`, maar bouwen hun `GanttRenderOptions` MET DE HAND op. Ze staan
// dus stroomafwaarts van het rekenwerk dat bepaalt wat er in die opties komt: de tijdas-oorsprong,
// de contentbreedte, de baseline-overlay, de trace, de histogramreeks. Dat rekenwerk zat tot nu toe
// als `useMemo`-body in `GanttCanvas.tsx` en werd door geen enkele test aangeraakt — een fout erin
// gaf geen rode suite maar een scheve Gantt.
//
// Deel 1 (karakterisering) houdt de verhuisde functies tegen een VERBATIM KOPIE van de code zoals
// die vóór de extractie in het component stond. Dat is dezelfde techniek als
// `oldGanttCanvasRevealX` in check-axis-consolidation.ts: de oude formule blijft als orakel staan,
// zodat "verplaatst" aantoonbaar "onveranderd" betekent. Deel 2 pint het gedrag dat daarna moet
// blijven gelden, ook als het orakel ooit verdwijnt. Deel 3 zijn bron-asserts.
//
// GRENS VAN DEZE BATTERIJ, expliciet. Wat hier NIET in zit is de BEDRADING: er is geen jsdom of
// testing-library in dit project, dus het component is niet headless te renderen. Geef je in
// `drawPrimary` per ongeluk `view.viewStartDate` mee waar `effectiveViewStart` hoort, dan is dat
// typecorrect en blijft deze suite groen (gemeten) terwijl de tijdas scheef staat en het histogram
// onder de verkeerde kolommen komt. Deel 3 dekt daar één ding van af — dat het component deze
// functies daadwerkelijk gebruikt en er geen tweede kopie naast ontstaat — maar niet dát de juiste
// argumenten worden meegegeven. Daarvoor is een browser-pass nodig (tier 1 uit
// docs/self-test-harness.md).
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import {
  buildBaselineOverlay, buildTrace, buildSharedAxis,
  computeContentSpanDays, computeContentWidth, buildHistogramPicker, buildHistogramSeries,
  buildGanttRenderOptions, type GanttRenderOptionsInput,
} from '@/components/canvas/ganttRenderOptions';
import { traceFrom } from '@/engine/scheduler/graphWalk';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { diffDays, formatDate, parseDate, addCalendarDays } from '@/utils/dateUtils';
import { ORIGIN_PADDING_DAYS, computeEffectiveViewStart } from '@/utils/ganttViewport';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource } from '@/types/resource';
import type { Baseline } from '@/types/baseline';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { ResourceLoadResult } from '@/engine/scheduler/ResourceLoad';
import type { GanttAxis } from '@/engine/renderer/timeAxis';
import type { HistogramSeries, HistogramPickerItem } from '@/engine/renderer/HistogramRenderer';
import type { TraceMode } from '@/state/slices/types';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
/**
 * Vergelijkbare JSON-vorm die Map en Set zichtbaar maakt — RECURSIEF, en dat woord is hier de hele
 * pointe. `JSON.stringify(new Set([...]))` levert `{}`, dus een Set die genest in een object zit
 * (zoals `HistogramSeries.overSet`) valt volledig weg uit de vergelijking. Een eerdere versie van
 * dit bestand keek alleen op het bovenste niveau; met een negatieve controle bleek dat de hele
 * overallocatie-uitkomst daardoor ongetoetst was — de epsilon uit `buildHistogramSeries` slopen
 * hield de suite groen.
 */
const shape = (v: unknown): unknown => {
  if (v instanceof Map) return { __map: [...v.entries()].map(([k, val]) => [k, shape(val)]).sort() };
  if (v instanceof Set) return { __set: [...v].sort() };
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = shape((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
};
const eqDeep = (label: string, got: unknown, want: unknown) => eq(label, shape(got), shape(want));

// ════════════════════════════════════════════════════════════════════════════
// DEEL 1 — Karakterisering: verbatim kopieën van de pre-extractie-`useMemo`-bodies.
// Deze vier functies zijn met opzet NIET opgeschoond: elke regel is letterlijk overgenomen uit
// `GanttCanvas.tsx` zoals hij vóór K-item 33 was. Wijk hier niet van af — de waarde zit erin dat
// het orakel onafhankelijk is van de nieuwe implementatie.
// ════════════════════════════════════════════════════════════════════════════

function oldBaselineOverlay(baselines: Baseline[], activeBaselineId: string | null) {
  if (!activeBaselineId) return undefined;
  const active = baselines.find(b => b.id === activeBaselineId);
  if (!active) return undefined;
  const map = new Map<string, { start: string; finish: string; isMilestone: boolean }>();
  for (const bt of active.tasks) {
    map.set(bt.taskId, { start: bt.start, finish: bt.finish, isMilestone: bt.isMilestone });
  }
  return map;
}

function oldTrace(traceMode: TraceMode, selectedTaskIds: string[], sequences: Sequence[], cpmResult: CPMResult | null) {
  if (traceMode === 'off' || selectedTaskIds.length === 0) return undefined;
  const focusId = selectedTaskIds[0];
  const drivingIds = cpmResult && !cpmResult.error
    ? new Set(cpmResult.drivingSequenceIds)
    : undefined;
  const tr = traceFrom(focusId, sequences, drivingIds);
  return {
    focusId,
    predecessors: traceMode !== 'successors' ? [...tr.predecessors] : [],
    drivingPredecessors: traceMode !== 'successors' ? [...tr.drivingPredecessors] : [],
    successors: traceMode !== 'predecessors' ? [...tr.successors] : [],
    drivenSuccessors: traceMode !== 'predecessors' ? [...tr.drivenSuccessors] : [],
  };
}

function oldEffectiveViewStart(tasks: Task[], viewStartDate: string): string {
  let earliest = parseDate(viewStartDate);
  for (const task of tasks) {
    const start = task.time.earlyStart || task.time.scheduleStart || task.time.lateStart;
    if (start) {
      const d = parseDate(start);
      if (d.getTime() < earliest.getTime()) earliest = d;
    }
  }
  return formatDate(addCalendarDays(earliest, -ORIGIN_PADDING_DAYS));
}

function oldContentSpanDays(tasks: Task[], effectiveViewStart: string, compressNonWorkdays: boolean, sharedAxis: GanttAxis): number | null {
  if (tasks.length === 0) return null;
  const viewStart = effectiveViewStart;
  let maxDays = 365;
  for (const task of tasks) {
    const end = task.time.earlyFinish || task.time.scheduleFinish || task.time.lateFinish;
    if (end) {
      const days = compressNonWorkdays
        ? sharedAxis.daySpan(parseDate(viewStart), parseDate(end))
        : diffDays(viewStart, end);
      if (days > maxDays) maxDays = days;
    }
  }
  return maxDays;
}

function oldHistogramSeries(resourceLoadResult: ResourceLoadResult | null, histogramResourceId: string | undefined, resources: Resource[]): HistogramSeries {
  if (!resourceLoadResult) return { load: {}, capacity: {}, overSet: new Set<string>() };
  const { load, capacity, overallocatedDays } = resourceLoadResult;
  if (histogramResourceId) {
    return {
      load: load[histogramResourceId] ?? {},
      capacity: capacity[histogramResourceId] ?? {},
      overSet: new Set(overallocatedDays[histogramResourceId] ?? []),
    };
  }
  const aggLoad: Record<string, number> = {};
  const aggCap: Record<string, number> = {};
  for (const r of resources) {
    if (r.type === 'MATERIAL') continue;
    const l = load[r.id];
    const cp = capacity[r.id];
    if (l) for (const iso in l) aggLoad[iso] = (aggLoad[iso] ?? 0) + l[iso];
    if (cp) for (const iso in cp) aggCap[iso] = (aggCap[iso] ?? 0) + cp[iso];
  }
  const overSet = new Set<string>();
  for (const iso in aggLoad) if (aggLoad[iso] > (aggCap[iso] ?? 0) + 1e-9) overSet.add(iso);
  return { load: aggLoad, capacity: aggCap, overSet };
}

function oldHistogramPicker(resources: Resource[], resourceLoadResult: ResourceLoadResult | null, allLabel: string): HistogramPickerItem[] {
  const over = resourceLoadResult?.overallocatedDays ?? {};
  const anyRenewableOver = resources.some(
    r => r.type !== 'MATERIAL' && (over[r.id]?.length ?? 0) > 0,
  );
  const items: HistogramPickerItem[] = [
    { id: undefined, label: allLabel, overallocated: anyRenewableOver },
  ];
  for (const r of resources) {
    items.push({ id: r.id, label: r.name || r.id, overallocated: (over[r.id]?.length ?? 0) > 0 });
  }
  return items;
}

// ── Projectje met echte taken uit de echte store (geen handgeknutselde Task-literals). ──────
S().setProject({ startDate: '2027-03-01' });
const idA = S().addTask({ name: 'Fundering', time: { ...S().tasks[0]?.time ?? ({} as Task['time']) } as Task['time'] });
S().updateTask(idA, { time: { ...S().tasks.find(t => t.id === idA)!.time, scheduleStart: '2027-03-01', scheduleFinish: '2027-03-12', scheduleDuration: 10 } });
// LET OP — de duur van 700 werkdagen is geen willekeurige keuze. `computeContentSpanDays` start op
// een bodem van 365 dagen; blijft het project daaronder, dan geeft de functie 365 terug ongeacht
// welk rekenpad hij neemt en is de check VACUÜM. Met 700 werkdagen loopt de span naar ~1023
// kalenderdagen (ongecomprimeerd) resp. ~719 werkdag-eenheden (gecomprimeerd), zodat beide takken
// meetbaar verschillen. Gemeten met een negatieve controle: op de oude 48-daagse fixture bleef de
// suite groen als je de compressie-tak volledig weghaalde.
const idB = S().addTask({ name: 'Ruwbouw' });
S().updateTask(idB, { time: { ...S().tasks.find(t => t.id === idB)!.time, scheduleStart: '2027-03-15', scheduleDuration: 700 } });
// Een taak die VÓÓR de opgeslagen viewStartDate begint — precies het geval waar
// `computeEffectiveViewStart` voor bestaat (anders is hij onbereikbaar links van de oorsprong).
const idC = S().addTask({ name: 'Vooronderzoek' });
S().updateTask(idC, { time: { ...S().tasks.find(t => t.id === idC)!.time, scheduleStart: '2026-11-04', scheduleFinish: '2026-11-20', scheduleDuration: 12 } });
S().addSequence({ predecessorId: idA, successorId: idB, type: 'FINISH_START', lagDays: 0 });
// Een OPVOLGER van de trace-focus (idB). Zonder deze zijn `successors`/`drivenSuccessors` in
// `buildTrace` structureel leeg en kun je die halve functie hardcoderen zonder dat de suite rood
// wordt (gemeten). Bewust een nieuwe taak en niet idC: die begint vóór de opgeslagen viewStartDate
// en dat is precies waarvoor hij in deze fixture zit — een FS-relatie zou hem naar achteren duwen.
const idD = S().addTask({ name: 'Afbouw' });
S().addSequence({ predecessorId: idB, successorId: idD, type: 'FINISH_START', lagDays: 0 });
S().runCPM();

const tasks = S().tasks;
const sequences = S().sequences;
const cpm = S().cpmResult;
const calendar = S().calendar;

// Taken die de VELDKETEN-terugvallen raken. Ná `runCPM` heeft elke echte taak zowel `earlyStart`
// als `scheduleStart` gezet, en die zijn dan gelijk — dus de `||`-ketens
// (`earlyStart || scheduleStart || lateStart`) zijn op de gewone fixture NIET te onderscheiden:
// je kunt de hele staart weghalen en de suite blijft groen (gemeten). Deze vier taken zetten
// precies één schakel van elke keten, met onderling ver uiteenliggende datums.
const chainBase = tasks[0];
const chained = (over: Partial<Task['time']>): Task => ({
  ...chainBase,
  id: `chain-${JSON.stringify(over)}`,
  time: { ...chainBase.time, earlyStart: '', scheduleStart: '', lateStart: '', earlyFinish: '', scheduleFinish: '', lateFinish: '', ...over },
});
//
// LET OP hoe de extrema verdeeld zijn. Een eerdere versie legde het minimum/maximum steeds op de
// LAATSTE schakel; dan domineert die de min/max en meet de middelste schakel niets — je kon
// `earlyX || scheduleX || lateX` inkorten tot `earlyX || lateX`, of de hele keten omkeren, en de
// suite bleef groen (gemeten). Hier ligt het extremum juist op de MIDDELSTE schakel
// (`scheduleStart` 2019 is de vroegste, `scheduleFinish` 2038 de laatste), zodat het weglaten van
// die schakel meteen omvalt.
const chainTasks: Task[] = [
  chained({ earlyStart: '2025-05-20', earlyFinish: '2031-01-02' }),        // 1e schakel
  chained({ scheduleStart: '2019-02-28', scheduleFinish: '2038-07-11' }),  // 2e schakel — het extremum
  chained({ lateStart: '2023-08-08', lateFinish: '2033-12-24' }),          // 3e schakel
  chained({}),                                                            // geen datums: draagt niets bij
];
// PRECEDENTIE. Bovenstaande taken zetten elk één schakel, dus ze tonen wel dat elke schakel
// meedoet maar niet in welke VOLGORDE. Deze taak zet ze alle drie tegelijk met ver uiteenliggende
// waarden: alleen de eerste schakel mag tellen. Keer de keten om en dit valt om.
const precedenceTasks: Task[] = [chained({
  earlyStart: '2029-06-01', scheduleStart: '2021-01-01', lateStart: '2017-03-03',
  earlyFinish: '2029-07-01', scheduleFinish: '2040-01-01', lateFinish: '2045-01-01',
})];

// 1 — effectiveViewStart, over vier tijdvenster-oorsprongen én de veldketen.
for (const [i, vsd] of ['2027-03-01', '2026-01-01', '2028-12-31', '2026-11-04'].entries()) {
  eq(`01.${i} effectiveViewStart identiek aan het orakel (viewStartDate=${vsd})`,
    computeEffectiveViewStart(tasks, vsd), oldEffectiveViewStart(tasks, vsd));
}
eq('01b effectiveViewStart volgt elke schakel van de start-veldketen (early → schedule → late)',
  computeEffectiveViewStart(chainTasks, '2030-01-01'), oldEffectiveViewStart(chainTasks, '2030-01-01'));
eq('01d effectiveViewStart: bij drie gezette schakels wint de EERSTE (earlyStart)',
  computeEffectiveViewStart(precedenceTasks, '2035-01-01'), '2029-05-18');
// Hard gepind zodat 01b ook zonder het orakel iets zegt: de vroegste schakel over de vier
// ketting-taken is `scheduleStart` (2019-02-28), min de marge van 14 dagen.
eq('01c effectiveViewStart: de vroegste schakel wint, min de marge van 14 dagen',
  computeEffectiveViewStart(chainTasks, '2030-01-01'), '2019-02-14');
eq('02 effectiveViewStart: leeg takenlijst valt terug op viewStartDate − marge',
  computeEffectiveViewStart([], '2027-03-01'), oldEffectiveViewStart([], '2027-03-01'));

// 3 — sharedAxis + contentSpanDays. Twee assen (compressie aan/uit) × drie viewports. De viewports
// met scrollX ≠ 0 en chartOriginX ≠ 0 zitten er omdat een as die die twee negeert anders
// onopgemerkt bleef: met alles op 0 is `dateToX` er ongevoelig voor (negatieve controle gemeten).
const VIEWPORTS = [
  { chartOriginX: 300, zoom: 30, scrollX: 0 },
  { chartOriginX: 300, zoom: 30, scrollX: 1750 },
  { chartOriginX: 0, zoom: 7.5, scrollX: 420 },
];
for (const compress of [false, true]) {
  const evs = computeEffectiveViewStart(tasks, '2027-03-01');
  for (const [j, vp] of VIEWPORTS.entries()) {
    const axisNew = buildSharedAxis({ calendar, compressNonWorkdays: compress, viewStartDate: evs, ...vp });
    const axisOld = resolveGanttAxis({
      calendar: new CalendarEngine(calendar),
      compressNonWorkdays: compress,
      origin: parseDate(evs),
      ...vp,
    });
    const probe = parseDate('2028-08-14');
    eq(`03.${compress}.${j} sharedAxis.dateToX identiek aan het orakel`, axisNew.dateToX(probe), axisOld.dateToX(probe));
    eq(`04.${compress}.${j} sharedAxis.daySpan identiek aan het orakel`,
      axisNew.daySpan(parseDate(evs), probe), axisOld.daySpan(parseDate(evs), probe));
    eq(`05.${compress}.${j} contentSpanDays identiek aan het orakel`,
      computeContentSpanDays(tasks, evs, compress, axisNew), oldContentSpanDays(tasks, evs, compress, axisOld));
  }
  // De bodem van 365 moet daadwerkelijk overschreden zijn, anders zeggen de checks hierboven niets
  // over het rekenpad — dit is de bewaker op de fixture zelf.
  const axis0 = buildSharedAxis({ calendar, compressNonWorkdays: compress, viewStartDate: evs, ...VIEWPORTS[0] });
  checks++;
  const span = computeContentSpanDays(tasks, evs, compress, axis0);
  if (span === null || span <= 365) diffs.push(`05b.${compress} fixture te kort: contentSpanDays bleef op de 365-bodem (${span}) — de check is dan vacuüm`);
  // De finish-veldketen (early → schedule → late), om dezelfde reden als bij de start hierboven.
  eq(`05c.${compress} contentSpanDays volgt elke schakel van de finish-veldketen`,
    computeContentSpanDays(chainTasks, '2023-07-25', compress, axis0),
    oldContentSpanDays(chainTasks, '2023-07-25', compress, axis0));
  eq(`05e.${compress} contentSpanDays: bij drie gezette schakels wint de EERSTE (earlyFinish)`,
    computeContentSpanDays(precedenceTasks, '2029-01-01', compress, axis0),
    oldContentSpanDays(precedenceTasks, '2029-01-01', compress, axis0));
  // Én de 365-bodem zelf: een kort project mag níét lager uitkomen.
  eq(`05d.${compress} contentSpanDays: kort project blijft op de bodem van 365`,
    computeContentSpanDays([chained({ earlyStart: '2027-01-01', earlyFinish: '2027-02-01' })], '2027-01-01', compress, axis0),
    365);
}
eq('06 contentSpanDays: leeg project ⇒ null', computeContentSpanDays([], '2027-03-01', false, buildSharedAxis({
  calendar, compressNonWorkdays: false, viewStartDate: '2027-03-01', chartOriginX: 0, zoom: 30, scrollX: 0,
})), null);

// 7 — contentWidthFor: de bodem van 2000px en de lineaire tak.
eq('07 computeContentWidth: leeg project ⇒ vaste 2000px', computeContentWidth(null, 30, 300), 2000);
eq('08 computeContentWidth: korte span blijft op de 2000px-bodem', computeContentWidth(10, 30, 300), 2000);
eq('09 computeContentWidth: lange span schaalt met zoom en tabelbreedte',
  computeContentWidth(500, 30, 300), Math.max(2000, (500 * 1.2) * 30 + 300));

// 10 — trace, over alle vier de standen. De focus is `idB`, die zowel een VOORGANGER (idA) als een
// OPVOLGER (idC) heeft. Dat tweede is niet cosmetisch: met alleen een voorganger zijn
// `successors`/`drivenSuccessors` structureel leeg, en dan kun je die twee takken hardcoderen op
// `[]` — of de hele predecessors/successors-conditie omdraaien — zonder dat de suite rood wordt
// (gemeten). De helft van `buildTrace` was zo ongetoetst.
const traceModes: TraceMode[] = ['off', 'predecessors', 'successors', 'both'];
for (const mode of traceModes) {
  eqDeep(`10.${mode} trace identiek aan het orakel`,
    buildTrace(mode, [idB], sequences, cpm), oldTrace(mode, [idB], sequences, cpm));
}
// Bewaker op de fixture zelf: heeft de focus wel iets aan béíde kanten om te traceren?
{
  const tr = buildTrace('both', [idB], sequences, cpm)!;
  checks++;
  if (tr.predecessors.length === 0) diffs.push('10z fixture: focus heeft geen voorgangers — de trace-checks zijn dan half vacuüm');
  checks++;
  if (tr.successors.length === 0) diffs.push('10z fixture: focus heeft geen opvolgers — de trace-checks zijn dan half vacuüm');
}
eq('11 trace: lege selectie ⇒ undefined', buildTrace('both', [], sequences, cpm), undefined);
// Een CPM-resultaat MET fout telt als "nog niets berekend": geen driving-tinten.
const cpmFailed = { ...(cpm as CPMResult), error: 'cyclus' } as CPMResult;
eqDeep('12 trace bij een mislukte CPM identiek aan het orakel',
  buildTrace('both', [idB], sequences, cpmFailed), oldTrace('both', [idB], sequences, cpmFailed));

// 13 — baselineOverlay.
const baselines: Baseline[] = [{
  id: 'bl1', name: 'Nulmeting', createdAt: '2027-02-01T00:00:00', projectEnd: '2027-05-20', projectDuration: 58,
  tasks: [
    { taskId: idA, start: '2027-03-01', finish: '2027-03-10', duration: 8, isMilestone: false },
    { taskId: idB, start: '2027-03-11', finish: '2027-05-01', duration: 38, isMilestone: true },
  ],
}];
eqDeep('13 baselineOverlay identiek aan het orakel', buildBaselineOverlay(baselines, 'bl1'), oldBaselineOverlay(baselines, 'bl1'));
eq('14 baselineOverlay: geen actieve baseline ⇒ undefined', buildBaselineOverlay(baselines, null), undefined);
eq('15 baselineOverlay: onbekend id ⇒ undefined (niet een lege Map)', buildBaselineOverlay(baselines, 'weg'), undefined);

// 16 — histogram. Materiaal telt bewust NIET mee in de "alle resources"-som (§6.4).
const resources: Resource[] = [
  { id: 'r1', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2 },
  { id: 'r2', name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 },
  { id: 'r3', name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 999, unitOfMeasure: 'm3' },
  { id: 'r4', name: '', type: 'LABOR', description: '', maxUnits: 1 },  // naamloos ⇒ label valt terug op id
];
// De drie dagen 03/04/05 dekken de EPSILON-grens in de overallocatie-toets (`> cap + 1e-9`):
// exact gelijk, een overschrijding kleiner dan epsilon (drijvende-kommaruis — mag NIET als
// overbelast tellen) en een echte overschrijding. Zonder die dagen bleef de suite groen als je
// `+ 1e-9` weghaalde (negatieve controle gemeten). Let op: `>` versus `>=` is dankzij diezelfde
// epsilon een equivalente mutant — dat verschil is niet waarneembaar en is dus geen dekkingsgat.
const load: ResourceLoadResult = {
  load: {
    r1: { '2027-03-01': 3, '2027-03-02': 1, '2027-03-03': 2, '2027-03-04': 2 + 5e-10, '2027-03-05': 2.5 },
    r2: { '2027-03-01': 1 },
    r3: { '2027-03-01': 40 },
  },
  capacity: {
    r1: { '2027-03-01': 2, '2027-03-02': 2, '2027-03-03': 2, '2027-03-04': 2, '2027-03-05': 2 },
    r2: { '2027-03-01': 1 },
    r3: { '2027-03-01': 999 },
  },
  overallocatedDays: { r1: ['2027-03-01', '2027-03-05'], r2: [], r3: [], r4: [] },
};
// Losse fixture waarin ALLEEN materiaal overbelast is. Nodig omdat `anyRenewableOver` in de fixture
// hierboven sowieso true is (r1 is overbelast): de MATERIAL-uitsluiting in `buildHistogramPicker`
// was daardoor ongetoetst — je kon hem eruit slopen en de suite bleef groen (gemeten).
const materialOnlyOver: ResourceLoadResult = {
  load: { r3: { '2027-03-01': 1500 } },
  capacity: { r3: { '2027-03-01': 999 } },
  overallocatedDays: { r1: [], r2: [], r3: ['2027-03-01'], r4: [] },
};
for (const [i, sel] of [undefined, 'r1', 'r3', 'onbekend'].entries()) {
  eqDeep(`16.${i} histogramSeries identiek aan het orakel (selectie=${sel ?? 'alle'})`,
    buildHistogramSeries(load, sel, resources), oldHistogramSeries(load, sel, resources));
}
eqDeep('17 histogramSeries: geen berekening ⇒ lege reeks',
  buildHistogramSeries(null, undefined, resources), oldHistogramSeries(null, undefined, resources));
eq('18 histogramPicker identiek aan het orakel',
  buildHistogramPicker(resources, load, 'Alle resources'), oldHistogramPicker(resources, load, 'Alle resources'));
eq('19 histogramPicker zonder berekening identiek aan het orakel',
  buildHistogramPicker(resources, null, 'Alle resources'), oldHistogramPicker(resources, null, 'Alle resources'));
eq('19b histogramPicker: alleen MATERIAL overbelast ⇒ de somrij-vlag blijft UIT',
  buildHistogramPicker(resources, materialOnlyOver, 'Alle resources')[0].overallocated, false);
eq('19c histogramPicker: de materiaalrij zelf toont zijn overbelasting wél',
  buildHistogramPicker(resources, materialOnlyOver, 'Alle resources').find(i => i.id === 'r3')?.overallocated, true);
eqDeep('19d histogramSeries: MATERIAL telt niet mee in de som over alle resources',
  buildHistogramSeries(materialOnlyOver, undefined, resources), { load: {}, capacity: {}, overSet: new Set<string>() });

// ════════════════════════════════════════════════════════════════════════════
// DEEL 2 — Gedragscontract van `buildGanttRenderOptions`.
// ════════════════════════════════════════════════════════════════════════════

const axis = buildSharedAxis({
  calendar, compressNonWorkdays: false, viewStartDate: '2027-02-25', chartOriginX: 300, zoom: 30, scrollX: 0,
});
// De echte CPM-uitkomst heeft hier lege `violatedConstraintTaskIds` én `missedDeadlineTaskIds`, en
// dan is `[]` vs `[]` geen vergelijking: je kunt de twee velden in de bouwer verwisselen en de
// suite blijft groen (gemeten). Vandaar drie ONDERLING VERSCHILLENDE herkenbare lijsten.
const cpmDistinct = {
  ...(cpm as CPMResult),
  drivingSequenceIds: ['seq-driving'],
  violatedConstraintTaskIds: ['taak-geschonden'],
  missedDeadlineTaskIds: ['taak-deadline-gemist'],
} as CPMResult;

// LET OP — twee regels voor deze fixture.
//
// (1) Geen enkele waarde mag samenvallen met de default die de renderer zelf hanteert wanneer het
// veld ontbreekt. Anders is de passthrough-check `x` vs `x` en overleeft een
// bouwer die het veld hardcodeert. Dat gold eerder voor weekStartDay ('monday'), barSplitMode
// ('selection'), showProgressLine/enableQuarterHourZoom/highContrast (false) en fontScale (1) —
// zes vacuüme checks, alle gemeten met een negatieve controle.
//
// (2) De booleans mogen ook niet allemaal DEZELFDE waarde hebben. Stonden ze alle zes op `true`,
// dan zijn ze onderling niet te onderscheiden en overleeft een kruisbedrading
// (`showStatusDateLine: input.showProgressLine`) — de meest waarschijnlijke fout bij overtypen.
// Gemeten: drie van zulke verwisselingen bleven groen. Vandaar drie op `false` en drie op `true`.
const baseInput: GanttRenderOptionsInput = {
  rows: S().viewRows,
  sequences,
  calendar,
  view: { ...S().view, viewStartDate: '2027-02-25' },
  selectedTaskIds: [idB],
  cpmResult: cpmDistinct,
  statusDate: '2027-04-01',
  showStatusDateLine: false,
  showProgressLine: true,
  showBaselineOverlay: true,
  baselineOverlay: buildBaselineOverlay(baselines, 'bl1'),
  trace: buildTrace('both', [idB], sequences, cpmDistinct),
  canvasWidth: 1200,
  canvasHeight: 800,
  rowHeight: 28,
  headerHeight: 50,
  localizedMonths: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
  localizedWeekdays: ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'],
  weekStartDay: 'sunday',
  enableQuarterHourZoom: true,
  effectiveCalById: new Map(),
  barSplitMode: 'always',
  enableHourPlanning: false,
  durationDisplay: 'auto',
  durationSuffixes: { day: 'd', hour: 'u', minute: 'm' },
  externalStaleLabel: 'verouderd (NL-test)',
  durationDrag: { taskId: idA, edge: 'right' },
  highContrast: false,
  // NIET `undefined`: met undefined is `palette: input.palette` niet te onderscheiden van
  // `palette: undefined` en overleeft een bouwer die het veld laat vallen (gemeten). De waarde
  // wordt hier alleen doorgegeven, nooit getekend, dus een herkenbare stand-in volstaat.
  palette: { __testPalette: true } as unknown as GanttRenderOptions['palette'],
  compressNonWorkdays: false,
  axis,
  fontFamily: 'Inter, sans-serif',
  fontScale: 1.25,
};

const optsOk = buildGanttRenderOptions(baseInput);

// 20 — het CPM-resultaat wordt op één plek uitgepakt; de drie lijsten komen uit dezelfde bron.
eq('20 geslaagde CPM: drivingSequenceIds komt door', optsOk.drivingSequenceIds, ['seq-driving']);
eq('21 geslaagde CPM: violatedConstraintTaskIds komt door', optsOk.violatedConstraintTaskIds, ['taak-geschonden']);
eq('22 geslaagde CPM: missedDeadlineTaskIds komt door', optsOk.missedDeadlineTaskIds, ['taak-deadline-gemist']);

// 23 — een MISLUKTE berekening mag geen markeringen opleveren. Alle drie tegelijk, want dit was
// vóór de extractie drie losse ternaries die elk apart konden verlopen.
const optsFailed = buildGanttRenderOptions({ ...baseInput, cpmResult: cpmFailed });
eq('23 mislukte CPM: geen drivingSequenceIds', optsFailed.drivingSequenceIds, undefined);
eq('24 mislukte CPM: geen violatedConstraintTaskIds', optsFailed.violatedConstraintTaskIds, undefined);
eq('25 mislukte CPM: geen missedDeadlineTaskIds', optsFailed.missedDeadlineTaskIds, undefined);
const optsNoCpm = buildGanttRenderOptions({ ...baseInput, cpmResult: null });
eq('26 geen CPM: geen drivingSequenceIds', optsNoCpm.drivingSequenceIds, undefined);
eq('27 geen CPM: geen violatedConstraintTaskIds', optsNoCpm.violatedConstraintTaskIds, undefined);
eq('28 geen CPM: geen missedDeadlineTaskIds', optsNoCpm.missedDeadlineTaskIds, undefined);

// 29 — doorgeefvelden. Dit is de check die omvalt als iemand een veld hernoemt of laat vallen:
// het zijn precies de velden die het component eerder twee keer met de hand overtypte.
const passthrough: [string, unknown, unknown][] = [
  ['rows', optsOk.rows, baseInput.rows],
  ['sequences', optsOk.sequences, baseInput.sequences],
  ['calendar', optsOk.calendar, baseInput.calendar],
  ['view', optsOk.view, baseInput.view],
  ['selectedTaskIds', optsOk.selectedTaskIds, baseInput.selectedTaskIds],
  ['statusDate', optsOk.statusDate, baseInput.statusDate],
  ['showStatusDateLine', optsOk.showStatusDateLine, baseInput.showStatusDateLine],
  ['showProgressLine', optsOk.showProgressLine, baseInput.showProgressLine],
  ['showBaselineOverlay', optsOk.showBaselineOverlay, baseInput.showBaselineOverlay],
  ['baselineOverlay', optsOk.baselineOverlay, baseInput.baselineOverlay],
  ['trace', optsOk.trace, baseInput.trace],
  ['canvasWidth', optsOk.canvasWidth, baseInput.canvasWidth],
  ['canvasHeight', optsOk.canvasHeight, baseInput.canvasHeight],
  ['rowHeight', optsOk.rowHeight, baseInput.rowHeight],
  ['headerHeight', optsOk.headerHeight, baseInput.headerHeight],
  ['localizedMonths', optsOk.localizedMonths, baseInput.localizedMonths],
  ['localizedWeekdays', optsOk.localizedWeekdays, baseInput.localizedWeekdays],
  ['weekStartDay', optsOk.weekStartDay, baseInput.weekStartDay],
  ['enableQuarterHourZoom', optsOk.enableQuarterHourZoom, baseInput.enableQuarterHourZoom],
  ['effectiveCalById', optsOk.effectiveCalById, baseInput.effectiveCalById],
  ['barSplitMode', optsOk.barSplitMode, baseInput.barSplitMode],
  ['enableHourPlanning', optsOk.enableHourPlanning, baseInput.enableHourPlanning],
  ['durationDisplay', optsOk.durationDisplay, baseInput.durationDisplay],
  ['durationSuffixes', optsOk.durationSuffixes, baseInput.durationSuffixes],
  ['externalStaleLabel', optsOk.externalStaleLabel, baseInput.externalStaleLabel],
  ['durationDrag', optsOk.durationDrag, baseInput.durationDrag],
  ['highContrast', optsOk.highContrast, baseInput.highContrast],
  ['palette', optsOk.palette, baseInput.palette],
  ['compressNonWorkdays', optsOk.compressNonWorkdays, baseInput.compressNonWorkdays],
  ['fontFamily', optsOk.fontFamily, baseInput.fontFamily],
  ['fontScale', optsOk.fontScale, baseInput.fontScale],
];
for (const [name, got, want] of passthrough) {
  eqDeep(`29.${name} gaat ongewijzigd door naar de renderer`, got, want);
}
// `axis` moet DEZELFDE instantie zijn, niet een kopie — de Histogram deelt hem (§10.1).
checks++;
if (optsOk.axis !== axis) diffs.push('30 axis: renderer krijgt niet dezelfde as-INSTANTIE als de histogram');

// 31 — de secundaire split-view-pane. Hij geeft bewust `undefined` mee waar de primaire een waarde
// heeft; dat moet undefined BLIJVEN (de renderer valt dan terug op zijn eigen defaults), en de
// gedeelde velden moeten identiek zijn aan de primaire.
const optsSecondary = buildGanttRenderOptions({
  ...baseInput,
  view: { ...baseInput.view, zoom: 12, scrollX: 400 },
  enableHourPlanning: undefined,
  durationDisplay: undefined,
  durationSuffixes: undefined,
  externalStaleLabel: undefined,
  durationDrag: undefined,
  axis: undefined,
});
eq('31 secundair: geen eigen as (renderer bouwt hem zelf uit view+compressNonWorkdays)', optsSecondary.axis, undefined);
eq('33 secundair: geen sleep-pilletje', optsSecondary.durationDrag, undefined);
eq('34 secundair: eigen zoom', optsSecondary.view.zoom, 12);
eq('35 secundair: eigen scrollX', optsSecondary.view.scrollX, 400);
// GESCHRAPT: hier stonden veertien checks `36.<veld> secundair deelt dit veld met de primaire pane`.
// Ze maten niets. Beide kanten komen uit DEZELFDE bouwer met DEZELFDE waarde (`optsSecondary` is
// `{...baseInput, <overrides>}` en geen van die veertien velden zat in de overrides), dus elke
// mutatie van de bouwer verschoof beide kanten even hard — gemeten: `statusDate` hardcoderen liet
// 29.statusDate omvallen en 36.statusDate groen. De eigenschap die dat label beschreef — dat de
// twee AANROEPPLEKKEN in GanttCanvas dezelfde waarde meegeven — woont in het component en is hier
// per constructie niet te zien. Veertien regels die het totaal opbliezen en niets bewaakten.

// ════════════════════════════════════════════════════════════════════════════
// DEEL 3 — Bron-assert op `GanttCanvas.tsx`.
//
// Grens van deze batterij, expliciet: alles hierboven toetst de FUNCTIES, niet de BEDRADING. Er is
// geen jsdom/testing-library in dit project, dus het component is niet headless te renderen — een
// verwisseld argument op de aanroepplek (`view.viewStartDate` waar `effectiveViewStart` hoort) is
// typecorrect en zou hierboven niet omvallen. Wat wél machinaal te bewaken is, is dat het component
// deze functies daadwerkelijk gebruikt in plaats van er stilletjes een tweede kopie naast te zetten
// — precies de situatie die K-item 33 opruimde (de origin-lus stond twee keer in het bestand).
// Zelfde techniek als `runSourceParity` in harness.ts.
// ════════════════════════════════════════════════════════════════════════════
{
  const { readFileSync, existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join, dirname } = await import('node:path');
  // Loop omhoog tot de repo-root i.p.v. een vast aantal `..`: dit bestand draait als GEBUNDELDE
  // .mjs, en waar die bundel landt bepaalt `run.sh` — een hardgecodeerde `../..` leest dan het
  // verkeerde pad (en crasht met ENOENT in plaats van een nette faalregel).
  let root = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  const canvasPath = join(root, 'src/components/canvas/GanttCanvas.tsx');
  const viewportPath = join(root, 'src/utils/ganttViewport.ts');
  // Zonder deze guard eindigt een bundel die BUITEN de repo landt in een ongevangen ENOENT uit
  // readFileSync — een crash in plaats van een faalregel, precies wat de walk hierboven wil
  // vermijden. Zelf gereproduceerd.
  checks++;
  if (!existsSync(canvasPath) || !existsSync(viewportPath)) {
    diffs.push(`36 bron-assert overgeslagen: repo-root niet gevonden vanaf ${dirname(fileURLToPath(import.meta.url))}`);
  } else {
  const raw = readFileSync(canvasPath, 'utf8');

  // Commentaar eruit vóór we iets beweren. Dit bestand is zwaar becommentarieerd en verwijst in
  // proza naar precies de namen die we hier zoeken (`ORIGIN_PADDING_DAYS` staat nog in een
  // toelichting), dus een kale `includes` zou op de uitleg matchen in plaats van op code — een
  // permanent rode check die niets meet. Toestandsmachientje omdat een regel-gebaseerde aanpak
  // struikelt over `//` binnen een string.
  // BEPERKING, expliciet: dit machientje kent geen JSX en geen regexliterals. Een apostrof in
  // JSX-tekst (`<p>z'n Gantt</p>`) of in een karakterklasse (`/['"]/`) zet 'm in string-modus,
  // waardoor een daaropvolgend `//`-commentaar blijft staan. Gemeten, en met gewone Nederlandse
  // tekst ("z'n", "'s ochtends", "API's") makkelijk te raken. De faalrichting is OVERtellen: er
  // blijft commentaar staan, dus een assert hieronder kan vals ROOD worden — nooit vals groen.
  // Daarom acceptabel, maar reken er niet op dat commentaar gegarandeerd weg is.
  const stripComments = (s: string): string => {
    let out = '';
    let mode: 'code' | 'line' | 'block' | '"' | "'" | '`' = 'code';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if (mode === 'code') {
        if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
        if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') mode = c;
        out += c;
      } else if (mode === 'line') {
        if (c === '\n') { mode = 'code'; out += c; }
      } else if (mode === 'block') {
        if (c === '*' && n === '/') { mode = 'code'; i++; }
      } else {
        // Binnen een string/template: escapes overslaan, sluiter herkennen.
        if (c === '\\') { out += c + (n ?? ''); i++; continue; }
        if (c === mode) mode = 'code';
        out += c;
      }
    }
    return out;
  };
  const src = stripComments(raw);
  // De stripper zelf toetsen op SYNTHETISCHE invoer, niet op het bestand. Een eerdere versie
  // beweerde "laat strings met // intact" en controleerde toen `src.includes('useCanvasLayer')` —
  // een kale identifier, geen string, en `GanttCanvas.tsx` bevat helemaal geen string met `//`.
  // Die check kón dus niet falen. Hieronder staan de gevallen wél in de invoer.
  eq('36a stripComments haalt regelcommentaar weg', stripComments('const a = 1; // weg\nconst b = 2;'), 'const a = 1; \nconst b = 2;');
  eq('36b stripComments haalt blokcommentaar weg', stripComments('const /* weg */ a = 1;'), 'const  a = 1;');
  eq('36c stripComments laat een string met // intact', stripComments("const u = 'https://x'; // weg"), "const u = 'https://x'; ");
  eq('36d stripComments laat een template met // intact', stripComments('const t = `a//b`; /* weg */'), 'const t = `a//b`; ');
  eq('36e stripComments laat een ontsnapt aanhalingsteken heel', stripComments("const s = 'a\\'b'; // weg"), "const s = 'a\\'b'; ");
  // De bekende beperking, hier vastgelegd in plaats van weggemoffeld: op een JSX-apostrof loopt het
  // machientje vast en blijft het commentaar staan. Valt deze check ooit om omdat de uitkomst wél
  // gestript is, dan is de beperking verholpen en mag de waarschuwing hierboven weg.
  eq('36h stripComments is NIET sluitend op een JSX-apostrof (bekende beperking)',
    stripComments("return <p>Don't</p>; // BLIJFT STAAN"), "return <p>Don't</p>; // BLIJFT STAAN");
  // En op het echte bestand: commentaar eruit, code erin.
  eq('36f stripComments haalt commentaar uit het echte bestand', src.includes('K-item 33: de pure afleidingen'), false);
  eq('36g stripComments laat de code van het echte bestand staan', src.includes('export function GanttCanvas('), true);

  // Beide teken-paden (primair + split-view-secundair) lopen via de gedeelde bouwer. Het KOPPEL
  // van deze twee tellingen is de eigenlijke bewering: elke renderer die het component bouwt, moet
  // zijn opties van de bouwer krijgen. Alleen `buildGanttRenderOptions` tellen is te zwak — dan
  // overleeft een derde `new GanttRenderer(ctx, handgemaaktObject)` (gemeten: die sabotage bleef
  // groen toen assert 38 nog alleen de inline-literalvorm herkende).
  eq('37 GanttCanvas instantieert precies twee GanttRenderers (primair + secundair)',
    (src.match(/new GanttRenderer\(/g) ?? []).length, 2);
  eq('38 GanttCanvas roept buildGanttRenderOptions even vaak aan als het renderers maakt',
    (src.match(/buildGanttRenderOptions\(/g) ?? []).length,
    (src.match(/new GanttRenderer\(/g) ?? []).length);

  // De origin-lus stond drie keer in de codebase: de render-memo, `revealTaskIfOffscreen` en
  // `computeScrollToDate`. Alleen `GanttCanvas.tsx` scannen ving die derde per constructie niet —
  // vandaar dat de volgende bewering over de HELE `src/` gaat en op de VORM van de lus zoekt, niet
  // op een importnaam. Wie hem opnieuw uitschrijft (met een eigen constante, zonder
  // `computeEffectiveViewStart`) valt hier alsnog om.
  const { execSync } = await import('node:child_process');
  const { relative } = await import('node:path');
  // De DRIE-schakelige keten, met `lateStart` als anker. Twee schakels (`… || scheduleStart || ''`)
  // is iets anders: dat is de datumloos-guard in `GanttRenderer.barGeometry`/`dragDurationText`,
  // geen oorsprongsberekening. Zonder dat anker vlagt deze check die twee ten onrechte.
  const chain = String.raw`earlyStart \|\| [a-zA-Z_.]*scheduleStart \|\| [a-zA-Z_.]*lateStart`;
  const hits = execSync(
    `grep -rlE ${JSON.stringify(chain)} ${JSON.stringify(join(root, 'src'))} || true`,
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean).map(f => relative(root, f)).sort();
  // Let op wat deze check WEL en NIET zegt. `grep -rl` geeft een BESTANDSlijst: hij bewaakt dat de
  // keten nergens buiten `ganttViewport.ts` opduikt, niet dat hij daarbinnen één keer voorkomt (dat
  // is hij ook niet — `computeFitToProject` heeft zijn eigen variant, zie de toelichting daar).
  // Verder is hij regel-verankerd en filesystem-gebaseerd. Een achtergebleven `.bak`/`.orig` in
  // `src/` geeft een vals rood (gemeten) — hinderlijk, maar de veilige richting. Een kopie die
  // over twee regels is afgebroken ontsnapt aan DEZE check; check 40 hieronder vangt hem dan
  // alsnog, want die telt de aanroepen van de gedeelde functie. Een eerdere versie van dit
  // commentaar beweerde beide dingen tegelijk ("ontsnapt" én "overtellen, geen gat"); dat kon
  // niet allebei waar zijn.
  eq('39 de start-veldketen staat in geen enkel bestand buiten ganttViewport.ts',
    hits, ['src/utils/ganttViewport.ts']);
  // Issue #65 voegde een DERDE plek toe: het "spring naar taak"-effect (pendingFocusTaskId) rekent
  // met dezelfde effectieve oorsprong als de render-memo en `revealTaskIfOffscreen`, om exact
  // dezelfde reden — anders zou de gesprongen positie niet 1-op-1 kloppen met wat er getekend wordt.
  eq('40 GanttCanvas gebruikt computeEffectiveViewStart op drie plekken (memo + reveal + spring-naar-taak)',
    (src.match(/computeEffectiveViewStart\(/g) ?? []).length, 3);

  // En de gedeelde functie moet daadwerkelijk gedeeld zijn: `computeScrollToDate` had een eigen
  // kopie, alleen door een commentaarregel aan de render-memo gekoppeld.
  const viewport = stripComments(readFileSync(viewportPath, 'utf8'));
  eq('41 computeScrollToDate hergebruikt de gedeelde oorsprongsfunctie',
    /computeScrollToDate[\s\S]{0,400}computeEffectiveViewStart\(/.test(viewport), true);

  // BEIDE panes moeten het vertaalde "verouderd"-label meegeven. Dat is geen tabelveld: de badge
  // wordt in de CHART getekend (`drawTaskBars` → `drawExternalGhosts`), dus een pane dat het
  // weglaat valt terug op de hardgecodeerde NL-tekst in de renderer — zichtbaar voor elke
  // niet-Nederlandse gebruiker met een externe koppeling in split view. Precies de fout die de
  // secundaire pane had.
  eq('42 beide panes geven het vertaalde "verouderd"-label mee',
    (src.match(/externalStaleLabel:\s*tTask\(/g) ?? []).length, 2);
  eq('43 geen pane laat externalStaleLabel leeg',
    /externalStaleLabel:\s*undefined/.test(src), false);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  gantt-render-options: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  gantt-render-options: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
