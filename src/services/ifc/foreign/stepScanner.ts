/**
 * STEP-scanner op bytes (#804 fase 0, ontwerp "Gebouwmodel behouden" §4.1 en §4.2).
 *
 * Fase 0 is een haalbaarheidsproef: deze module wordt nog nergens in de app aangeroepen. Alleen
 * de poort `tests/planning/check-ifc-foreign-classify.ts` en de meting `scripts/proef/meet-scanner.mjs`
 * gebruiken haar.
 *
 * De scanner knipt een STEP-bestand in **stukken**. Een stuk is een entiteit-instantie van `#` tot en met
 * de `;` die haar afsluit, plus alle tekst ervóór sinds het vorige stuk (witruimte, regeleinden, ook
 * CRLF, en commentaar). De kop (alles vóór het eerste `DATA;`), elk `DATA;`-statement (met de tekst ervóór, bij
 * een tweede DATA-sectie dus ook de `ENDSEC;` van de vorige) en de staart (alles na de laatste entiteit, met
 * `ENDSEC;` en `END-ISO-10303-21;`) zijn aparte stukken. Elk byte van de bron
 * valt in precies één stuk, en de stukken staan in bronvolgorde.
 *
 * De scanner leest bytes (`Uint8Array`): alle STEP-syntaxis is ASCII. Hij decodeert geen tekst die de
 * indeling niet nodig heeft. De index levert per stuk het `#id`, het type (of `(COMPLEX)` voor een
 * complexe instantie `#n=(A(..)B(..));`), de byte-grenzen, de uitgaande `#`-verwijzingen met hun
 * argumentpositie en de inkomende verwijzingen. Daarnaast een klein aantal gedecodeerde velden
 * (zie `StepIndex`), lui en alleen op aanvraag.
 *
 * Ongeschikte invoer weigert de scanner met een `StepScanError`, met dezelfde regels als de voorproef
 * `scripts/proef/classify-v9.py` (ontwerp v18): geen `ISO-10303-21;` vooraan of `END-ISO-10303-21;` achteraan,
 * tekst of commentaar zonder einde, een laatste statement zonder `;`, secties in een andere volgorde (HEADER met
 * ENDSEC, dan een of meer DATA-secties met ENDSEC), een onbekend statement, een `#id` dat twee keer voorkomt, of geen
 * entiteiten. Sleutelwoorden en typenamen staan in hoofdletters (ISO 10303-21). Daarmee is de scanner strenger dan
 * `parseSTEP` in `ifcReader.ts`: die zoekt `DATA;` hoofdletterongevoelig, valt bij een ongebalanceerde apostrof terug
 * op een regel-verankerde zoektocht, en laat bij een dubbel `#id` de laatste winnen. Quotes (`''`) en commentaar
 * volgen wel dezelfde regels, zodat scanner en lezer op geldige invoer dezelfde entiteiten zien. Bekend verschil: de
 * lezer slaat een complexe instantie over (`readEntity` geeft -1), de scanner maakt er een stuk van.
 */
import { decodeStepText } from '../ifcReader';

/** Het type van een complexe instantie `#n=(A(..)B(..));`. */
export const COMPLEX_TYPE = '(COMPLEX)';

/** Soort stuk. */
export type ChunkKind = 'kop' | 'data' | 'entiteit' | 'staart';
const KIND_KOP = 0;
const KIND_DATA = 1;
const KIND_ENTITEIT = 2;
const KIND_STAART = 3;
const KIND_NAMES: readonly ChunkKind[] = ['kop', 'data', 'entiteit', 'staart'];

const CH_TAB = 9;
const CH_LF = 10;
const CH_CR = 13;
const CH_SPACE = 32;
const CH_HASH = 35;
const CH_QUOTE = 39;
const CH_LPAREN = 40;
const CH_RPAREN = 41;
const CH_STAR = 42;
const CH_COMMA = 44;
const CH_SLASH = 47;
const CH_SEMI = 59;
const CH_EQ = 61;

function isWord(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
}
function isSpace(c: number): boolean {
  return c === CH_SPACE || (c >= CH_TAB && c <= CH_CR);
}
/** Teken van een typenaam: `[A-Z0-9_]` (ISO 10303-21 schrijft hoofdletters voor). */
function isUpperWord(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || c === 95;
}
function isDigit(c: number): boolean {
  return c >= 48 && c <= 57;
}
/** Witruimte en commentaar overslaan: de lezer strippt commentaar vóór hij entiteiten leest, dus
 *  `#1= IFCTASK /* x *\/ (…);` is daar een gewone entiteit. */
function skipBlank(b: Uint8Array, i: number): number {
  const n = b.length;
  for (;;) {
    while (i < n && isSpace(b[i])) i++;
    if (b[i] === CH_SLASH && b[i + 1] === CH_STAR) { i = skipQuotedOrComment(b, i); continue; }
    return i;
  }
}

/**
 * Staat `i` op het begin van een string (`'…'`, `''` = ontsnapte apostrof) of commentaar (`/* … *\/`),
 * dan de index direct erna; anders -1. Niet afgesloten: tot het einde. Spiegel van
 * `skipQuotedOrComment` in `ifcReader.ts`, op bytes.
 */
function skipQuotedOrComment(b: Uint8Array, i: number): number {
  const n = b.length;
  const c = b[i];
  if (c === CH_QUOTE) {
    for (let j = i + 1; j < n; j++) {
      if (b[j] !== CH_QUOTE) continue;
      if (b[j + 1] === CH_QUOTE) { j++; continue; }
      return j + 1;
    }
    return n;
  }
  if (c === CH_SLASH && b[i + 1] === CH_STAR) {
    for (let j = i + 2; j + 1 < n; j++) {
      if (b[j] === CH_STAR && b[j + 1] === CH_SLASH) return j + 2;
    }
    return n;
  }
  return -1;
}

/** Groeiende Int32-buffer: geen JS-array per entiteit, ook niet bij miljoenen stukken. */
class IntBuf {
  data: Int32Array;
  length = 0;
  constructor(capacity: number) { this.data = new Int32Array(Math.max(16, capacity)); }
  push(v: number): void {
    if (this.length === this.data.length) {
      const next = new Int32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    this.data[this.length++] = v;
  }
  done(): Int32Array { return this.data.subarray(0, this.length); }
}

/** Velden van een `IfcWorkSchedule`/`IfcWorkPlan` die de indeling leest (§4.2). */
export interface WorkControlFields {
  /** De ruwe tokens van alle argumenten; alleen voor `workControlSlots` (lay-outherkenning). */
  readonly slotTokens: readonly string[];
  readonly name: string;
  /** Ruw token van CreationDate, zonder quotes (`2026-01-01T07:00:00`), of '' bij `$`. */
  readonly creationDate: string;
}

/** `ApplicationIdentifier` en `Version` van een `IfcApplication`. */
export interface ApplicationFields {
  readonly identifier: string;
  readonly version: string;
}

/**
 * De index van een STEP-bestand. Alleen de velden en methoden hieronder zijn er; de indeling
 * (`classify.ts`) is een pure functie van deze index en leest geen ander veld (de poort controleert
 * dat met een `Proxy`, zie `STEP_INDEX_FIELDS`).
 */
export class StepIndex {
  readonly #bytes: Uint8Array;
  readonly #kind: Uint8Array;
  readonly #start: Int32Array;
  readonly #end: Int32Array;
  readonly #entStart: Int32Array;
  readonly #typeCode: Int32Array;
  readonly #typeNames: readonly string[];
  readonly #idNum: Int32Array;
  readonly #byNum: Int32Array | Map<number, number>;
  readonly #outOff: Int32Array;
  readonly #outTarget: Int32Array;
  readonly #outArg: Int32Array;
  readonly #inOff: Int32Array;
  readonly #inSource: Int32Array;
  readonly #inArg: Int32Array;
  readonly #utf8 = new TextDecoder('utf-8');
  #literalCache: Int8Array | undefined;
  #fileCoding: { hasApplication: boolean; legacyLiteral: boolean } | undefined;

  /** Aantal stukken, inclusief kop, `DATA;` en staart. */
  readonly count: number;
  /** Aantal entiteiten (stukken van soort `entiteit`). */
  readonly entityCount: number;
  /** Regeleinde van de bron: CRLF als het eerste regeleinde een CRLF is. */
  readonly lineEnding: '\r\n' | '\n';
  /** Aantal verwijzingen naar een `#id` dat niet bestaat. */
  readonly danglingRefCount: number;

  /** @internal Alleen `scanStep` maakt een index. */
  constructor(parts: {
    bytes: Uint8Array; kind: Uint8Array; start: Int32Array; end: Int32Array; entStart: Int32Array;
    typeCode: Int32Array; typeNames: string[]; idNum: Int32Array; byNum: Int32Array | Map<number, number>;
    outOff: Int32Array; outTarget: Int32Array; outArg: Int32Array;
    inOff: Int32Array; inSource: Int32Array; inArg: Int32Array;
    lineEnding: '\r\n' | '\n'; danglingRefCount: number;
  }) {
    this.#bytes = parts.bytes;
    this.#kind = parts.kind;
    this.#start = parts.start;
    this.#end = parts.end;
    this.#entStart = parts.entStart;
    this.#typeCode = parts.typeCode;
    this.#typeNames = parts.typeNames;
    this.#idNum = parts.idNum;
    this.#byNum = parts.byNum;
    this.#outOff = parts.outOff;
    this.#outTarget = parts.outTarget;
    this.#outArg = parts.outArg;
    this.#inOff = parts.inOff;
    this.#inSource = parts.inSource;
    this.#inArg = parts.inArg;
    this.count = parts.kind.length;
    let entities = 0;
    for (let i = 0; i < this.count; i++) if (parts.kind[i] === KIND_ENTITEIT) entities++;
    this.entityCount = entities;
    this.lineEnding = parts.lineEnding;
    this.danglingRefCount = parts.danglingRefCount;
  }

  // ── Structuur ────────────────────────────────────────────────────────────────────────────

  kind(i: number): ChunkKind { return KIND_NAMES[this.#kind[i]]; }
  isEntity(i: number): boolean { return this.#kind[i] === KIND_ENTITEIT; }
  /** Eerste byte van het stuk (inclusief de tekst ervóór). */
  start(i: number): number { return this.#start[i]; }
  /** Eerste byte ná het stuk. */
  end(i: number): number { return this.#end[i]; }
  /** Positie van de `#` van de entiteit; -1 voor kop, `DATA;` en staart. */
  entityStart(i: number): number { return this.#entStart[i]; }
  /** Type in hoofdletters (`IFCTASK`), `(COMPLEX)`, of '' voor kop, `DATA;` en staart. */
  type(i: number): string { return this.#typeNames[this.#typeCode[i]]; }
  /** Het `#id` zonder `#` (`'12'`), of '' voor kop, `DATA;` en staart. */
  id(i: number): string {
    const n = this.#idNum[i];
    return n >= 0 ? String(n) : '';
  }
  /** Het stuk met dit `#id` (zonder `#`), of -1. */
  chunkOf(id: string): number {
    if (!/^\d{1,10}$/.test(id)) return -1;
    const n = Number(id);
    return n <= 0x7fffffff ? this.#lookupNum(n) : -1;
  }
  #lookupNum(n: number): number {
    const t = this.#byNum;
    if (t instanceof Int32Array) return n < t.length ? t[n] : -1;
    return t.get(n) ?? -1;
  }

  // ── Verwijzingen ────────────────────────────────────────────────────────────────────────
  // Uitgaand: index k loopt van outStart(i) tot outEnd(i); outTarget(k) is het doelstuk (-1 = bestaat
  // niet), outArg(k) de argumentpositie op het hoogste niveau. Inkomend: idem met inSource/inArg.

  outStart(i: number): number { return this.#outOff[i]; }
  outEnd(i: number): number { return this.#outOff[i + 1]; }
  outTarget(k: number): number { return this.#outTarget[k]; }
  outArg(k: number): number { return this.#outArg[k]; }
  inStart(i: number): number { return this.#inOff[i]; }
  inEnd(i: number): number { return this.#inOff[i + 1]; }
  inSource(k: number): number { return this.#inSource[k]; }
  inArg(k: number): number { return this.#inArg[k]; }

  /** De doelstukken op argumentpositie `arg` (in volgorde; ook de leden van een lijst). */
  refsAt(i: number, arg: number): number[] {
    const out: number[] = [];
    for (let k = this.#outOff[i]; k < this.#outOff[i + 1]; k++) {
      if (this.#outArg[k] === arg && this.#outTarget[k] >= 0) out.push(this.#outTarget[k]);
    }
    return out;
  }
  /** Het eerste doelstuk op argumentpositie `arg`, of -1. */
  refAt(i: number, arg: number): number {
    for (let k = this.#outOff[i]; k < this.#outOff[i + 1]; k++) {
      if (this.#outArg[k] === arg) return this.#outTarget[k];
    }
    return -1;
  }

  // ── Ruwe en gedecodeerde velden (§4.2) ──────────────────────────────────────────────────

  /** Aantal argumenten op het hoogste niveau (lay-outherkenning, zoals de lezer). */
  argCount(i: number): number { return this.#rawArgs(i)?.length ?? 0; }

  /** Argument 0 als ruwe ASCII-tekst zonder quotes: de GlobalId van een `IfcRoot`. '' als het geen string is. */
  globalId(i: number): string {
    const a0 = this.#rawArg0(i);
    return a0.length >= 2 && a0.charCodeAt(0) === CH_QUOTE && a0.charCodeAt(a0.length - 1) === CH_QUOTE
      ? a0.slice(1, -1).replace(/''/g, "'")
      : '';
  }

  /**
   * De gedecodeerde `Name` van een pset of template (arg 2), een property (arg 0), een
   * property-template (arg 2) of een werkschema/werkplan (arg 2). '' bij `$`; `undefined` bij een ander type.
   */
  name(i: number): string | undefined {
    const pos = NAME_POSITION[this.type(i)];
    if (pos === undefined) return undefined;
    const args = this.#rawArgs(i);
    return args ? this.#text(i, args[pos]) : undefined;
  }

  /** `TemplateType` van een `IfcSimplePropertyTemplate` zonder punten (`P_SINGLEVALUE`), of ''. */
  templateType(i: number): string {
    if (this.type(i) !== 'IFCSIMPLEPROPERTYTEMPLATE') return '';
    return (this.#rawArgs(i)?.[4] ?? '').replace(/\./g, '').trim();
  }

  /** `PredefinedType`-slot, `Name` en `CreationDate` van een werkschema of werkplan. */
  workControl(i: number): WorkControlFields | undefined {
    const t = this.type(i);
    if (t !== 'IFCWORKSCHEDULE' && t !== 'IFCWORKPLAN') return undefined;
    const args = this.#rawArgs(i);
    if (!args) return undefined;
    const created = args[6] ?? '';
    return {
      slotTokens: args,
      name: this.#text(i, args[2]),
      creationDate: created.startsWith("'") ? this.#text(i, created) : '',
    };
  }

  /**
   * De tekst in de `NominalValue` van een `IfcPropertySingleValue` (`IFCTEXT('…')`/`IFCLABEL('…')`),
   * gedecodeerd; `undefined` bij een andere waarde. De indeling gebruikt dit alleen voor de property
   * `Baselines` in `OPS_Baselines` en de JSON in `OPS_StructureMeta` (§4.2).
   */
  propertyText(i: number): string | undefined {
    if (this.type(i) !== 'IFCPROPERTYSINGLEVALUE') return undefined;
    const v = this.#rawArgs(i)?.[2] ?? '';
    const m = /^IFC\w+\s*\(\s*('[\s\S]*')\s*\)$/i.exec(v);
    return m ? this.#text(i, m[1]) : undefined;
  }

  /**
   * De gedecodeerde tekstwaarden van een `IfcPropertyEnumeratedValue` (arg 2) of een
   * `IfcPropertyEnumeration` (arg 1), in volgorde. Andere waarden (getallen) vallen weg, zoals in de lezer.
   */
  enumValues(i: number): string[] | undefined {
    const t = this.type(i);
    const pos = t === 'IFCPROPERTYENUMERATEDVALUE' ? 2 : t === 'IFCPROPERTYENUMERATION' ? 1 : -1;
    if (pos < 0) return undefined;
    const list = (this.#rawArgs(i)?.[pos] ?? '').trim();
    if (!list.startsWith('(')) return [];
    const out: string[] = [];
    for (const item of splitArgs(list.slice(1, -1))) {
      const m = /^IFC\w+\s*\(\s*('[\s\S]*')\s*\)$/i.exec(item);
      if (m) out.push(this.#text(i, m[1]));
    }
    return out;
  }

  /** `ApplicationIdentifier` (arg 3) en `Version` (arg 1) van een `IfcApplication`. */
  application(i: number): ApplicationFields | undefined {
    if (this.type(i) !== 'IFCAPPLICATION') return undefined;
    const args = this.#rawArgs(i);
    if (!args) return undefined;
    return { identifier: this.#text(i, args[3]), version: this.#text(i, args[1]) };
  }

  // ── Intern ──────────────────────────────────────────────────────────────────────────────

  /** De argumenten op het hoogste niveau als ruwe tekst (UTF-8 gedecodeerd, commentaar weg). */
  #rawArgs(i: number): string[] | undefined {
    if (this.#kind[i] !== KIND_ENTITEIT || this.type(i) === COMPLEX_TYPE) return undefined;
    const b = this.#bytes;
    const p = openParenOf(b, this.#entStart[i]);
    const argsStart = p + 1;
    // De sluithaak van de entiteit: het stuk eindigt op `;`, met daarvoor `)` en eventueel witruimte
    // of commentaar. Zoek terug naar de laatste `)` buiten commentaar door vooruit te tellen.
    let depth = 0;
    let argsEnd = -1;
    for (let k = p; k < this.#end[i];) {
      const c = b[k];
      if (c === CH_QUOTE || c === CH_SLASH) {
        const skip = skipQuotedOrComment(b, k);
        if (skip >= 0) { k = skip; continue; }
      }
      if (c === CH_LPAREN) depth++;
      else if (c === CH_RPAREN && --depth === 0) { argsEnd = k; break; }
      k++;
    }
    if (argsEnd < 0) return undefined;
    return splitArgs(stripComments(this.#utf8.decode(b.subarray(argsStart, argsEnd))));
  }

  #rawArg0(i: number): string {
    if (this.#kind[i] !== KIND_ENTITEIT || this.type(i) === COMPLEX_TYPE) return '';
    const b = this.#bytes;
    const p = skipBlank(b, openParenOf(b, this.#entStart[i]) + 1);
    if (b[p] !== CH_QUOTE) return '';
    const end = skipQuotedOrComment(b, p);
    let s = '';
    for (let k = p; k < end; k++) s += String.fromCharCode(b[k]);
    return s;
  }

  /** Een stringtoken (`'…'`) naar tekst, met de codering van dit stuk (§4.9 punt 5). `$` en geen string ⇒ ''. */
  #text(i: number, token: string | undefined): string {
    const t = (token ?? '').trim();
    if (!t.startsWith("'") || !t.endsWith("'") || t.length < 2) return '';
    const body = t.slice(1, -1).replace(/''/g, "'");
    return this.#literal(i) ? body : decodeStepText(body);
  }

  /**
   * Codering per stuk (§4.9 punt 5): een stuk met een `OwnerHistory`-slot volgt de applicatie achter
   * dat slot (OPS met versie `'0.1'` = letterlijk, al het andere = de norm). Een stuk zonder dat slot
   * volgt het eerste stuk dat ernaar verwijst; een stuk waar niemand naar verwijst, volgt de norm.
   * Zonder `IfcApplication` in het hele bestand blijft de huidige terugval: met `OPS_`-psets letterlijk.
   */
  #literal(i: number): boolean {
    const file = this.#fileCodingInfo();
    if (!file.hasApplication) return file.legacyLiteral;
    if (!this.#literalCache) this.#literalCache = new Int8Array(this.count).fill(-1);
    const cached = this.#literalCache[i];
    if (cached >= 0) return cached === 1;
    let value = false;
    let cur = i;
    for (let depth = 0; depth < 4 && cur >= 0; depth++) {
      const oh = this.#ownerHistoryOf(cur);
      if (oh !== undefined) {
        value = oh >= 0 && this.#isLiteralOwnerHistory(oh);
        break;
      }
      cur = this.#inOff[cur] < this.#inOff[cur + 1] ? this.#inSource[this.#inOff[cur]] : -1;
    }
    this.#literalCache[i] = value ? 1 : 0;
    return value;
  }

  /** Het owner-history-stuk van een stuk met een `OwnerHistory`-slot (-1 bij `$`), of `undefined` als
   *  het stuk dat slot niet heeft. Fase 0 kent het slot via de verwijzing op argument 1 naar een
   *  `IfcOwnerHistory`, of via een bekend `IfcRoot`-type met `$` op argument 1. */
  #ownerHistoryOf(i: number): number | undefined {
    if (this.#kind[i] !== KIND_ENTITEIT) return undefined;
    const target = this.refAt(i, 1);
    if (target >= 0 && this.type(target) === 'IFCOWNERHISTORY') return target;
    if (target < 0 && ROOT_TYPES_FOR_CODING.has(this.type(i))) return -1;
    return undefined;
  }

  #isLiteralOwnerHistory(oh: number): boolean {
    const app = this.refAt(oh, 1);
    if (app < 0 || this.type(app) !== 'IFCAPPLICATION') return false;
    const args = this.#rawArgs(app);
    if (!args) return false;
    // Identifier en versie zijn vaste ASCII: zonder decodering vergelijken (anders een kringloop).
    const id = (args[3] ?? '').trim();
    const version = (args[1] ?? '').trim();
    return id === "'OPS'" && version === "'0.1'";
  }

  #fileCodingInfo(): { hasApplication: boolean; legacyLiteral: boolean } {
    if (this.#fileCoding) return this.#fileCoding;
    let hasApplication = false;
    for (let i = 0; i < this.count && !hasApplication; i++) hasApplication = this.type(i) === 'IFCAPPLICATION';
    // Alleen zonder IfcApplication telt de oude terugval (`isOpsAuthoredIfc` in de lezer): een `OPS_`-pset.
    let opsPset = false;
    for (let i = 0; i < this.count && !hasApplication && !opsPset; i++) {
      if (this.type(i) === 'IFCPROPERTYSET') opsPset = (this.#rawArgs(i)?.[2] ?? '').trim().startsWith("'OPS_");
    }
    this.#fileCoding = { hasApplication, legacyLiteral: opsPset };
    return this.#fileCoding;
  }
}

/** De publieke velden en methoden van `StepIndex`: wat de indeling mag lezen (§4.2). */
export const STEP_INDEX_FIELDS: ReadonlySet<string> = new Set([
  'count', 'entityCount', 'lineEnding', 'danglingRefCount',
  'kind', 'isEntity', 'start', 'end', 'entityStart', 'type', 'id', 'chunkOf',
  'outStart', 'outEnd', 'outTarget', 'outArg', 'inStart', 'inEnd', 'inSource', 'inArg', 'refsAt', 'refAt',
  'argCount', 'globalId', 'name', 'templateType', 'workControl', 'propertyText', 'enumValues', 'application',
]);

/** Positie van `Name` per type (§4.2: psets, templates, properties, property-templates, werkschema's). */
const NAME_POSITION: Readonly<Record<string, number>> = {
  IFCPROPERTYSET: 2,
  IFCPROPERTYSETTEMPLATE: 2,
  IFCSIMPLEPROPERTYTEMPLATE: 2,
  IFCPROPERTYSINGLEVALUE: 0,
  IFCPROPERTYENUMERATEDVALUE: 0,
  IFCPROPERTYLISTVALUE: 0,
  IFCPROPERTYBOUNDEDVALUE: 0,
  IFCPROPERTYTABLEVALUE: 0,
  IFCPROPERTYREFERENCEVALUE: 0,
  IFCCOMPLEXPROPERTY: 0,
  IFCWORKSCHEDULE: 2,
  IFCWORKPLAN: 2,
};

/** `IfcRoot`-typen met een `OwnerHistory`-slot op argument 1 die de writer schrijft (voor de codering
 *  bij `$`). Fase 2 vervangt dit door de descriptortabellen. */
const ROOT_TYPES_FOR_CODING: ReadonlySet<string> = new Set([
  'IFCPROJECT', 'IFCWORKPLAN', 'IFCWORKSCHEDULE', 'IFCWORKCALENDAR', 'IFCTASK',
  'IFCPROPERTYSET', 'IFCPROPERTYSETTEMPLATE', 'IFCSIMPLEPROPERTYTEMPLATE',
  'IFCRELNESTS', 'IFCRELASSIGNSTOCONTROL', 'IFCRELASSIGNSTOPROCESS', 'IFCRELAGGREGATES', 'IFCRELDECLARES',
  'IFCRELDEFINESBYPROPERTIES', 'IFCRELSEQUENCE',
  'IFCLABORRESOURCE', 'IFCCONSTRUCTIONEQUIPMENTRESOURCE', 'IFCCONSTRUCTIONMATERIALRESOURCE',
  'IFCCONSTRUCTIONPRODUCTRESOURCE', 'IFCSUBCONTRACTRESOURCE', 'IFCCREWRESOURCE',
]);

/** De `(` van de argumenten van een entiteit vanaf haar `#`: `#id`, `=`, type, met witruimte en commentaar ertussen. */
function openParenOf(b: Uint8Array, at: number): number {
  let i = at + 1;
  while (isWord(b[i])) i++;
  i = skipBlank(b, i);
  i = skipBlank(b, i + 1); // na '='
  while (isWord(b[i])) i++;
  return skipBlank(b, i);
}

/** Argumenten op het hoogste niveau splitsen, quote-bewust (spiegel van `splitArgs` in de lezer). */
function splitArgs(argsStr: string): string[] {
  const args: string[] = [];
  let segStart = 0;
  let depth = 0;
  let inString = false;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === "'" && !inString) inString = true;
    else if (ch === "'" && inString) {
      if (i + 1 < argsStr.length && argsStr[i + 1] === "'") i++;
      else inString = false;
    } else if (inString) {
      // teken binnen een string
    } else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      args.push(argsStr.slice(segStart, i).trim());
      segStart = i + 1;
    }
  }
  const tail = argsStr.slice(segStart).trim();
  if (tail) args.push(tail);
  return args;
}

/** Commentaar buiten strings weghalen (zelden: alleen als er `/*` in de argumenten staat). */
function stripComments(text: string): string {
  if (text.indexOf('/*') < 0) return text;
  let out = '';
  let from = 0;
  for (let i = 0; i < text.length;) {
    const c = text.charCodeAt(i);
    if (c === CH_QUOTE) {
      let j = i + 1;
      for (; j < text.length; j++) {
        if (text.charCodeAt(j) !== CH_QUOTE) continue;
        if (text.charCodeAt(j + 1) === CH_QUOTE) { j++; continue; }
        break;
      }
      i = j + 1;
      continue;
    }
    if (c === CH_SLASH && text.charCodeAt(i + 1) === CH_STAR) {
      out += text.slice(from, i);
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
      from = i;
      continue;
    }
    i++;
  }
  return out + text.slice(from);
}

/** Waarom de scanner invoer weigert. Dezelfde regels als `scripts/proef/classify-v9.py` (ontwerp v18). */
export type StepScanReason =
  /** Geen `ISO-10303-21;` als eerste statement, of geen `HEADER;` direct erna. */
  | 'geen-kop'
  /** Het laatste statement is niet `END-ISO-10303-21;`. */
  | 'geen-einde'
  | 'tekst-zonder-einde'
  | 'commentaar-zonder-einde'
  /** Tekst na de laatste `;` die geen witruimte of commentaar is. */
  | 'statement-zonder-puntkomma'
  /** HEADER of DATA zonder ENDSEC, of een statement buiten een sectie. */
  | 'sectievolgorde'
  /** Een statement dat in deze sectie niet past (geen entiteit in DATA, geen kopentiteit in HEADER). */
  | 'onbekend-statement'
  | 'dubbel-id'
  | 'geen-entiteiten';

/** Ongeschikte of onvolledige STEP-invoer. `at` is de byte-positie van het statement, of -1. */
export class StepScanError extends Error {
  readonly reason: StepScanReason;
  readonly at: number;
  constructor(reason: StepScanReason, message: string, at = -1) {
    super(message);
    this.name = 'StepScanError';
    this.reason = reason;
    this.at = at;
    Object.setPrototypeOf(this, StepScanError.prototype);
  }
}

/** Einde van tekst of commentaar vanaf `i` (zoals `skipQuotedOrComment`), maar gooit als het niet afgesloten is.
 *  -1 als `i` niet op tekst of commentaar staat. */
function skipQuotedOrCommentStrict(b: Uint8Array, i: number): number {
  const n = b.length;
  const c = b[i];
  if (c === CH_QUOTE) {
    for (let j = i + 1; j < n; j++) {
      if (b[j] !== CH_QUOTE) continue;
      if (b[j + 1] === CH_QUOTE) { j++; continue; }
      return j + 1;
    }
    throw new StepScanError('tekst-zonder-einde', 'Tekst zonder einde.', i);
  }
  if (c === CH_SLASH && b[i + 1] === CH_STAR) {
    for (let j = i + 2; j + 1 < n; j++) {
      if (b[j] === CH_STAR && b[j + 1] === CH_SLASH) return j + 2;
    }
    throw new StepScanError('commentaar-zonder-einde', 'Commentaar zonder einde.', i);
  }
  return -1;
}
/** Witruimte en commentaar overslaan; gooit bij commentaar zonder einde. */
function skipBlankStrict(b: Uint8Array, i: number): number {
  const n = b.length;
  for (;;) {
    while (i < n && isSpace(b[i])) i++;
    if (b[i] === CH_SLASH && b[i + 1] === CH_STAR) { i = skipQuotedOrCommentStrict(b, i); continue; }
    return i;
  }
}

const S_BEGIN = 0;   // verwacht ISO-10303-21
const S_HEADER = 1;  // verwacht HEADER
const S_KOP = 2;     // in de HEADER-sectie
const S_TUSSEN = 3;  // tussen secties
const S_DATA = 4;    // in een DATA-sectie
const S_EINDE = 5;   // na END-ISO-10303-21

/**
 * Scan een STEP-bestand. Gooit `StepScanError` bij ongeschikte invoer (zie de kop van dit bestand). De volgorde van
 * de controles is die van `classify-v9.py`, zodat beide dezelfde reden geven: eerst tekst, commentaar en de laatste
 * `;` (over het hele bestand), dan het eerste statement, het laatste, `HEADER`, en de secties in bronvolgorde
 * (met dubbele `#id`'s op hun plek), en tot slot een open sectie en nul entiteiten.
 */
export function scanStep(bytes: Uint8Array): StepIndex {
  const b = bytes;
  const n = b.length;
  const estimate = Math.max(64, Math.floor(n / 60));
  const kind = new IntBuf(estimate);
  const start = new IntBuf(estimate);
  const end = new IntBuf(estimate);
  const entStart = new IntBuf(estimate);
  const typeCode = new IntBuf(estimate);
  const idNum = new IntBuf(estimate);
  const outOff = new IntBuf(estimate + 1);
  const refRaw = new IntBuf(estimate * 3); // doel-`#id`, of -1 als het niet in een Int32 past
  const outArg = new IntBuf(estimate * 3);
  const typeNames: string[] = [''];
  const typeIndex = new Map<string, number>([['', 0]]);

  const pushChunk = (k: number, s: number, e: number, es: number, tc: number, idn: number): number => {
    kind.push(k); start.push(s); end.push(e); entStart.push(es); typeCode.push(tc); idNum.push(idn);
    outOff.push(refRaw.length);
    return kind.length - 1;
  };
  const internType = (from: number, to: number): number => {
    let s = '';
    for (let k = from; k < to; k++) s += String.fromCharCode(b[k]);
    let code = typeIndex.get(s);
    if (code === undefined) {
      code = typeNames.length;
      typeNames.push(s);
      typeIndex.set(s, code);
    }
    return code;
  };
  const complexCode = (() => {
    const code = typeNames.length;
    typeNames.push(COMPLEX_TYPE);
    typeIndex.set(COMPLEX_TYPE, code);
    return code;
  })();

  /** Lees een entiteit `#n=TYPE(…);` of `#n=(A(…)B(…));` vanaf de `#` op `at`. Geeft de index na de `;` terug,
   *  of -1 als het statement die vorm niet heeft (dan bepaalt `statementEnd` het einde en de reden). Schrijft
   *  verwijzingen pas weg als de entiteit compleet is. */
  const pendingRefs: number[] = [];
  const pendingArgs: number[] = [];
  let lastId = -1;
  let lastType = 0;
  const readEntity = (at: number): number => {
    pendingRefs.length = 0; pendingArgs.length = 0;
    let i = at + 1;
    let idValue = 0;
    while (i < n && isDigit(b[i])) {
      idValue = idValue * 10 + (b[i] - 48);
      if (idValue > 0x7fffffff) return -1;
      i++;
    }
    if (i === at + 1 || isWord(b[i])) return -1;
    lastId = idValue;
    i = skipBlank(b, i);
    if (b[i] !== CH_EQ) return -1;
    i = skipBlank(b, i + 1);
    let complex = false;
    if (b[i] === CH_LPAREN) {
      complex = true;
      lastType = complexCode;
    } else {
      const typeStart = i;
      while (i < n && isUpperWord(b[i])) i++;
      if (i === typeStart || isWord(b[i])) return -1;
      lastType = internType(typeStart, i);
      i = skipBlank(b, i);
      if (b[i] !== CH_LPAREN) return -1;
    }
    // Argumenten op haakdiepte; tekst en commentaar overslaan. Bij een complexe instantie tellen de
    // argumenten van de componenten door (component 1: 0..k, component 2: k+1..).
    let depth = 0;
    let arg = 0;
    const argDepth = complex ? 2 : 1;
    let closed = false;
    while (i < n) {
      const c = b[i];
      if (c === CH_QUOTE || c === CH_SLASH) {
        const skip = skipQuotedOrComment(b, i);
        if (skip >= 0) { i = skip; continue; }
      }
      if (c === CH_LPAREN) depth++;
      else if (c === CH_RPAREN) {
        depth--;
        if (complex && depth === 1) arg++;
        if (depth === 0) { i++; closed = true; break; }
      } else if (c === CH_COMMA && depth === argDepth) arg++;
      else if (c === CH_SEMI) return -1; // `;` buiten tekst sluit het statement: haakjes niet in balans
      else if (c === CH_HASH) {
        // Een verwijzing is `#` met cijfers (zoals `#(\d+)` in de voorproef).
        let j = i + 1;
        let refValue = 0;
        while (j < n && isDigit(b[j])) {
          if (refValue <= 0x7fffffff) refValue = refValue * 10 + (b[j] - 48);
          j++;
        }
        if (j > i + 1) {
          pendingRefs.push(refValue > 0x7fffffff ? -1 : refValue);
          pendingArgs.push(arg);
        }
        i = j;
        continue;
      }
      i++;
    }
    if (!closed) return -1;
    i = skipBlank(b, i);
    if (b[i] !== CH_SEMI) return -1;
    return i + 1;
  };

  /** Positie van de `;` die het statement vanaf `from` sluit (buiten tekst en commentaar), of -1 als die er niet
   *  is. Zet `lastSig` op het laatste byte ervóór dat geen witruimte of commentaar is. */
  let lastSig = -1;
  const statementEnd = (from: number): number => {
    lastSig = -1;
    for (let i = from; i < n;) {
      const c = b[i];
      if (c === CH_QUOTE || c === CH_SLASH) {
        const skip = skipQuotedOrCommentStrict(b, i);
        if (skip >= 0) { if (c === CH_QUOTE) lastSig = skip - 1; i = skip; continue; }
      }
      if (c === CH_SEMI) return i;
      if (!isSpace(c)) lastSig = i;
      i++;
    }
    return -1;
  };
  const keywordEnd = (from: number): number => {
    let k = from;
    while (k < n && (isUpperWord(b[k]) || b[k] === 0x2d)) k++;
    return k;
  };
  const keywordIs = (from: number, to: number, word: string): boolean => {
    if (to - from !== word.length) return false;
    for (let k = 0; k < word.length; k++) if (b[from + k] !== word.charCodeAt(k)) return false;
    return true;
  };

  // Uitgestelde fouten, in de rangorde van de voorproef: [0] het eerste statement, [1] HEADER, [2] de eerste fout
  // in de secties. Na de eerste fout zoekt de scanner alleen nog statementgrenzen (tekst, commentaar, laatste `;`,
  // en of het laatste statement END-ISO-10303-21 is).
  let headIssue: StepScanError | undefined;
  let headerIssue: StepScanError | undefined;
  let sectionIssue: StepScanError | undefined;
  let state = S_BEGIN;
  let stateAtEnd = S_BEGIN;
  let statements = 0;
  let lastIsEnd = false;
  let pending = 0;
  let firstData = true;
  let i = 0;
  for (;;) {
    i = skipBlankStrict(b, i);
    if (i >= n) break;
    const st = i;
    statements++;
    const skimming = headIssue !== undefined || headerIssue !== undefined || sectionIssue !== undefined;
    if (!skimming && state === S_DATA && b[i] === CH_HASH) {
      const next = readEntity(i);
      if (next > 0) {
        pushChunk(KIND_ENTITEIT, pending, next, i, lastType, lastId);
        for (let k = 0; k < pendingRefs.length; k++) { refRaw.push(pendingRefs[k]); outArg.push(pendingArgs[k]); }
        pending = next;
        i = next;
        lastIsEnd = false;
        continue;
      }
    }
    const semi = statementEnd(st);
    if (semi < 0) {
      throw new StepScanError('statement-zonder-puntkomma', 'Het laatste statement heeft geen ;.', st);
    }
    const kwEnd = keywordEnd(st);
    const after = skipBlank(b, kwEnd);
    const bare = after === semi;
    const withParams = !bare && b[after] === CH_LPAREN && lastSig >= 0 && b[lastSig] === CH_RPAREN;
    const isEnd = bare && keywordIs(st, kwEnd, 'END-ISO-10303-21');
    lastIsEnd = isEnd;
    i = semi + 1;
    if (skimming) continue;
    const isData = keywordIs(st, kwEnd, 'DATA') && (bare || withParams);
    const isEndsec = bare && keywordIs(st, kwEnd, 'ENDSEC');
    switch (state) {
      case S_BEGIN:
        if (bare && keywordIs(st, kwEnd, 'ISO-10303-21')) state = S_HEADER;
        else headIssue = new StepScanError('geen-kop', 'Geen STEP-kop (ISO-10303-21;).', st);
        break;
      case S_HEADER:
        if (bare && keywordIs(st, kwEnd, 'HEADER')) state = S_KOP;
        else headerIssue = new StepScanError('geen-kop', 'Geen HEADER; na ISO-10303-21;.', st);
        break;
      case S_KOP: {
        if (isEndsec) { state = S_TUSSEN; break; }
        if (isEnd) { stateAtEnd = state; state = S_EINDE; break; }
        if ((bare && keywordIs(st, kwEnd, 'HEADER')) || isData) {
          sectionIssue = new StepScanError('sectievolgorde', 'HEADER zonder ENDSEC.', st);
          break;
        }
        // Kopentiteit: `[A-Z][A-Z0-9_]*\s*\(.*\)`.
        let ok = withParams && b[st] >= 65 && b[st] <= 90;
        for (let k = st; ok && k < kwEnd; k++) if (b[k] === 0x2d) ok = false;
        if (!ok) sectionIssue = new StepScanError('onbekend-statement', 'Onbekend statement in HEADER.', st);
        break;
      }
      case S_TUSSEN:
        if (isData) {
          state = S_DATA;
          if (firstData) {
            pushChunk(KIND_KOP, 0, st, -1, 0, -1);
            pending = st;
            firstData = false;
          }
          pushChunk(KIND_DATA, pending, i, -1, 0, -1);
          pending = i;
        } else if (isEnd) { stateAtEnd = state; state = S_EINDE; }
        else sectionIssue = new StepScanError('sectievolgorde', 'Statement buiten een sectie.', st);
        break;
      case S_DATA:
        if (isEndsec) state = S_TUSSEN;
        else if (isEnd) { stateAtEnd = state; state = S_EINDE; }
        else sectionIssue = new StepScanError('onbekend-statement', 'Onbekend statement in DATA.', st);
        break;
      case S_EINDE:
        // END-ISO-10303-21 was niet het laatste statement: de voorproef behandelt het dan als gewoon statement in
        // de sectie waar het stond.
        sectionIssue = stateAtEnd === S_KOP
          ? new StepScanError('sectievolgorde', 'HEADER zonder ENDSEC.', st)
          : stateAtEnd === S_DATA
            ? new StepScanError('onbekend-statement', 'Onbekend statement in DATA.', st)
            : new StepScanError('sectievolgorde', 'Statement buiten een sectie.', st);
        break;
    }
  }
  if (statements === 0) throw new StepScanError('geen-kop', 'Geen STEP-kop (ISO-10303-21;).');
  if (headIssue) throw headIssue;
  if (!lastIsEnd) throw new StepScanError('geen-einde', 'Geen END-ISO-10303-21;.');
  if (headerIssue) throw headerIssue;
  pushChunk(KIND_STAART, pending, n, -1, 0, -1);
  outOff.push(refRaw.length);

  const total = kind.length;
  const idNumArr = idNum.done();
  // `#id` → stuk. Dicht als de ids compact genoeg zijn, anders een Map. Na een sectiefout leest de scanner geen
  // entiteiten meer, dus een gevonden dubbel `#id` staat altijd vóór die fout (de voorproef meldt de eerste).
  let maxId = 0;
  for (let k = 0; k < total; k++) if (idNumArr[k] > maxId) maxId = idNumArr[k];
  let firstDuplicate = -1;
  let byNum: Int32Array | Map<number, number>;
  if (maxId <= total * 8 + 1024) {
    const t = new Int32Array(maxId + 1).fill(-1);
    for (let k = 0; k < total && firstDuplicate < 0; k++) {
      const v = idNumArr[k];
      if (v < 0) continue;
      if (t[v] >= 0) firstDuplicate = k;
      else t[v] = k;
    }
    byNum = t;
  } else {
    const m = new Map<number, number>();
    for (let k = 0; k < total && firstDuplicate < 0; k++) {
      const v = idNumArr[k];
      if (v < 0) continue;
      if (m.has(v)) firstDuplicate = k;
      else m.set(v, k);
    }
    byNum = m;
  }
  const entStartArr = entStart.done();
  if (firstDuplicate >= 0) {
    throw new StepScanError('dubbel-id', `#${idNumArr[firstDuplicate]} komt twee keer voor.`, entStartArr[firstDuplicate]);
  }
  if (sectionIssue) throw sectionIssue;
  if (state === S_EINDE && stateAtEnd === S_KOP) throw new StepScanError('sectievolgorde', 'HEADER zonder ENDSEC.');
  if (state === S_EINDE && stateAtEnd === S_DATA) throw new StepScanError('sectievolgorde', 'DATA zonder ENDSEC.');
  let entityCount = 0;
  for (let k = 0; k < total; k++) if (idNumArr[k] >= 0) entityCount++;
  if (entityCount === 0) throw new StepScanError('geen-entiteiten', 'Het bestand heeft geen entiteiten.');

  const lookup = (v: number): number => (byNum instanceof Int32Array ? (v < byNum.length ? byNum[v] : -1) : (byNum.get(v) ?? -1));
  const raw = refRaw.done();
  const outTarget = new Int32Array(raw.length);
  let danglingRefCount = 0;
  for (let k = 0; k < raw.length; k++) {
    const v = raw[k];
    const t = v >= 0 ? lookup(v) : -1;
    outTarget[k] = t;
    if (t < 0) danglingRefCount++;
  }
  const outOffArr = outOff.done();
  const outArgArr = outArg.done();

  // Inkomend: tellen, prefixsom, vullen (CSR).
  const inOff = new Int32Array(total + 1);
  for (let k = 0; k < outTarget.length; k++) if (outTarget[k] >= 0) inOff[outTarget[k] + 1]++;
  for (let k = 0; k < total; k++) inOff[k + 1] += inOff[k];
  const fill = inOff.slice(0, total);
  const inSource = new Int32Array(inOff[total]);
  const inArg = new Int32Array(inOff[total]);
  for (let k = 0; k < total; k++) {
    for (let r = outOffArr[k]; r < outOffArr[k + 1]; r++) {
      const t = outTarget[r];
      if (t < 0) continue;
      const at = fill[t]++;
      inSource[at] = k;
      inArg[at] = outArgArr[r];
    }
  }

  let lineEnding: '\r\n' | '\n' = '\n';
  const lf = b.indexOf(CH_LF);
  if (lf > 0 && b[lf - 1] === CH_CR) lineEnding = '\r\n';

  const kindArr = new Uint8Array(total);
  const kinds = kind.done();
  for (let k = 0; k < total; k++) kindArr[k] = kinds[k];

  return new StepIndex({
    bytes: b, kind: kindArr, start: start.done(), end: end.done(), entStart: entStartArr,
    typeCode: typeCode.done(), typeNames, idNum: idNumArr, byNum,
    outOff: outOffArr, outTarget, outArg: outArgArr, inOff, inSource, inArg,
    lineEnding, danglingRefCount,
  });
}
