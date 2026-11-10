// De grammatica van een heel STEP-bestand (ISO 10303-21 editie 3), van `ISO-10303-21;` tot `END-ISO-10303-21;` (#870,
// besluit Trias, wrakko 10 november 2026). `readIFC` en de doelcontrole lezen een bestand alleen volgens hun eigen regels
// als het hele bestand in deze grammatica past. Breekt het bestand, dan opent `readIFC` het precies zoals main, en
// weigert de doelcontrole het schrijven (de regel van #867: bij twijfel weigeren).
//
// Wat de grammatica leest (tabel 3 en §8 tot §11 van de norm):
//   `ISO-10303-21;`
//   `HEADER;` FILE_DESCRIPTION(2 parameters) FILE_NAME(7) FILE_SCHEMA(1) { eigen kopentiteit } `ENDSEC;`
//   [ `ANCHOR;` … `ENDSEC;` ] [ `REFERENCE;` … `ENDSEC;` ]
//   { DATAKOP { entiteit } `ENDSEC;` }
//   `END-ISO-10303-21;`
// - Een kopentiteit is `NAAM ( parameters ) ;`.
// - Een DATAKOP is `DATA ;` of `DATA ( 'naam' , ( 'schema' { , 'schema' } ) ) ;` (§11.1; meer schema's laat de app toe).
// - Een entiteit is `#n = TYPE ( parameters ) ;` of complex: `#n = ( TYPE ( parameters ) { TYPE ( parameters ) } ) ;`.
// - Een parameter is een string, een binaire waarde `"…"`, een URI `<…>`, een getal, een enumeratie `.X.`, `$`, `*`, een
//   verwijzing `#n` of `@n`, een lijst `( … )` of een getypeerde waarde `TYPE ( parameter )`.
// - In een ANCHOR- of REFERENCE-sectie is een statement `<naam> = … ;` of `#n = … ;`; daar telt alleen dat de haakjes
//   kloppen (dezelfde regel als de vinder in `stepDataSection.ts`).
// Tokens, zoals de vinder in `stepDataSection.ts` (één regel voor strings, commentaar en scheiding):
// - Stuurtekens (onder U+0020, en U+007F) vallen overal weg, ook midden in een token of een string (§5.2, §5.6).
// - Een string is `'…'` met `''` als aanhalingsteken, `\\` als backslash, en `\S\` plus één teken (ook `\S\'`, §6.4.3).
//   Elke andere backslash is een gewoon teken: oude eigen bestanden schreven JSON met `\"` letterlijk.
// - Commentaar `/* … */` en de afdrukcodes `\N\` en `\F\` zijn scheiding.
// - Sleutelwoorden lezen hoofdletterongevoelig (alleen ASCII), zoals de app altijd deed.
// - Een niet-ASCII-teken buiten een string past nergens.
//
// De grammatica ziet ook de modeltypes (`IFC_BUILDING_MODEL_TYPES`) als type van een entiteit, ook als deel van een
// complexe instantie. Zo ziet zij een wand die de lexer van `parseSTEP` mist (knownbug 1050), en een wand in een
// tweede datasectie.
//
// De grammatica leest teken voor teken (`step`), zodat een stroom hem in stukken kan voeden. Als UTF-16-tekst
// (`readIFC`) is elk teken een code-eenheid; als UTF-8-bytes (de doelcontrole) is elk teken een byte. Alleen ASCII telt.
import { IFC_BUILDING_MODEL_TYPES } from './ifcBuildingModelTypes';

const QUOTE = 0x27;
const DQUOTE = 0x22;
const SLASH = 0x2f;
const STAR = 0x2a;
const BACKSLASH = 0x5c;
const SPACE = 0x20;
const LT = 0x3c;
const GT = 0x3e;
const SEMI = 0x3b;
const OPEN = 0x28;
const CLOSE = 0x29;
const COMMA = 0x2c;
const EQUALS = 0x3d;
const HASH = 0x23;
const AT = 0x40;
const DOT = 0x2e;
const DOLLAR = 0x24;
const BANG = 0x21;
const PLUS = 0x2b;
const MINUS = 0x2d;
const UNDERSCORE = 0x5f;
const LETTER_E = 0x45;
const LETTER_S = 0x53;
const LETTER_N = 0x4e;
const LETTER_F = 0x46;

const BOM_BYTES = [0xef, 0xbb, 0xbf];
const upper = (c: number) => (c >= 0x61 && c <= 0x7a ? c - 0x20 : c);
const isUpper = (u: number) => (u >= 0x41 && u <= 0x5a) || u === UNDERSCORE;
const isDigit = (u: number) => u >= 0x30 && u <= 0x39;
/** Een teken van een woord: sleutelwoord, getal, enumeratie, `$`, `*`, `#12`, `@3`, `!EIGEN` (zoals de vinder). */
const isWordChar = (u: number) => isUpper(u) || isDigit(u)
  || u === MINUS || u === PLUS || u === DOT || u === DOLLAR || u === STAR || u === HASH || u === AT || u === BANG;

/** Langer is geen token van een geldig bestand; een langer woord breekt de grammatica (de buffer groeit tot hier). */
const WORD_MAX = 1 << 20;
/** Zo diep mogen lijsten en getypeerde waarden in elkaar zitten; dieper breekt de grammatica. */
const DEPTH_MAX = 4096;
/** De verplichte kopentiteiten, in deze volgorde, met hun aantal parameters (§8.1, §8.2). */
const HEADER_ENTITIES: readonly (readonly [string, number])[] = [['FILE_DESCRIPTION', 2], ['FILE_NAME', 7], ['FILE_SCHEMA', 1]];

// FNV-1a over het type. Een tabel van de laagste 16 bits van de hash van elk modeltype: alleen bij een treffer maakt de
// grammatica een string van het type. Zo kost een gewone entiteit geen string.
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MODEL_HASH = new Uint8Array(1 << 16);
for (const type of IFC_BUILDING_MODEL_TYPES) {
  let h = FNV_OFFSET;
  for (let k = 0; k < type.length; k++) h = Math.imul(h ^ type.charCodeAt(k), FNV_PRIME);
  MODEL_HASH[h & 0xffff] = 1;
}

/** Lexicale toestand. */
const enum Lex { Code, Word, Str, StrQuote, StrBack, StrBackS, StrBackSBack, Bin, Uri, Slash, Comment, CommentStar, Back, BackLetter }
/** Waar in het bestand de grammatica is. */
const enum Sec { Start, Pre, Header, Between, Anchor, Data, End }
/** Waar in het statement de grammatica is. */
const enum P {
  /** Begin van een statement. */
  Stmt,
  /** Na een sleutelwoord dat een `;` vraagt (`ISO-10303-21`, `HEADER`, `ENDSEC`, …). */
  Semi,
  /** Na de naam van een kopentiteit: `(`. */
  HeadOpen,
  /** In de parameters van een record (kopentiteit of entiteit). */
  Params,
  /** Na de `)` van een kopentiteit: `;`. */
  HeadSemi,
  /** In de DATAKOP na `DATA`. */
  DataHead,
  /** Na `#n` in een datasectie: `=`. */
  InstEq,
  /** Na `#n =`: een type (enkelvoudig) of `(` (complex). */
  InstVal,
  /** Na het type van een record: `(`. */
  RecOpen,
  /** Na een enkelvoudig record: `;`. */
  SimpleSemi,
  /** In een complexe instantie: het volgende type, of `)`. */
  ComplexNext,
  /** Na de `)` van een complexe instantie: `;`. */
  ComplexSemi,
  /** In een ANCHOR- of REFERENCE-sectie na de naam: `=`. */
  AnchorEq,
  /** In een ANCHOR- of REFERENCE-sectie na `=`: haakjes tot de `;`. */
  AnchorVal,
}
/** In een parameterlijst: wat er na het vorige token mag komen. */
const enum X { ValueOrClose, Value, AfterKeyword, Sep }
/** Soort open haakje in een parameterlijst. */
const enum Ctx { Record, List, Typed }
/** Soort woord. */
const enum W { Keyword, Name, Enum, Number, Dollar, Star, Bad }

/** Uitkomst van de grammatica: nog bezig, het hele bestand past, of het bestand breekt. */
export type StepGrammarState = 'running' | 'valid' | 'failed';

export class StepFileGrammar {
  /** De eerste DATAKOP: de `D` (`dataAt`) en direct na de `;` (`dataEnd`); -1 zolang die er niet is. */
  dataAt = -1;
  dataEnd = -1;
  /** Een entiteit met een modeltype als type (ook als deel van een complexe instantie), vóór het bestand brak. */
  model = false;
  /** Waar het bestand brak (het teken dat niet paste), of -1. */
  failedAt = -1;

  private result: StepGrammarState = 'running';
  private lex = Lex.Code;
  private sec: Sec;
  private p = P.Stmt;
  private x = X.ValueOrClose;
  // ── Het woord dat nu gelezen wordt ──
  private word = new Uint16Array(128);
  private wordLength = 0;
  private wordAt = -1;
  private wordHash = FNV_OFFSET;
  /** De lexer leest een woord na `\` of een `/` die geen commentaar werd: die tekens zijn geen scheiding. */
  private lexBack = Lex.Code;
  // ── Statement ──
  private nextSec = Sec.Start;
  private headerIndex = 0;
  private headerParams = -1;
  private params = 0;
  private stack = new Uint8Array(64);
  private depth = 0;
  private complexParts = 0;
  private dataHeadK = 0;
  private dataHeadAt = -1;
  private anchorDepth = 0;
  // ── BOM ──
  private bom = 0;

  /**
   * `utf8`: de tekens zijn UTF-8-bytes, anders UTF-16-code-eenheden. `fromData`: begin midden in een datasectie, direct
   * na de `;` van de DATAKOP (de route voor een oud eigen bestand met een kapotte kop, `targetModelScan.ts`).
   */
  constructor(private readonly utf8: boolean, fromData = false) {
    this.sec = fromData ? Sec.Data : Sec.Start;
    if (fromData) this.bom = -1;
  }

  get state(): StepGrammarState { return this.result; }
  get failed(): boolean { return this.result === 'failed'; }

  /** Eén teken op positie `at`. Na 'failed' of 'valid' telt niets meer, behalve dat 'valid' na `END-ISO-10303-21;` nog
   *  breekt op iets anders dan scheiding. */
  step(c: number, at: number): void {
    if (this.result === 'failed') return;
    if (this.bom >= 0) {
      // Bytes: de BOM vooraan (EF BB BF) haalt de decoder weg; hij hoort niet bij de tekst. Als tekst heeft de decoder
      // hem al weggehaald: een U+FEFF in de tekst is een tweede BOM, en die past nergens (zoals de bytes EF BB BF erna).
      if (this.utf8 && at === this.bom && c === BOM_BYTES[this.bom]) { if (++this.bom === 3) this.bom = -1; return; }
      if (this.utf8 && this.bom > 0) { this.fail(at); return; } // een half BOM
      this.bom = -1;
    }
    if (c < SPACE || c === 0x7f) return; // stuurtekens vallen weg, vóór elke andere regel (§5.2, §5.6)
    this.lexStep(c, at);
  }

  /** Een hele tekst: hetzelfde als `step` voor elk teken. In een string tellen alleen `'` en `\`, in commentaar alleen
   *  `*`: daar slaat de lus de andere tekens over (ook stuurtekens, die `step` toch weglaat). */
  run(content: string): void {
    const n = content.length;
    for (let i = 0; i < n; i++) {
      if (this.result === 'failed') return;
      if (this.lex === Lex.Str) {
        let c = content.charCodeAt(i);
        while (c !== QUOTE && c !== BACKSLASH && ++i < n) c = content.charCodeAt(i);
        if (i === n) return;
      } else if (this.lex === Lex.Comment) {
        const j = content.indexOf('*', i);
        if (j < 0) return;
        i = j;
      }
      this.step(content.charCodeAt(i), i);
    }
  }

  /** Het einde van de tekst. */
  end(at: number): StepGrammarState {
    if (this.result === 'failed') return this.result;
    if (this.lex === Lex.Word) this.wordDone();
    if (this.failed) return 'failed';
    if (this.sec !== Sec.End || this.p !== P.Stmt || this.lex !== Lex.Code) return this.fail(at);
    this.result = 'valid';
    return this.result;
  }

  private fail(at: number): 'failed' {
    if (this.failedAt < 0) this.failedAt = at;
    this.result = 'failed';
    return 'failed';
  }

  // ── Lexer ──────────────────────────────────────────────────────────────────────────────────────────────────────────

  private lexStep(c: number, at: number): void {
    switch (this.lex) {
      case Lex.Str:
        if (c === QUOTE) this.lex = Lex.StrQuote;
        else if (c === BACKSLASH) this.lex = Lex.StrBack;
        return;
      case Lex.StrQuote:
        if (c === QUOTE) { this.lex = Lex.Str; return; } // `''` is een aanhalingsteken in de string
        this.lex = Lex.Code;
        break; // einde van de string: dit teken is weer code
      case Lex.StrBack:
        if (c === BACKSLASH) { this.lex = Lex.Str; return; } // `\\`
        if (c === LETTER_S) { this.lex = Lex.StrBackS; return; } // `\S`, alleen als hoofdletter (zoals de vinder)
        this.lex = Lex.Str;
        this.lexStep(c, at);
        return;
      case Lex.StrBackS:
        if (c === BACKSLASH) { this.lex = Lex.StrBackSBack; return; }
        this.lex = Lex.Str;
        this.lexStep(c, at);
        return;
      case Lex.StrBackSBack:
        this.lex = Lex.Str; // het teken na `\S\` hoort bij de string, ook een `'`
        return;
      case Lex.Bin:
        if (c === DQUOTE) this.lex = Lex.Code;
        return;
      case Lex.Uri:
        if (c === GT) this.lex = Lex.Code;
        return;
      case Lex.Slash:
        if (c === STAR) { this.lex = Lex.Comment; return; }
        this.fail(at - 1); // een losse `/` past nergens
        return;
      case Lex.Comment:
        if (c === STAR) this.lex = Lex.CommentStar;
        return;
      case Lex.CommentStar:
        if (c === SLASH) this.lex = this.lexBack;
        else if (c !== STAR) this.lex = Lex.Comment;
        return;
      case Lex.Back:
        if (c !== LETTER_N && c !== LETTER_F) { this.fail(at); return; } // een losse `\` past nergens
        this.lex = Lex.BackLetter;
        return;
      case Lex.BackLetter:
        if (c !== BACKSLASH) { this.fail(at); return; }
        this.lex = this.lexBack; // `\N\` of `\F\`: scheiding
        return;
      case Lex.Word: {
        const u = upper(c);
        if (isWordChar(u)) { this.wordChar(u, at); return; }
        this.lex = Lex.Code;
        this.wordDone();
        if (this.result === 'failed') return;
        break;
      }
      case Lex.Code:
        break;
    }
    if (this.sec === Sec.End && this.p === P.Stmt && c !== SPACE && c !== SLASH && c !== BACKSLASH) {
      this.fail(at); // na `END-ISO-10303-21;` alleen scheiding
      return;
    }
    const u = upper(c);
    if (isWordChar(u)) {
      this.lex = Lex.Word;
      this.wordLength = 0;
      this.wordAt = at;
      this.wordHash = FNV_OFFSET;
      this.wordChar(u, at);
      return;
    }
    switch (c) {
      case SPACE: return;
      case SLASH: this.lexBack = Lex.Code; this.lex = Lex.Slash; return;
      case BACKSLASH: this.lexBack = Lex.Code; this.lex = Lex.Back; return;
      case QUOTE: this.lex = Lex.Str; this.atom(at); return;
      case DQUOTE: this.lex = Lex.Bin; this.atom(at); return;
      case LT: this.lex = Lex.Uri; this.atom(at); return;
      case OPEN: case CLOSE: case COMMA: case SEMI: case EQUALS: this.punct(c, at); return;
      default: this.fail(at); // niet-ASCII of een teken dat nergens past
    }
  }

  private wordChar(u: number, at: number): void {
    if (this.wordLength === this.word.length) {
      if (this.wordLength === WORD_MAX) { this.fail(at); return; }
      const grown = new Uint16Array(this.word.length * 2);
      grown.set(this.word);
      this.word = grown;
    }
    this.word[this.wordLength++] = u;
    this.wordHash = Math.imul(this.wordHash ^ u, FNV_PRIME);
  }

  private wordText(): string {
    return String.fromCharCode.apply(null, this.word.subarray(0, this.wordLength) as unknown as number[]);
  }

  private wordKind(): W {
    const w = this.word;
    const n = this.wordLength;
    const c0 = w[0];
    if (n === 1 && c0 === DOLLAR) return W.Dollar;
    if (n === 1 && c0 === STAR) return W.Star;
    if (c0 === HASH || c0 === AT) {
      if (n < 2) return W.Bad;
      for (let k = 1; k < n; k++) if (!isDigit(w[k])) return W.Bad;
      return W.Name;
    }
    if (isUpper(c0) || c0 === BANG) {
      let k = c0 === BANG ? 1 : 0;
      if (k === 1 && (n < 2 || !isUpper(w[1]))) return W.Bad;
      for (; k < n; k++) if (!isUpper(w[k]) && !isDigit(w[k]) && w[k] !== MINUS) return W.Bad;
      return W.Keyword;
    }
    if (c0 === DOT) {
      if (n < 3 || w[n - 1] !== DOT || !isUpper(w[1])) return W.Bad;
      for (let k = 2; k < n - 1; k++) if (!isUpper(w[k]) && !isDigit(w[k])) return W.Bad;
      return W.Enum;
    }
    // Getal: [+-] cijfers [ . cijfers [ E [+-] cijfers ] ]
    let k = c0 === PLUS || c0 === MINUS ? 1 : 0;
    const digits = k;
    while (k < n && isDigit(w[k])) k++;
    if (k === digits) return W.Bad;
    if (k === n) return W.Number;
    if (w[k] !== DOT) return W.Bad;
    k++;
    while (k < n && isDigit(w[k])) k++;
    if (k === n) return W.Number;
    if (w[k] !== LETTER_E) return W.Bad;
    k++;
    if (k < n && (w[k] === PLUS || w[k] === MINUS)) k++;
    const exp = k;
    while (k < n && isDigit(w[k])) k++;
    return k === n && k > exp ? W.Number : W.Bad;
  }

  /** Is het woord (een sleutelwoord) gelijk aan `text`? */
  private wordIs(text: string): boolean {
    if (this.wordLength !== text.length) return false;
    for (let k = 0; k < text.length; k++) if (this.word[k] !== text.charCodeAt(k)) return false;
    return true;
  }

  private isModelWord(): boolean {
    if (MODEL_HASH[this.wordHash & 0xffff] === 0) return false;
    return IFC_BUILDING_MODEL_TYPES.has(this.wordText());
  }

  // ── Parser ─────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Een woord is af. */
  private wordDone(): void {
    const at = this.wordAt;
    const kind = this.wordKind();
    if (kind === W.Bad) { this.fail(at); return; }
    switch (this.p) {
      case P.Stmt:
        if (kind === W.Keyword) { this.statementKeyword(at); return; }
        if (kind === W.Name && this.word[0] === HASH && this.sec === Sec.Data) { this.p = P.InstEq; return; }
        if (kind === W.Name && this.sec === Sec.Anchor) { this.p = P.AnchorEq; return; }
        this.fail(at);
        return;
      case P.Params:
        this.paramWord(kind, at);
        return;
      case P.InstVal:
      case P.ComplexNext:
        if (kind !== W.Keyword) { this.fail(at); return; }
        if (this.isModelWord()) this.model = true;
        if (this.p === P.ComplexNext) this.complexParts++;
        else this.complexParts = -1; // enkelvoudig
        this.p = P.RecOpen;
        return;
      case P.AnchorVal:
        return; // alleen de haakjes tellen
      default:
        this.fail(at);
    }
  }

  /** Een sleutelwoord aan het begin van een statement. */
  private statementKeyword(at: number): void {
    switch (this.sec) {
      case Sec.Start:
        if (this.wordIs('ISO-10303-21')) { this.semi(Sec.Pre); return; }
        break;
      case Sec.Pre:
        if (this.wordIs('HEADER')) { this.semi(Sec.Header); return; }
        break;
      case Sec.Header:
        if (this.wordIs('ENDSEC')) {
          if (this.headerIndex < HEADER_ENTITIES.length) break;
          this.semi(Sec.Between);
          return;
        }
        if (this.headerIndex < HEADER_ENTITIES.length) {
          const [name, count] = HEADER_ENTITIES[this.headerIndex];
          if (!this.wordIs(name)) break;
          this.headerParams = count;
        } else {
          this.headerParams = -1;
        }
        this.headerIndex++;
        this.p = P.HeadOpen;
        return;
      case Sec.Between:
        if (this.wordIs('DATA')) { this.p = P.DataHead; this.dataHeadK = -1; this.dataHeadAt = at; return; }
        if (this.wordIs('ANCHOR') || this.wordIs('REFERENCE')) { this.semi(Sec.Anchor); return; }
        if (this.wordIs('END-ISO-10303-21')) { this.semi(Sec.End); return; }
        break;
      case Sec.Anchor:
      case Sec.Data:
        if (this.wordIs('ENDSEC')) { this.semi(Sec.Between); return; }
        break;
      case Sec.End:
        break;
    }
    this.fail(at);
  }

  private semi(next: Sec): void {
    this.p = P.Semi;
    this.nextSec = next;
  }

  /** Een string, binaire waarde of URI begint op `at`. */
  private atom(at: number): void {
    switch (this.p) {
      case P.Params:
        if (this.x === X.Value || this.x === X.ValueOrClose) { this.value(); this.x = X.Sep; return; }
        break;
      case P.DataHead:
        if ((this.dataHeadK === 0 || this.dataHeadK === 3) && this.lex === Lex.Str) { this.dataHeadK = this.dataHeadK === 0 ? 1 : 4; return; }
        break;
      case P.Stmt:
        if (this.sec === Sec.Anchor && this.lex === Lex.Uri) { this.p = P.AnchorEq; return; } // `<naam> = …`
        break;
      case P.AnchorVal:
        return;
      default:
        break;
    }
    this.fail(at);
  }

  /** Een waarde op diepte 1 van een kopentiteit telt als parameter (de komma's tellen de rest). */
  private value(): void {
    if (this.depth === 1 && this.params === 0) this.params = 1;
  }

  private push(ctx: Ctx, at: number): void {
    if (this.depth === DEPTH_MAX) { this.fail(at); return; }
    if (this.depth === this.stack.length) {
      const grown = new Uint8Array(this.stack.length * 2);
      grown.set(this.stack);
      this.stack = grown;
    }
    this.stack[this.depth++] = ctx;
  }

  private paramWord(kind: W, at: number): void {
    if (this.x !== X.Value && this.x !== X.ValueOrClose) { this.fail(at); return; }
    this.value();
    this.x = kind === W.Keyword ? X.AfterKeyword : X.Sep;
  }

  private punct(c: number, at: number): void {
    switch (this.p) {
      case P.Semi:
        if (c !== SEMI) break;
        this.sec = this.nextSec;
        this.p = P.Stmt;
        return;
      case P.HeadOpen:
      case P.RecOpen:
        if (c !== OPEN) break;
        this.p = P.Params;
        this.x = X.ValueOrClose;
        this.depth = 0;
        this.params = 0;
        this.push(Ctx.Record, at);
        return;
      case P.Params:
        this.paramPunct(c, at);
        return;
      case P.HeadSemi:
        if (c !== SEMI) break;
        this.p = P.Stmt;
        return;
      case P.DataHead:
        this.dataHeadPunct(c, at);
        return;
      case P.InstEq:
        if (c !== EQUALS) break;
        this.p = P.InstVal;
        return;
      case P.InstVal:
        if (c !== OPEN) break;
        this.p = P.ComplexNext; // complexe instantie
        this.complexParts = 0;
        return;
      case P.SimpleSemi:
      case P.ComplexSemi:
        if (c !== SEMI) break;
        this.p = P.Stmt;
        return;
      case P.ComplexNext:
        if (c !== CLOSE || this.complexParts === 0) break;
        this.p = P.ComplexSemi;
        return;
      case P.AnchorEq:
        if (c !== EQUALS) break;
        this.p = P.AnchorVal;
        this.anchorDepth = 0;
        return;
      case P.AnchorVal:
        if (c === OPEN) this.anchorDepth++;
        else if (c === CLOSE) { if (--this.anchorDepth < 0) break; }
        else if (c === SEMI) { if (this.anchorDepth !== 0) break; this.p = P.Stmt; }
        return;
      default:
        break;
    }
    this.fail(at);
  }

  private paramPunct(c: number, at: number): void {
    const top = this.stack[this.depth - 1];
    switch (this.x) {
      case X.AfterKeyword:
        if (c !== OPEN) break; // een sleutelwoord als parameter is altijd een getypeerde waarde
        this.push(Ctx.Typed, at);
        this.x = X.Value;
        return;
      case X.ValueOrClose:
      case X.Value:
        if (c === OPEN) { this.value(); this.push(Ctx.List, at); this.x = X.ValueOrClose; return; }
        if (c === CLOSE && this.x === X.ValueOrClose && top !== Ctx.Typed) { this.close(at); return; }
        break;
      case X.Sep:
        if (c === COMMA && top !== Ctx.Typed) {
          if (this.depth === 1) this.params++;
          this.x = X.Value;
          return;
        }
        if (c === CLOSE) { this.close(at); return; }
        break;
    }
    this.fail(at);
  }

  /** Een `)` in de parameters. */
  private close(at: number): void {
    this.depth--;
    if (this.depth > 0) { this.x = X.Sep; return; }
    // De `)` van het record.
    if (this.sec === Sec.Header) {
      if (this.headerParams >= 0 && this.params !== this.headerParams) { this.fail(at); return; }
      this.p = P.HeadSemi;
      return;
    }
    this.p = this.complexParts < 0 ? P.SimpleSemi : P.ComplexNext;
  }

  /** De DATAKOP: `;`, of `( 'naam' , ( 'schema' { , 'schema' } ) ) ;`. */
  private dataHeadPunct(c: number, at: number): void {
    switch (this.dataHeadK) {
      case -1:
        if (c === SEMI) { this.dataHeadDone(at); return; }
        if (c === OPEN) { this.dataHeadK = 0; return; }
        break;
      case 1:
        if (c === COMMA) { this.dataHeadK = 2; return; }
        break;
      case 2:
        if (c === OPEN) { this.dataHeadK = 3; return; }
        break;
      case 4:
        if (c === COMMA) { this.dataHeadK = 3; return; }
        if (c === CLOSE) { this.dataHeadK = 5; return; }
        break;
      case 5:
        if (c === CLOSE) { this.dataHeadK = 6; return; }
        break;
      case 6:
        if (c === SEMI) { this.dataHeadDone(at); return; }
        break;
      default:
        break;
    }
    this.fail(at);
  }

  private dataHeadDone(at: number): void {
    if (this.dataAt < 0) { this.dataAt = this.dataHeadAt; this.dataEnd = at + 1; }
    this.sec = Sec.Data;
    this.p = P.Stmt;
  }
}

/** De grammatica over een hele tekst (`readIFC`). */
export function stepFileGrammar(content: string): StepFileGrammar {
  const grammar = new StepFileGrammar(false);
  grammar.run(content);
  grammar.end(content.length);
  return grammar;
}
