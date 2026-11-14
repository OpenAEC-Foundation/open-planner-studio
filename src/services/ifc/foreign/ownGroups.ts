/**
 * De eigen groepen op projectniveau (#804 fase 1c, PR 12a; onderzoek "een andere toets voor gegevens die volledig van de
 * app zijn", 14 november 2026, vraag 1).
 *
 * Een eigen groep is een pset die de writer op het `IfcProject` of op zijn eigen live werkschema zet, met haar properties
 * (en wat daaronder hangt, zoals een enumeratie) en haar `IfcRelDefinesByProperties`. Bij `OPS_StructureMeta` horen ook de
 * templates, hun enumeraties en de `IfcRelDeclares` van de codes en eigen velden. De indeling volgt uit de vorm van de
 * regels, niet uit een lijst namen: wat de writer daar schrijft, is een groep. Niemand anders schrijft in zo'n groep, en de
 * lezer zet alles wat de writer daar schrijft om in een domeinveld.
 *
 * Twee gegevens staan daarnaast op een tweede plek buiten de pset, op een object dat ook andere gegevens draagt: de
 * baselinekop (een `.BASELINE.`-werkschema in de aggregatie van het werkplan, bij `OPS_Baselines`) en de typenaam
 * (`ObjectType`) van een taak met `PredefinedType .USERDEFINED.` (bij `OPS_TaskTypes`). Die staan hier als de groepen
 * `BASELINE_HEADS` en `TASK_OBJECT_TYPES`.
 *
 * Gebruik: de uitvoercontrole (c) in `mergeWriter.ts` vergelijkt per groep de boomvorm van de uitvoer met die van de writer
 * op de herlezing (`ownGroupTrees`, `ownGroupDifference`), en slaat de groepen over waar de herleestoets (b) bronwaarden
 * terugzette (`editedOwnGroup`). Een latere stap (de andere toets in de verliescontrole) kan dezelfde indeling op de
 * bronregels gebruiken: `ownGroupMembers` geeft per regel de groep.
 */
import { decodeStepText } from '../stepText';
import { PSET } from '../ifcPsets';
import type { OutLine } from './lossCheck';

/** De tweede vorm van `OPS_Baselines`: de baselinekoppen en hun lidmaatschap van een aggregatie. */
export const BASELINE_HEADS = `kop:${PSET.Baselines}`;
/** De tweede vorm van `OPS_TaskTypes`: `ObjectType` van elke eigen taak met `PredefinedType .USERDEFINED.`. */
export const TASK_OBJECT_TYPES = `taak:ObjectType`;

/**
 * Een kijk op een reeks regels. `line(id)`: een eigen regel (van de writer), anders `undefined`. `typeOf(id)`: het
 * entiteittype van elk stuk, ook een vreemd (zoals een `IfcProject` van een ander programma). `aggregated`: de ids die in
 * een `IfcRelAggregates` staan, eigen of vreemd.
 */
export interface OwnLinesView {
  readonly lines: Iterable<OutLine>;
  line(id: number): OutLine | undefined;
  typeOf(id: number): string | undefined;
  readonly aggregated: ReadonlySet<number>;
}

/** Een view op losse regels (de writer), met een terugval voor ids die niet tussen die regels staan. */
export function linesView(lines: readonly OutLine[], fallbackType: (id: number) => string | undefined = () => undefined): OwnLinesView {
  const byId = new Map(lines.map(l => [l.id, l]));
  const aggregated = new Set<number>();
  for (const l of lines) if (l.type === 'IFCRELAGGREGATES') for (const id of refs(l.args[5])) aggregated.add(id);
  return { lines, line: id => byId.get(id), typeOf: id => byId.get(id)?.type ?? fallbackType(id), aggregated };
}

/** Typen die een object zijn (geen deel van een groep): in de boomvorm staat alleen hun type. */
const OBJECT_TYPES: ReadonlySet<string> = new Set(['IFCPROJECT', 'IFCWORKPLAN', 'IFCWORKSCHEDULE', 'IFCTASK', 'IFCOWNERHISTORY']);
/** `IfcRoot`-typen binnen een groep: GlobalId (0) en owner history (1) tellen niet mee. */
const ROOT_TYPES: ReadonlySet<string> = new Set(['IFCPROPERTYSET', 'IFCRELDEFINESBYPROPERTIES', 'IFCPROPERTYSETTEMPLATE',
  'IFCSIMPLEPROPERTYTEMPLATE', 'IFCRELDECLARES']);

const isBaselineHead = (l: OutLine) => l.type === 'IFCWORKSCHEDULE' && l.args.some(a => a.trim() === '.BASELINE.');
function refs(token: string | undefined): number[] {
  return [...(token ?? '').matchAll(/#(\d+)/g)].map(m => Number(m[1]));
}
function unquote(token: string | undefined): string {
  const t = (token ?? '').trim();
  return t.length >= 2 && t.startsWith("'") && t.endsWith("'") ? decodeStepText(t.slice(1, -1).replace(/''/g, "'")) : t;
}

/** Een anker van een projectgroep: het `IfcProject` (eigen of vreemd) of het eigen live werkschema. */
function anchor(view: OwnLinesView, id: number): boolean {
  if (view.typeOf(id) === 'IFCPROJECT') return true;
  const l = view.line(id);
  return !!l && l.type === 'IFCWORKSCHEDULE' && !isBaselineHead(l);
}

/** De wortels per groep: de eigen `IfcRelDefinesByProperties` naar een anker, en de eigen `IfcRelDeclares` van templates. */
function groupRoots(view: OwnLinesView): Map<string, OutLine[]> {
  const roots = new Map<string, OutLine[]>();
  const add = (g: string, l: OutLine) => { const a = roots.get(g) ?? []; a.push(l); roots.set(g, a); };
  for (const l of view.lines) {
    if (l.type === 'IFCRELDEFINESBYPROPERTIES') {
      const related = refs(l.args[4]), pset = view.line(refs(l.args[5])[0] ?? -1);
      if (pset?.type === 'IFCPROPERTYSET' && related.length > 0 && related.every(id => anchor(view, id))) add(unquote(pset.args[2]), l);
    } else if (l.type === 'IFCRELDECLARES') {
      const related = refs(l.args[5]).map(id => view.line(id));
      if (refs(l.args[4]).every(id => anchor(view, id)) && related.length > 0
        && related.every(t => t?.type === 'IFCPROPERTYSETTEMPLATE')) add(PSET.StructureMeta, l);
    }
  }
  return roots;
}

/** Per eigen regel de groep waartoe zij hoort (pset, properties, enumeraties, templates, relaties, baselinekoppen). */
export function ownGroupMembers(view: OwnLinesView): Map<number, string> {
  const out = new Map<number, string>();
  const walk = (id: number, g: string) => {
    const l = view.line(id);
    if (!l || OBJECT_TYPES.has(l.type) || out.has(id)) return;
    out.set(id, g);
    for (const a of l.args) for (const r of refs(a)) walk(r, g);
  };
  for (const [g, roots] of groupRoots(view)) for (const l of roots) walk(l.id, g);
  for (const l of view.lines) if (isBaselineHead(l)) out.set(l.id, BASELINE_HEADS);
  return out;
}

/** De groep die een herstelde bronwaarde (b) raakt: argument `arg` van eigen regel `line`, of niets. */
export function editedOwnGroup(members: ReadonlyMap<number, string>, line: OutLine, arg: number): string | undefined {
  if (line.type === 'IFCTASK') return arg === 4 || arg === 12 ? TASK_OBJECT_TYPES : undefined;
  return members.get(line.id);
}

/**
 * Per groep een gesorteerde lijst boomvormen, zonder GlobalId en owner history; een object staat er alleen met zijn type.
 * Alleen eigen leden van een pset tellen mee (een vreemd lid staat niet in `view.line`). `taskIds`: de taken van de
 * herlezing; een sleutel van `TaskGuids` zonder taak telt niet mee (de regel van de canon, `orphanRowsWithoutId`).
 */
export function ownGroupTrees(view: OwnLinesView, taskIds: ReadonlySet<string>): Map<string, string[]> {
  const tree = (id: number, depth: number): string => {
    const l = view.line(id);
    if (!l) return view.typeOf(id) ?? `?#${id}`;
    if (OBJECT_TYPES.has(l.type)) return isBaselineHead(l) ? 'IFCWORKSCHEDULE[BASELINE]' : l.type;
    if (depth > 12) return `${l.type}(…)`;
    return `${l.type}(${argsOf(l, depth).join(',')})`;
  };
  const argsOf = (l: OutLine, depth: number) => l.args.map((a, k) => {
    const t = a.trim();
    if (ROOT_TYPES.has(l.type) && k < 2) return k === 0 ? 'G' : 'OH';
    if (l.type === 'IFCPROPERTYSINGLEVALUE' && k === 2 && unquote(l.args[0]) === 'TaskGuids') return withoutOrphans(t, taskIds);
    const list = /^\(([\s\S]*)\)$/.exec(t);
    if (list && /^#\d+(\s*,\s*#\d+)*$/.test(list[1].trim())) {
      let ids = refs(list[1]);
      const members = l.type === 'IFCPROPERTYSET' && k === 4;
      if (members) ids = ids.filter(x => view.line(x) !== undefined);
      const parts = ids.map(x => tree(x, depth + 1));
      if (members) parts.sort();
      return `(${parts.join(',')})`;
    }
    return /^#\d+$/.test(t) ? tree(Number(t.slice(1)), depth + 1) : t;
  });
  const groups = new Map<string, string[]>();
  const add = (g: string, t: string) => { const a = groups.get(g) ?? []; a.push(t); groups.set(g, a); };
  for (const [g, roots] of groupRoots(view)) for (const l of roots) add(g, tree(l.id, 0));
  for (const l of view.lines) {
    if (isBaselineHead(l)) add(BASELINE_HEADS, `${view.aggregated.has(l.id) ? 'in aggregatie' : 'los'}|${argsOf({ ...l, args: l.args.slice(2) }, 0).join(',')}`);
    else if (l.type === 'IFCTASK' && l.args[12]?.trim() === '.USERDEFINED.') add(TASK_OBJECT_TYPES, `${l.args[0].trim()}|${l.args[4]?.trim()}`);
  }
  for (const v of groups.values()) v.sort();
  return groups;
}

/** `TaskGuids` zonder de sleutels van taken die na herlezen niet bestaan, op sleutel gesorteerd. */
function withoutOrphans(token: string, taskIds: ReadonlySet<string>): string {
  const m = /^IFCTEXT\(('[\s\S]*')\)$/.exec(token);
  if (!m) return token;
  let map: unknown;
  try { map = JSON.parse(unquote(m[1])); } catch { return token; }
  if (!map || typeof map !== 'object' || Array.isArray(map)) return token;
  const kept = Object.entries(map as Record<string, unknown>).filter(([k]) => taskIds.has(k)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `TaskGuids${JSON.stringify(kept)}`;
}

/** Het eerste verschil tussen twee indelingen: de groep en een stukje van beide kanten rond het eerste andere teken. */
export function ownGroupDifference(output: ReadonlyMap<string, readonly string[]>, rewritten: ReadonlyMap<string, readonly string[]>,
  skip: ReadonlySet<string>): { group: string; detail: string } | undefined {
  const names = [...new Set([...output.keys(), ...rewritten.keys()])].filter(g => !skip.has(g)).sort();
  for (const group of names) {
    const x = (output.get(group) ?? []).join('\n'), y = (rewritten.get(group) ?? []).join('\n');
    if (x === y) continue;
    let i = 0;
    while (i < x.length && x[i] === y[i]) i++;
    const around = (s: string) => s.slice(Math.max(0, i - 60), i + 80) || '(niets)';
    return { group, detail: `de eigen groep ${group} leest niet terug tot wat de writer ervan maakt: uitvoer «${around(x)}», herschreven «${around(y)}»` };
  }
  return undefined;
}
