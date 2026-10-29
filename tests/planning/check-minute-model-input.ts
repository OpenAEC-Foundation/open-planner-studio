// F2, normalisatie bij invoer (spec §3.6, T17): één genormaliseerde wijziging per invoerroute.
//
// Review ronde 1 van PR #559, deel B, punt 1 (BEVESTIGD, BLOKKEERT): de no-op-toets vergeleek de
// genormaliseerde taak, maar de gevolgregels (`taskTriggerChanges`) en het schrijven gebruikten daarna de
// ruwe patch. Een naamwijziging met dezelfde SNET opnieuw als "2026-06-01" zag zo een andere beperking
// dan het opgeslagen "2026-06-01T07:00", en wiste de nivelleerpauze: het einde ging van 4 naar 3 juni,
// ook na opslaan. Deze check toetst dat via de store (`updateTask`, paneel/Gantt/extensie) én via de echte
// tool `planner_update_tasks` (MCP, `patchTaskFields`), met een IFC-rondgang. Twee controles houden de
// gevolgregel scherp: een échte datumwijziging wist de pauze wél, en een gelijke deadline is een no-op.
import { makeMcpContext } from '../mcp/harness';
import { getTool } from '@/services/mcp/toolRegistry';
import './domStub';
import { createAppStoreContext } from '@/state/appStoreFactory';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { normalizeTaskPatch } from '@/state/migrations/minuteModel';
import type { Task } from '@/types/task';

let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown) {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
}

const GAP = { afterMinutes: 480, gapMinutes: 480, source: 'leveling' as const };

/** Taak van drie dagen vanaf ma 1 juni, SNET 1 juni, met een nivelleerpauze van één dag. */
function setup() {
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().setProject({ startDate: '2026-06-01' });
  const id = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-06-01', 3), constraint: { type: 'SNET', date: '2026-06-01' } });
  S().applyLeveling({ delays: {}, gaps: { [id]: [GAP] } });
  const task = () => S().tasks.find(t => t.id === id)!;
  return { ctx, S, id, task };
}

type Route = 'updateTask' | 'planner_update_tasks';
const ROUTES: Route[] = ['updateTask', 'planner_update_tasks'];

async function edit(route: Route, f: ReturnType<typeof setup>, fields: Record<string, unknown>): Promise<void> {
  if (route === 'updateTask') {
    f.S().updateTask(f.id, fields as Partial<Task>);
    f.S().runCPM();
    return;
  }
  const outcome = await getTool('planner_update_tasks')!.handler({ updates: [{ id: f.id, fields }] }, makeMcpContext(f.ctx));
  eq(`${route}: de tool slaagt`, (outcome as { ok?: boolean }).ok, true);
}

for (const route of ROUTES) {
  // (1) Naam wijzigen en dezelfde SNET zonder tijd opnieuw meegeven: de pauze blijft.
  {
    const f = setup();
    eq(`${route} (1) beginstand: SNET is een moment`, f.task().constraint, { type: 'SNET', date: '2026-06-01T07:00' });
    eq(`${route} (1) beginstand: einde met pauze`, f.task().time.earlyFinish, '2026-06-04T16:00');
    const depth = historyDepthsForActiveScope(f.S()).undoDepth;
    await edit(route, f, { name: 'A hernoemd', constraint: { type: 'SNET', date: '2026-06-01' } });
    const t = f.task();
    eq(`${route} (1) naam gewijzigd`, t.name, 'A hernoemd');
    eq(`${route} (1) SNET blijft hetzelfde moment`, t.constraint, { type: 'SNET', date: '2026-06-01T07:00' });
    eq(`${route} (1) nivelleerpauze blijft`, t.splitGaps, [GAP]);
    eq(`${route} (1) einde blijft 4 juni 16:00`, t.time.earlyFinish, '2026-06-04T16:00');
    eq(`${route} (1) één undo-stap`, historyDepthsForActiveScope(f.S()).undoDepth, depth + 1);
    // Opslaan en heropenen: de pauze staat ook in het bestand.
    const back = readIFC(writeIFC(buildWriteIFCInput(f.S()))).tasks.find(x => x.id === f.id);
    eq(`${route} (1) pauze na IFC-rondgang`, back?.splitGaps, [GAP]);
    eq(`${route} (1) SNET na IFC-rondgang`, back?.constraint?.date?.slice(0, 10), '2026-06-01');
  }
  // (2) Controle: een échte nieuwe SNET verzet de tijdas en wist de pauze nog steeds.
  {
    const f = setup();
    await edit(route, f, { constraint: { type: 'SNET', date: '2026-06-02' } });
    eq(`${route} (2) nieuwe SNET is een moment`, f.task().constraint, { type: 'SNET', date: '2026-06-02T07:00' });
    eq(`${route} (2) echte datumwijziging wist de pauze`, f.task().splitGaps ?? null, null);
  }
}

// (3) Een opnieuw ingevoerde gelijke deadline zonder tijd is per saldo geen wijziging: geen undo-stap.
{
  const f = setup();
  f.S().updateTask(f.id, { deadline: '2026-06-05' });
  eq('(3) deadline wordt D2', f.task().deadline, '2026-06-05T16:00');
  const depth = historyDepthsForActiveScope(f.S()).undoDepth;
  const dirtyBefore = f.S().isDirty;
  f.S().updateTask(f.id, { deadline: '2026-06-05' });
  eq('(3) gelijke deadline: geen undo-stap', historyDepthsForActiveScope(f.S()).undoDepth, depth);
  eq('(3) gelijke deadline: pauze blijft', f.task().splitGaps, [GAP]);
  eq('(3) gelijke deadline: isDirty onveranderd', f.S().isDirty, dirtyBefore);
}

// (4) De helper zelf: alleen omgezette waarden worden vervangen; de rest van de patch blijft.
{
  const f = setup();
  const base = f.task();
  const patch: Partial<Task> = { name: 'X', constraint: { type: 'SNET', date: '2026-06-01' } };
  const next: Task = { ...base, name: 'X', constraint: { type: 'SNET', date: '2026-06-01T07:00' } };
  const out = normalizeTaskPatch(patch, next);
  eq('(4) beperking krijgt het moment', out.constraint, { type: 'SNET', date: '2026-06-01T07:00' });
  eq('(4) naam blijft dezelfde waarde', out.name, 'X');
  eq('(4) invoer blijft onaangeroerd', patch.constraint, { type: 'SNET', date: '2026-06-01' });
  const nothing: Partial<Task> = { name: 'X' };
  eq('(4) niets om te zetten: dezelfde patch', normalizeTaskPatch(nothing, { ...base, name: 'X' }) === nothing, true);
  const timePatch = { actualStart: '2026-06-01', actualFinish: undefined } as unknown as Task['time'];
  const timeNext: Task = { ...base, time: { ...base.time, actualStart: '2026-06-01T07:00', actualFinish: undefined } };
  const timeOut = normalizeTaskPatch({ time: timePatch }, timeNext).time!;
  eq('(4) tijdsleutel krijgt het moment', timeOut.actualStart, '2026-06-01T07:00');
  eq('(4) undefined-sleutel blijft aanwezig en leeg', ['actualFinish' in timeOut, timeOut.actualFinish], [true, undefined]);
  eq('(4) geen extra tijdsleutels', Object.keys(timeOut).sort(), ['actualFinish', 'actualStart']);
}

if (errors.length) { for (const e of errors) console.log(`XX ${e}`); process.exitCode = 1; }
console.log(`minutenmodel invoer: ${checks - errors.length}/${checks} groen`);
