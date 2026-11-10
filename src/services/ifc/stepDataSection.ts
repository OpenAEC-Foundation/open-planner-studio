// De kop en het begin van de datasectie van een STEP-bestand: de ENIGE regels daarvoor (#804 fase 1a, fixronde 4; eis
// van Trias, wrakko 10 november 2026: één bron voor het zoeken naar `DATA;`). `readIFC` (`assertIfcIntegrity` en
// `indexOfDataSection` in `ifcReader.ts`, op tekst) en de doelcontrole (`foreign/targetModelScan.ts`, als stroom van
// bytes) gebruiken allebei deze code. Een tweede kopie van deze regels zou later uit elkaar lopen; dan zag de
// doelcontrole een ander bestand dan de lezer.
//
// De vinder zoekt de eerste datasectie in drie pogingen. De tabel met alle vormen van de kop staat in
// `tests/planning/ifcDoelBestanden.ts` (`DATA_KOP_VORMEN`).
//  1. De grammatica van ISO 10303-21 editie 3 (eis van Trias na review van #870, ronde 1 tot 5). De vinder leest de
//     statements vóór de eerste datasectie zoals de norm ze beschrijft (tabel 3):
//       `ISO-10303-21;` `HEADER;` { KOPENTITEIT } `ENDSEC;` [ ANCHOR- of REFERENCE-sectie ] `DATA` [ `(` … `)` ] `;`
//     Een kopentiteit is `NAAM ( parameters ) ;`. De parameters volgen de grammatica van een parameterlijst: een waarde
//     (string, binair, getal, enumeratie, `$`, `*`, verwijzing, lijst of getypeerde waarde), dan `,` of `)`. Van
//     FILE_DESCRIPTION, FILE_NAME en FILE_SCHEMA ligt het aantal parameters vast (2, 7 en 1, §8.2). In een ANCHOR- of
//     REFERENCE-sectie is een statement `<naam> = … ;` of `#n = … ;`; daar telt alleen dat de haakjes kloppen.
//     Tokens (§5, §6): een string `'…'` (met `''` als aanhalingsteken), een binaire waarde `"…"`, een URI `<…>`,
//     commentaar `/* … */`, en woorden. Scheiding is de spatie, commentaar en de afdrukcodes `\N\` en `\F\` (§5.6).
//     Stuurtekens (onder U+0020, en U+007F) vallen overal weg, vóór elke andere regel, ook midden in een token of in
//     een string (§5.2, §5.6: "line breaks may appear anywhere within the structure, including within tokens").
//     `END⏎SEC;` is dus `ENDSEC;`, `*⏎/` sluit commentaar, en `'it'⏎'s'` is één string.
//     Sleutelwoorden zijn in de norm hoofdletters; de app las altijd hoofdletterongevoelig (alleen ASCII), en blijft dat.
//     Scheiding tussen `ENDSEC` en `;` laat de vinder toe (de norm schrijft `ENDSEC;` als één token).
//     Past iets niet in de grammatica, dan beslist poging 1 niets meer. Zo kan een oude, rauw geschreven bestandsnaam
//     met één apostrof (`'Van 't Hof DATA (bouw).ifc'`, `'Van ', ENDSEC; DATA (bouw).ifc'`) geen valse sectiekop meer
//     geven: de omgedraaide stringtoestand breekt de grammatica (een `;` binnen haakjes, een woord na een string, of een
//     ander aantal parameters in FILE_NAME). Review van #870, ronde 3 tot 5.
//  2. Alleen als (1) niets vond: de regel van main, ongewijzigd: het eerste `DATA;` op codeniveau, buiten een string
//     `'…'` en buiten commentaar `/* … */`, ook midden in een woord.
//  3. Alleen als (1) en (2) niets vonden: de eerste sectiekop aan het begin van een regel, na spaties en tabs, los van
//     strings (`/^[ \t]*DATA(?:[ \t\n\v\f\r]|<commentaar>)*[;(]/im`). Een regel begint aan het begin van de tekst en na
//     `\n`, `\r`, U+2028 en U+2029. Loopt een poging over een regeleinde en mislukt ze, dan begint de volgende regel een
//     nieuwe poging (`DATA` op de ene regel, `DATA;` op de volgende).
// (2) en (3) zijn voor oude eigen bestanden met zo'n kapotte naam: daar leest de app wat main las. Een andere kop dan
// `DATA;` vindt de app daar alleen aan het begin van een regel; anders weigert `readIFC` het bestand (`no-data-section`),
// en zegt de doelcontrole "geen model" (besluit van 9 november 2026: wat de app niet kan lezen, kan hij niet beoordelen).
//
// De vinder leest teken voor teken (`step`), zodat een stroom hem in stukken kan voeden. Als UTF-16-tekst (`readIFC`) is
// elk teken een code-eenheid; als UTF-8-bytes (de doelcontrole) is elk teken een byte, en de bytes `E2 80 A8` en
// `E2 80 A9` zijn U+2028 en U+2029. Andere niet-ASCII-tekens zijn gewone tekens: alleen ASCII telt in deze regels.

/** De verplichte kop van een STEP-bestand. */
export const STEP_HEADER = 'ISO-10303-21;';

/** Begint `text` op positie `at` met de kop `ISO-10303-21;` (hoofdletterongevoelig, zoals `toUpperCase`)? */
export function startsWithStepHeader(text: string, at: number): boolean {
  return text.slice(at, at + STEP_HEADER.length).toUpperCase() === STEP_HEADER;
}

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
const DATA = [0x44, 0x41, 0x54, 0x41]; // D A T A
/** Witruimte in de regel-verankerde poging (`isSpaceCode` van `ifcReader.ts`). */
const isSpace = (c: number) => c === SPACE || (c >= 0x09 && c <= 0x0d);
const upper = (c: number) => (c >= 0x61 && c <= 0x7a ? c - 0x20 : c);
/** Een teken van een woord: sleutelwoord, getal, enumeratie `.T.`, `$`, `*`, `#12`, `@3`, `!EIGEN`. */
const isWordChar = (u: number) => (u >= 0x41 && u <= 0x5a) || (u >= 0x30 && u <= 0x39)
  || u === 0x5f || u === 0x2d || u === 0x2b || u === 0x2e || u === 0x24 || u === STAR || u === 0x23 || u === 0x40 || u === 0x21;
/** Langer hoeft een woord niet te zijn om de sleutelwoorden hieronder te herkennen. */
const WORD_MAX = 24;
/** Zoveel parameters hebben de verplichte kopentiteiten (ISO 10303-21, §8.2). */
const HEADER_PARAMS: Readonly<Record<string, number>> = { FILE_DESCRIPTION: 2, FILE_NAME: 7, FILE_SCHEMA: 1 };

/** Lexicale toestand van poging 1. */
const enum Lex { Code, Str, StrQuote, Bin, Uri, Slash, Comment, CommentStar, Back, BackLetter }
/** Waar in het bestand poging 1 is. `Stop`: (1) beslist niets meer (gevonden, grammatica gebroken, of geen datasectie). */
const enum Sec { Start, Pre, Header, Between, Anchor, Stop }
/** Waar in het statement poging 1 is. */
const enum St { Stmt, AfterWord, AfterName, Value, Params, AfterParams }
/** In een parameterlijst: wat er na het vorige token mag komen. */
const enum Expect { ValueOrClose, Value, AfterWord, Sep }
/** Een token zonder eigen teken: string, binair of URI. */
const ATOM = -2;
/** Een teken dat in de grammatica nergens past (een losse `/` of `\`, of niet-ASCII buiten een string). */
const OTHER = -3;

/** Toestand van de regel van main (poging 2). */
const enum Old { Code, Str, StrQuote, Slash, Comment, CommentStar }

/** Regel-verankerd: `DATA` aan het begin van de regel gezien, en daarna witruimte (ook regeleindes) of commentaar. */
const LINE_GAP = 5;
/** Regel-verankerd: tot het einde van de regel geen treffer meer. */
const LINE_DEAD = 6;
/** Regel-verankerd, in de scheiding na `DATA`: een `/`, misschien het begin van commentaar. */
const LINE_SLASH = 7;
const LINE_COMMENT = 8;
const LINE_COMMENT_STAR = 9;

export class StepDataSectionFinder {
  /** Positie van de `D` van de sectiekop die `step` met `true` meldde (poging 1). */
  strictAt = -1;

  // ── Poging 1: de grammatica ──
  private lex = Lex.Code;
  private sec = Sec.Start;
  private st = St.Stmt;
  private expect = Expect.ValueOrClose;
  /** Diepte van de haakjes in het statement. */
  private depth = 0;
  /** Het woord dat nu gelezen wordt (in hoofdletters, hoogstens `WORD_MAX` tekens), en zijn begin. */
  private word = '';
  private wordAt = -1;
  private inWord = false;
  /** Het eerste woord van het statement, en zijn begin. */
  private keyword = '';
  private keywordAt = -1;
  /** In een kopentiteit: het aantal parameters op diepte 1 (de komma's plus één, zodra er een waarde was). */
  private params = 0;
  private backLetter = -1;

  // ── Poging 2: de regel van main ──
  private old = Old.Code;
  private oldRun = 0;
  private oldAt = -1;
  private oldEnd = -1;

  // ── Poging 3: regel-verankerd ──
  private anchored = -1;
  private anchoredEnd = -1;
  /** 0 = begin van een regel; 1–4 = zoveel tekens van `DATA` na het begin; `LINE_GAP`; `LINE_DEAD`; commentaar. */
  private line = 0;
  private lineAt = -1;
  /** In `LINE_GAP`: sinds het laatste regeleinde alleen spaties en tabs. Dan begint hier een nieuwe regel. */
  private lineFresh = false;
  // Alleen UTF-8: de twee vorige bytes, voor `E2 80 A8` en `E2 80 A9`.
  private prev1 = -1;
  private prev2 = -1;

  /** `utf8`: de tekens zijn UTF-8-bytes; anders UTF-16-code-eenheden. */
  constructor(private readonly utf8: boolean) {}

  /** Eén teken op positie `at`. `true`: op `at` eindigt de sectiekop van poging 1 (de `;` of `(`; de `D` staat op
   *  `strictAt`). De datasectie begint op `at + 1`. */
  step(c: number, at: number): boolean {
    let lineEnd = c === 0x0a || c === 0x0d;
    if (this.utf8) {
      if ((c === 0xa8 || c === 0xa9) && this.prev1 === 0x80 && this.prev2 === 0xe2) lineEnd = true;
      this.prev2 = this.prev1;
      this.prev1 = c;
    } else if (c === 0x2028 || c === 0x2029) {
      lineEnd = true;
    }
    if (this.line !== LINE_DEAD || lineEnd) this.anchor(c, at, lineEnd);
    if (this.oldAt < 0) this.oldStep(c, at);
    if (this.sec === Sec.Stop) return false;
    if (c < SPACE || c === 0x7f) return false; // stuurtekens vallen weg, vóór elke andere regel (§5.2, §5.6)
    return this.lexStep(c, at);
  }

  /** Poging 2, anders 3: waar de datasectie begint als `step` nooit `true` gaf. Pas aan het einde van de tekst
   *  definitief; `null` zonder sectiekop. */
  get fallback(): { at: number; end: number } | null {
    if (this.oldAt >= 0) return { at: this.oldAt, end: this.oldEnd };
    return this.anchored < 0 ? null : { at: this.anchored, end: this.anchoredEnd };
  }

  // ── 1. De grammatica ──────────────────────────────────────────────────────────────────────────────────────────────

  private lexStep(c: number, at: number): boolean {
    switch (this.lex) {
      case Lex.Str:
        if (c === QUOTE) this.lex = Lex.StrQuote;
        return false;
      case Lex.StrQuote:
        if (c === QUOTE) { this.lex = Lex.Str; return false; } // `''` is een aanhalingsteken in de string
        this.lex = Lex.Code;
        break; // einde van de string: dit teken is weer code
      case Lex.Bin:
        if (c === DQUOTE) this.lex = Lex.Code;
        return false;
      case Lex.Uri:
        if (c === GT) this.lex = Lex.Code;
        return false;
      case Lex.Slash:
        this.lex = Lex.Code;
        if (c === STAR) { this.lex = Lex.Comment; return false; }
        this.token(OTHER); // een losse `/`
        break;
      case Lex.Comment:
        if (c === STAR) this.lex = Lex.CommentStar;
        return false;
      case Lex.CommentStar:
        if (c === SLASH) this.lex = Lex.Code;
        else if (c !== STAR) this.lex = Lex.Comment;
        return false;
      case Lex.Back:
        this.lex = Lex.Code;
        if (c === 0x4e || c === 0x46) { this.lex = Lex.BackLetter; this.backLetter = c; return false; }
        this.token(OTHER); // geen afdrukcode: een losse `\`
        break;
      case Lex.BackLetter:
        this.lex = Lex.Code;
        if (c === BACKSLASH) return false; // `\N\` of `\F\`: scheiding
        this.token(OTHER);
        this.code(this.backLetter, at - 1);
        break;
      case Lex.Code:
        break;
    }
    if (this.sec === Sec.Stop) return false;
    return this.code(c, at);
  }

  private code(c: number, at: number): boolean {
    const u = upper(c);
    if (isWordChar(u)) {
      if (!this.inWord) { this.inWord = true; this.word = ''; this.wordAt = at; }
      if (this.word.length < WORD_MAX) this.word += String.fromCharCode(u);
      return false;
    }
    if (this.inWord) {
      this.inWord = false;
      this.wordToken();
      if (this.sec === Sec.Stop) return false;
    }
    switch (c) {
      case SPACE: return false;
      case SLASH: this.lex = Lex.Slash; return false; // misschien commentaar: scheiding
      case BACKSLASH: this.lex = Lex.Back; return false; // misschien een afdrukcode: scheiding
      case QUOTE: this.lex = Lex.Str; return this.token(ATOM);
      case DQUOTE: this.lex = Lex.Bin; return this.token(ATOM);
      case LT: this.lex = Lex.Uri; return this.token(ATOM);
      case SEMI: case OPEN: case CLOSE: case COMMA: case EQUALS: return this.token(c);
      default: return this.token(OTHER);
    }
  }

  private stop(): false {
    this.sec = Sec.Stop;
    return false;
  }

  /** Een woord is af. Een woord maakt nooit zelf een sectiekop af: die eindigt op `;` of `(`. */
  private wordToken(): void {
    switch (this.st) {
      case St.Stmt:
        this.keyword = this.word;
        this.keywordAt = this.wordAt;
        this.st = St.AfterWord;
        return;
      case St.Value:
        return;
      case St.Params:
        if (this.expect === Expect.Value || this.expect === Expect.ValueOrClose) {
          this.value();
          this.expect = Expect.AfterWord;
          return;
        }
        this.stop();
        return;
      default:
        this.stop();
    }
  }

  /** Een waarde op diepte 1 telt als parameter (de komma's tellen de rest). */
  private value(): void {
    if (this.depth === 1 && this.params === 0) this.params = 1;
  }

  /** Een token anders dan een woord: `ATOM`, `OTHER` of een leesteken. `true`: hier eindigt de sectiekop. */
  private token(t: number): boolean {
    switch (this.st) {
      case St.Stmt:
        if (t === ATOM && this.sec === Sec.Anchor) { this.st = St.AfterName; return false; } // `<naam> = …`
        return this.stop();
      case St.AfterWord:
        return this.afterWord(t);
      case St.AfterName:
        if (t !== EQUALS) return this.stop();
        this.st = St.Value;
        this.depth = 0;
        return false;
      case St.Value:
        if (t === OPEN) this.depth++;
        else if (t === CLOSE && --this.depth < 0) return this.stop();
        else if (t === SEMI) {
          if (this.depth !== 0) return this.stop();
          this.st = St.Stmt;
        }
        return false;
      case St.Params:
        return this.param(t);
      case St.AfterParams:
        if (t !== SEMI) return this.stop();
        this.st = St.Stmt;
        return false;
    }
  }

  /** Na het eerste woord van een statement. */
  private afterWord(t: number): boolean {
    const kw = this.keyword;
    if (t === SEMI) {
      this.st = St.Stmt;
      switch (this.sec) {
        case Sec.Start: if (kw === 'ISO-10303-21') { this.sec = Sec.Pre; return false; } break;
        case Sec.Pre: if (kw === 'HEADER') { this.sec = Sec.Header; return false; } break;
        case Sec.Header: case Sec.Anchor: if (kw === 'ENDSEC') { this.sec = Sec.Between; return false; } break;
        case Sec.Between:
          if (kw === 'DATA') return this.found();
          if (kw === 'ANCHOR' || kw === 'REFERENCE') { this.sec = Sec.Anchor; return false; }
          break; // ook `END-ISO-10303-21;`: geen datasectie
        case Sec.Stop: break;
      }
      return this.stop();
    }
    if (t === OPEN && this.sec === Sec.Between && kw === 'DATA') return this.found();
    if (t === OPEN && this.sec === Sec.Header) {
      this.st = St.Params;
      this.expect = Expect.ValueOrClose;
      this.depth = 1;
      this.params = 0;
      return false;
    }
    if (t === EQUALS && this.sec === Sec.Anchor && /^[#@][0-9]+$/.test(kw)) {
      this.st = St.Value;
      this.depth = 0;
      return false;
    }
    return this.stop();
  }

  /** De parameterlijst van een kopentiteit. */
  private param(t: number): boolean {
    let e = this.expect;
    if (e === Expect.AfterWord) {
      if (t === OPEN) { this.depth++; this.expect = Expect.ValueOrClose; return false; } // getypeerde waarde
      e = Expect.Sep;
    }
    if (e === Expect.ValueOrClose && t === CLOSE) {
      e = Expect.Sep;
    } else if (e === Expect.ValueOrClose || e === Expect.Value) {
      if (t === ATOM) { this.value(); this.expect = Expect.Sep; return false; }
      if (t === OPEN) { this.value(); this.depth++; this.expect = Expect.ValueOrClose; return false; } // lijst
      return this.stop();
    }
    if (t === COMMA) {
      if (this.depth === 1) this.params++;
      this.expect = Expect.Value;
      return false;
    }
    if (t !== CLOSE) return this.stop();
    if (--this.depth > 0) { this.expect = Expect.Sep; return false; }
    const want = HEADER_PARAMS[this.keyword];
    if (want !== undefined && this.params !== want) return this.stop();
    this.st = St.AfterParams;
    return false;
  }

  private found(): true {
    this.strictAt = this.keywordAt;
    this.sec = Sec.Stop;
    return true;
  }

  // ── 2. De regel van main ──────────────────────────────────────────────────────────────────────────────────────────

  private oldStep(c: number, at: number): void {
    switch (this.old) {
      case Old.Str:
        if (c === QUOTE) this.old = Old.StrQuote;
        return;
      case Old.StrQuote:
        if (c === QUOTE) { this.old = Old.Str; return; } // `''` is een aanhalingsteken in de string
        this.old = Old.Code;
        break;
      case Old.Slash:
        this.old = Old.Code;
        if (c === STAR) { this.old = Old.Comment; return; }
        break; // de `/` was code; dit teken ook
      case Old.Comment:
        if (c === STAR) this.old = Old.CommentStar;
        return;
      case Old.CommentStar:
        if (c === SLASH) this.old = Old.Code;
        else if (c !== STAR) this.old = Old.Comment;
        return;
      case Old.Code:
        break;
    }
    if (c === QUOTE) { this.oldRun = 0; this.old = Old.Str; return; }
    if (c === SLASH) { this.oldRun = 0; this.old = Old.Slash; return; }
    const u = upper(c);
    if (this.oldRun === DATA.length) {
      if (u === SEMI) { this.oldAt = at - DATA.length; this.oldEnd = at + 1; return; }
      this.oldRun = 0;
    }
    // `DATA;` heeft geen herhaling in zichzelf: na een mismatch kan alleen een nieuwe `D` een treffer beginnen.
    if (u === DATA[this.oldRun]) this.oldRun++;
    else this.oldRun = u === DATA[0] ? 1 : 0;
  }

  // ── 3. Regel-verankerd ────────────────────────────────────────────────────────────────────────────────────────────

  /** `plain`: een `/` die geen commentaar begon, opnieuw als gewoon teken. */
  private anchor(c: number, at: number, lineEnd: boolean, plain = false): void {
    switch (this.line) {
      case LINE_SLASH:
        if (c === STAR) { this.line = LINE_COMMENT; this.lineFresh = false; return; }
        // De `/` was geen commentaar: een gewoon teken in de scheiding, dus de poging mislukt daar.
        this.line = LINE_GAP;
        this.anchor(SLASH, at - 1, false, true);
        this.anchor(c, at, lineEnd);
        return;
      case LINE_COMMENT:
        if (c === STAR) this.line = LINE_COMMENT_STAR;
        return;
      case LINE_COMMENT_STAR:
        if (c === SLASH) this.line = LINE_GAP;
        else if (c !== STAR) this.line = LINE_COMMENT;
        return;
    }
    if (this.line === DATA.length || this.line === LINE_GAP) {
      // Na `DATA` aan het begin van de regel: witruimte (ook een regeleinde) of commentaar, dan `;` of `(`.
      if (this.line === DATA.length) this.lineFresh = false;
      if (isSpace(c)) {
        if (lineEnd) this.lineFresh = true;
        else if (c !== SPACE && c !== 0x09) this.lineFresh = false;
        this.line = LINE_GAP;
        return;
      }
      if (c === SLASH && !plain) { this.line = LINE_SLASH; return; }
      const fresh = this.lineFresh;
      this.lineFresh = false;
      if (c === SEMI || c === OPEN) {
        if (this.anchored < 0) { this.anchored = this.lineAt; this.anchoredEnd = at + 1; }
        this.line = LINE_DEAD;
        return;
      }
      if (lineEnd) { this.line = 0; return; }
      if (!fresh) { this.line = LINE_DEAD; return; }
      // De poging liep over een regeleinde: dit teken staat aan het begin van een nieuwe regel.
      this.line = 0;
    }
    const line = this.line;
    if (lineEnd) { this.line = 0; return; }
    if (line === LINE_DEAD) return;
    if (line === 0 && (c === SPACE || c === 0x09)) return;
    if (upper(c) !== DATA[line]) { this.line = LINE_DEAD; return; }
    if (line === 0) this.lineAt = at;
    this.line = line + 1;
  }
}

/** Begin (`at`, de `D`) en leespositie (`end`, direct na de `;` of `(`) van de datasectie in `content`; `null` zonder
 *  sectiekop. `readIFC` gebruikt dit; de doelcontrole voedt dezelfde vinder als stroom. */
export function stepDataSectionBounds(content: string): { at: number; end: number } | null {
  const finder = new StepDataSectionFinder(false);
  for (let i = 0; i < content.length; i++) {
    if (finder.step(content.charCodeAt(i), i)) return { at: finder.strictAt, end: i + 1 };
  }
  return finder.fallback;
}

/** De positie van de `D` van de sectiekop (`stepDataSectionBounds`), of -1. */
export function indexOfStepDataSection(content: string): number {
  return stepDataSectionBounds(content)?.at ?? -1;
}
