// Werkelijke datums van een verzameltaak (fase) — headless tegen de ECHTE store.
//
// Vervolg op check-summary-progress.ts (besluit A: fasevoortgang is afgeleid en alleen-lezen). De
// werkelijke start en het werkelijke einde van een fase rolden niet op: een fase met begonnen of
// voltooide bladen had geen werkelijke datums (of een bevroren importwaarde), terwijl haar voortgang
// en status wél uit de bladen kwamen.
//
// Besluit (afgeleid uit hetzelfde besluit A): in dezelfde rollup en dezelfde helper
// (`summaryProgressOf`) krijgt de fase
// - werkelijke start = de vroegste werkelijke start van haar bladen, zodra er één begonnen is;
// - werkelijk einde = het laatste werkelijke einde, alleen als ALLE bladen voltooid zijn.
// Alleen-lezen zoals de voortgang, met dezelfde uitzonderingen (handmatige fase, "datums zoals
// opgeslagen"). Exports schrijven het afgeleide; de verplaats-telling telt de fase niet dubbel.
//
// Draait via run.sh.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { computeMoveImpact } from '@/engine/moveProject';
import type { CellEditIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import { installDOMParser } from './xmldom-shim';

// De MSPDI-lezer gebruikt de browser-`DOMParser`; in Node via de minimale shim.
installDOMParser();

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

const S = () => useAppStore.getState();
const task = (id: string): Task => S().tasks.find(t => t.id === id)!;
const byName = (name: string): Task => S().tasks.find(t => t.name === name)!;
/** Werkelijke datums van een taak; `null` = geen waarde. */
const actualsOf = (t: Task) => ({ as: t.time.actualStart ?? null, af: t.time.actualFinish ?? null });
const progressOf = (t: Task) => ({ completion: t.time.completion, status: t.status });

function setTime(id: string, patch: Partial<Task['time']>): void {
  S().updateTask(id, { time: { ...task(id).time, ...patch } });
}

/**
 * Fase P met drie bladtaken (5d, 10d, 5d) en een subfase Q met één blad (4d) — hetzelfde project als
 * check-summary-progress. Projectstart maandag 2 maart; de statusdatum ligt ná alle werkelijke
 * datums hieronder, zodat geen enkele geweigerd wordt.
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

/** Alle vier bladen voltooid, met een duidelijk vroegste start (K1/K2) en laatste einde (K2). */
function completeAll(ids: ReturnType<typeof reset>): void {
  const set = (id: string, as: string, af: string) => {
    ok(`Fixture: werkelijke start ${as} geaccepteerd`, S().setActualStart(id, as));
    ok(`Fixture: werkelijk einde ${af} geaccepteerd`, S().setActualFinish(id, af));
  };
  set(ids.K1, '2026-03-02', '2026-03-06');
  set(ids.K2, '2026-03-02', '2026-03-13');
  set(ids.K3, '2026-03-09', '2026-03-11');
  set(ids.L1, '2026-03-09', '2026-03-12');
  S().runCPM();
}

// ── 1. Werkelijke start = de vroegste van de bladen, zodra er één begonnen is ─────────────────
{
  const ids = reset();
  eq('Vooraf: fase zonder werkelijke datums', actualsOf(task(ids.P)), { as: null, af: null });
  ok('Blad K2 begint', S().setActualStart(ids.K2, '2026-03-04'));
  S().runCPM();
  eq('Eén blad begonnen ⇒ fase-start = die start, nog geen einde', actualsOf(task(ids.P)), { as: '2026-03-04', af: null });
  eq('Subfase zonder begonnen blad ⇒ geen werkelijke datums', actualsOf(task(ids.Q)), { as: null, af: null });
  ok('Blad L1 (in de subfase) begint eerder', S().setActualStart(ids.L1, '2026-03-03'));
  S().runCPM();
  eq('Vroegere start dieper in de boom ⇒ fase-start = de vroegste over alle bladen', actualsOf(task(ids.P)).as, '2026-03-03');
  eq('Subfase-start = haar eigen blad', actualsOf(task(ids.Q)).as, '2026-03-03');
  eq('Fase-status volgt (bestaande regel)', task(ids.P).status, 'STARTED');

  // Voortgang zonder expliciete datum: `setTaskProgress` leidt de werkelijke start van het blad af,
  // en de fase volgt die.
  const ids2 = reset();
  S().setTaskProgress(ids2.K3, 0.4);
  S().runCPM();
  eq('Blad op 40% (afgeleide start) ⇒ fase-start = die start', actualsOf(task(ids2.P)).as, task(ids2.K3).time.actualStart ?? null);
  ok('Fixture: het blad kreeg een werkelijke start', !!task(ids2.K3).time.actualStart);

  // Alle starts weer weg ⇒ ook de fase-start weg.
  S().setTaskProgress(ids2.K3, 0);
  S().setActualStart(ids2.K3, undefined);
  S().runCPM();
  eq('Geen begonnen blad meer ⇒ fase zonder werkelijke start', actualsOf(task(ids2.P)), { as: null, af: null });
}

// ── 2. Werkelijk einde = het laatste, alleen als ALLE bladen voltooid zijn ─────────────────────
{
  const ids = reset();
  S().setActualStart(ids.K1, '2026-03-02'); S().setActualFinish(ids.K1, '2026-03-06');
  S().setActualStart(ids.K2, '2026-03-02'); S().setActualFinish(ids.K2, '2026-03-13');
  S().setActualStart(ids.L1, '2026-03-09'); S().setActualFinish(ids.L1, '2026-03-12');
  S().setActualStart(ids.K3, '2026-03-09');
  S().runCPM();
  eq('Drie van vier bladen klaar ⇒ fase heeft een start maar GEEN einde', actualsOf(task(ids.P)), { as: '2026-03-02', af: null });
  eq('Subfase met haar enige blad klaar ⇒ start + einde', actualsOf(task(ids.Q)), { as: '2026-03-09', af: '2026-03-12' });
  eq('Subfase is dan 100% voltooid', progressOf(task(ids.Q)), { completion: 1, status: 'COMPLETED' });

  S().setActualFinish(ids.K3, '2026-03-11');
  S().runCPM();
  eq('Alle bladen klaar ⇒ fase-einde = het LAATSTE werkelijke einde (niet het laatst gezette)',
    actualsOf(task(ids.P)), { as: '2026-03-02', af: '2026-03-13' });
  eq('... en de fase is 100% voltooid: 100% ⇔ werkelijk einde, ook op de fase',
    progressOf(task(ids.P)), { completion: 1, status: 'COMPLETED' });

  S().setActualFinish(ids.K3, undefined);
  S().runCPM();
  eq('Eén blad weer open ⇒ het fase-einde vervalt, de start blijft', actualsOf(task(ids.P)), { as: '2026-03-02', af: null });
  eq('... en de fase is weer "bezig"', task(ids.P).status, 'STARTED');
}

// ── 3. Uitzondering: een handmatig geplande fase houdt haar opgeslagen werkelijke datums ───────
{
  const ids = reset();
  S().setActualStart(ids.K1, '2026-03-03');
  S().updateTask(ids.P, { manuallyScheduled: true, status: 'STARTED' });
  setTime(ids.P, { actualStart: '2026-02-26', completion: 0.1 });
  S().runCPM();
  eq('Handmatige fase: opgeslagen werkelijke start blijft staan', actualsOf(task(ids.P)), { as: '2026-02-26', af: null });
  eq('Automatische subfase eronder rolt wél op (geen begonnen blad)', actualsOf(task(ids.Q)), { as: null, af: null });
}

// ── 4. Alleen-lezen: setters en raster weigeren, de afgeleide waarde blijft ────────────────────
{
  const ids = reset();
  S().setActualStart(ids.K2, '2026-03-04');
  S().runCPM();
  const before = J(S().tasks);
  eq('setActualStart op een fase wordt geweigerd', S().setActualStart(ids.P, '2026-03-02'), false);
  eq('setActualFinish op een fase wordt geweigerd', S().setActualFinish(ids.P, '2026-03-10'), false);
  const edit: CellEditIntent = {
    kind: 'cell-edit', taskId: ids.P, columnId: 'task.time.actualStart' as CellEditIntent['columnId'],
    route: 'task-progress', value: '2026-03-02',
  };
  const grid = S().runGridMutation([edit]);
  eq('Raster-transactie: werkelijke start op een fase geweigerd met reden', grid.ok ? null : grid.errors[0]?.code, 'summaryProgress');
  eq('Geweigerde schrijfpogingen veranderen niets', J(S().tasks) === before, true);
  S().runCPM();
  eq('Na herberekenen: nog steeds de afgeleide start', actualsOf(task(ids.P)), { as: '2026-03-04', af: null });
}

// ── 5. Project verplaatsen: een fase telt niet dubbel als "taak met werkelijke datums" ─────────
{
  const ids = reset();
  S().setActualStart(ids.K1, '2026-03-03');
  S().runCPM();
  ok('Fixture: de fase draagt nu een afgeleide werkelijke start', !!task(ids.P).time.actualStart);
  const s = S();
  const impact = computeMoveImpact(s.tasks, s.resources, s.baselines, s.customFieldDefs);
  eq('Verplaats-telling: alleen het blad met eigen werkelijke datums telt', impact.actualCount, 1);
}

// ── 6. Exports schrijven de afgeleide fasedatums ───────────────────────────────────────────────
{
  const ids = reset();
  completeAll(ids);
  const s = S();
  const xml = writeMSPDI(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments);
  const phaseXml = xml.split('<Task>').find(block => block.includes('<Name>Fase</Name>')) ?? '';
  ok('MSPDI: de fase schrijft haar afgeleide ActualStart', /<ActualStart>2026-03-02T/.test(phaseXml), phaseXml.slice(0, 400));
  ok('MSPDI: de fase schrijft haar afgeleide ActualFinish', /<ActualFinish>2026-03-13T/.test(phaseXml), phaseXml.slice(0, 400));
  const back = readMSPDI(xml).tasks.find(t => t.name === 'Fase')!;
  eq('MSPDI terug: fase-actuals op de dag gelijk', [back.time.actualStart?.slice(0, 10), back.time.actualFinish?.slice(0, 10)], ['2026-03-02', '2026-03-13']);
  const csv = writeCSV(s.project, s.calendar, s.tasks, s.sequences, s.resources, s.assignments);
  const phaseRow = csv.split(/\r?\n/).find(line => /[;,]"?Fase"?[;,]/.test(line)) ?? '';
  ok('CSV: de faserij draagt de afgeleide werkelijke datums', phaseRow.includes('2026-03-02') && phaseRow.includes('2026-03-13'), phaseRow);
}

// ── 7. IFC: opslaan schrijft de afgeleide waarde; een oud bestand blijft leesbaar ──────────────
{
  const ids = reset();
  completeAll(ids);
  const saved = readIFC(writeIFC(buildWriteIFCInput(S()))).tasks.find(t => t.name === 'Fase')!;
  eq('Opslaan: het IFC draagt de afgeleide fase-actuals', actualsOf(saved), { as: '2026-03-02', af: '2026-03-13' });

  // Oud bestand A (typisch vóór deze wijziging): de fase draagt geen werkelijke datums en de oude
  // 0% "Niet gestart", terwijl haar bladen klaar zijn.
  S().updateTask(ids.P, { status: 'NOT_STARTED' });
  setTime(ids.P, { completion: 0, actualStart: undefined, actualFinish: undefined });
  const oldA = writeIFC(buildWriteIFCInput(S()));
  eq('Fixture A: het bestand draagt geen fase-actuals', actualsOf(readIFC(oldA).tasks.find(t => t.name === 'Fase')!), { as: null, af: null });
  S().applyLoadedProject(readIFC(oldA), { filePath: null, recompute: true });
  eq('Oud bestand A openen: de fase krijgt de afgeleide datums', actualsOf(byName('Fase')), { as: '2026-03-02', af: '2026-03-13' });
  eq('Oud bestand A openen: bladen ongewijzigd', actualsOf(byName('K2')), { as: '2026-03-02', af: '2026-03-13' });

  // Oud bestand B: de fase draagt BEVROREN werkelijke datums (MSP-import of een oude paneelinvoer),
  // en K3 staat later opgeslagen dan de berekening, zodat openen "datums zoals opgeslagen" aanbiedt.
  const idsB = reset();
  completeAll(idsB);
  setTime(idsB.P, { actualStart: '2026-02-20', actualFinish: '2026-03-20' });
  setTime(idsB.K3, { earlyStart: '2026-03-16', earlyFinish: '2026-03-20' });
  const oldB = writeIFC(buildWriteIFCInput(S()));
  eq('Fixture B: het bestand draagt de bevroren fase-actuals', actualsOf(readIFC(oldB).tasks.find(t => t.name === 'Fase')!), { as: '2026-02-20', af: '2026-03-20' });
  S().applyLoadedProject(readIFC(oldB), { filePath: null, recompute: true });
  eq('Oud bestand B openen: afgeleid, niet bevroren', actualsOf(byName('Fase')), { as: '2026-03-02', af: '2026-03-13' });
  const resaved = readIFC(writeIFC(buildWriteIFCInput(S()))).tasks.find(t => t.name === 'Fase')!;
  eq('Oud bestand B openen + opslaan: het bestand draagt nu de afgeleide waarde', actualsOf(resaved), { as: '2026-03-02', af: '2026-03-13' });

  ok('Fixture B: openen bood "datums zoals opgeslagen" aan', !!S().recordedDates);
  S().showRecordedDates();
  eq('"Datums zoals opgeslagen": de fase toont haar opgeslagen werkelijke datums', actualsOf(byName('Fase')), { as: '2026-02-20', af: '2026-03-20' });
  S().runCPM();
  eq('Herberekenen verlaat de modus: weer afgeleid', actualsOf(byName('Fase')), { as: '2026-03-02', af: '2026-03-13' });
}

if (diffs.length === 0) {
  console.log(`OK  verzameltaak-werkelijke datums (afgeleid, alleen-lezen): ${checks} controles groen`);
} else {
  for (const diff of diffs) console.log(`XX  ${diff}`);
  console.log(`XX  verzameltaak-werkelijke datums (afgeleid, alleen-lezen): ${diffs.length}/${checks} controles rood`);
  process.exit(1);
}
