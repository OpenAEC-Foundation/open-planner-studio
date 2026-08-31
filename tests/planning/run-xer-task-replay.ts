import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { XER_FIDELITY_AXES } from './xerGroundTruth';
import type { XerCorpusManifest } from './xerFidelity';
import { corpusReplayExitCode, runXerTaskReplayCorpus } from './xerTaskReplayCorpus';
import {
  dropFinishMilestoneBoundaryCandidate,
  syntheticZeroRegressionCandidate,
} from './xerTaskReplayProduct';

const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const corpusRoot = value('--corpus');
const manifestPath = value('--manifest') ?? join(process.cwd(), 'tests/planning/xer-corpus-manifest.json');
const candidateName = value('--candidate') ?? 'finish-milestone-boundary';
const report = value('--report') ?? 'summary';
if (!corpusRoot) throw new Error('gebruik: --corpus <map> [--candidate finish-milestone-boundary|zero] [--report summary|detail]');
if (report !== 'summary' && report !== 'detail') throw new Error(`onbekend rapporttype: ${report}`);
const candidate = candidateName === 'finish-milestone-boundary'
  ? dropFinishMilestoneBoundaryCandidate
  : candidateName === 'zero'
    ? syntheticZeroRegressionCandidate
    : undefined;
if (!candidate) throw new Error(`onbekende kandidaat: ${candidateName}`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as XerCorpusManifest;

const summary = runXerTaskReplayCorpus({
  corpusRoot,
  manifest,
  candidate,
  onEntry: entry => {
    console.log(JSON.stringify({
      type: 'entry',
      candidateId: candidate.id,
      label: entry.label,
      schemaFingerprint: entry.schemaFingerprint,
      projects: entry.projects,
      tasks: entry.tasks,
      projectsSolvedSequentially: entry.projectsSolvedSequentially,
      aggregate: entry.replay.aggregate,
    }));
    if (report !== 'detail') return;
    for (const predicate of entry.replay.predicate) {
      console.log(JSON.stringify({ type: 'predicate', candidateId: candidate.id, label: entry.label, ...predicate }));
    }
    for (const task of entry.replay.tasks) {
      console.log(JSON.stringify({
        type: 'task',
        candidateId: candidate.id,
        label: entry.label,
        projectId: task.projectId,
        taskId: task.taskId,
        taskCode: task.taskCode,
        axes: Object.fromEntries(XER_FIDELITY_AXES.map(axis => [axis, task.axes[axis]])),
        overall: task.overall,
      }));
    }
  },
});
console.log(JSON.stringify({ type: 'summary', ...summary }));
process.exitCode = corpusReplayExitCode(summary);
