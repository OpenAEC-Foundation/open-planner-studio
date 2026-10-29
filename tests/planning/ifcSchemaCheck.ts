// Kern van de IFC-schemapoort: een eigen STEP-parser (los van ifcReader: een poort leunt niet op de
// code die hij toetst) en de toets van één bestand tegen de schematabel `ifcSchemaTable.ts` van het
// schema in zijn kop (IFC4X3_ADD2, IFC4X3 of IFC4).
// Gebruikt door `check-ifc-schema.ts` (de poort, met zijn bronnen) en `check-ifc-roundtrip.ts` (de
// round-trip-fixture als extra bron: splits, contouren, timephased, P6-voortgang). Geen check: dit
// bestand draait niets. Toelichting: docs/ifc-round-trip.md, alinea "Schemageldigheid".
import { IFC_SCHEMA_TABLES, type IfcSchemaTable, type IfcSchemaTableId } from './ifcSchemaTable';

/**
 * BEKENDE AFWIJKING (bewust, gemeld): `IfcRelAssignsToProcess.RelatedObjects` is een SET, maar OPS
 * herhaalt daar een resource die twee keer op dezelfde taak staat; de lezer telt elke herhaling als
 * eigen toewijzing (`extractAssignments`, met de `GUID#N`-sleutels in OPS_Assignments). IfcOpenShell
 * 0.9.0 meldt dit niet en laadt beide verwijzingen (gemeten 2026-10-13). Een andere codering raakt de
 * lezer en oudere OPS-versies; dat is een eigen besluit, niet deze fix.
 */
const SET_DUPLICATES_ALLOWED = new Set(['IFCRELASSIGNSTOPROCESS.RelatedObjects']);

// ── STEP-parser (onafhankelijk van ifcReader: een poort leunt niet op de code die hij toetst) ──────

type V =
  | { k: 'null' } | { k: 'derived' } | { k: 'ref'; id: number } | { k: 'str'; raw: string }
  | { k: 'enum'; v: string } | { k: 'int'; n: number } | { k: 'real'; n: number }
  | { k: 'badnum'; raw: string } | { k: 'bin' } | { k: 'list'; items: V[] }
  | { k: 'typed'; type: string; value: V };

interface StepEntity { id: number; type: string; args: V[] }

/** Leest de DATA-sectie van een STEP-bestand. Gooit bij een syntaxfout (dat is zelf een bevinding). */
export function parseStep(text: string): StepEntity[] {
  const start = text.indexOf('\nDATA;');
  const end = text.lastIndexOf('\nENDSEC;');
  if (start < 0 || end < start) throw new Error('geen DATA-sectie');
  const s = text.slice(start + 6, end);
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const expect = (c: string) => {
    ws();
    if (s[i] !== c) throw new Error(`verwacht '${c}' op ${i}, kreeg '${s.slice(i, i + 20)}'`);
    i++;
  };
  const value = (): V => {
    ws();
    const c = s[i];
    if (c === '$') { i++; return { k: 'null' }; }
    if (c === '*') { i++; return { k: 'derived' }; }
    if (c === '#') {
      const m = /^#(\d+)/.exec(s.slice(i, i + 20));
      if (!m) throw new Error(`kapotte verwijzing op ${i}`);
      i += m[0].length;
      return { k: 'ref', id: Number(m[1]) };
    }
    if (c === "'") {
      let j = i + 1;
      for (;;) {
        const q = s.indexOf("'", j);
        if (q < 0) throw new Error(`open string op ${i}`);
        if (s[q + 1] === "'") { j = q + 2; continue; }
        const raw = s.slice(i, q + 1);
        i = q + 1;
        return { k: 'str', raw };
      }
    }
    if (c === '"') {
      const q = s.indexOf('"', i + 1);
      i = q + 1;
      return { k: 'bin' };
    }
    if (c === '.') {
      const q = s.indexOf('.', i + 1);
      const v = s.slice(i + 1, q);
      i = q + 1;
      return { k: 'enum', v };
    }
    if (c === '(') {
      i++;
      const items: V[] = [];
      ws();
      if (s[i] === ')') { i++; return { k: 'list', items }; }
      for (;;) {
        items.push(value());
        ws();
        if (s[i] === ',') { i++; continue; }
        expect(')');
        return { k: 'list', items };
      }
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i, i + 80))!;
      i += m[0].length;
      expect('(');
      const inner = value();
      expect(')');
      return { k: 'typed', type: m[0].toUpperCase(), value: inner };
    }
    // Getal. Alles wat geen STEP-INTEGER of STEP-REAL is (`1e-7`, `NaN`, `Infinity`), is een bevinding.
    const m = /^[^,()\s;]+/.exec(s.slice(i, i + 80));
    if (!m) throw new Error(`onverwacht teken '${c}' op ${i}`);
    i += m[0].length;
    const raw = m[0];
    if (/^[+-]?\d+$/.test(raw)) return { k: 'int', n: Number(raw) };
    if (/^[+-]?\d+\.\d*(E[+-]?\d+)?$/.test(raw)) return { k: 'real', n: Number(raw) };
    return { k: 'badnum', raw };
  };
  const out: StepEntity[] = [];
  for (;;) {
    ws();
    if (i >= s.length) break;
    const m = /^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(/.exec(s.slice(i, i + 200));
    if (!m) throw new Error(`geen entiteit op ${i}: '${s.slice(i, i + 40)}'`);
    i += m[0].length;
    const args: V[] = [];
    ws();
    if (s[i] === ')') i++;
    else {
      for (;;) {
        args.push(value());
        ws();
        if (s[i] === ',') { i++; continue; }
        expect(')');
        break;
      }
    }
    expect(';');
    out.push({ id: Number(m[1]), type: m[2].toUpperCase(), args });
  }
  return out;
}

// ── Toets per attribuut ───────────────────────────────────────────────────────────────────────────

const show = (v: V): string => {
  switch (v.k) {
    case 'null': return '$';
    case 'derived': return '*';
    case 'ref': return `#${v.id}`;
    case 'str': return v.raw.length > 30 ? `${v.raw.slice(0, 27)}…'` : v.raw;
    case 'enum': return `.${v.v}.`;
    case 'int': case 'real': return String(v.n);
    case 'badnum': return v.raw;
    case 'bin': return '"…"';
    case 'list': return `(${v.items.map(show).join(',')})`;
    case 'typed': return `${v.type}(${show(v.value)})`;
  }
};

/** Tekst met een vaste vorm (codes uit de schematabel). STEP-strings staan tussen quotes. */
const SHAPED_STRINGS: Record<string, [RegExp, string]> = {
  // IFC-base64 (0-9 A-Z a-z _ $), 22 tekens; 128 bits ⇒ het eerste teken draagt 2 bits (0-3).
  G: [/^'[0-3][0-9A-Za-z_$]{21}'$/, 'GlobalId: 22 tekens uit 0-9 A-Z a-z _ $, eerste teken 0-3'],
  DT: [/^'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?'$/, 'IfcDateTime: YYYY-MM-DDThh:mm:ss (met seconden)'],
  DA: [/^'\d{4}-\d{2}-\d{2}(Z|[+-]\d{2}:\d{2})?'$/, 'IfcDate: YYYY-MM-DD'],
  TI: [/^'\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?'$/, 'IfcTime: hh:mm:ss'],
  DU: [/^'-?P(?!')(\d+(\.\d+)?Y)?(\d+(\.\d+)?M)?(\d+(\.\d+)?W)?(\d+(\.\d+)?D)?(T(?=\d)(\d+(\.\d+)?H)?(\d+(\.\d+)?M)?(\d+(\.\d+)?S)?)?'$/,
    'IfcDuration: ISO 8601 (PnYnMnDTnHnMnS)'],
};

/** Toetst waarde `v` tegen typecode `code` (zonder `?`). `types`: STEP-id → entiteittype van het
 *  bestand; `table`: de schematabel uit de kop. Geeft een foutomschrijving of ''. */
function checkKind(
  v: V, code: string, types: ReadonlyMap<number, string>, table: IfcSchemaTable, allowDuplicates = false,
): string {
  if (code === '*') return v.k === 'derived' ? '' : 'afgeleid attribuut moet * zijn';
  const agg = /^(SET|LIST|BAG|ARRAY)(\d+):(.*)$/.exec(code);
  if (agg) {
    if (v.k !== 'list') return `${agg[1]} verwacht`;
    if (v.items.length < Number(agg[2])) return `${agg[1]} met minder dan ${agg[2]} element(en)`;
    for (const item of v.items) {
      if (item.k === 'null') return `$ als element in ${agg[1]}`;
      const err = checkKind(item, agg[3], types, table);
      if (err) return `element ${show(item)}: ${err}`;
    }
    if (agg[1] === 'SET' && !allowDuplicates) {
      const seen = new Set(v.items.map(show));
      if (seen.size !== v.items.length) return 'SET met dubbele elementen';
    }
    return '';
  }
  if (code.startsWith('#=')) {
    if (v.k !== 'ref') return 'verwijzing verwacht';
    const target = types.get(v.id);
    if (!target) return `verwijzing #${v.id} bestaat niet`;
    const allowed = code.length > 2 ? code.slice(2).split('|') : [];
    return allowed.includes(target) ? '' : `verwijst naar ${target}, toegestaan: ${allowed.join(', ') || 'geen OPS-entiteit'}`;
  }
  if (code in SHAPED_STRINGS) {
    if (v.k !== 'str') return 'tekst verwacht';
    const [shape, what] = SHAPED_STRINGS[code];
    return shape.test(v.raw) ? '' : `vorm klopt niet (${what})`;
  }
  if (code.startsWith('E=')) {
    const allowed = code.slice(2).split('|');
    if (v.k !== 'enum') return 'enum verwacht';
    return allowed.includes(v.v) ? '' : `enum-literal .${v.v}. niet toegestaan`;
  }
  if (code.startsWith('V=')) {
    const sel = table.selects[code.slice(2)];
    if (!sel) return `select ${code} niet in de tabel`;
    if (v.k === 'ref') {
      if (!sel.refs) return 'select staat geen verwijzing toe';
      const target = types.get(v.id);
      if (!target) return `verwijzing #${v.id} bestaat niet`;
      return sel.entities.includes(target) ? '' : `verwijst naar ${target}, niet toegestaan in ${code.slice(2)}`;
    }
    if (v.k !== 'typed') return 'getypte waarde of verwijzing verwacht';
    if (!sel.types.includes(v.type)) return `${v.type} niet toegestaan in ${code.slice(2)}`;
    const inner = table.typedValueKind[v.type];
    return inner ? checkKind(v.value, inner, types, table) : `${v.type} zonder typecode`;
  }
  switch (code) {
    case 'S': return v.k === 'str' ? '' : 'tekst verwacht';
    case 'R': return v.k === 'real' ? '' : 'REAL verwacht (met decimale punt)';
    case 'R+': return v.k === 'real' ? (v.n > 0 ? '' : 'positieve REAL verwacht (> 0)') : 'REAL verwacht (met decimale punt)';
    case 'I': return v.k === 'int' ? '' : 'INTEGER verwacht';
    case 'I+': return v.k === 'int' ? (v.n > 0 ? '' : 'positieve INTEGER verwacht') : 'INTEGER verwacht';
    case 'N': return v.k === 'int' || v.k === 'real' ? '' : 'getal verwacht';
    case 'B': return v.k === 'enum' && (v.v === 'T' || v.v === 'F') ? '' : 'BOOLEAN verwacht';
    case 'L': return v.k === 'enum' && (v.v === 'T' || v.v === 'F' || v.v === 'U') ? '' : 'LOGICAL verwacht';
    case 'X': return v.k === 'bin' ? '' : 'BINARY verwacht';
    default: return `onbekende typecode ${code}`;
  }
}

function attrName(spec: string): string { return spec.slice(0, spec.indexOf(':')); }

/** Wat de getoetste bestanden samen bevatten (voor de dekkingstoets van de poort). */
export interface Seen { entities: Set<string>; typed: Set<string>; schemas: Set<string> }
export const newSeen = (): Seen => ({ entities: new Set(), typed: new Set(), schemas: new Set() });

const isTableSchema = (id: string | undefined): id is IfcSchemaTableId => !!id && Object.prototype.hasOwnProperty.call(IFC_SCHEMA_TABLES, id);

function collectTyped(v: V, out: Set<string>): void {
  if (v.k === 'typed') { out.add(v.type); collectTyped(v.value, out); }
  else if (v.k === 'list') for (const item of v.items) collectTyped(item, out);
}

/**
 * Toetst één bestand tegen de tabel van het schema in zijn kop (`FILE_SCHEMA`). `label` komt in elke
 * foutmelding. `expectSchema`: als gegeven, moet de kop precies dat schema noemen. Geeft het aantal
 * toetsen en de fouten.
 */
export function checkIfcSchema(
  label: string, text: string, seen: Seen = newSeen(), expectSchema?: IfcSchemaTableId,
): { checks: number; failures: string[] } {
  let checks = 0;
  const failures: string[] = [];
  const assert = (cond: boolean, msg: string) => { checks++; if (!cond) failures.push(msg); };
  // De kop kiest de tabel: elk schema heeft eigen enum-literals (IfcTaskTypeEnum.INSPECTION bestaat
  // bijvoorbeeld niet in IFC4) en eigen getypeerde waarden.
  const schemaId = /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/.exec(text)?.[1];
  if (expectSchema) assert(schemaId === expectSchema, `${label}: FILE_SCHEMA is '${schemaId}', verwacht '${expectSchema}'`);
  if (!isTableSchema(schemaId)) {
    assert(false, `${label}: FILE_SCHEMA '${schemaId}' heeft geen schematabel (${Object.keys(IFC_SCHEMA_TABLES).join(', ')})`);
    return { checks, failures };
  }
  const table = IFC_SCHEMA_TABLES[schemaId];
  seen.schemas.add(schemaId);
  let entities: StepEntity[];
  try {
    entities = parseStep(text);
  } catch (e) {
    assert(false, `${label}: STEP niet te lezen: ${(e as Error).message}`);
    return { checks, failures };
  }
  const byId = new Map(entities.map(e => [e.id, e]));
  const types = new Map(entities.map(e => [e.id, e.type]));
  assert(byId.size === entities.length, `${label}: dubbele STEP-id's`);
  // Fouten per soort (entiteit + bericht zonder waarde) met één voorbeeld, zodat één bestand met
  // honderd gelijke fouten de uitvoer niet vult en elke soort zichtbaar blijft.
  const kinds = new Map<string, { count: number; example: string }>();
  const fail = (e: StepEntity, msg: string, detail = '') => {
    const key = `${e.type}: ${msg}`;
    const k = kinds.get(key);
    if (k) k.count++;
    else kinds.set(key, { count: 1, example: `#${e.id}${detail ? ` ${detail}` : ''}` });
  };
  for (const e of entities) {
    seen.entities.add(e.type);
    for (const a of e.args) collectTyped(a, seen.typed);
    const spec = table.attributes[e.type];
    if (!spec) { fail(e, `entiteit staat niet in de schematabel van ${schemaId} (ifcSchemaTable.ts)`); continue; }
    checks++;
    if (e.args.length !== spec.length) {
      fail(e, `${e.args.length} attributen, verwacht ${spec.length}`);
      continue;
    }
    spec.forEach((attr, idx) => {
      const name = attrName(attr);
      let code = attr.slice(name.length + 1);
      const optional = code.endsWith('?');
      if (optional) code = code.slice(0, -1);
      const v = e.args[idx];
      if (v.k === 'null') {
        if (!optional) fail(e, `${name} (index ${idx}) is verplicht maar $`);
        return;
      }
      const err = checkKind(v, code, types, table, SET_DUPLICATES_ALLOWED.has(`${e.type}.${name}`));
      if (err) fail(e, `${name} (index ${idx}): ${err}`, `waarde ${show(v)}`);
    });
    checkRules(e, spec, byId, fail);
  }
  for (const [key, { count, example }] of kinds) {
    assert(false, `${label} [${schemaId}]: ${key} — ${count}× (bv. ${example})`);
  }
  return { checks, failures };
}

/**
 * WHERE-regels uit IFC4X3_ADD2 die de OPS-writer kan raken (IfcOpenShell `validate --rules` toetst ze
 * allemaal; deze selectie is de CI-wacht voor de gevallen die we tegenkwamen):
 *  - CorrectPredefinedType (IfcTask, resources, IfcWorkCalendar, IfcWorkSchedule, …): PredefinedType
 *    USERDEFINED ⇒ ObjectType bestaat;
 *  - IfcProject.HasName / IfcTask.HasName: Name bestaat;
 *  - IfcPerson.IdentifiablePerson: Identification, FamilyName of GivenName bestaat;
 *  - IfcPropertySet.UniquePropertyNames: geen twee properties met dezelfde naam;
 *  - IfcRelSequence.AvoidInconsistentSequence: een taak is niet zijn eigen voorganger.
 */
function checkRules(
  e: StepEntity, spec: readonly string[], byId: Map<number, StepEntity>, fail: (e: StepEntity, msg: string) => void,
): void {
  const at = (name: string) => {
    const idx = spec.findIndex(a => attrName(a) === name);
    return idx < 0 ? undefined : e.args[idx];
  };
  const predefined = at('PredefinedType');
  const objectType = at('ObjectType');
  if (predefined?.k === 'enum' && predefined.v === 'USERDEFINED' && objectType?.k === 'null') {
    fail(e, 'CorrectPredefinedType: USERDEFINED zonder ObjectType');
  }
  if ((e.type === 'IFCPROJECT' || e.type === 'IFCTASK') && at('Name')?.k === 'null') fail(e, 'HasName: Name is $');
  if (e.type === 'IFCPERSON' && ['Identification', 'FamilyName', 'GivenName'].every(n => at(n)?.k === 'null')) {
    fail(e, 'IdentifiablePerson: geen Identification, FamilyName of GivenName');
  }
  if (e.type === 'IFCPROPERTYSET') {
    const props = at('HasProperties');
    if (props?.k === 'list') {
      const names = props.items.map(p => (p.k === 'ref' ? byId.get(p.id)?.args[0] : undefined))
        .map(n => (n?.k === 'str' ? n.raw : '?'));
      if (new Set(names).size !== names.length) fail(e, 'UniquePropertyNames: dubbele propertynaam');
    }
  }
  if (e.type === 'IFCRELSEQUENCE') {
    const a = at('RelatingProcess');
    const b = at('RelatedProcess');
    if (a?.k === 'ref' && b?.k === 'ref' && a.id === b.id) fail(e, 'AvoidInconsistentSequence: taak volgt op zichzelf');
  }
}
