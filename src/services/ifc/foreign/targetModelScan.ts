// Bevat een bestaand doel van Opslaan als, een export of AutoSave een gebouwmodel (#804 fase 1a, fixronde 2)? Besluit
// Trias (wrakko, 9 november 2026): de app controleert het gekozen bestaande doel zelf. Is het een IFC met een
// `IfcProduct` of `IfcTypeProduct` (dezelfde ingecheckte type-inventaris als de modelweigering bij openen,
// `IFC_BUILDING_MODEL_TYPES`), dan schrijft de app niet. Zo is ook een gewijzigde modelversie, of een modelbestand dat
// niet open is, beschermd.
//
// De lezer werkt als stroom: hij leest het bestand in stukken en stopt bij de eerste modelentiteit. Een groot bestand
// zonder model leest hij helemaal, maar houdt het nooit helemaal in het geheugen. Hij kijkt, zoals de lezer bij openen,
// naar entiteittypen en nooit naar tekst: een naam in een string of commentaar telt niet.
//
// Alleen een IFC telt: de STEP-kop `ISO-10303-21;` met een IFC-schema in `FILE_SCHEMA`. Een ander bestand (CSV, XML,
// een andere STEP-toepassing) valt erbuiten. IFCX (JSON) leest de app nog niet; dat komt erbij zodra de app IFCX leest.
import { IFC_BUILDING_MODEL_TYPES } from '../ifcBuildingModelTypes';

/** Uitkomst van de controle: een IFC met een gebouwmodel, een IFC zonder, of geen IFC. */
export type TargetModelScan = 'model' | 'no-model' | 'not-ifc';

const QUOTE = 0x27; // '
const SLASH = 0x2f; // /
const STAR = 0x2a; // *
const SEMI = 0x3b; // ;
const OPEN = 0x28; // (
const HEAD_MAX = 96;
const BOM = [0xef, 0xbb, 0xbf];
// FNV-1a over het type in de kop. Een tabel van de laagste 16 bits van de hash van elk modeltype: alleen bij een treffer
// maakt de lezer een string van het type en kijkt hij in `IFC_BUILDING_MODEL_TYPES`. Zo kost een gewone entiteit geen
// string (een groot bestand zonder model heeft er miljoenen).
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MODEL_HASH = new Uint8Array(1 << 16);
for (const type of IFC_BUILDING_MODEL_TYPES) {
  let h = FNV_OFFSET;
  for (let k = 0; k < type.length; k++) h = Math.imul(h ^ type.charCodeAt(k), FNV_PRIME);
  MODEL_HASH[h & 0xffff] = 1;
}
/** Zoveel bytes mag de kop hoogstens zijn voordat `DATA;` komt; een echte kop is een paar honderd bytes. */
const HEADER_MAX = 1 << 20;

const enum Mode { Code, Str, StrQuote, Slash, Comment, CommentStar }

/**
 * Een STEP-lezer per byte, met de toestand tussen de stukken: in een string (`''` is een aanhalingsteken), in
 * commentaar (`/* … *\/`), of in code. In code houdt hij de kop van elk statement bij (tekens tot de eerste `(` of
 * `;`, zonder spaties): `ISO-10303-21`, `FILE_SCHEMA`, `DATA`, of `#<id>=<TYPE>`.
 */
export class TargetModelScanner {
  private mode = Mode.Code;
  private readonly head = new Uint8Array(HEAD_MAX);
  private headLength = 0;
  /** Plaats van de eerste `=` in de kop (`#<id>=`), en de hash van wat erna komt (het type). */
  private eqAt = -1;
  private typeHash = FNV_OFFSET;
  /** Na de eerste `(` of na een te lange kop: wachten op `;`. */
  private inBody = false;
  private statements = 0;
  private schemaWanted = false;
  private schema: string[] | null = null;
  private schemaText = '';
  private inData = false;
  private seen = 0;
  private bom = 0;
  private result: TargetModelScan | null = null;

  /** De uitkomst zodra die vaststaat (dan kan de lezer stoppen), anders `null`. */
  get done(): TargetModelScan | null { return this.result; }

  /** Lees het volgende stuk. Geeft de uitkomst als die vaststaat. */
  push(chunk: Uint8Array): TargetModelScan | null {
    if (this.result) return this.result;
    const n = chunk.length;
    let i = 0;
    // UTF-8-BOM vooraan overslaan, ook als hij over stukken verdeeld is (alles tot nu toe was BOM).
    while (this.bom < 3 && this.seen + i === this.bom && i < n && chunk[i] === BOM[this.bom]) { i++; this.bom++; }
    while (i < n) {
      // Snelle paden: deze bytes doen in `step` niets, dus de lus slaat ze over zonder functieaanroep. Een groot
      // bestand zonder model bestaat vooral uit argumenten van entiteiten en strings.
      const mode = this.mode;
      if (mode === Mode.Code && this.inBody) {
        // Argumenten: alleen een string, commentaar of het einde van het statement telt.
        while (i < n) {
          const b = chunk[i];
          if (b === QUOTE || b === SLASH || b === SEMI) break;
          i++;
        }
        if (i === n) break;
      } else if (mode === Mode.Code) {
        // De kop: tekens tot `(`, `;`, een string of commentaar.
        while (i < n) {
          const b = chunk[i];
          if (b === QUOTE || b === SLASH || b === SEMI || b === OPEN) break;
          i++;
          if (b > 0x20) { this.pushHead(b); if (this.inBody) break; }
        }
        if (i === n || this.inBody) continue;
      } else if ((mode === Mode.Str && !this.schemaWanted) || mode === Mode.Comment) {
        const j = chunk.indexOf(mode === Mode.Str ? QUOTE : STAR, i);
        if (j < 0) break;
        i = j;
      }
      this.step(chunk[i++]);
      if (this.result) return this.result;
    }
    this.seen += n;
    if (!this.inData && this.seen > HEADER_MAX) this.result = 'not-ifc';
    return this.result;
  }

  /** Eén byte, in de toestand van nu. */
  private step(b: number): void {
    switch (this.mode) {
      case Mode.Str:
        if (b === QUOTE) this.mode = Mode.StrQuote;
        else if (this.schemaWanted) this.schemaText += String.fromCharCode(b);
        return;
      case Mode.StrQuote:
        if (b === QUOTE) { this.mode = Mode.Str; if (this.schemaWanted) this.schemaText += "'"; return; }
        // Einde van de string.
        if (this.schemaWanted) { (this.schema ??= []).push(this.schemaText); this.schemaText = ''; }
        this.mode = Mode.Code;
        break; // dit byte is weer code
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

  /** Het einde van het bestand. */
  end(): TargetModelScan {
    this.result ??= this.statements > 0 && this.isIfc() ? 'no-model' : 'not-ifc';
    return this.result;
  }

  private isIfc(): boolean {
    return (this.schema ?? []).some(s => /^IFC/i.test(s.trim()));
  }

  /** Eén byte code (buiten strings en commentaar). */
  private code(b: number): void {
    if (b === SEMI) { this.endStatement(); return; }
    if (this.inBody) return;
    if (b === OPEN) { this.openStatement(); return; }
    if (b <= 0x20) return; // witruimte telt niet in de kop
    this.pushHead(b);
  }

  /** Eén teken van de kop, in hoofdletters. Een te lange kop is geen modeltype: dan wachten op `;`. */
  private pushHead(b: number): void {
    if (this.headLength === HEAD_MAX) { this.inBody = true; return; }
    const u = b >= 0x61 && b <= 0x7a ? b - 0x20 : b;
    if (this.eqAt >= 0) this.typeHash = Math.imul(this.typeHash ^ u, FNV_PRIME);
    else if (u === 0x3d) this.eqAt = this.headLength;
    this.head[this.headLength++] = u;
  }

  private headText(from = 0): string {
    return String.fromCharCode.apply(null, this.head.subarray(from, this.headLength) as unknown as number[]);
  }

  private openStatement(): void {
    this.inBody = true;
    if (this.inData) {
      // `#<id>=<TYPE>(`: het type van de entiteit.
      if (this.head[0] !== 0x23 || this.eqAt <= 0 || MODEL_HASH[this.typeHash & 0xffff] === 0) return;
      if (IFC_BUILDING_MODEL_TYPES.has(this.headText(this.eqAt + 1))) this.result = 'model';
      return;
    }
    if (this.statements === 0) { this.result = 'not-ifc'; return; } // de eerste regel moet `ISO-10303-21;` zijn
    this.schemaWanted = this.headText() === 'FILE_SCHEMA';
  }

  private endStatement(): void {
    const head = this.inBody ? '' : this.headText();
    if (this.statements === 0 && head !== 'ISO-10303-21') { this.result = 'not-ifc'; return; }
    if (!this.inData && head === 'DATA') {
      // Vanaf hier entiteiten; zonder IFC-schema in de kop is het geen IFC.
      if (!this.isIfc()) { this.result = 'not-ifc'; return; }
      this.inData = true;
    }
    this.statements++;
    this.schemaWanted = false;
    this.headLength = 0;
    this.eqAt = -1;
    this.typeHash = FNV_OFFSET;
    this.inBody = false;
  }
}

/** Lees `chunks` tot de uitkomst vaststaat; stopt bij de eerste modelentiteit. `cancel` sluit de bron af. */
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
