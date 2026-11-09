/**
 * STEP-scanner op bytes (#804 fase 0, ontwerp "Gebouwmodel behouden" §4.1 en §4.2).
 *
 * Fase 0 is een haalbaarheidsproef: deze module wordt nog nergens in de app aangeroepen. Alleen
 * de poort `tests/planning/check-ifc-foreign-classify.ts` en de meting `scripts/proef/meet-scanner.mjs`
 * gebruiken haar.
 *
 * De scanner knipt een STEP-bestand in **stukken**. Een stuk is een entiteit-instantie van `#` tot en met
 * de `;` die haar afsluit, plus alle tekst ervóór sinds het vorige stuk (witruimte, regeleinden, ook
 * CRLF, en commentaar). De kop (alles vóór `DATA;`), het token `DATA;` zelf en de staart (alles na de
 * laatste entiteit, met `ENDSEC;` en `END-ISO-10303-21;`) zijn aparte stukken. Elk byte van de bron
 * valt in precies één stuk, en de stukken staan in bronvolgorde.
 *
 * De scanner leest bytes (`Uint8Array`): alle STEP-syntaxis is ASCII. Hij decodeert geen tekst die de
 * indeling niet nodig heeft. De index levert per stuk het `#id`, het type (of `(COMPLEX)` voor een
 * complexe instantie `#n=(A(..)B(..));`), de byte-grenzen, de uitgaande `#`-verwijzingen met hun
 * argumentpositie en de inkomende verwijzingen. Daarnaast een klein aantal gedecodeerde velden
 * (zie `StepIndex`), lui en alleen op aanvraag.
 *
 * De regels voor de sectiegrens, quotes (`''`) en commentaar volgen `parseSTEP` in `ifcReader.ts`, zodat
 * scanner en lezer dezelfde entiteiten zien. Bekende verschillen met de lezer: de lezer slaat een
 * complexe instantie over (`readEntity` geeft -1), de scanner maakt er een stuk van.
 */
import { IfcParseError } from '../ifcErrors';
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

/** ASCII-hoofdletterongevoelige match van `token` (in hoofdletters) op positie `i`. */
function startsWithCI(b: Uint8Array, i: number, token: string): boolean {
  if (i + token.length > b.length) return false;
  for (let k = 0; k < token.length; k++) {
    let c = b[i + k];
    if (c >= 0x61 && c <= 0x7a) c -= 0x20;
    if (c !== token.charCodeAt(k)) return false;
  }
  return true;
}

/**
 * Begin van `DATA;`, met dezelfde twee pogingen als `indexOfDataSection` in de lezer: eerst quote- en
 * commentaarbewust, dan regel-verankerd (oude eigen bestanden met een ongebalanceerde apostrof in
 * `FILE_NAME`). -1 als er geen is.
 */
function indexOfDataSection(b: Uint8Array): number {
  for (let i = 0; i < b.length;) {
    const c = b[i];
    if (c === CH_QUOTE || c === CH_SLASH) {
      const skip = skipQuotedOrComment(b, i);
      if (skip >= 0) { i = skip; continue; }
    }
    if ((c === 0x44 || c === 0x64) && startsWithCI(b, i, 'DATA;')) return i;
    i++;
  }
  // Regel-verankerd: begin van de tekst of na een regeleinde, dan spaties/tabs, dan `DATA;`. De lezer
  // gebruikt `/^[ \t]*DATA;/im`; in JavaScript begint een regel ook na `\r`.
  for (let i = 0; i < b.length; i++) {
    if (i !== 0 && b[i - 1] !== CH_LF && b[i - 1] !== CH_CR) continue;
    let j = i;
    while (j < b.length && (b[j] === CH_SPACE || b[j] === CH_TAB)) j++;
    if (startsWithCI(b, j, 'DATA;')) return j;
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
  readonly #idStr: Map<number, string>;
  readonly #byNum: Int32Array | Map<number, number>;
  readonly #byStr: Map<string, number>;
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
  /** Aantal `#id`'s dat twee keer voorkomt (de laatste wint, zoals `entityMap` in de lezer). */
  readonly duplicateIdCount: number;
  /** Aantal verwijzingen naar een `#id` dat niet bestaat. */
  readonly danglingRefCount: number;

  /** @internal Alleen `scanStep` maakt een index. */
  constructor(parts: {
    bytes: Uint8Array; kind: Uint8Array; start: Int32Array; end: Int32Array; entStart: Int32Array;
    typeCode: Int32Array; typeNames: string[]; idNum: Int32Array; idStr: Map<number, string>;
    byNum: Int32Array | Map<number, number>; byStr: Map<string, number>;
    outOff: Int32Array; outTarget: Int32Array; outArg: Int32Array;
    inOff: Int32Array; inSource: Int32Array; inArg: Int32Array;
    lineEnding: '\r\n' | '\n'; duplicateIdCount: number; danglingRefCount: number;
  }) {
    this.#bytes = parts.bytes;
    this.#kind = parts.kind;
    this.#start = parts.start;
    this.#end = parts.end;
    this.#entStart = parts.entStart;
    this.#typeCode = parts.typeCode;
    this.#typeNames = parts.typeNames;
    this.#idNum = parts.idNum;
    this.#idStr = parts.idStr;
    this.#byNum = parts.byNum;
    this.#byStr = parts.byStr;
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
    this.duplicateIdCount = parts.duplicateIdCount;
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
    if (n >= 0) return String(n);
    return this.#idStr.get(i) ?? '';
  }
  /** Het stuk met dit `#id` (zonder `#`), of -1. */
  chunkOf(id: string): number {
    if (/^\d+$/.test(id) && id.length < 10) return this.#lookupNum(Number(id));
    return this.#byStr.get(id) ?? -1;
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
  'count', 'entityCount', 'lineEnding', 'duplicateIdCount', 'danglingRefCount',
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

/**
 * Scan een STEP-bestand. Gooit `IfcParseError('no-data-section')` als er geen `DATA;` is, net als de
 * lezer. Alle andere tekst die geen entiteit is, hoort bij het volgende stuk (of de staart).
 */
export function scanStep(bytes: Uint8Array): StepIndex {
  const b = bytes;
  const n = b.length;
  const dataAt = indexOfDataSection(b);
  if (dataAt < 0) {
    throw new IfcParseError('no-data-section', "Onleesbaar IFC-bestand: de verplichte 'DATA;'-sectiegrens ontbreekt.");
  }
  const estimate = Math.max(64, Math.floor(n / 60));
  const kind = new IntBuf(estimate);
  const start = new IntBuf(estimate);
  const end = new IntBuf(estimate);
  const entStart = new IntBuf(estimate);
  const typeCode = new IntBuf(estimate);
  const idNum = new IntBuf(estimate);
  const idStr = new Map<number, string>();
  const outOff = new IntBuf(estimate + 1);
  const refRaw = new IntBuf(estimate * 3); // numeriek doel-id, of -2 - index in refStr
  const refStr: string[] = [];
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
    for (let k = from; k < to; k++) {
      let c = b[k];
      if (c >= 0x61 && c <= 0x7a) c -= 0x20;
      s += String.fromCharCode(c);
    }
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

  pushChunk(KIND_KOP, 0, dataAt, -1, 0, -1);
  pushChunk(KIND_DATA, dataAt, dataAt + 5, -1, 0, -1);

  /** Lees een entiteit vanaf de `#` op `at`; geef de index na de `;` terug, of -1. Schrijft verwijzingen
   *  pas weg als de entiteit compleet is. */
  const pendingRefs: number[] = [];
  const pendingArgs: number[] = [];
  const pendingStr: string[] = [];
  let lastId = -1;
  let lastIdStr = '';
  let lastType = 0;
  const readEntity = (at: number): number => {
    pendingRefs.length = 0; pendingArgs.length = 0; pendingStr.length = 0;
    let i = at + 1;
    const idStart = i;
    let numeric = true;
    let idValue = 0;
    while (i < n && isWord(b[i])) {
      const c = b[i];
      if (c >= 48 && c <= 57 && numeric && idValue < 0x0ccccccc) idValue = idValue * 10 + (c - 48);
      else numeric = false;
      i++;
    }
    if (i === idStart) return -1;
    if (numeric) { lastId = idValue; lastIdStr = ''; } else {
      lastId = -1;
      lastIdStr = '';
      for (let k = idStart; k < i; k++) lastIdStr += String.fromCharCode(b[k]);
    }
    i = skipBlank(b, i);
    if (b[i] !== CH_EQ) return -1;
    i = skipBlank(b, i + 1);
    let complex = false;
    if (b[i] === CH_LPAREN) {
      complex = true;
      lastType = complexCode;
    } else {
      const typeStart = i;
      while (i < n && isWord(b[i])) i++;
      if (i === typeStart) return -1;
      lastType = internType(typeStart, i);
      i = skipBlank(b, i);
      if (b[i] !== CH_LPAREN) return -1;
    }
    // Argumenten op haakdiepte; strings en commentaar overslaan. Bij een complexe instantie tellen de
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
      else if (c === CH_HASH && depth >= 1) {
        let j = i + 1;
        let refNumeric = true;
        let refValue = 0;
        while (j < n && isWord(b[j])) {
          const d = b[j];
          if (d >= 48 && d <= 57 && refNumeric && refValue < 0x0ccccccc) refValue = refValue * 10 + (d - 48);
          else refNumeric = false;
          j++;
        }
        if (j > i + 1) {
          if (refNumeric) pendingRefs.push(refValue);
          else {
            let s = '';
            for (let k = i + 1; k < j; k++) s += String.fromCharCode(b[k]);
            pendingRefs.push(-2 - pendingStr.length);
            pendingStr.push(s);
          }
          pendingArgs.push(arg);
        }
        i = j;
        continue;
      }
      i++;
    }
    if (!closed) return -1;
    // Witruimte en commentaar tussen `)` en `;`.
    i = skipBlank(b, i);
    if (b[i] !== CH_SEMI) return -1;
    return i + 1;
  };

  let pending = dataAt + 5; // begin van het volgende stuk
  for (let i = pending; i < n;) {
    const c = b[i];
    if (c === CH_QUOTE || c === CH_SLASH) {
      const skip = skipQuotedOrComment(b, i);
      if (skip >= 0) { i = skip; continue; }
    }
    if (c === CH_HASH) {
      const next = readEntity(i);
      if (next > 0) {
        const chunk = pushChunk(KIND_ENTITEIT, pending, next, i, lastType, lastId);
        if (lastId < 0) idStr.set(chunk, lastIdStr);
        for (let k = 0; k < pendingRefs.length; k++) {
          const r = pendingRefs[k];
          if (r <= -2) {
            refRaw.push(-2 - refStr.length);
            refStr.push(pendingStr[-2 - r]);
          } else refRaw.push(r);
          outArg.push(pendingArgs[k]);
        }
        pending = next;
        i = next;
        continue;
      }
      i++;
      continue;
    }
    // `ENDSEC;` op codeniveau sluit de datasectie (zelfde test als `parseSTEP`: hoofdletters).
    if (c === 0x45 && b[i + 1] === 0x4e && b[i + 2] === 0x44 && b[i + 3] === 0x53 && b[i + 4] === 0x45
      && b[i + 5] === 0x43 && b[i + 6] === CH_SEMI) {
      break;
    }
    i++;
  }
  pushChunk(KIND_STAART, pending, n, -1, 0, -1);
  outOff.push(refRaw.length);

  const count = kind.length;
  const idNumArr = idNum.done();
  // `#id` → stuk. Dicht als de ids compact genoeg zijn, anders een Map.
  let maxId = 0;
  for (let i = 0; i < count; i++) if (idNumArr[i] > maxId) maxId = idNumArr[i];
  let duplicateIdCount = 0;
  let byNum: Int32Array | Map<number, number>;
  if (maxId <= count * 8 + 1024) {
    const t = new Int32Array(maxId + 1).fill(-1);
    for (let i = 0; i < count; i++) {
      const v = idNumArr[i];
      if (v < 0) continue;
      if (t[v] >= 0) duplicateIdCount++;
      t[v] = i;
    }
    byNum = t;
  } else {
    const m = new Map<number, number>();
    for (let i = 0; i < count; i++) {
      const v = idNumArr[i];
      if (v < 0) continue;
      if (m.has(v)) duplicateIdCount++;
      m.set(v, i);
    }
    byNum = m;
  }
  const byStr = new Map<string, number>();
  for (const [chunk, s] of idStr) {
    if (byStr.has(s)) duplicateIdCount++;
    byStr.set(s, chunk);
  }
  const lookup = (v: number): number => (byNum instanceof Int32Array ? (v < byNum.length ? byNum[v] : -1) : (byNum.get(v) ?? -1));

  const raw = refRaw.done();
  const outTarget = new Int32Array(raw.length);
  let danglingRefCount = 0;
  for (let k = 0; k < raw.length; k++) {
    const v = raw[k];
    const t = v >= 0 ? lookup(v) : (byStr.get(refStr[-2 - v]) ?? -1);
    outTarget[k] = t;
    if (t < 0) danglingRefCount++;
  }
  const outOffArr = outOff.done();
  const outArgArr = outArg.done();

  // Inkomend: tellen, prefixsom, vullen (CSR).
  const inOff = new Int32Array(count + 1);
  for (let k = 0; k < outTarget.length; k++) if (outTarget[k] >= 0) inOff[outTarget[k] + 1]++;
  for (let i = 0; i < count; i++) inOff[i + 1] += inOff[i];
  const fill = inOff.slice(0, count);
  const inSource = new Int32Array(inOff[count]);
  const inArg = new Int32Array(inOff[count]);
  for (let i = 0; i < count; i++) {
    for (let k = outOffArr[i]; k < outOffArr[i + 1]; k++) {
      const t = outTarget[k];
      if (t < 0) continue;
      const at = fill[t]++;
      inSource[at] = i;
      inArg[at] = outArgArr[k];
    }
  }

  let lineEnding: '\r\n' | '\n' = '\n';
  const lf = b.indexOf(CH_LF);
  if (lf > 0 && b[lf - 1] === CH_CR) lineEnding = '\r\n';

  const kindArr = new Uint8Array(count);
  const kinds = kind.done();
  for (let i = 0; i < count; i++) kindArr[i] = kinds[i];

  return new StepIndex({
    bytes: b, kind: kindArr, start: start.done(), end: end.done(), entStart: entStart.done(),
    typeCode: typeCode.done(), typeNames, idNum: idNumArr, idStr, byNum, byStr,
    outOff: outOffArr, outTarget, outArg: outArgArr, inOff, inSource, inArg,
    lineEnding, duplicateIdCount, danglingRefCount,
  });
}
