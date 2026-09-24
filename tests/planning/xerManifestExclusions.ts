/**
 * Uitsluiting per project of per taak binnen een orakelentry van `xer-corpus-manifest.json`.
 *
 * Waarom: een bestand kan terecht orakel zijn (aantoonbaar door P6 doorgerekend) terwijl een deel van
 * zijn opgeslagen uitvoer dat niet is — een project dat P6 nooit doorrekende (Hotel/CR 2665), een
 * project dat P6 nivelleerde (OZB 9033), of een handvol taken met verouderde uitvoer (HarbourPointe).
 * Zo'n deel uit de meetlat halen is een eigenaarsbesluit, net als een rolwissel van een heel bestand;
 * dit bestand levert alleen het MECHANISME. Veldinhoud kiest nooit zelf de populatie: een uitsluiting
 * staat letterlijk in het manifest, met een reden en een `decision` in precies de vorm
 * `JJJJ-MM-DD eigenaarsbesluit: <vrije tekst>` (een bestaande datum, niet in de toekomst).
 *
 * Vorm per manifestentry (alleen `role: "oracle"`, `included: true`):
 *
 *   "decision": "2026-09-23 eigenaarsbesluit: …",
 *   "excludeProjects": [{ "projId": "2665", "reason": "…" }],
 *   "excludeTasks": [{ "projId": "9032", "taskId": "12345", "reason": "…" },
 *                    { "projId": "9032", "taskCode": "OZ1040", "reason": "…",
 *                      "decision": "2026-09-24 eigenaarsbesluit: …" }]
 *
 * Een regel mag een eigen `decision` (zelfde vorm) dragen wanneer ze uit een LATER besluit komt dan de
 * entry (critreview C14-landing 2026-09-24, datumherkomst): de entry-`decision` noemt dan het vroegste
 * besluit (en de latere in de tekst, chronologisch), de regel haar eigen besluitdatum. Een regel-`decision`
 * vóór de entrydatum is een fout. Zo draagt elke uitsluiting — en haar HERPIN-regel — haar eigen datum.
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

/**
 * Exact de vorm `JJJJ-MM-DD eigenaarsbesluit: <vrije tekst>` — geen vrije plaatsing van het woord, zodat
 * "2026-09-23 geen eigenaarsbesluit" of "… niet als eigenaarsbesluit …" nooit doorglipt.
 */
export const EXCLUSION_DECISION_RE = /^(\d{4})-(\d{2})-(\d{2}) eigenaarsbesluit: \S.*$/;
/** Minimale lengte van een reden (na trimmen): "x" of "mutant" is geen reden. */
export const EXCLUSION_REASON_MIN = 10;

/** Vandaag als JJJJ-MM-DD (UTC); injecteerbaar voor de fixtures. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Het probleem met een `decision`-waarde, of `undefined` als hij geldig is: exacte vorm, een bestaande
 * kalenderdatum (geen 2026-02-31) en niet in de toekomst (`today` + één dag speling voor tijdzones).
 */
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

/** De `decision` van één regel: de eigen (later besluit) of die van de entry; `problem` bij een ongeldige. */
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

/** Een identiteitsveld (projId/taskId/taskCode): string, niet leeg; een getal krijgt een eigen melding. */
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

/** De uitsluitingen van één manifestentry, of problemen. Een entry zonder de drie velden geeft []. */
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

/**
 * Alle uitsluitingen van het manifest, canoniek gesorteerd en gegroepeerd per bestands-SHA. Dragen
 * meerdere orakellabels dezelfde bytes, dan moeten ze exact dezelfde uitsluitingen dragen (anders hing
 * het van de labelvolgorde af welke gold).
 */
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
  /** Taakregel per geraakte taak: twee regels (bv. taskId én taskCode) op dezelfde taak zijn een fout. */
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

/**
 * Of de opgeloste IDENTITEITSSET (uitgesloten projecten en taken) verschilt. Een gewijzigde reden of
 * datum verandert de lijst (digest, herpin) maar niet wat er gemeten wordt, en telt dus niet voor de
 * dekking, de cellen of het drivingPath-orakel.
 */
export function exclusionIdentityChanged(now: ResolvedExclusions, was: ResolvedExclusions): boolean {
  const key = (resolved: ResolvedExclusions) => JSON.stringify([[...resolved.projects].sort(), [...resolved.taskKeys].sort()]);
  return key(now) !== key(was);
}

/** Het label waaronder een uitsluiting in de HERPIN-regel staat: het eerste (gesorteerde) inbegrepen
 *  orakellabel met die bytes — byte-duplicaten dragen per definitie dezelfde uitsluitingen. */
export function exclusionLabelFor(manifest: XerExclusionManifestLike, sha256: string): string {
  return Object.keys(manifest.files).sort()
    .find(label => manifest.files[label]!.sha256 === sha256 && manifest.files[label]!.role === 'oracle' && manifest.files[label]!.included === true)
    ?? sha256;
}

/** De HERPIN-regel die boven het pinblok moet staan voor een uitsluiting (letterlijk uit het record). */
export function exclusionHerpinLine(record: XerExclusionRecord, label: string): string {
  return `HERPIN ${record.decision.slice(0, 10)} uitsluiting: ${label} — ${record.reason}`;
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
