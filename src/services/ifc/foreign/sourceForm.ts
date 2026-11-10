/**
 * Wat de planner niet wijzigde, in de vorm van de bron (knownbug 1105; vervolg-PR van #867, "de merge via de route van de
 * app").
 *
 * De app opent een bestand via de store: de lezer, de omzetting naar het minutenmodel (een datum wordt een tijdstip, vast
 * werk wordt urenmaat, een baseline krijgt tijdstippen) en de herberekening bij openen (vroege en late datums, speling, de
 * duur en datums van samenvattingen). Daarna wijkt het domein af van de lezing van de bron, zonder dat de planner iets
 * deed. Regel (Trias, 10 november 2026): "de planner wijzigde dit veld" betekent: het wijkt af van wat de app na het
 * openen liet zien (`IfcSource.opened`), niet van de lezing van de bron. Een veld dat alleen door het openen veranderde,
 * krijgt hier de waarde uit de lezing van de bron terug. De writer schrijft het dan zoals in O0, (b) zet de bronwaarde
 * terug waar de lezer haar niet draagt, en de verliesbewaking, die met de bron blijft vergelijken, ziet geen wijziging.
 * Zo maakt ook een datum die alleen door het openen een tijd kreeg, de kalender niet letterlijk.
 *
 * Per veld, met d = het domein, o = `opened`, p = de lezing van de bron en m = p na de omzetting naar het minutenmodel
 * (`migrateToMinuteModel`, dezelfde functie als bij openen):
 *  - d ≠ o: de planner wijzigde het. De writer schrijft d.
 *  - d = o = p: er is niets terug te zetten.
 *  - d = o = m ≠ p: de omzetting maakte het. Het wordt p, als de omzetting van p met de taak en de kalender van nu weer d
 *    geeft (de voortoets hieronder). Zo niet (de planner wijzigde de kalender, een feestdag of de taak zelf zodat dezelfde
 *    datum een ander tijdstip wordt), dan schrijft de writer d.
 *  - d = o ≠ m, in `task.time`: de herberekening bij openen maakte het. Het wordt p: openen rekent het opnieuw uit, uit de
 *    invoer.
 *  - anders (een andere stap bij openen, zoals de bibliotheek of de WBS-nummering): d. De verliesbewaking beslist dan.
 *
 * Eenheden: een taak per veld en `time` per deel; een baseline als geheel. Een kalender nooit: het herstel van een oude
 * kalender gebeurt alleen bij een bestand zonder `TimeModel`, en de merge schrijft `TimeModel` altijd; een herstelde
 * kalender in de vorm van de bron las na openen dus anders. Relaties, resources, toewijzingen, het project en de overige
 * velden ook niet: de omzetting raakt ze niet.
 *
 * De voortoets: de omzetting van het domein met de teruggezette waarden, zoals heropenen haar doet (met `TimeModel`, dus
 * alleen de datums), moet voor elk teruggezet veld van de omzetting weer d geven. Een veld dat dat niet doet, blijft d; dat
 * kan de taak van een ander veld veranderen, dus de toets herhaalt tot niets meer afvalt. De datums van één taak (in `time`
 * de velden van `TIME_FIELDS`, en `deadline`, `constraint`, `constraint2` en `externalLinks`) gaan samen: blijft er één d,
 * dan blijven ze allemaal d. Een tijdstip dat niet op de kalender valt, laat de writer de taak letterlijk schrijven, en dan
 * schrijft hij ook een teruggezette datum anders dan in O0 (een werkdag die later begint: het begin blijft 07:30, het einde
 * zou de vorm van de bron houden). Na het schrijven gaat de herleestoets (`sourceFormProblems`) hetzelfde na op wat de
 * lezer uit de uitvoer leest.
 */
import type { ImportResult } from '@/services/importTypes';
import type { DocumentPayload } from '@/state/documentContract';
import type { Task } from '@/types/task';
import type { Baseline } from '@/types/baseline';
import { MINUTE_MODEL_TIME_MODEL, migrateToMinuteModel, TIME_FIELDS } from '@/state/migrations/minuteModel';
import { inferWbsAutoNumberOnOpen } from '@/utils/wbs';
import type { WriteIFCInput } from '../ifcWriter';

/** Een veld dat de merge in de vorm van de bron schrijft omdat de omzetting het maakte. */
export type SourceFormLeaf =
  | { readonly kind: 'task'; readonly id: string; readonly field: string; readonly sub?: string }
  | { readonly kind: 'baseline'; readonly id: string };

export interface SourceForm {
  /** Het domein dat de merge schrijft: de invoer, met de bronwaarde in elk veld dat de planner niet wijzigde. */
  readonly input: WriteIFCInput;
  /** De velden die de omzetting maakte en die nu de bronwaarde hebben: wat de herleestoets nagaat. */
  readonly checked: readonly SourceFormLeaf[];
}

/** Een veld met de bronwaarde die het krijgt, en of de omzetting het maakte (anders de herberekening). */
type Restore = { readonly leaf: SourceFormLeaf; readonly value: unknown; readonly converted: boolean };

/** Gelijk van inhoud: de volgorde van sleutels telt niet, een sleutel met `undefined` telt als afwezig. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => sameValue(x, b[i]));
  }
  if (a instanceof Set || b instanceof Set) {
    return a instanceof Set && b instanceof Set && a.size === b.size && [...a].every(x => b.has(x));
  }
  const ka = Object.keys(a).filter(k => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter(k => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every(k => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** De planning na de omzetting naar het minutenmodel, zoals `payloadFromImport` haar maakt (alleen de delen die de omzetting
 *  raakt). */
function migrated(parsed: ImportResult): { tasks: readonly Task[]; baselines: readonly Baseline[] } {
  const payload = {
    project: parsed.project, calendar: parsed.calendar, calendars: parsed.resourceCalendars ?? [], tasks: parsed.tasks,
    resources: parsed.resources, baselines: parsed.baselines ?? [],
  } as unknown as DocumentPayload;
  const out = migrateToMinuteModel(payload, { timeModel: parsed.timeModel, milestonesAtDayEnd: parsed.milestonesAtDayEnd }).payload;
  return { tasks: out.tasks, baselines: out.baselines };
}

/** Een lijst op id; een id dat vaker voorkomt, telt niet (dan is niet te zeggen welk object welk is). */
function byId<T extends { id: string }>(list: readonly T[] | undefined): Map<string, T> {
  const out = new Map<string, T>();
  const twice = new Set<string>();
  for (const x of list ?? []) { if (out.has(x.id)) twice.add(x.id); out.set(x.id, x); }
  for (const id of twice) out.delete(id);
  return out;
}

const fields = (x: unknown) => x as Record<string, unknown>;

/** De datumvelden van een taak (`mapTaskDates`): in `time` de velden van `TIME_FIELDS`, daarbuiten deze. */
const TASK_DATE_KEYS: ReadonlySet<string> = new Set(['deadline', 'constraint', 'constraint2', 'externalLinks']);
const TIME_DATE_KEYS: ReadonlySet<string> = new Set<string>(TIME_FIELDS);
const isDateLeaf = (leaf: SourceFormLeaf) => leaf.kind === 'task'
  && (leaf.sub === undefined ? TASK_DATE_KEYS.has(leaf.field) : TIME_DATE_KEYS.has(leaf.sub));

/** De waarde van een veld, of `found: false` als het object ontbreekt. */
function leafValue(planning: { tasks: readonly Task[]; baselines?: readonly Baseline[] }, leaf: SourceFormLeaf): { found: boolean; value?: unknown } {
  if (leaf.kind === 'baseline') {
    const b = (planning.baselines ?? []).find(x => x.id === leaf.id);
    return b ? { found: true, value: b } : { found: false };
  }
  const t = planning.tasks.find(x => x.id === leaf.id);
  if (!t) return { found: false };
  const v = fields(t)[leaf.field];
  return { found: true, value: leaf.sub === undefined ? v : (v as Record<string, unknown> | undefined)?.[leaf.sub] };
}

/**
 * Een regel van een baseline waarvan de taak niet (meer) in de planning staat, zonder zijn taak-id (knownbug 1104). Wist de
 * planner een taak uit een baseline van OPS v2026.7.4 tot v2026.7.14 (zonder `TaskGuids`), dan houdt die regel met de
 * bron-JSON het oude interne id, en in de vorm van de writer het id uit het domein. Beide wijzen naar geen taak; de planning
 * is dezelfde. De herleestoets van (b) (`mergeWriter.ts`) en die van de bronvorm vergelijken zo'n regel daarom zonder id.
 */
export function orphanRowsWithoutId<T extends { tasks: readonly Task[]; baselines?: readonly Baseline[] }>(planning: T): T {
  const ids = new Set(planning.tasks.map(t => t.id));
  if (!planning.baselines?.some(b => b.tasks.some(t => !ids.has(t.taskId)))) return planning;
  return {
    ...planning,
    baselines: planning.baselines.map(b => ({ ...b, tasks: b.tasks.map(t => (ids.has(t.taskId) ? t : { ...t, taskId: '' })) })),
  };
}

/** De velden die het openen veranderde en die de bronwaarde terug kunnen krijgen (zie de kop). */
function candidates(domain: WriteIFCInput, opened: WriteIFCInput, pristine: ImportResult): Restore[] {
  const m = migrated(pristine);
  const out: Restore[] = [];
  const consider = (leaf: SourceFormLeaf, d: unknown, o: unknown, p: unknown, mv: unknown, computed: boolean) => {
    if (!sameValue(d, o) || sameValue(o, p)) return;
    if (sameValue(o, mv)) out.push({ leaf, value: p, converted: true });
    else if (computed) out.push({ leaf, value: p, converted: false });
  };
  const openedTasks = byId(opened.tasks), pristineTasks = byId(pristine.tasks), migratedTasks = byId(m.tasks);
  for (const d of domain.tasks) {
    const o = openedTasks.get(d.id), p = pristineTasks.get(d.id), mt = migratedTasks.get(d.id);
    if (!o || !p || !mt) continue;
    for (const key of new Set([...Object.keys(d), ...Object.keys(o), ...Object.keys(p)])) {
      if (key === 'time' || key === 'id') continue;
      consider({ kind: 'task', id: d.id, field: key }, fields(d)[key], fields(o)[key], fields(p)[key], fields(mt)[key], false);
    }
    const td = fields(d.time), to = fields(o.time), tp = fields(p.time), tm = fields(mt.time);
    for (const sub of new Set([...Object.keys(td), ...Object.keys(to), ...Object.keys(tp)])) {
      consider({ kind: 'task', id: d.id, field: 'time', sub }, td[sub], to[sub], tp[sub], tm[sub], true);
    }
  }
  const openedBaselines = byId(opened.baselines), pristineBaselines = byId(pristine.baselines), migratedBaselines = byId(m.baselines);
  for (const d of domain.baselines ?? []) {
    if (!pristineBaselines.has(d.id)) continue;
    consider({ kind: 'baseline', id: d.id }, d, openedBaselines.get(d.id), pristineBaselines.get(d.id), migratedBaselines.get(d.id), false);
  }
  return out;
}

/** Het domein met deze bronwaarden. */
function withRestores(domain: WriteIFCInput, restores: readonly Restore[]): WriteIFCInput {
  if (restores.length === 0) return domain;
  const perTask = new Map<string, Restore[]>();
  const perBaseline = new Map<string, unknown>();
  for (const r of restores) {
    if (r.leaf.kind === 'baseline') perBaseline.set(r.leaf.id, r.value);
    else { const l = perTask.get(r.leaf.id); if (l) l.push(r); else perTask.set(r.leaf.id, [r]); }
  }
  const set = (target: Record<string, unknown>, key: string, value: unknown) => {
    if (value === undefined) delete target[key]; else target[key] = value;
  };
  const tasks = domain.tasks.map((t) => {
    const list = perTask.get(t.id);
    if (!list) return t;
    const out = { ...t, time: { ...t.time } };
    for (const { leaf, value } of list) {
      if (leaf.kind !== 'task') continue;
      set(leaf.sub === undefined ? fields(out) : fields(out.time), leaf.sub ?? leaf.field, value);
    }
    return out;
  });
  const baselines = domain.baselines?.map(b => (perBaseline.has(b.id) ? perBaseline.get(b.id) as Baseline : b));
  return { ...domain, tasks, ...(baselines ? { baselines } : {}) };
}

/** Wat heropenen van dit domein met de omzetting maakt (met `TimeModel`, zoals de merge schrijft: alleen de datums). */
function reopened(input: WriteIFCInput) {
  return migrated({ ...input, timeModel: MINUTE_MODEL_TIME_MODEL });
}

/**
 * Het domein dat de merge schrijft: `domain` met de bronwaarde (uit `pristine`) in elk veld dat de planner sinds het
 * openen niet wijzigde (`opened`) en dat alleen het openen veranderde. Zonder `opened` (geen store) is de lezing van de bron
 * wat de app liet zien, en verandert er niets.
 */
export function sourceFormWhereUnchanged(domain: WriteIFCInput, opened: WriteIFCInput | undefined, pristine: ImportResult): SourceForm {
  if (!opened) return { input: domain, checked: [] };
  let restores = candidates(domain, opened, pristine);
  // De voortoets (zie de kop): een veld van de omzetting dat met de taak en de kalender van nu niet weer d wordt, blijft d.
  // Elke ronde valt er minstens één af, of de toets is klaar.
  for (;;) {
    const again = orphanRowsWithoutId(reopened(withRestores(domain, restores)));
    const shown = orphanRowsWithoutId(domain);
    const failing = restores.filter(r => r.converted && !sameValue(leafValue(again, r.leaf).value, leafValue(shown, r.leaf).value));
    if (failing.length === 0) break;
    const datesOf = new Set(failing.filter(r => isDateLeaf(r.leaf)).map(r => r.leaf.id));
    restores = restores.filter(r => !failing.includes(r) && !(isDateLeaf(r.leaf) && datesOf.has(r.leaf.id)));
  }
  return { input: withProjectSource(withRestores(domain, restores), opened, pristine), checked: restores.filter(r => r.converted).map(r => r.leaf) };
}

/**
 * Het project: noemt de bron de automatische WBS-nummering niet, dan leidt openen haar af uit de codes
 * (`inferWbsAutoNumberOnOpen`). Wijzigde de planner haar niet en leidt heropenen dezelfde waarde af, dan blijft ze weg, zoals
 * in de bron.
 */
function withProjectSource(input: WriteIFCInput, opened: WriteIFCInput, pristine: ImportResult): WriteIFCInput {
  const d = input.project.wbsAutoNumber;
  if (pristine.project.wbsAutoNumber !== undefined || d === undefined || d !== opened.project.wbsAutoNumber) return input;
  const { wbsAutoNumber: _, ...project } = input.project;
  if (inferWbsAutoNumberOnOpen(project, input.tasks).wbsAutoNumber !== d) return input;
  return { ...input, project };
}

const leafLabel = (leaf: SourceFormLeaf) => leaf.kind === 'baseline' ? `baseline ${leaf.id}`
  : `taak ${leaf.id}, ${leaf.sub === undefined ? leaf.field : `${leaf.field}.${leaf.sub}`}`;

/**
 * De herleestoets: elk veld dat de omzetting maakte en dat de merge in de vorm van de bron schrijft, moet na de omzetting
 * van wat de lezer uit de uitvoer leest (`back`) weer de waarde hebben die de planner zag (`domain`). Geeft de verschillen.
 */
export function sourceFormProblems(checked: readonly SourceFormLeaf[], domain: WriteIFCInput, back: ImportResult): string[] {
  if (checked.length === 0) return [];
  const m = orphanRowsWithoutId(migrated(back));
  const shown = orphanRowsWithoutId(domain);
  const out: string[] = [];
  for (const leaf of checked) {
    const want = leafValue(shown, leaf);
    const got = leafValue(m, leaf);
    if (!got.found) { out.push(`${leafLabel(leaf)}: ontbreekt na herlezen`); continue; }
    if (!sameValue(got.value, want.value)) {
      out.push(`${leafLabel(leaf)}: ${JSON.stringify(got.value)?.slice(0, 80)} na herlezen in plaats van ${JSON.stringify(want.value)?.slice(0, 80)}`);
    }
  }
  return out;
}
