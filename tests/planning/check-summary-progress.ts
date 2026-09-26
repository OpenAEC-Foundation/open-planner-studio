// Voortgang en status van een verzameltaak (fase) — headless tegen de ECHTE store.
//
// Bevinding "weergaven 3" + "taakmutaties 7": de Tabel, de Gantt-tooltip, de PDF en MCP lazen de
// OPGESLAGEN `completion`/`status` van een fase (vaak 0% "Niet gestart", of een bevroren
// importwaarde), terwijl het WBS-rapport zelf een duurgewogen voortgang uitrekende en 100% zei.
// Tegelijk accepteerden de paneelschuif, het contextmenu en het raster eigen voortgang op een fase
// (fase 100%, kinderen 0%), terwijl MCP, voortgangsimport en de gids zeggen dat een fase geen eigen
// voortgang draagt.
//
// Besluit (optie A): fasevoortgang is ALTIJD afgeleid — één gedeelde helper met de gewogen formule
// van het WBS-rapport, aangeroepen in de verzameltaak-rollup van `applyCpmResult` — met dezelfde
// uitzonderingen als de datum-rollup (handmatig geplande fase, "datums zoals opgeslagen"). Voortgang
// op een fase is alleen-lezen; het contextmenu werkt via de bladtaken eronder.
//
// Draait via run.sh.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { planTaskCellEdit } from '@/engine/taskGrid/taskEditPlan';
import { buildTaskEditPlanEnvironment } from '@/state/gridTransaction';
import { computeWbsSummary, type ReportContext } from '@/engine/reports';
import { contextMenuBulk } from '@/components/canvas/contextMenuScope';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { CellEditIntent, TaskColumnContext } from '@/types/taskGrid';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
}
function ok(label: string, condition: boolean, info = ''): void {
  checks++;
  if (!condition) diffs.push(`${label}${info ? ` (${info})` : ''}`);
}
function near(label: string, got: number, want: number, tol = 0.0006): void {
  checks++;
  if (!(Math.abs(got - want) <= tol)) diffs.push(`${label}: verwacht ≈${want}, kreeg ${got}`);
}

const S = () => useAppStore.getState();
const task = (id: string): Task => S().tasks.find(t => t.id === id)!;
const byName = (name: string): Task => S().tasks.find(t => t.name === name)!;
const progressOf = (id: string) => ({ completion: task(id).time.completion, status: task(id).status });

function setTime(id: string, patch: Partial<Task['time']>): void {
  S().updateTask(id, { time: { ...task(id).time, ...patch } });
}

function reportContext(): ReportContext {
  const s = S();
  return {
    tasks: s.tasks, sequences: s.sequences, resources: s.resources, assignments: s.assignments,
    calendar: s.calendar, calendars: s.calendars, cpmResult: s.cpmResult, baseline: null,
    statusDate: s.project.statusDate, today: '2026-03-20',
    datesAsRecorded: s.datesAsRecorded,
  } as ReportContext;
}
function wbsCompletion(id: string): number {
  const row = computeWbsSummary(reportContext(), { maxLevel: 0, includeActivities: false }).rows.find(r => r.taskId === id);
  return row ? row.completion : NaN;
}

/**
 * Fase P met drie bladtaken (5d, 10d, 5d) en een subfase Q met één blad (4d). Alles start op de
 * projectstart; de statusdatum ligt ná de einden, zodat werkelijke datums nooit geweigerd worden.
 */
function reset() {
  S().newProject();
  S().setProject({ startDate: '2026-03-02', statusDate: '2026-03-31' });
  const P = S().addTask({ name: 'Fase' });
  const leaf = (name: string, dur: number, parentId: string) => {
    const id = S().addTask({ name, parentId });
    setTime(id, { scheduleDuration: dur });
    return id;
  };
  const K1 = leaf('K1', 5, P);
  const K2 = leaf('K2', 10, P);
  const K3 = leaf('K3', 5, P);
  const Q = S().addTask({ name: 'Subfase', parentId: P });
  const L1 = leaf('L1', 4, Q);
  S().runCPM();
  return { P, Q, K1, K2, K3, L1 };
}

// ── 1. Alles 100% ⇒ de fase is 100% en voltooid ──────────────────────────────────────────────
{
  const ids = reset();
  eq('Vooraf: fase 0% niet gestart', progressOf(ids.P), { completion: 0, status: 'NOT_STARTED' });
  for (const id of [ids.K1, ids.K2, ids.K3, ids.L1]) S().setTaskProgress(id, 1);
  S().runCPM();
  eq('Alle kinderen 100% ⇒ fase 100% COMPLETED', progressOf(ids.P), { completion: 1, status: 'COMPLETED' });
  eq('Alle kinderen 100% ⇒ subfase 100% COMPLETED', progressOf(ids.Q), { completion: 1, status: 'COMPLETED' });
  eq('WBS-rapport zegt hetzelfde (fase)', wbsCompletion(ids.P), 1);

  // Terug naar 0%: de bladen houden (§3.2) hun werkelijke start en blijven dus "gestart" — de fase
  // volgt precies dat. Pas als ook de werkelijke starts weg zijn, is de fase weer "niet gestart".
  for (const id of [ids.K1, ids.K2, ids.K3, ids.L1]) S().setTaskProgress(id, 0);
  S().runCPM();
  eq('Alle kinderen terug naar 0% (mét werkelijke start) ⇒ fase 0% STARTED', progressOf(ids.P), { completion: 0, status: 'STARTED' });
  for (const id of [ids.K1, ids.K2, ids.K3, ids.L1]) S().setActualStart(id, undefined);
  S().runCPM();
  eq('Ook de werkelijke starts gewist ⇒ fase 0% NOT_STARTED', progressOf(ids.P), { completion: 0, status: 'NOT_STARTED' });
}

// ── 2. Gemengd ⇒ duurgewogen over de BLADEN, gelijk aan het WBS-rapport ──────────────────────
{
  const ids = reset();
  S().setTaskProgress(ids.K1, 1);
  S().setTaskProgress(ids.K2, 0.4);
  S().setTaskProgress(ids.L1, 0.5);
  S().runCPM();
  // (5×1 + 10×0.4 + 5×0 + 4×0.5) / (5+10+5+4) = 11/24
  near('Gemengd: fase = Σ(duur×%)/Σduur over de bladen', progressOf(ids.P).completion, 11 / 24);
  eq('Gemengd: fase status STARTED', progressOf(ids.P).status, 'STARTED');
  eq('Gemengd: fase-waarde = WBS-rapport, exact', progressOf(ids.P).completion, wbsCompletion(ids.P));
  eq('Gemengd: subfase 50% STARTED', progressOf(ids.Q), { completion: 0.5, status: 'STARTED' });
  eq('Gemengd: subfase-waarde = WBS-rapport, exact', progressOf(ids.Q).completion, wbsCompletion(ids.Q));

  // Gestart zonder % (werkelijke start, 0%) ⇒ fase "bezig", voortgang 0.
  const ids2 = reset();
  ok('Werkelijke start op een blad wordt geaccepteerd', S().setActualStart(ids2.K3, '2026-03-02'));
  S().runCPM();
  eq('Blad gestart op 0% ⇒ fase 0% STARTED', progressOf(ids2.P), { completion: 0, status: 'STARTED' });
}

// ── 3. Uitzondering: een handmatig geplande fase houdt haar opgeslagen waarde ─────────────────
{
  const ids = reset();
  S().setTaskProgress(ids.K1, 1);
  S().updateTask(ids.P, { manuallyScheduled: true, status: 'STARTED' });
  setTime(ids.P, { completion: 0.62 });
  S().runCPM();
  eq('Handmatige fase: opgeslagen voortgang blijft staan', progressOf(ids.P), { completion: 0.62, status: 'STARTED' });
  eq('Handmatige fase: WBS-rapport toont dezelfde opgeslagen waarde', wbsCompletion(ids.P), 0.62);
  near('Automatische subfase eronder rolt wél op', progressOf(ids.Q).completion, 0);
}

// ── 4. Voortgang op een fase is alleen-lezen: setters en raster weigeren ──────────────────────
{
  const ids = reset();
  S().setTaskProgress(ids.K1, 0.5);
  S().runCPM();
  const before = J(S().tasks);
  const accepted = S().setTaskProgress(ids.P, 1) as unknown;
  eq('setTaskProgress op een fase wordt geweigerd', accepted, false);
  eq('setTaskProgress op een fase verandert niets', J(S().tasks) === before, true);
  eq('setActualStart op een fase wordt geweigerd', S().setActualStart(ids.P, '2026-03-03'), false);
  eq('setActualFinish op een fase wordt geweigerd', S().setActualFinish(ids.P, '2026-03-10'), false);
  eq('Geweigerde actuals veranderen niets', J(S().tasks) === before, true);

  const registry = buildTaskColumnRegistry({ projectId: 'sp', activityCodeTypes: [], customFieldDefs: [], baselines: [] });
  const ctx = {} as TaskColumnContext;
  for (const id of ['task.status', 'task.time.completion', 'task.time.actualStart', 'task.time.actualFinish',
    'task.time.actualDuration', 'task.time.remainingTime']) {
    const d = registry.find(x => String(x.id) === id)!;
    const ro = (t: Task) => typeof d.readOnly === 'function' ? d.readOnly(t, ctx) : d.readOnly;
    eq(`Raster: ${id} alleen-lezen op een fase`, ro(task(ids.P)), true);
    eq(`Raster: ${id} bewerkbaar op een blad`, ro(task(ids.K1)), false);
    eq(`Raster: ${id} geeft de reden "summaryProgress"`, d.readOnlyReason?.(task(ids.P), ctx), 'summaryProgress');
  }

  const edit = (columnId: string, value: unknown): CellEditIntent => ({
    kind: 'cell-edit', taskId: ids.P, columnId: columnId as CellEditIntent['columnId'], route: 'task-progress', value,
  });
  const grid = S().runGridMutation([edit('task.time.completion', 1)]);
  eq('Raster-transactie: voortgang op een fase geweigerd', grid.ok, false);
  eq('Raster-transactie: met de reden summaryProgress', grid.ok ? null : grid.errors[0]?.code, 'summaryProgress');
  eq('Raster-transactie: niets gewijzigd', J(S().tasks) === before, true);
  const planned = planTaskCellEdit(task(ids.P), edit('task.status', 'COMPLETED'), buildTaskEditPlanEnvironment(S(), task(ids.P)));
  eq('Celplanner (ook voor plakken/import): status op een fase geweigerd', planned.ok ? null : planned.errors[0]?.code, 'summaryProgress');
}

// ── 5. Contextmenu "Voortgang" op een fase werkt via de bladtaken, niet op de fase zelf ───────
{
  const ids = reset();
  S().selectTask(ids.P, false);
  const beforeP = progressOf(ids.P);
  contextMenuBulk.setProgress(ids.P, 1);
  eq('Contextmenu: alle bladtaken onder de fase op 100%',
    [ids.K1, ids.K2, ids.K3, ids.L1].map(id => task(id).time.completion), [1, 1, 1, 1]);
  eq('Contextmenu: de fase zelf krijgt géén eigen voortgang (tot F5)', progressOf(ids.P), beforeP);
  S().runCPM();
  eq('Contextmenu + F5: fase 100% COMPLETED', progressOf(ids.P), { completion: 1, status: 'COMPLETED' });
  S().undo();
  eq('Contextmenu is één undo-stap', [ids.K1, ids.K2, ids.K3, ids.L1].map(id => task(id).time.completion), [0, 0, 0, 0]);
}

// ── 6. IFC: openen + opslaan zet geen oude fasevoortgang terug; "datums zoals opgeslagen" wel ──
{
  const ids = reset();
  S().setTaskProgress(ids.K1, 1);
  S().setTaskProgress(ids.K2, 1);
  S().setTaskProgress(ids.K3, 1);
  S().setTaskProgress(ids.L1, 1);
  S().runCPM();
  // Een "oud" bestand: de fase draagt een bevroren 62% "gestart", en K3 staat later opgeslagen dan
  // de berekening geeft (zodat openen een verschuiving vindt en "datums zoals opgeslagen" aanbiedt).
  // Sinds de fase ook afgeleide werkelijke datums krijgt, draagt ze na de rollup een werkelijk einde;
  // een bevroren 62%-fase heeft dat niet (de lezer zou haar daarop naar 100% normaliseren), dus weg.
  S().updateTask(ids.P, { status: 'STARTED' });
  setTime(ids.P, { completion: 0.62, actualFinish: undefined });
  setTime(ids.K3, { earlyStart: '2026-03-16', earlyFinish: '2026-03-20' });
  const oldFile = writeIFC(buildWriteIFCInput(S()));
  const rawOld = readIFC(oldFile).tasks.find(t => t.name === 'Fase')!;
  eq('Fixture: het bestand draagt de bevroren fasewaarde', [rawOld.time.completion, rawOld.status], [0.62, 'STARTED']);

  // Integratie groep B × main (heropen-beleid, eigenaarsbesluit 2026-09-24 "beperken"): een eigen
  // IFC biedt "datums zoals opgeslagen" alleen nog aan als het bestand zijn oorspronkelijke bron
  // noemt (`recordedSourceFormat`, geschreven in de modus). Het "oude" bestand hier stamt dus uit
  // een MSPDI-import; de fasevoortgang-regel die deze sectie bewaakt, verandert daar niet door.
  const parsedOld = readIFC(oldFile);
  parsedOld.recordedSourceFormat = 'mspdi';
  S().applyLoadedProject(parsedOld, { filePath: null, recompute: true });
  eq('Openen: de fase krijgt de afgeleide voortgang, niet de bevroren bestandswaarde',
    { completion: byName('Fase').time.completion, status: byName('Fase').status }, { completion: 1, status: 'COMPLETED' });
  const resaved = readIFC(writeIFC(buildWriteIFCInput(S()))).tasks.find(t => t.name === 'Fase')!;
  eq('Openen + opslaan: het bestand draagt nu de afgeleide waarde', [resaved.time.completion, resaved.status], [1, 'COMPLETED']);

  ok('Fixture: openen bood "datums zoals opgeslagen" aan', !!S().recordedDates);
  S().showRecordedDates();
  eq('"Datums zoals opgeslagen": de fase toont haar opgeslagen voortgang',
    { completion: byName('Fase').time.completion, status: byName('Fase').status }, { completion: 0.62, status: 'STARTED' });
  eq('"Datums zoals opgeslagen": WBS-rapport volgt de opgeslagen waarde', wbsCompletion(byName('Fase').id), 0.62);
  S().runCPM();
  eq('Herberekenen verlaat de modus: weer afgeleid',
    { completion: byName('Fase').time.completion, status: byName('Fase').status }, { completion: 1, status: 'COMPLETED' });
}

if (diffs.length === 0) {
  console.log(`OK  verzameltaak-voortgang (afgeleid, alleen-lezen): ${checks} controles groen`);
} else {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  verzameltaak-voortgang (afgeleid, alleen-lezen): ${diffs.length}/${checks} controles rood`);
  process.exit(1);
}
