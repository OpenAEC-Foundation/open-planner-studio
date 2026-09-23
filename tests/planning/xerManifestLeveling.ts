/**
 * Het manifestveld `leveledProjects` (etappe P6-nivellering, FUNDAMENT; onderzoek
 * `docs/superpowers/plans/2026-09-24-nivellering-etappe-onderzoek.md` §6 en §7 stap 6).
 *
 * Waarom een handmatig veld: een XER-bestand zegt niet óf P6 genivelleerd heeft (§2b: OZB 9045/9047/9049
 * dragen exact dezelfde nivelleerinstellingen als het wél genivelleerde 9033). Of een project met
 * nivellering gemeten moet worden is dus een menselijke herkomstclassificatie, net als `role`/`included`
 * en `excludeProjects` — nooit een lezerafleiding, en zeker nooit een afleiding uit opgeslagen
 * rekenuitvoer (bak 4).
 *
 * STAND: MECHANISME ZONDER DATA. Het manifest draagt het veld nog nergens, en het veld heeft GEEN invloed
 * op de telling: X12 rapporteert alleen "genivelleerd volgens eigenaar: N projecten". Of 9033 zo terug in
 * het orakel komt, en of de meting de optie dan per project aanzet, is eigenaarsbeslissing 2 (open). Zolang
 * die niet genomen is, mag niets in de meetketen dit veld lezen behalve de rapportageregel.
 *
 * Vorm per manifestentry (alleen `role: "oracle"`, `included: true`):
 *
 *   "leveledProjects": [
 *     { "projId": "9033", "decision": "JJJJ-MM-DD eigenaarsbesluit: …", "reason": "…" }
 *   ]
 *
 * Anders dan bij de uitsluitingen draagt elke regel zijn EIGEN besluit: een nivelleerclassificatie per
 * project is een los besluit, geen gedeeld besluit over een lijst. Een regel die niets raakt (project
 * bestaat niet in het bestand) is een fout, geen no-op.
 *
 * Puur (geen I/O): de corpusloze check (`check-xer-manifest-leveling.ts`) en X12 gebruiken dezelfde lezer.
 */
import { decisionProblem, EXCLUSION_REASON_MIN } from './xerManifestExclusions';

export interface XerLeveledProject { projId: string; decision: string; reason: string }

/** Eén canonieke regel, per volledige bestands-SHA (byte-duplicaten delen hem). */
export interface XerLeveledRecord extends XerLeveledProject { sha256: string }

export interface XerLeveledManifestLike {
  files: Record<string, { sha256: string; role: string; included: boolean; leveledProjects?: unknown }>;
}

const KEYS = new Set(['projId', 'decision', 'reason']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value === value.trim();
}

function compare(left: XerLeveledRecord, right: XerLeveledRecord): number {
  const a = JSON.stringify([left.sha256, left.projId, left.reason, left.decision]);
  const b = JSON.stringify([right.sha256, right.projId, right.reason, right.decision]);
  return a < b ? -1 : a > b ? 1 : 0;
}

function entryRecords(
  label: string, entry: XerLeveledManifestLike['files'][string], today: string | undefined,
): { records: XerLeveledRecord[]; problems: string[] } {
  const records: XerLeveledRecord[] = [];
  const problems: string[] = [];
  if (!Object.prototype.hasOwnProperty.call(entry, 'leveledProjects')) return { records, problems };
  const where = `manifest ${label}: leveledProjects`;
  if (entry.role !== 'oracle' || entry.included !== true) {
    problems.push(`${where} op een entry die geen inbegrepen orakel is (role=${entry.role})`);
    return { records, problems };
  }
  const list = entry.leveledProjects;
  if (!Array.isArray(list)) return { records, problems: [`${where} is geen lijst`] };
  if (list.length === 0) return { records, problems: [`${where} is leeg (laat het veld weg)`] };
  const seen = new Set<string>();
  for (const [index, item] of list.entries()) {
    const at = `${where}[${index}]`;
    if (!isObject(item)) { problems.push(`${at} is geen object`); continue; }
    const extra = Object.keys(item).filter(key => !KEYS.has(key));
    const itemProblems: string[] = [];
    if (extra.length > 0) itemProblems.push(`${at}: onbekende sleutel(s) ${extra.join(', ')}`);
    if (typeof item.projId === 'number') itemProblems.push(`${at}: projId moet een string zijn (schrijf "${item.projId}")`);
    else if (!nonEmpty(item.projId)) itemProblems.push(`${at}: projId ontbreekt of is leeg`);
    if (!nonEmpty(item.reason)) itemProblems.push(`${at}: reason ontbreekt of is leeg`);
    else if (item.reason.length < EXCLUSION_REASON_MIN) itemProblems.push(`${at}: reason is te kort (minimaal ${EXCLUSION_REASON_MIN} tekens)`);
    const badDecision = decisionProblem(item.decision, today);
    if (badDecision !== undefined) itemProblems.push(`${at}: ${badDecision}`);
    problems.push(...itemProblems);
    if (itemProblems.length > 0) continue;
    const record: XerLeveledRecord = {
      sha256: entry.sha256, projId: item.projId as string, decision: item.decision as string, reason: item.reason as string,
    };
    if (seen.has(record.projId)) problems.push(`${where}: project ${record.projId} staat er dubbel in`);
    seen.add(record.projId);
    records.push(record);
  }
  return { records: problems.length > 0 ? [] : records, problems };
}

/**
 * Alle `leveledProjects` van het manifest, canoniek gesorteerd en gegroepeerd per bestands-SHA.
 * Byte-identieke orakellabels moeten dezelfde lijst dragen (anders hing het van de labelvolgorde af).
 */
export function readManifestLeveledProjects(manifest: XerLeveledManifestLike, today?: string): {
  records: XerLeveledRecord[];
  bySha: Map<string, XerLeveledRecord[]>;
  problems: string[];
} {
  const problems: string[] = [];
  const perLabel = new Map<string, XerLeveledRecord[]>();
  for (const label of Object.keys(manifest.files).sort()) {
    const result = entryRecords(label, manifest.files[label]!, today);
    problems.push(...result.problems);
    perLabel.set(label, result.records);
  }
  const labelsBySha = new Map<string, string[]>();
  for (const [label, entry] of Object.entries(manifest.files)) {
    if (entry.role !== 'oracle' || entry.included !== true) continue;
    labelsBySha.set(entry.sha256, [...(labelsBySha.get(entry.sha256) ?? []), label].sort());
  }
  const bySha = new Map<string, XerLeveledRecord[]>();
  for (const [sha, labels] of labelsBySha) {
    const variants = labels.map(label => JSON.stringify([...(perLabel.get(label) ?? [])].sort(compare)));
    if (new Set(variants).size > 1) {
      problems.push(`manifest: byte-identieke orakellabels ${labels.join(', ')} dragen verschillende leveledProjects`);
      continue;
    }
    const records = [...(perLabel.get(labels[0]!) ?? [])].sort(compare);
    if (records.length > 0) bySha.set(sha, records);
  }
  return { records: [...bySha.values()].flat().sort(compare), bySha, problems };
}

/** Los de regels van één bestand op tegen de projecten van de onafhankelijke grondwaarheid. */
export function resolveLeveledProjects(
  projects: ReadonlySet<string>, records: readonly XerLeveledRecord[],
): { projects: string[]; problems: string[] } {
  const problems: string[] = [];
  const hit: string[] = [];
  for (const record of records) {
    if (projects.has(record.projId)) hit.push(record.projId);
    else problems.push(`leveledProjects ${record.sha256.slice(0, 12)} project ${record.projId} bestaat niet in het bestand`);
  }
  return { projects: hit.sort(), problems };
}

/** De rapportageregel: "genivelleerd volgens eigenaar: N projecten", met per project bestand en reden. */
export function leveledSummary(resolvedByFile: ReadonlyArray<{ label: string; records: readonly XerLeveledRecord[] }>): {
  projects: number; line: string;
} {
  const parts = resolvedByFile.flatMap(({ label, records }) =>
    records.map(record => `${label}: project ${record.projId} — ${record.reason} [${record.decision.slice(0, 10)}]`));
  return {
    projects: parts.length,
    line: `genivelleerd volgens eigenaar: ${parts.length} projecten${parts.length > 0 ? ` — ${parts.join('; ')}` : ''}`,
  };
}
