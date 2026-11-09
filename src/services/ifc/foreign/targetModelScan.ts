// Bevat een bestaand doel van Opslaan als, een export of AutoSave een gebouwmodel (#804 fase 1a, fixronde 2 en 3)? Besluit
// Trias (wrakko, 9 november 2026): de app controleert het gekozen bestaande doel zelf. Is het een IFC met een
// `IfcProduct` of `IfcTypeProduct` (dezelfde ingecheckte type-inventaris als de modelweigering bij openen,
// `IFC_BUILDING_MODEL_TYPES`), dan schrijft de app niet. Zo is ook een gewijzigde modelversie, of een modelbestand dat
// niet open is, beschermd.
//
// De uitkomst en wat hij betekent (fixronde 3: een scan zonder uitkomst is geen vrijbrief):
//  - 'model': een entiteit met een modeltype, ook als deel van een complexe instantie `#n=(A(…)B(…));`. Niet schrijven.
//  - 'no-model': het eerste statement (na een BOM, witruimte en commentaar) is `ISO-10303-21;`, en de lezer las het HELE
//    bestand zonder modelentiteit. Schrijven mag.
//  - 'not-ifc': het eerste statement is geen `ISO-10303-21;` (CSV, XML, JSON, een leeg bestand). Schrijven mag. IFCX
//    (JSON) leest de app nog niet; dat komt erbij zodra de app IFCX leest.
// Een andere uitkomst bestaat niet: 'no-model' komt alleen uit `end()`, aan het einde van het bestand. Er is geen grens
// op de kop of het commentaar; per statement houdt de lezer hoogstens `HEAD_MAX` bytes vast. Stopt het lezen vóór het
// einde (een leesfout), dan is er geen uitkomst; de aanroeper telt dat als "niet leesbaar".
//
// Het schema in `FILE_SCHEMA` telt niet: een STEP-bestand met een modeltype is een model, ook met een ander of geen
// schema. Wat `readIFC` bij openen als model weigert, weigert deze lezer dus ook (`check-ifc-target-model-scan.ts`).
//
// Twee lezers op dezelfde bytes:
//  1. per statement, met strings (`''` is een aanhalingsteken) en commentaar (`/* … */`): de kop `#<id>=<TYPE>(`, of de
//     deeltypen van een complexe instantie. Dit is de precieze lezer: een typenaam in een string of commentaar telt niet.
//  2. per regel, los van strings en commentaar: een regel die begint met `#<id>=<TYPE>(`. Die vangt een bestand waarin de
//     aanhalingstekens niet kloppen (een ongebalanceerde apostrof in de kop, die `readIFC` toestaat): lezer 1 ziet daar
//     code als string. Zo'n regel binnen een string van meer regels telt ook als model; dat weigert hooguit te veel.
// De lezer stopt bij de eerste modelentiteit. Een groot bestand zonder model leest hij helemaal, maar als stroom.
import { IFC_BUILDING_MODEL_TYPES } from '../ifcBuildingModelTypes';

/** Uitkomst van de controle; zie de kop van dit bestand voor de betekenis. */
export type TargetModelScan = 'model' | 'no-model' | 'not-ifc';

const QUOTE = 0x27; // '
const SLASH = 0x2f; // /
const STAR = 0x2a; // *
const SEMI = 0x3b; // ;
const OPEN = 0x28; // (
const CLOSE = 0x29; // )
const HASH = 0x23; // #
const EQ = 0x3d; // =
const NL = 0x0a;
/** Zoveel bytes van een kop of een type houdt de lezer vast; elk modeltype is korter. */
const HEAD_MAX = 96;
const BOM = [0xef, 0xbb, 0xbf];
const ISO = 'ISO-10303-21';
// FNV-1a over het type. Een tabel van de laagste 16 bits van de hash van elk modeltype: alleen bij een treffer maakt de
// lezer een string van het type en kijkt hij in `IFC_BUILDING_MODEL_TYPES`. Zo kost een gewone entiteit geen string (een
// groot bestand zonder model heeft er miljoenen).
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MODEL_HASH = new Uint8Array(1 << 16);
for (const type of IFC_BUILDING_MODEL_TYPES) {
  let h = FNV_OFFSET;
  for (let k = 0; k < type.length; k++) h = Math.imul(h ^ type.charCodeAt(k), FNV_PRIME);
  MODEL_HASH[h & 0xffff] = 1;
}

const upper = (b: number) => (b >= 0x61 && b <= 0x7a ? b - 0x20 : b);
const isWord = (b: number) => (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x5f;
const isBlank = (b: number) => b === 0x20 || b === 0x09 || b === 0x0d;
const text = (buf: Uint8Array, length: number) => String.fromCharCode.apply(null, buf.subarray(0, length) as unknown as number[]);

/** Is het type (`length` bytes in `buf`, met hash `hash`) een modeltype? Een te lang type is het nooit. */
function isModelType(buf: Uint8Array, length: number, hash: number): boolean {
  if (length === 0 || length > HEAD_MAX || MODEL_HASH[hash & 0xffff] === 0) return false;
  return IFC_BUILDING_MODEL_TYPES.has(text(buf, length));
}

const enum Mode { Code, Str, StrQuote, Slash, Comment, CommentStar }
/** Lezer 2, per regel: vooraan (witruimte), in het id, na `=`, in het type, na het type, of de rest van de regel. */
const enum Line { Start, Id, Eq, Type, AfterType, Rest }

export class TargetModelScanner {
  private seen = 0;
  private bom = 0;
  private result: TargetModelScan | null = null;
  // ── Lezer 1: per statement ──
  private mode = Mode.Code;
  private statements = 0;
  /** De kop van het statement (een woord als `ISO-10303-21`) of, na `#<id>=`, het type; hoofdletters, zonder witruimte. */
  private readonly head = new Uint8Array(HEAD_MAX);
  /** Aantal bytes van kop of type; kan groter zijn dan `HEAD_MAX` (dan is het geen modeltype en niet `ISO-10303-21`). */
  private headLength = 0;
  private headStarted = false;
  /** De kop begint met `#`: een entiteit. Het id zelf houdt de lezer niet vast, dus een lang id is geen omweg. */
  private entity = false;
  private sawEq = false;
  private typeHash = FNV_OFFSET;
  /** Na de eerste `(`: wachten op `;`. */
  private inBody = false;
  /** In een complexe instantie: de diepte van de haakjes (1 = tussen de deelrecords). */
  private complexDepth = 0;
  // ── Lezer 2: per regel ──
  private line = Line.Start;
  private readonly lineType = new Uint8Array(HEAD_MAX);
  private lineLength = 0;
  private lineHash = FNV_OFFSET;

  /** De uitkomst zodra die vaststaat (dan kan de lezer stoppen), anders `null`. */
  get done(): TargetModelScan | null { return this.result; }

  /** Lees het volgende stuk. Geeft 'model' of 'not-ifc' zodra dat vaststaat; 'no-model' pas bij `end()`. */
  push(chunk: Uint8Array): TargetModelScan | null {
    if (this.result) return this.result;
    const n = chunk.length;
    let i = 0;
    // UTF-8-BOM vooraan overslaan, ook als hij over stukken verdeeld is (alles tot nu toe was BOM).
    while (this.bom < 3 && this.seen + i === this.bom && i < n && chunk[i] === BOM[this.bom]) { i++; this.bom++; }
    this.statementPass(chunk, i);
    // Lezer 2 telt pas na een geldig eerste statement: een bestand dat geen STEP is, blijft 'not-ifc'. Vóór dat
    // statement houdt hij alleen bij waar een regel begint.
    if (!this.result) this.linePass(chunk, i, this.statements > 0);
    this.seen += n;
    return this.result;
  }

  /** Het einde van het bestand: alles is gelezen. */
  end(): TargetModelScan {
    this.result ??= this.statements > 0 ? 'no-model' : 'not-ifc';
    return this.result;
  }

  // ── Lezer 1 ────────────────────────────────────────────────────────────────────────────────────────────────────

  private statementPass(chunk: Uint8Array, start: number): void {
    const n = chunk.length;
    let i = start;
    while (i < n) {
      // Snelle paden: deze bytes doen in `step` niets, dus de lus slaat ze over zonder functieaanroep. Een groot bestand
      // zonder model bestaat vooral uit argumenten van entiteiten en strings.
      const mode = this.mode;
      if (mode === Mode.Code && this.inBody && this.complexDepth === 0) {
        // Argumenten: alleen een string, commentaar of het einde van het statement telt.
        while (i < n) {
          const b = chunk[i];
          if (b === QUOTE || b === SLASH || b === SEMI) break;
          i++;
        }
        if (i === n) break;
      } else if (mode === Mode.Code && !this.inBody) {
        // De kop: tekens tot `(`, `;`, een string of commentaar.
        while (i < n) {
          const b = chunk[i];
          if (b === QUOTE || b === SLASH || b === SEMI || b === OPEN) break;
          i++;
          if (b > 0x20) this.pushHead(b);
        }
        if (i === n) break;
      } else if (mode === Mode.Str || mode === Mode.Comment) {
        const j = chunk.indexOf(mode === Mode.Str ? QUOTE : STAR, i);
        if (j < 0) break;
        i = j;
      }
      this.step(chunk[i++]);
      if (this.result) return;
    }
  }

  /** Eén byte, in de toestand van nu. */
  private step(b: number): void {
    switch (this.mode) {
      case Mode.Str:
        if (b === QUOTE) this.mode = Mode.StrQuote;
        return;
      case Mode.StrQuote:
        if (b === QUOTE) { this.mode = Mode.Str; return; } // `''` is een aanhalingsteken in de string
        this.mode = Mode.Code;
        break; // einde van de string: dit byte is weer code
      case Mode.Slash:
        if (b === STAR) { this.mode = Mode.Comment; return; }
        this.mode = Mode.Code;
        this.code(SLASH);
        if (this.result) return;
        break;
      case Mode.Comment:
        if (b === STAR) this.mode = Mode.CommentStar;
        return;
      case Mode.CommentStar:
        if (b === SLASH) this.mode = Mode.Code;
        else if (b !== STAR) this.mode = Mode.Comment;
        return;
      case Mode.Code:
        break;
    }
    if (b === QUOTE) { this.mode = Mode.Str; return; }
    if (b === SLASH) { this.mode = Mode.Slash; return; }
    this.code(b);
  }

  /** Eén byte code (buiten strings en commentaar). */
  private code(b: number): void {
    if (b === SEMI) { this.endStatement(); return; }
    if (this.complexDepth > 0) { this.complexByte(b); return; }
    if (this.inBody) return;
    if (b === OPEN) { this.openStatement(); return; }
    if (b <= 0x20) return; // witruimte telt niet in de kop
    this.pushHead(b);
  }

  /** Eén teken van de kop. Van een entiteit houdt de lezer alleen het type vast (na de eerste `=`). */
  private pushHead(b: number): void {
    const u = upper(b);
    if (!this.headStarted) {
      this.headStarted = true;
      if (u === HASH) { this.entity = true; return; }
    }
    if (this.entity) {
      if (!this.sawEq) { if (u === EQ) this.sawEq = true; return; }
      this.pushType(u);
      return;
    }
    if (this.headLength < HEAD_MAX) this.head[this.headLength] = u;
    this.headLength++;
  }

  private pushType(u: number): void {
    this.typeHash = Math.imul(this.typeHash ^ u, FNV_PRIME);
    if (this.headLength < HEAD_MAX) this.head[this.headLength] = u;
    this.headLength++;
  }

  private resetType(): void {
    this.headLength = 0;
    this.typeHash = FNV_OFFSET;
  }

  private checkType(): void {
    if (isModelType(this.head, this.headLength, this.typeHash)) this.result = 'model';
  }

  private openStatement(): void {
    this.inBody = true;
    if (this.statements === 0) { this.result = 'not-ifc'; return; } // het eerste statement moet `ISO-10303-21;` zijn
    if (!this.entity || !this.sawEq) return;
    if (this.headLength === 0) {
      // `#<id>=(`: een complexe instantie; de deelrecords `A(…)B(…)` volgen.
      this.complexDepth = 1;
      return;
    }
    this.checkType();
  }

  /** Een byte code binnen een complexe instantie: de naam van elk deelrecord, op diepte 1. */
  private complexByte(b: number): void {
    if (b === OPEN) {
      if (this.complexDepth === 1) {
        this.checkType();
        this.resetType();
      }
      this.complexDepth++;
      return;
    }
    if (b === CLOSE) {
      this.complexDepth--;
      if (this.complexDepth <= 1) this.resetType();
      return;
    }
    if (this.complexDepth === 1 && b > 0x20) this.pushType(upper(b));
  }

  private endStatement(): void {
    if (this.statements === 0) {
      const iso = !this.entity && !this.inBody && this.headLength === ISO.length && text(this.head, ISO.length) === ISO;
      if (!iso) { this.result = 'not-ifc'; return; }
    }
    this.statements++;
    this.headLength = 0;
    this.headStarted = false;
    this.entity = false;
    this.sawEq = false;
    this.typeHash = FNV_OFFSET;
    this.inBody = false;
    this.complexDepth = 0;
  }

  // ── Lezer 2 ────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Elke regel die begint met `#<id>=<TYPE>(`, los van strings en commentaar. `count` = false: alleen bijhouden. */
  private linePass(chunk: Uint8Array, start: number, count: boolean): void {
    const n = chunk.length;
    let i = start;
    let line = this.line;
    let length = this.lineLength;
    let hash = this.lineHash;
    while (i < n) {
      if (line === Line.Rest) {
        const j = chunk.indexOf(NL, i);
        if (j < 0) break;
        i = j + 1;
        line = Line.Start;
        continue;
      }
      const b = chunk[i++];
      if (b === NL) { line = Line.Start; continue; }
      if (line === Line.Start) {
        if (b === HASH) line = Line.Id;
        else if (!isBlank(b)) line = Line.Rest;
      } else if (line === Line.Id) {
        if (b === EQ) { line = Line.Eq; length = 0; hash = FNV_OFFSET; }
        else if (!isWord(b) && !isBlank(b)) line = Line.Rest;
      } else if (isWord(b) && (line === Line.Eq || line === Line.Type)) {
        const u = upper(b);
        hash = Math.imul(hash ^ u, FNV_PRIME);
        if (length < HEAD_MAX) this.lineType[length] = u;
        length++;
        line = Line.Type;
      } else if (isBlank(b)) {
        if (line === Line.Type) line = Line.AfterType;
      } else if (b === OPEN && (line === Line.Type || line === Line.AfterType)) {
        if (count && isModelType(this.lineType, length, hash)) { this.result = 'model'; return; }
        line = Line.Rest;
      } else {
        line = Line.Rest;
      }
    }
    this.line = line;
    this.lineLength = length;
    this.lineHash = hash;
  }
}

/** Lees `chunks` tot de uitkomst vaststaat; stopt bij de eerste modelentiteit. `cancel` sluit de bron af. Een leesfout
 *  gaat door naar de aanroeper: dan is er geen uitkomst. */
export async function scanTargetChunks(
  next: () => Promise<Uint8Array | null>,
  cancel?: () => Promise<void> | void,
): Promise<TargetModelScan> {
  const scanner = new TargetModelScanner();
  try {
    for (;;) {
      const chunk = await next();
      if (chunk === null) return scanner.end();
      const result = scanner.push(chunk);
      if (result) return result;
    }
  } finally {
    await cancel?.();
  }
}

/** Een `Blob` (de `File` van een FSA-handle) als stroom. */
export function scanTargetBlob(blob: Blob): Promise<TargetModelScan> {
  const reader = blob.stream().getReader();
  return scanTargetChunks(
    async () => { const r = await reader.read(); return r.done ? null : r.value; },
    async () => { try { await reader.cancel(); } catch { /* al dicht */ } },
  );
}

/** Bytes die al in het geheugen staan (bijv. van de site). */
export function scanTargetBytes(bytes: Uint8Array): TargetModelScan {
  const scanner = new TargetModelScanner();
  return scanner.push(bytes) ?? scanner.end();
}
