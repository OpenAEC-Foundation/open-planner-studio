import { createHash } from 'node:crypto';

export interface XerProjectExclusion { projId: string; reason: string }
export interface XerTaskExclusion { projId: string; taskId?: string; taskCode?: string; reason: string }

export interface XerExclusionRecord {
  sha256: string;
  kind: 'project' | 'task';
  projId: string;
  taskId?: string;
  taskCode?: string;
  reason: string;
  decision: string;
}

export interface XerExclusionManifestLike {
  files: Record<string, {
    sha256: string;
    role: string;
    included: boolean;
    decision?: unknown;
    excludeProjects?: unknown;
    excludeTasks?: unknown;
  }>;
}

export const EXCLUSION_DECISION_RE = /^(\d{4})-(\d{2})-(\d{2}) eigenaarsbesluit: \S.*$/;
export const EXCLUSION_REASON_MIN = 10;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function decisionProblem(decision: unknown, today: string = todayUtc()): string | undefined {
  if (typeof decision !== 'string') return `decision ontbreekt of is geen tekst (verwacht "JJJJ-MM-DD eigenaarsbesluit: <tekst>")`;
  const match = EXCLUSION_DECISION_RE.exec(decision);
  if (!match || decision !== decision.trim()) return `decision ${JSON.stringify(decision.slice(0, 60))} heeft niet exact de vorm "JJJJ-MM-DD eigenaarsbesluit: <tekst>"`;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return `decision-datum ${match[1]}-${match[2]}-${match[3]} bestaat niet`;
  }
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) + 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (decision.slice(0, 10) > limit) return `decision-datum ${decision.slice(0, 10)} ligt in de toekomst (vandaag ${today})`;
  return undefined;
}

const PROJECT_KEYS = new Set(['projId', 'reason', 'decision']);
const TASK_KEYS = new Set(['projId', 'taskId', 'taskCode', 'reason', 'decision']);

function ruleDecision(at: string, item: Record<string, unknown>, entryDecision: string, today: string): { decision: string; problem?: string } {
  if (!Object.prototype.hasOwnProperty.call(item, 'decision')) return { decision: entryDecision };
  const own = item.decision;
  const bad = decisionProblem(own, today);
  if (bad !== undefined || typeof own !== 'string') return { decision: entryDecision, problem: `${at}: ${bad ?? 'decision geen tekst'}` };
  if (own.slice(0, 10) < entryDecision.slice(0, 10)) {
    return { decision: entryDecision, problem: `${at}: decision-datum ${own.slice(0, 10)} ligt vóór die van de entry (${entryDecision.slice(0, 10)}) — de entry noemt het vroegste besluit` };
  }
  return { decision: own };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value === value.trim();
}

function identityProblem(at: string, field: string, value: unknown): string | undefined {
  if (typeof value === 'number') return `${at}: ${field} moet een string zijn (kreeg het getal ${value}; schrijf "${value}")`;
  if (!nonEmpty(value)) return `${at}: ${field} ontbreekt of is leeg`;
  return undefined;
}

function reasonProblem(at: string, value: unknown): string | undefined {
  if (!nonEmpty(value)) return `${at}: reason ontbreekt of is leeg`;
  if (value.length < EXCLUSION_REASON_MIN) return `${at}: reason ${JSON.stringify(value)} is te kort (minimaal ${EXCLUSION_REASON_MIN} tekens)`;
  return undefined;
}

function recordKey(record: XerExclusionRecord): string {
  return JSON.stringify(recordTuple(record));
}

function recordTuple(record: XerExclusionRecord): string[] {
  return [record.sha256, record.kind, record.projId, record.taskId ?? '', record.taskCode ?? '', record.reason, record.decision];
}

function compareRecords(left: XerExclusionRecord, right: XerExclusionRecord): number {
  const a = recordKey(left);
  const b = recordKey(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function entryRecords(label: string, entry: XerExclusionManifestLike['files'][string], today: string): { records: XerExclusionRecord[]; problems: string[] } {
  const problems: string[] = [];
  const records: XerExclusionRecord[] = [];
  const has = (key: 'decision' | 'excludeProjects' | 'excludeTasks') => Object.prototype.hasOwnProperty.call(entry, key);
  if (!has('decision') && !has('excludeProjects') && !has('excludeTasks')) return { records, problems };
  const where = `manifest ${label}`;
  const hasExclusions = has('excludeProjects') || has('excludeTasks');
  if (!hasExclusions) {
    problems.push(`${where}: decision zonder excludeProjects/excludeTasks (een besluit zonder uitsluiting sluit niets uit)`);
    return { records, problems };
  }
  const decision = entry.decision;
  const badDecision = decisionProblem(decision, today);
  if (badDecision !== undefined || typeof decision !== 'string') {
    problems.push(`${where}: uitsluiting zonder geldig decision-veld — ${badDecision ?? 'geen tekst'}; de lezer weigert een uitsluiting die geen eigenaarsbesluit is`);
    return { records, problems };
  }
  if (entry.role !== 'oracle' || entry.included !== true) {
    problems.push(`${where}: uitsluiting op een entry die geen inbegrepen orakel is (role=${entry.role}) — sluit dan het hele bestand uit via role/included`);
    return { records, problems };
  }
  const projects = has('excludeProjects') ? entry.excludeProjects : [];
  const tasks = has('excludeTasks') ? entry.excludeTasks : [];
  for (const [field, list] of [['excludeProjects', projects], ['excludeTasks', tasks]] as const) {
    if (!Array.isArray(list)) problems.push(`${where}: ${field} is geen lijst`);
    else if (has(field) && list.length === 0) problems.push(`${where}: ${field} is leeg (laat het veld weg)`);
  }
  if (problems.length > 0) return { records, problems };
  for (const [index, item] of (projects as unknown[]).entries()) {
    const at = `${where}: excludeProjects[${index}]`;
    if (!isObject(item)) { problems.push(`${at} is geen object`); continue; }
    const extra = Object.keys(item).filter(key => !PROJECT_KEYS.has(key));
    if (extra.length > 0) problems.push(`${at}: onbekende sleutel(s) ${extra.join(', ')}`);
    const own = ruleDecision(at, item, decision, today);
    const itemProblems = [identityProblem(at, 'projId', item.projId), reasonProblem(at, item.reason), own.problem]
      .filter((problem): problem is string => problem !== undefined);
    problems.push(...itemProblems);
    if (extra.length === 0 && itemProblems.length === 0 && nonEmpty(item.projId) && nonEmpty(item.reason)) {
      records.push({ sha256: entry.sha256, kind: 'project', projId: item.projId, reason: item.reason, decision: own.decision });
    }
  }
  for (const [index, item] of (tasks as unknown[]).entries()) {
    const at = `${where}: excludeTasks[${index}]`;
    if (!isObject(item)) { problems.push(`${at} is geen object`); continue; }
    const extra = Object.keys(item).filter(key => !TASK_KEYS.has(key));
    if (extra.length > 0) problems.push(`${at}: onbekende sleutel(s) ${extra.join(', ')}`);
    const own = ruleDecision(at, item, decision, today);
    const itemProblems = [identityProblem(at, 'projId', item.projId), reasonProblem(at, item.reason), own.problem]
      .filter((problem): problem is string => problem !== undefined);
    problems.push(...itemProblems);
    const hasId = Object.prototype.hasOwnProperty.call(item, 'taskId');
    const hasCode = Object.prototype.hasOwnProperty.call(item, 'taskCode');
    const taskProblem = hasId === hasCode ? `${at}: precies één van taskId en taskCode is vereist`
      : identityProblem(at, hasId ? 'taskId' : 'taskCode', hasId ? item.taskId : item.taskCode);
    if (taskProblem !== undefined) problems.push(taskProblem);
    else if (extra.length === 0 && itemProblems.length === 0 && nonEmpty(item.projId) && nonEmpty(item.reason)) {
      records.push({
        sha256: entry.sha256, kind: 'task', projId: item.projId,
        ...(hasId ? { taskId: item.taskId as string } : { taskCode: item.taskCode as string }),
        reason: item.reason, decision: own.decision,
      });
    }
  }
  const seen = new Set<string>();
  const excludedProjects = new Set(records.filter(record => record.kind === 'project').map(record => record.projId));
  for (const record of records) {
    const identity = JSON.stringify([record.kind, record.projId, record.taskId ?? '', record.taskCode ?? '']);
    if (seen.has(identity)) problems.push(`${where}: dubbele uitsluiting ${record.kind} ${record.projId}/${record.taskId ?? record.taskCode ?? ''}`);
    seen.add(identity);
    if (record.kind === 'task' && excludedProjects.has(record.projId)) {
      problems.push(`${where}: taakuitsluiting ${record.projId}/${record.taskId ?? record.taskCode} staat al onder een uitgesloten project`);
    }
  }
  return { records: problems.length > 0 ? [] : records, problems };
}

export function readManifestExclusions(manifest: XerExclusionManifestLike, today: string = todayUtc()): {
  records: XerExclusionRecord[];
  bySha: Map<string, XerExclusionRecord[]>;
  problems: string[];
} {
  const problems: string[] = [];
  const perLabel = new Map<string, XerExclusionRecord[]>();
  for (const label of Object.keys(manifest.files).sort()) {
    const result = entryRecords(label, manifest.files[label]!, today);
    problems.push(...result.problems);
    perLabel.set(label, result.records);
  }
  const bySha = new Map<string, XerExclusionRecord[]>();
  const oracleLabelsBySha = new Map<string, string[]>();
  for (const [label, entry] of Object.entries(manifest.files)) {
    if (entry.role !== 'oracle' || entry.included !== true) continue;
    oracleLabelsBySha.set(entry.sha256, [...(oracleLabelsBySha.get(entry.sha256) ?? []), label].sort());
  }
  for (const [sha, labels] of oracleLabelsBySha) {
    const variants = labels.map(label => JSON.stringify((perLabel.get(label) ?? []).map(recordTuple).sort()));
    if (new Set(variants).size > 1) {
      problems.push(`manifest: byte-identieke orakellabels ${labels.join(', ')} dragen verschillende uitsluitingen`);
      continue;
    }
    const records = [...(perLabel.get(labels[0]!) ?? [])].sort(compareRecords);
    if (records.length > 0) bySha.set(sha, records);
  }
  const records = [...bySha.values()].flat().sort(compareRecords);
  return { records, bySha, problems };
}

export function exclusionsDigest(records: readonly XerExclusionRecord[]): string {
  return createHash('sha256').update(JSON.stringify([...records].sort(compareRecords).map(recordTuple))).digest('hex');
}

export interface TruthTaskIdentity { projectId: string; taskId: string; taskCode: string }

export interface ResolvedExclusions {
  projects: Set<string>;
  taskKeys: Set<string>;
  applied: Array<{ record: XerExclusionRecord; tasks: number }>;
  problems: string[];
}

export function exclusionTaskKey(projectId: string, taskId: string): string {
  return `${projectId}/${taskId}`;
}

export function resolveExclusions(tasks: readonly TruthTaskIdentity[], records: readonly XerExclusionRecord[]): ResolvedExclusions {
  const resolved: ResolvedExclusions = { projects: new Set(), taskKeys: new Set(), applied: [], problems: [] };
  const taskHitBy = new Map<string, string>();
  for (const record of records) {
    const label = `${record.sha256.slice(0, 12)} ${record.kind} ${record.projId}${record.kind === 'task' ? `/${record.taskId ?? `code ${record.taskCode}`}` : ''}`;
    const hits = record.kind === 'project'
      ? tasks.filter(task => task.projectId === record.projId)
      : tasks.filter(task => task.projectId === record.projId
        && (record.taskId !== undefined ? task.taskId === record.taskId : task.taskCode === record.taskCode));
    if (hits.length === 0) {
      resolved.problems.push(`uitsluiting ${label} raakt geen enkele orakeltaak (bestaat het project/de taak?)`);
    } else if (record.kind === 'task' && hits.length > 1) {
      resolved.problems.push(`uitsluiting ${label} is dubbelzinnig: ${hits.length} taken — gebruik taskId`);
    }
    if (record.kind === 'project') resolved.projects.add(record.projId);
    for (const task of hits) {
      const key = exclusionTaskKey(task.projectId, task.taskId);
      if (record.kind === 'task') {
        const earlier = taskHitBy.get(key);
        if (earlier !== undefined) resolved.problems.push(`uitsluiting ${label} raakt taak ${key}, die ${earlier} al uitsluit (dubbel: taskId én taskCode?)`);
        else taskHitBy.set(key, label);
      }
      resolved.taskKeys.add(key);
    }
    resolved.applied.push({ record, tasks: hits.length });
  }
  return resolved;
}

export function filterTruthExclusions<T extends { projects: Set<string>; tasks: TruthTaskIdentity[] }>(truth: T, resolved: ResolvedExclusions): T {
  if (resolved.taskKeys.size === 0 && resolved.projects.size === 0) return truth;
  return {
    ...truth,
    projects: new Set([...truth.projects].filter(project => !resolved.projects.has(project))),
    tasks: truth.tasks.filter(task => !resolved.taskKeys.has(exclusionTaskKey(task.projectId, task.taskId))),
  };
}

export function filterSolvedExclusions<P extends { projectId: string; tasks: readonly T[] }, T extends { sourceTaskId: string }>(
  projects: readonly P[],
  resolved: ResolvedExclusions,
): P[] {
  if (resolved.taskKeys.size === 0 && resolved.projects.size === 0) return [...projects];
  return projects
    .filter(project => !resolved.projects.has(project.projectId))
    .map(project => ({
      ...project,
      tasks: project.tasks.filter(task => !resolved.taskKeys.has(exclusionTaskKey(project.projectId, task.sourceTaskId))),
    }));
}

export function exclusionSummary(resolvedByFile: ReadonlyArray<{ label: string; resolved: ResolvedExclusions }>): { tasks: number; projects: number; line: string } {
  const projects = new Set<string>();
  let tasks = 0;
  const parts: string[] = [];
  for (const { label, resolved } of resolvedByFile) {
    tasks += resolved.taskKeys.size;
    for (const key of resolved.taskKeys) projects.add(`${label}\u0000${key.slice(0, key.indexOf('/'))}`);
    for (const { record, tasks: count } of resolved.applied) {
      const what = record.kind === 'project' ? `project ${record.projId}` : `taak ${record.projId}/${record.taskId ?? `code ${record.taskCode}`}`;
      parts.push(`${label}: ${what} (${count} taken) — ${record.reason} [${record.decision.slice(0, 10)}]`);
    }
  }
  return {
    tasks,
    projects: projects.size,
    line: `uitgesloten: ${tasks} taken in ${projects.size} projecten${parts.length > 0 ? ` — ${parts.join('; ')}` : ''}`,
  };
}

export const EXCLUSION_PIN_BEGIN = '// BEGIN manifest-uitsluitingspin — herschreven door OPS_XER_CELLS_WRITE=corpus bij een gewijzigde uitsluiting; nooit met de hand';
export const EXCLUSION_PIN_END = '// END manifest-uitsluitingspin';
const EXCLUSION_PIN_ROW = '//   ';

export function renderExclusionPinBlock(records: readonly XerExclusionRecord[]): string {
  const sorted = [...records].sort(compareRecords);
  return [
    EXCLUSION_PIN_BEGIN,
    `// ${sorted.length} uitsluiting(en): [bestand-sha256, soort, project, taskId, taskCode, reden, besluit]`,
    ...sorted.map(record => `${EXCLUSION_PIN_ROW}${JSON.stringify(recordTuple(record))}`),
    `const EXPECTED_EXCLUSIONS_SHA256 = '${exclusionsDigest(sorted)}';`,
    EXCLUSION_PIN_END,
  ].join('\n');
}

export function extractExclusionPinBlock(source: string): string | undefined {
  const begin = source.indexOf(EXCLUSION_PIN_BEGIN);
  const end = source.indexOf(EXCLUSION_PIN_END);
  if (begin < 0 || end < begin || source.indexOf(EXCLUSION_PIN_BEGIN, begin + 1) >= 0
    || source.indexOf(EXCLUSION_PIN_END, end + 1) >= 0) return undefined;
  return source.slice(begin, end + EXCLUSION_PIN_END.length);
}

export function parseExclusionPinBlock(block: string): XerExclusionRecord[] | undefined {
  const rows = block.split('\n').filter(line => line.startsWith(EXCLUSION_PIN_ROW));
  const records: XerExclusionRecord[] = [];
  for (const row of rows) {
    let tuple: unknown;
    try { tuple = JSON.parse(row.slice(EXCLUSION_PIN_ROW.length)); } catch { return undefined; }
    if (!Array.isArray(tuple) || tuple.length !== 7 || !tuple.every(value => typeof value === 'string')) return undefined;
    const [sha256, kind, projId, taskId, taskCode, reason, decision] = tuple as string[];
    if (kind !== 'project' && kind !== 'task') return undefined;
    records.push({
      sha256: sha256!, kind, projId: projId!,
      ...(taskId ? { taskId } : {}), ...(taskCode ? { taskCode } : {}),
      reason: reason!, decision: decision!,
    });
  }
  return renderExclusionPinBlock(records) === block ? records : undefined;
}

export function rewriteExclusionPin(source: string, records: readonly XerExclusionRecord[]): { text: string } | { error: string } {
  const block = extractExclusionPinBlock(source);
  if (block === undefined) return { error: 'uitsluitingspin-blok niet (precies één keer) gevonden' };
  if (parseExclusionPinBlock(block) === undefined) return { error: 'uitsluitingspin-blok is met de hand bewerkt (hoort niet bij zijn eigen regels)' };
  return { text: source.replace(block, () => renderExclusionPinBlock(records)) };
}

export function exclusionIdentityChanged(now: ResolvedExclusions, was: ResolvedExclusions): boolean {
  const key = (resolved: ResolvedExclusions) => JSON.stringify([[...resolved.projects].sort(), [...resolved.taskKeys].sort()]);
  return key(now) !== key(was);
}

export function exclusionLabelFor(manifest: XerExclusionManifestLike, sha256: string): string {
  return Object.keys(manifest.files).sort()
    .find(label => manifest.files[label]!.sha256 === sha256 && manifest.files[label]!.role === 'oracle' && manifest.files[label]!.included === true)
    ?? sha256;
}

export function exclusionHerpinCore(record: XerExclusionRecord, label: string): string {
  return `uitsluiting (besluit ${record.decision.slice(0, 10)}): ${label} — ${record.reason}`;
}

export function exclusionHerpinLine(record: XerExclusionRecord, label: string, herpinDate: string): string {
  return `HERPIN ${herpinDate} ${exclusionHerpinCore(record, label)}`;
}

export function byDecisionDate(records: readonly XerExclusionRecord[]): XerExclusionRecord[] {
  return [...records].sort((a, b) => (a.decision.slice(0, 10) < b.decision.slice(0, 10) ? -1 : a.decision.slice(0, 10) > b.decision.slice(0, 10) ? 1 : 0));
}

export function changedExclusionFiles(pinned: readonly XerExclusionRecord[], current: readonly XerExclusionRecord[]): Set<string> {
  const group = (records: readonly XerExclusionRecord[]) => {
    const map = new Map<string, string[]>();
    for (const record of records) map.set(record.sha256, [...(map.get(record.sha256) ?? []), recordKey(record)]);
    return map;
  };
  const before = group(pinned);
  const after = group(current);
  const changed = new Set<string>();
  for (const sha of new Set([...before.keys(), ...after.keys()])) {
    if (JSON.stringify((before.get(sha) ?? []).sort()) !== JSON.stringify((after.get(sha) ?? []).sort())) changed.add(sha);
  }
  return changed;
}
