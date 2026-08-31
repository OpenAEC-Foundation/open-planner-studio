import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { scanXerGroundTruth, XER_FIDELITY_AXES, type XerFidelityAxis } from './xerGroundTruth';
import { xerSchemaFingerprint, type XerCorpusManifest } from './xerFidelity';
import {
  evaluateXerTaskReplay,
  shouldRejectXerTaskReplay,
  type XerReplayCounts,
  type XerTaskReplayResult,
} from './xerTaskReplay';
import {
  replayXerProductBeforeOracle,
  type XerTaskReplayCandidate,
} from './xerTaskReplayProduct';

export interface XerTaskReplayEntryResult {
  label: string;
  schemaFingerprint: string;
  projects: number;
  tasks: number;
  projectsSolvedSequentially: number;
  replay: XerTaskReplayResult;
}

export interface XerTaskReplayCorpusSummary {
  candidateId: string;
  manifestEntries: number;
  selectedEntries: number;
  projects: number;
  tasks: number;
  aggregate: XerTaskReplayResult['aggregate'];
  rejected: boolean;
  maxRssBytes: number;
  memoryModel: 'one-manifest-entry-and-one-project-solve-clone-at-a-time';
}

export interface XerTaskReplayCorpusOptions {
  corpusRoot: string;
  manifest: XerCorpusManifest;
  candidate: XerTaskReplayCandidate;
  onEntry?: (entry: XerTaskReplayEntryResult) => void;
}

interface HashGroup {
  includedLabel?: string;
}

function emptyCounts(): XerReplayCounts {
  return { improved: 0, regressed: 0, unchanged: 0 };
}

function emptyAggregate(): XerTaskReplayResult['aggregate'] {
  return Object.fromEntries([
    ...XER_FIDELITY_AXES.map(axis => [axis, emptyCounts()] as const),
    ['overall', emptyCounts()] as const,
  ]) as XerTaskReplayResult['aggregate'];
}

function addCounts(target: XerReplayCounts, source: XerReplayCounts): void {
  target.improved += source.improved;
  target.regressed += source.regressed;
  target.unchanged += source.unchanged;
}

function addAggregate(target: XerTaskReplayResult['aggregate'], source: XerTaskReplayResult['aggregate']): void {
  for (const axis of XER_FIDELITY_AXES) addCounts(target[axis], source[axis]);
  addCounts(target.overall, source.overall);
}

function listXerLabels(root: string): string[] {
  const labels: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xer')) {
        labels.push(relative(root, path).split('\\').join('/'));
      }
    }
  };
  visit(root);
  return labels.sort((a, b) => a.localeCompare(b));
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function validateInventory(labels: readonly string[], manifest: XerCorpusManifest): void {
  const found = new Set(labels);
  const declared = new Set(Object.keys(manifest.files));
  for (const label of declared) {
    if (!found.has(label)) throw new Error(`task replay: manifestbestand ontbreekt in corpus: ${label}`);
  }
  for (const label of found) {
    if (!declared.has(label)) throw new Error(`task replay: corpusbestand ontbreekt in manifest: ${label}`);
  }
}

/**
 * Canonieke X12-selectie zonder alle corpusbytes tegelijk te bewaren. Pass 1 groepeert alleen
 * hashes; pass 2 scant uitsluitend de manifest-orakels en dedupliceert dezelfde schemafingerprint.
 */
function selectedLabels(
  corpusRoot: string,
  labels: readonly string[],
  manifest: XerCorpusManifest,
): string[] {
  const hashGroups = new Map<string, HashGroup>();
  for (const label of labels) {
    const bytes = readFileSync(join(corpusRoot, label));
    const actualHash = sha256(bytes);
    const manifestEntry = manifest.files[label]!;
    if (manifestEntry.sha256 !== actualHash) {
      throw new Error(`task replay ${label}: SHA-256 verwacht ${manifestEntry.sha256}, kreeg ${actualHash}`);
    }
    const group = hashGroups.get(actualHash) ?? {};
    if (manifestEntry.included && group.includedLabel === undefined) group.includedLabel = label;
    hashGroups.set(actualHash, group);
  }

  const fingerprints = new Set<string>();
  const selected: string[] = [];
  for (const group of hashGroups.values()) {
    if (!group.includedLabel) continue;
    const bytes = readFileSync(join(corpusRoot, group.includedLabel));
    const truth = scanXerGroundTruth(bytes);
    if (truth.errors.length > 0) {
      throw new Error(`task replay ${group.includedLabel}: scannerfout: ${truth.errors.join('; ')}`);
    }
    const fingerprint = xerSchemaFingerprint(truth);
    if (fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);
    selected.push(group.includedLabel);
  }
  return selected;
}

export function runXerTaskReplayCorpus(options: XerTaskReplayCorpusOptions): XerTaskReplayCorpusSummary {
  if (!existsSync(options.corpusRoot)) {
    throw new Error(`task replay: corpusmap bestaat niet: ${options.corpusRoot}`);
  }
  const labels = listXerLabels(options.corpusRoot);
  validateInventory(labels, options.manifest);
  const selected = selectedLabels(options.corpusRoot, labels, options.manifest);
  const aggregate = emptyAggregate();
  let projects = 0;
  let tasks = 0;
  let maxRssBytes = process.memoryUsage.rss();

  for (const label of selected) {
    const bytes = readFileSync(join(options.corpusRoot, label));
    // De kandidaatroute krijgt uitsluitend productimportdata. Pas daarna wordt het oracle aan de
    // onafhankelijke classificatiekern gekoppeld.
    const product = replayXerProductBeforeOracle(bytes, options.candidate);
    const truth = scanXerGroundTruth(bytes);
    const replay = evaluateXerTaskReplay({
      oracle: truth,
      baseline: product.baseline,
      counterfactual: product.counterfactual,
      predicate: product.predicate,
    });
    const entry: XerTaskReplayEntryResult = {
      label,
      schemaFingerprint: xerSchemaFingerprint(truth),
      projects: new Set(truth.tasks.map(task => task.projectId)).size,
      tasks: truth.tasks.length,
      projectsSolvedSequentially: product.projectsSolvedSequentially,
      replay,
    };
    projects += entry.projects;
    tasks += entry.tasks;
    addAggregate(aggregate, replay.aggregate);
    maxRssBytes = Math.max(maxRssBytes, process.memoryUsage.rss());
    options.onEntry?.(entry);
  }

  return {
    candidateId: options.candidate.id,
    manifestEntries: labels.length,
    selectedEntries: selected.length,
    projects,
    tasks,
    aggregate,
    rejected: XER_FIDELITY_AXES.some((axis: XerFidelityAxis) => aggregate[axis].regressed > 0),
    maxRssBytes,
    memoryModel: 'one-manifest-entry-and-one-project-solve-clone-at-a-time',
  };
}

/** Publieke CLI gebruikt exact dezelfde rode poort als de corpusloze fixture. */
export function corpusReplayExitCode(summary: XerTaskReplayCorpusSummary): 0 | 1 {
  const result = { aggregate: summary.aggregate } as XerTaskReplayResult;
  return shouldRejectXerTaskReplay(result) ? 1 : 0;
}
