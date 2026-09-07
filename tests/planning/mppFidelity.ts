// Fidelity-meetkern (fase 3.8, etappe "MSP-pariteit", T1) — de pure functie die vaststelt hoe
// dicht `readMPP` + herberekening bij MS Projects EIGEN opgeslagen Start/Finish komt.
//
// TWEE LEVENS, ÉÉN IMPLEMENTATIE (plandocument §5): implementers/reviewers draaien deze module
// tijdens de etappe voor voor→na-cijfers, en `check-mpp-fidelity.ts` registreert 'm als
// regressietest. Beide lopen tegen de LIVE worktree — geen gepinde code-snapshot, geen tweede
// harnas dat kan afdrijven.
//
// KRITIEK ONTWERPPUNT (T1-acceptatie #1, herzien na reviewbevinding M3): dit bestand roept
// `solveProject` aan — NIET een losse `new CPMSolver(...).solve()` zoals het scratchpad-audit-
// harnas (`measure.ts`) nog deed. Dat scratchpad-harnas riep zelf óók `expandSummaryRelations` +
// `applyCpmResult` aan (het HAD dus feitelijk dezelfde keten, niet "een ander pad" — de eerdere
// versie van dit commentaar overdreef dat) — maar als HANDMATIG SAMENGESTELDE kopie van de stappen
// die `solveProject` bundelt. Zo'n kopie kan afdrijven van de echte app-keten zodra `runCPM` een
// stap toevoegt/herordent zonder dat het scratchpad-harnas meeverandert (het IS immers gepind op
// snapshot 97368f7d en wordt niet meer bijgewerkt). `solveProject`
// (`src/engine/scheduler/solveProject.ts`) is sinds A3/M3 de exacte, GEGARANDEERDE kern die
// `scheduleSlice.runCPM` zelf aanroept — dit bestand roept 'm rechtstreeks aan in plaats van de
// stappen ervan te herhalen, zodat een toekomstige wijziging in de app-keten hier automatisch
// meekomt. Zie T1-acceptatie #1 (mutatiebewijs: de `expandSummaryRelations`-aanroep in
// `solveProject.ts` tijdelijk verwijderen maakt deze suite rood — bewijst dat er geen tweede,
// stilzwijgend gedupliceerde implementatie in dit bestand zit).
import { readMPP } from '@/services/mpp/mppReader';
import { solveProject } from '@/engine/scheduler/solveProject';
import { scanGroundTruthTasks, type RawTask } from './mppGroundTruth';
import { classify, compareFidelityRow, countFidelityAxis } from './fidelityCore';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Project } from '@/types/project';

export { classify } from './fidelityCore';

const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 16) : null);
const dayOf = (s: string): string => s.slice(0, 10);

function dayDelta(ours: string, truth: string): number {
  const a = parseInstant(dayOf(ours)).getTime();
  const b = parseInstant(dayOf(truth)).getTime();
  return Math.round((a - b) / 86400000);
}

/** Resultaat van `readMPP` + `solveProject` — de "onze-ES/onze-EF"-kant van de vergelijking. */
export interface SolvedMpp {
  tasks: Task[];
  sequences: Sequence[];
  project: Project;
  cpmError: string | null;
}

/**
 * Lees + reken door — EXACT de keten die `scheduleSlice.runCPM` draait (zie de moduleheader).
 * Gedeeld door `measureFidelity` hieronder én door `check-mpp-fidelity.ts`'s pad-pariteitscase
 * (die dit vergelijkt met wat de ECHTE store via `applyLoadedProject`+`runCPM` oplevert).
 */
export function solveMppBytes(bytes: Uint8Array): SolvedMpp {
  const result = readMPP(bytes);
  const cpm = solveProject({
    tasks: result.tasks,
    sequences: result.sequences,
    calendar: result.calendar,
    calendars: result.resourceCalendars ?? [],
    dataDate: result.project.statusDate,
    progressMode: result.project.progressMode,
    schedulingOptions: result.project.schedulingOptions,
    // Gebruikstest-bevinding 2026-08 (zelfde optie als runCPM): sinds T7 (§9/O2, review-fixronde)
    // is dit UITSLUITEND nog een early-start-ondergrens voor taken MÉT voorganger (en hammocks) —
    // een taak zonder voorganger houdt sindsdien altijd haar eigen (evt. vóór-projectstart) anker aan.
    projectStartDate: result.project.startDate,
  });
  return { tasks: result.tasks, sequences: result.sequences, project: result.project, cpmError: cpm.error ?? null };
}

/** Eén rij van een afwijkende taak, voor `OPS_MPP_FIDELITY_REPORT=detail` — het "detail-formaat"
 *  uit het scratchpad-harnas (§5: "Overneembaar: … het detail-formaat"). */
export interface DiffTaskDetail {
  id: string;
  name: string;
  msStart: string | null;
  ourStart: string;
  msFinish: string | null;
  ourFinish: string;
  startMark: ' ' | '~' | 'X';
  finishMark: ' ' | '~' | 'X';
  durationDays: number;
  isMilestone: boolean;
  constraint: string;
  completionPct: number;
  actualStart: string;
  calendarId: string;
  preds: string;
}

export interface FidelityRow {
  status: 'ok' | 'rejected' | 'error';
  /** Alleen bij status 'rejected': `MppUnsupportedError.mppCode` (MPP_LEGACY/MPP_ENCRYPTED — telt
   *  als overgeslagen, nooit als fout, eigenaarsbesluit O7). Bij 'error': de foutnaam/-boodschap. */
  errCode?: string;
  errMsg?: string;
  tasks: number;
  startExact: number;
  /** Zelfde dag, andere klokstand (uurmodus). Wordt WEL per-veld gepind (`===`, dus een regressie
   *  van sameday naar diff of vice versa faalt gewoon de betreffende pin), maar telt bewust NIET
   *  mee in de "bestanden met ≥1 afwijking"-verzameling (reviewbevinding L6, zie
   *  check-mpp-fidelity.ts) — die verzameling volgt uitsluitend `startDiff`/`finishDiff` (een
   *  andere DAG, de eis van de goal is "tot op de minuut", maar de globale set-pin dient om een
   *  NIEUW afwijkend bestand te vangen, niet om sameday-ruis daarin mee te wegen). */
  startSameday: number;
  startDiff: number;
  finishExact: number;
  finishSameday: number;
  finishDiff: number;
  /** Attribuut-emmers over taken met een AFWIJKENDE (andere dag) start — zelfde emmers als het
   *  scratchpad-harnas: welke eigenschap correleert met de afwijking. */
  diffBuckets: Record<string, number>;
  /** Per afwijkende (sameday of diff) taak — alleen gebruikt door de detail-rapportage;
   *  altijd berekend (corpus is klein genoeg, < 3413 taken totaal) zodat rapport- en toetsmodus
   *  exact dezelfde data zien (rapportmodus mag de poort niet kunnen verzwakken, T1-acceptatie #4). */
  diffTasks: DiffTaskDetail[];
}

function rejectedRow(errCode: string, errMsg: string): FidelityRow {
  return {
    status: 'rejected', errCode, errMsg, tasks: 0,
    startExact: 0, startSameday: 0, startDiff: 0, finishExact: 0, finishSameday: 0, finishDiff: 0,
    diffBuckets: {}, diffTasks: [],
  };
}

function errorRow(errMsg: string): FidelityRow {
  return {
    status: 'error', errMsg, tasks: 0,
    startExact: 0, startSameday: 0, startDiff: 0, finishExact: 0, finishSameday: 0, finishDiff: 0,
    diffBuckets: {}, diffTasks: [],
  };
}

/**
 * De meting zelf: `readMPP` + `solveProject` (via `solveMppBytes`) tegen de onafhankelijke
 * grondwaarheid (`scanGroundTruthTasks`). `errCode`/`status`-classificatie spiegelt
 * `check-mpp-import.ts`'s bestaande conventie (`err.mppCode` aanwezig ⇒ 'rejected'/overgeslagen,
 * anders 'error'/echte fout — eigenaarsbesluit O7: MPP_LEGACY telt nooit als fout).
 */
export function measureFidelity(bytes: Uint8Array): FidelityRow {
  let solved: SolvedMpp;
  try {
    solved = solveMppBytes(bytes);
  } catch (e: unknown) {
    const err = e as { mppCode?: string; message?: unknown; name?: unknown };
    if (err && typeof err.mppCode === 'string') {
      return rejectedRow(err.mppCode, String(err.message ?? e).slice(0, 200));
    }
    return errorRow(String((e as Error)?.message ?? e).slice(0, 300));
  }

  let raws: RawTask[];
  try {
    ({ raws } = scanGroundTruthTasks(bytes));
  } catch (e: unknown) {
    return errorRow(`scanGroundTruthTasks: ${String((e as Error)?.message ?? e)}`);
  }

  const { tasks, sequences, project } = solved;
  if (raws.length !== tasks.length) {
    return errorRow(`grondwaarheid-uitlijning mislukt: ${raws.length} raw vs ${tasks.length} taken (readTasks/scanGroundTruthTasks lopen niet meer synchroon op ID)`);
  }
  // M2 (reviewbevinding): lengte-gelijkheid alleen bewijst nog GEEN 1-op-1-uitlijning — een
  // verschoven positie (bv. één taak eerder in de ene lijst geskipt, één later in de andere) zou
  // een lengte-match geven terwijl raws[i] en tasks[i] niet dezelfde taak zijn. Beide lijsten
  // sorteren op MS Projects eigen taak-ID (readTasks en scanGroundTruthTasks doen dat allebei),
  // dus de namen op gelijke positie moeten identiek zijn — corpusbreed gemeten (T1-review): 0
  // naam-mismatches, 0 dubbele MSP-ID's over 3413 taken/216 bestanden. Dat maakt deze check op dit
  // corpus "gratis" (nooit rood), maar een toekomstig corpusbestand met een collision zou hier
  // stil verkeerd rekenen zonder deze guard — rood, niet stil doorgaan.
  //
  // H2 (reviewbevinding, privacy): de foutmelding hieronder draagt NOOIT de taaknamen zelf — alleen
  // positie, MSP-id en naamLENGTE. `errorRow`'s boodschap komt in DEFAULT-modus (niet alleen
  // detail-modus) via `processFile` op stdout terecht, en dat is precies de uitvoer die CI-logs/
  // agents/mensen kopiëren-plakken — een taaknaam uit een bedrijfsbestand hoort daar nooit in,
  // zelfs niet als "bewijs" van een mismatch. Positie + id + lengte volstaat om het defect te
  // lokaliseren; wie de werkelijke namen nodig heeft draait zelf `OPS_MPP_FIDELITY_REPORT=detail`
  // (die modus print corpusinhoud bewust wél, zie de waarschuwing daarover in check-mpp-fidelity.ts).
  for (let i = 0; i < raws.length; i++) {
    if (raws[i].name !== tasks[i].name) {
      return errorRow(
        `grondwaarheid-uitlijning mislukt op positie ${i}: raw naamlengte ${raws[i].name.length} `
        + `(MSP-id ${raws[i].id}) ≠ readMPP-naamlengte ${tasks[i].name.length} — de twee scans zijn losgeraakt `
        + `(namen bewust niet in deze melding — draai OPS_MPP_FIDELITY_REPORT=detail voor de inhoud)`,
      );
    }
  }

  const truthStart = new Map<string, string | null>();
  const truthFinish = new Map<string, string | null>();
  raws.forEach((r, i) => {
    truthStart.set(tasks[i].id, iso(r.start));
    truthFinish.set(tasks[i].id, iso(r.finish));
  });

  if (solved.cpmError) {
    return errorRow(`CPM-fout: ${solved.cpmError}`);
  }

  const predsOf = new Map<string, string[]>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const s of sequences) {
    const list = predsOf.get(s.successorId) ?? [];
    list.push(`${byId.get(s.predecessorId)?.name.slice(0, 18) ?? '?'}[${s.type}]`);
    predsOf.set(s.successorId, list);
  }

  const comparisonRows = tasks.map(t => compareFidelityRow(t.id, {
    start: { ours: t.time.earlyStart, truth: truthStart.get(t.id) ?? null },
    finish: { ours: t.time.earlyFinish, truth: truthFinish.get(t.id) ?? null },
  }));
  const startCounts = countFidelityAxis(comparisonRows, 'start');
  const finishCounts = countFidelityAxis(comparisonRows, 'finish');
  const buckets: Record<string, number> = {};
  const bump = (k: string) => { buckets[k] = (buckets[k] ?? 0) + 1; };
  const diffTasks: DiffTaskDetail[] = [];

  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    const t = tasks[taskIndex];
    const comparison = comparisonRows[taskIndex];
    const truthS = truthStart.get(t.id) ?? null;
    const truthF = truthFinish.get(t.id) ?? null;
    const cs = comparison.axes.start.verdict;
    const cf = comparison.axes.finish.verdict;

    if (cs === 'diff') {
      // L7 (reviewbevinding): géén `truthS && dayDelta(...) !== 0`-guard meer — beide waren dode
      // conditie. `classify()` geeft 'diff' UITSLUITEND terug wanneer `truth` niet-null was (anders
      // 'missing') én de dag verschilt (anders 'exact'/'sameday'), dus `truthS` is hier altijd
      // gezet en `dayDelta(...) !== 0` is hier altijd waar — vandaar de niet-null-assertie i.p.v.
      // een dubbele check die nooit `false` kan zijn.
      const delta = dayDelta(t.time.earlyStart, truthS!);
      if (truthS! < project.startDate) bump('storedVoorProjectstart');
      if ((t.time.completion ?? 0) > 0) bump('heeftVoortgang');
      if (t.childIds.length > 0) bump('samenvattingstaak');
      if (t.constraint) bump('heeftConstraint');
      bump(delta > 0 ? 'wijLater' : 'wijVroeger');
      bump('totaal');
    }

    if (cs !== 'exact' || cf !== 'exact') {
      const mark = (c: ReturnType<typeof classify>): ' ' | '~' | 'X' => (c === 'exact' ? ' ' : c === 'sameday' ? '~' : 'X');
      diffTasks.push({
        id: t.id,
        name: t.name,
        msStart: truthS,
        ourStart: t.time.earlyStart,
        msFinish: truthF,
        ourFinish: t.time.earlyFinish,
        startMark: mark(cs),
        finishMark: mark(cf),
        durationDays: t.time.scheduleDuration,
        isMilestone: t.isMilestone,
        constraint: t.constraint ? `${t.constraint.type}${t.constraint.date ?? ''}` : '-',
        completionPct: Math.round((t.time.completion ?? 0) * 100),
        actualStart: t.time.actualStart ?? '-',
        calendarId: t.calendarId ?? '-',
        preds: (predsOf.get(t.id) ?? []).join(','),
      });
    }
  }

  return {
    status: 'ok',
    tasks: tasks.length,
    startExact: startCounts.exact, startSameday: startCounts.sameday, startDiff: startCounts.diff,
    finishExact: finishCounts.exact, finishSameday: finishCounts.sameday, finishDiff: finishCounts.diff,
    diffBuckets: buckets,
    diffTasks,
  };
}
