/**
 * Uitsluiting per project of per taak binnen een orakelentry van `xer-corpus-manifest.json`.
 *
 * Waarom: een bestand kan terecht orakel zijn (aantoonbaar door P6 doorgerekend) terwijl een deel van
 * zijn opgeslagen uitvoer dat niet is — een project dat P6 nooit doorrekende (Hotel/CR 2665), een
 * project dat P6 nivelleerde (OZB 9033), of een handvol taken met verouderde uitvoer (HarbourPointe).
 * Zo'n deel uit de meetlat halen is een eigenaarsbesluit, net als een rolwissel van een heel bestand;
 * dit bestand levert alleen het MECHANISME. Veldinhoud kiest nooit zelf de populatie: een uitsluiting
 * staat letterlijk in het manifest, met een reden en een `decision` (datum + "eigenaarsbesluit").
 *
 * Vorm per manifestentry (alleen `role: "oracle"`, `included: true`):
 *
 *   "decision": "2026-09-24 eigenaarsbesluit: …",
 *   "excludeProjects": [{ "projId": "2665", "reason": "…" }],
 *   "excludeTasks": [{ "projId": "9032", "taskId": "12345", "reason": "…" },
 *                    { "projId": "9032", "taskCode": "OZ1040", "reason": "…" }]
 *
 * Semantiek: de solve draait ongewijzigd over het hele bestand (de uitgesloten taken blijven invoer
 * voor hun opvolgers); alleen de METING laat ze weg — de zes assen, de cellen, drivingPath, de
 * nuldoelregels, de X1-doelbaseline en de task-replay. Uitgesloten taken worden apart gerapporteerd,
 * nooit stil. Een uitsluiting die niets raakt (project of taak bestaat niet, taakcode dubbelzinnig) is
 * een fout, geen no-op.
 *
 * Puur (alleen `node:crypto`): de corpusloze cel-poort gebruikt dezelfde lezer en pint de lijst.
 */
import { createHash } from 'node:crypto';

export interface XerProjectExclusion { projId: string; reason: string }
export interface XerTaskExclusion { projId: string; taskId?: string; taskCode?: string; reason: string }

/** Eén canonieke uitsluitingsregel, per volledige bestands-SHA (byte-duplicaten delen hem). */
export interface XerExclusionRecord {
  sha256: string;
  kind: 'project' | 'task';
  projId: string;
  /** Alleen bij `kind: 'task'`: precies één van beide. */
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

/** Datum (JJJJ-MM-DD) vooraan en het woord "eigenaarsbesluit" erin: anders weigert de lezer. */
export const EXCLUSION_DECISION_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b.*\beigenaarsbesluit\b/i;

const PROJECT_KEYS = new Set(['projId', 'reason']);
const TASK_KEYS = new Set(['projId', 'taskId', 'taskCode', 'reason']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value === value.trim();
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

/** De uitsluitingen van één manifestentry, of problemen. Een entry zonder de drie velden geeft []. */
function entryRecords(label: string, entry: XerExclusionManifestLike['files'][string]): { records: XerExclusionRecord[]; problems: string[] } {
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
  if (!nonEmpty(decision) || !EXCLUSION_DECISION_RE.test(decision)) {
    problems.push(`${where}: uitsluiting zonder geldig decision-veld (verwacht "JJJJ-MM-DD … eigenaarsbesluit …") — de lezer weigert een uitsluiting die geen eigenaarsbesluit is`);
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
    if (!nonEmpty(item.projId)) problems.push(`${at}: projId ontbreekt of is leeg`);
    if (!nonEmpty(item.reason)) problems.push(`${at}: reason ontbreekt of is leeg`);
    if (extra.length === 0 && nonEmpty(item.projId) && nonEmpty(item.reason)) {
      records.push({ sha256: entry.sha256, kind: 'project', projId: item.projId, reason: item.reason, decision });
    }
  }
  for (const [index, item] of (tasks as unknown[]).entries()) {
    const at = `${where}: excludeTasks[${index}]`;
    if (!isObject(item)) { problems.push(`${at} is geen object`); continue; }
    const extra = Object.keys(item).filter(key => !TASK_KEYS.has(key));
    if (extra.length > 0) problems.push(`${at}: onbekende sleutel(s) ${extra.join(', ')}`);
    if (!nonEmpty(item.projId)) problems.push(`${at}: projId ontbreekt of is leeg`);
    if (!nonEmpty(item.reason)) problems.push(`${at}: reason ontbreekt of is leeg`);
    const hasId = Object.prototype.hasOwnProperty.call(item, 'taskId');
    const hasCode = Object.prototype.hasOwnProperty.call(item, 'taskCode');
    if (hasId === hasCode) problems.push(`${at}: precies één van taskId en taskCode is vereist`);
    else if (hasId && !nonEmpty(item.taskId)) problems.push(`${at}: taskId is leeg`);
    else if (hasCode && !nonEmpty(item.taskCode)) problems.push(`${at}: taskCode is leeg`);
    else if (extra.length === 0 && nonEmpty(item.projId) && nonEmpty(item.reason)) {
      records.push({
        sha256: entry.sha256, kind: 'task', projId: item.projId,
        ...(hasId ? { taskId: item.taskId as string } : { taskCode: item.taskCode as string }),
        reason: item.reason, decision,
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

/**
 * Alle uitsluitingen van het manifest, canoniek gesorteerd en gegroepeerd per bestands-SHA. Dragen
 * meerdere orakellabels dezelfde bytes, dan moeten ze exact dezelfde uitsluitingen dragen (anders hing
 * het van de labelvolgorde af welke gold).
 */
export function readManifestExclusions(manifest: XerExclusionManifestLike): {
  records: XerExclusionRecord[];
  bySha: Map<string, XerExclusionRecord[]>;
  problems: string[];
} {
  const problems: string[] = [];
  const perLabel = new Map<string, XerExclusionRecord[]>();
  for (const label of Object.keys(manifest.files).sort()) {
    const result = entryRecords(label, manifest.files[label]!);
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

/** SHA-256 over de canonieke uitsluitingslijst (bestand, soort, project, taak, reden, besluit). */
export function exclusionsDigest(records: readonly XerExclusionRecord[]): string {
  return createHash('sha256').update(JSON.stringify([...records].sort(compareRecords).map(recordTuple))).digest('hex');
}

export interface TruthTaskIdentity { projectId: string; taskId: string; taskCode: string }

export interface ResolvedExclusions {
  /** Volledig uitgesloten projecten. */
  projects: Set<string>;
  /** Alle uitgesloten taken als `proj/taak` — ook die onder een uitgesloten project (celsleutelvorm). */
  taskKeys: Set<string>;
  /** Per regel het aantal geraakte orakeltaken, in de volgorde van de regels. */
  applied: Array<{ record: XerExclusionRecord; tasks: number }>;
  problems: string[];
}

export function exclusionTaskKey(projectId: string, taskId: string): string {
  return `${projectId}/${taskId}`;
}

/**
 * Los de uitsluitingen van één bestand op tegen de onafhankelijke grondwaarheid. Taakcodes worden
 * hier naar taak-id's vertaald; een regel die geen of (bij een taakcode) meer dan één taak raakt is
 * een probleem — nooit een stille no-op.
 */
export function resolveExclusions(tasks: readonly TruthTaskIdentity[], records: readonly XerExclusionRecord[]): ResolvedExclusions {
  const resolved: ResolvedExclusions = { projects: new Set(), taskKeys: new Set(), applied: [], problems: [] };
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
    for (const task of hits) resolved.taskKeys.add(exclusionTaskKey(task.projectId, task.taskId));
    resolved.applied.push({ record, tasks: hits.length });
  }
  return resolved;
}

/** Grondwaarheid zonder de uitgesloten projecten en taken (nieuw object; het origineel blijft). */
export function filterTruthExclusions<T extends { projects: Set<string>; tasks: TruthTaskIdentity[] }>(truth: T, resolved: ResolvedExclusions): T {
  if (resolved.taskKeys.size === 0 && resolved.projects.size === 0) return truth;
  return {
    ...truth,
    projects: new Set([...truth.projects].filter(project => !resolved.projects.has(project))),
    tasks: truth.tasks.filter(task => !resolved.taskKeys.has(exclusionTaskKey(task.projectId, task.taskId))),
  };
}

/** Opgeloste projecten zonder de uitgesloten projecten en taken (identiteit via `sourceTaskId`). */
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

/** Eén leesbare regel: "N taken in K projecten" plus per regel reden en aantal. */
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

/** Markeringen van het gegenereerde uitsluitingspin-blok in `check-fidelity-cells-gate.ts`. */
export const EXCLUSION_PIN_BEGIN = '// BEGIN manifest-uitsluitingspin — herschreven door OPS_XER_CELLS_WRITE=corpus bij een gewijzigde uitsluiting; nooit met de hand';
export const EXCLUSION_PIN_END = '// END manifest-uitsluitingspin';
const EXCLUSION_PIN_ROW = '//   ';

/** Het pinblok (markeringen, één JSON-regel per uitsluiting, digest-constante). */
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

/** Het pinblok uit een bronbestand, of `undefined` als de markeringen niet precies één keer staan. */
export function extractExclusionPinBlock(source: string): string | undefined {
  const begin = source.indexOf(EXCLUSION_PIN_BEGIN);
  const end = source.indexOf(EXCLUSION_PIN_END);
  if (begin < 0 || end < begin || source.indexOf(EXCLUSION_PIN_BEGIN, begin + 1) >= 0
    || source.indexOf(EXCLUSION_PIN_END, end + 1) >= 0) return undefined;
  return source.slice(begin, end + EXCLUSION_PIN_END.length);
}

/**
 * De gepinde uitsluitingen terug uit het blok; `undefined` als het blok niet exact de eigen render van
 * zijn regels is (met de hand bewerkt, of digest past niet bij de lijst).
 */
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

/** Herschrijft het pinblok in een bron; weigert als het huidige blok ontbreekt of met de hand bewerkt is. */
export function rewriteExclusionPin(source: string, records: readonly XerExclusionRecord[]): { text: string } | { error: string } {
  const block = extractExclusionPinBlock(source);
  if (block === undefined) return { error: 'uitsluitingspin-blok niet (precies één keer) gevonden' };
  if (parseExclusionPinBlock(block) === undefined) return { error: 'uitsluitingspin-blok is met de hand bewerkt (hoort niet bij zijn eigen regels)' };
  return { text: source.replace(block, () => renderExclusionPinBlock(records)) };
}

/** Per bestands-SHA of de uitsluitingen verschillen tussen twee lijsten. */
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
