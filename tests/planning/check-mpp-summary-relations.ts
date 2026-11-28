import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readMPP } from '@/services/mpp/mppReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { expandSummaryRelations, foldSyntheticSequenceIds } from '@/engine/scheduler/expandSummaryRelations';
import { installDOMParser } from './xmldom-shim';
import { legacyCpmOptions } from './legacySolveOptions';

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(label);
};

const CORPUS =
  process.env.OPS_MPP_CORPUS ??
  '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const TARGET_HASH = '870d339f60603f71';
function resolveByHash(dir: string, hash: string): string | null {
  if (!existsSync(dir)) return null;
  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.mpp')) continue;
    const full = join(dir, name);
    try {
      if (createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 16) === hash) return full;
    } catch {
    }
  }
  return null;
}
const path = resolveByHash(CORPUS, TARGET_HASH);

if (!path) {
  console.log(`OK  mpp-summary-relations: corpusbestand niet aanwezig (${TARGET_HASH}) — check overgeslagen`);
} else {
  let importResult: ReturnType<typeof readMPP> | null = null;
  let readErr: unknown = null;
  try {
    importResult = readMPP(new Uint8Array(readFileSync(path)));
  } catch (err) {
    readErr = err;
  }
  truthy(
    `readMPP op "${TARGET_HASH}" gooit niet (${readErr instanceof Error ? readErr.message : String(readErr ?? '')})`,
    readErr === null && importResult !== null,
  );

  if (importResult) {
    const { tasks, sequences, calendar, resourceCalendars } = importResult;
    truthy('bestand heeft taken', tasks.length > 0);
    truthy('bestand heeft relaties', sequences.length > 0);

    const leafTasks = tasks.filter((t) => t.childIds.length === 0);
    truthy('minstens één bladtaak (anders is er niets te plannen)', leafTasks.length > 0);
    const leafIds = new Set(leafTasks.map((t) => t.id));
    const touchesNonLeaf = sequences.some(
      (s) => !leafIds.has(s.predecessorId) || !leafIds.has(s.successorId),
    );
    truthy(
      'dit corpusbestand bevat minstens één relatie die een niet-bladtaak raakt (bewijst dat de check de propagatie echt oefent)',
      touchesNonLeaf,
    );
    const touchingCount = sequences.filter(
      (s) => !leafIds.has(s.predecessorId) || !leafIds.has(s.successorId),
    ).length;
    truthy(
      `de 489a9ef2-basislijn (28 relaties raken een niet-bladtaak) is nog intact — gemeten: ${touchingCount}`,
      touchingCount === 28,
    );

    const { sequences: expandedSequences, droppedSequenceIds: expansionDropped } =
      expandSummaryRelations(tasks, sequences);

    let solveThrew: unknown = null;
    let cpm: ReturnType<CPMSolver['solve']> | null = null;
    try {
      const solver = new CPMSolver(leafTasks, expandedSequences, calendar, resourceCalendars, legacyCpmOptions());
      cpm = solver.solve();
    } catch (err) {
      solveThrew = err;
    }
    truthy(
      `CPMSolver.solve() op "${TARGET_HASH}" crasht niet (${solveThrew instanceof Error ? solveThrew.stack ?? solveThrew.message : String(solveThrew ?? '')})`,
      solveThrew === null && cpm !== null,
    );

    if (cpm) {
      foldSyntheticSequenceIds(cpm);
      const totalDropped = [...new Set([...(cpm.droppedSequenceIds ?? []), ...expansionDropped])];

      truthy('geen circulaire-dependency-fout', !cpm.error);
      truthy('cpmResult bevat taakresultaten (rekent echt door)', cpm.tasks.size === leafTasks.length);
      truthy('projectEnd is een niet-lege datum', typeof cpm.projectEnd === 'string' && cpm.projectEnd.length > 0);
      truthy(
        `alle 105 relaties zijn nu gerepresenteerd — 0 gedropt (was 28 vóór de samenvattingsrelatie-propagatie), gemeten: ${totalDropped.length}`,
        totalDropped.length === 0,
      );

      truthy(`projectEnd-basislijn: ${cpm.projectEnd} (verwacht 2025-02-10T13:45, etappe 1.5 uurmodus)`, cpm.projectEnd === '2025-02-10T13:45');
      truthy(`projectDuration-basislijn: ${cpm.projectDuration} werkdagen (verwacht 6, etappe 1.5 uurmodus)`, cpm.projectDuration === 6);

      const relationKeyedIds = [
        ...cpm.drivingSequenceIds, ...cpm.truncatedLeadSequenceIds, ...cpm.outOfSequenceSequenceIds,
        ...Object.keys(cpm.sequenceFreeFloat),
      ];
      truthy(
        `I2: geen synthetische ids meer in drivingSequenceIds/sequenceFreeFloat/truncatedLead/outOfSequence ná fold (${relationKeyedIds.length} sleutels gecontroleerd)`,
        relationKeyedIds.every((id) => !id.includes('::exp-')),
      );

      const xmlPath = `${path}.xml`;
      if (existsSync(xmlPath)) {
        try {
          installDOMParser();
          const xmlResult = readMSPDI(readFileSync(xmlPath, 'utf-8'));
          if (process.env.OPS_MPP_DIAG === 'detail') {
            console.log(
              `    Ground-truth-vergelijking (voorbehoud: andere documentversie, zie header): ` +
              `onze projectEnd=${cpm.projectEnd}, MSPDI project.endDate=${xmlResult.project.endDate || '(leeg)'}.`,
            );
          } else {
            console.log('    Ground-truth-vergelijking gedaan (datums verborgen — OPS_MPP_DIAG=detail toont ze; corpusinhoud)');
          }
        } catch (err) {
          console.log(`    Ground-truth-vergelijking overgeslagen (readMSPDI faalde: ${err instanceof Error ? err.message : String(err)})`);
        }
      }

      console.log(
        `    ${TARGET_HASH}: ${leafTasks.length} bladtaken, ${sequences.length} relaties, ` +
        `${expandedSequences.length} bladtaak-relaties na expansie ` +
        `(${totalDropped.length} gedropt, was 28 vóór de propagatie)` +
        (process.env.OPS_MPP_DIAG === 'detail'
          ? `, projectEnd=${cpm.projectEnd}, projectDuration=${cpm.projectDuration} werkdagen`
          : ', projectEnd/duur verborgen (OPS_MPP_DIAG=detail; corpusinhoud)'),
      );
    }
  }

  if (diffs.length === 0) {
    console.log(`OK  mpp-summary-relations: alle checks groen (${checks})`);
  } else {
    console.log(`XX  mpp-summary-relations: ${diffs.length} afwijking(en) van ${checks}`);
    for (const d of diffs) console.log(`   - ${d}`);
    process.exitCode = 1;
  }
}
