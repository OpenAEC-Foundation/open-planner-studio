// De kop en het begin van de datasectie van een STEP-bestand: de ENIGE regels daarvoor (#804 fase 1a, fixronde 4; eis
// van Trias, wrakko 10 november 2026: één bron voor het zoeken naar `DATA;`). `readIFC` (`assertIfcIntegrity` en
// `indexOfDataSection` in `ifcReader.ts`, op tekst) en de doelcontrole (`foreign/targetModelScan.ts`, als stroom van
// bytes) gebruiken allebei deze code, en allebei de grammatica van het hele bestand in `stepFileGrammar.ts`. Een
// tweede kopie van deze regels zou later uit elkaar lopen; dan zag de doelcontrole een ander bestand dan de lezer.
//
// De vinder zoekt de eerste datasectie in drie pogingen. De tabel met alle vormen van de kop staat in
// `tests/planning/ifcDoelBestanden.ts` (`DATA_KOP_VORMEN`).
//  1. De grammatica van ISO 10303-21 editie 3 (eis van Trias na review van #870, ronde 1 tot 6). De vinder leest de
//     statements vóór de eerste datasectie zoals de norm ze beschrijft (tabel 3):
//       `ISO-10303-21;` `HEADER;` { KOPENTITEIT } `ENDSEC;` [ ANCHOR- of REFERENCE-sectie ] DATAKOP
//     Een kopentiteit is `NAAM ( parameters ) ;`. De parameters volgen de grammatica van een parameterlijst: een waarde
//     (string, binair, getal, enumeratie, `$`, `*`, verwijzing, lijst of getypeerde waarde), dan `,` of `)`. Van
//     FILE_DESCRIPTION, FILE_NAME en FILE_SCHEMA ligt het aantal parameters vast (2, 7 en 1, §8.2). In een ANCHOR- of
//     REFERENCE-sectie is een statement `<naam> = … ;` of `#n = … ;`; daar telt alleen dat de haakjes kloppen.
//     De DATAKOP is `DATA ;` of `DATA ( 'naam' , ( 'schema' { , 'schema' } ) ) ;` (§11.1; meer schema's laat de app
//     toe), en daarna begint een entiteit (`#`) of `ENDSEC`, of eindigt de tekst (`DataHeadCheck`). De datasectie
//     begint direct na die `;`: de parameters van de kop gaan nooit naar de entiteitenlus.
//     Tokens (§5, §6): een string `'…'` (met `''` als aanhalingsteken, `\\` als backslash en `\S\` plus één teken als
//     teken uit de tweede helft van ISO 8859, dus ook `\S\'`), een binaire waarde `"…"`, een URI `<…>`, commentaar
//     `/* … */`, en woorden. Scheiding is de spatie, commentaar en de afdrukcodes `\N\` en `\F\` (§5.6).
//     Stuurtekens (onder U+0020, en U+007F) vallen overal weg, vóór elke andere regel, ook midden in een token of in
//     een string (§5.2, §5.6: "line breaks may appear anywhere within the structure, including within tokens").
//     `END⏎SEC;` is dus `ENDSEC;`, `*⏎/` sluit commentaar, en `'it'⏎'s'` is één string.
//     Sleutelwoorden zijn in de norm hoofdletters; de app las altijd hoofdletterongevoelig (alleen ASCII), en blijft dat.
//     Scheiding tussen `ENDSEC` en `;` laat de vinder toe (de norm schrijft `ENDSEC;` als één token).
//     Past iets niet in de grammatica, dan beslist poging 1 niets meer. Zo geeft een oude, rauw geschreven bestandsnaam
//     met één apostrof geen valse sectiekop: de omgedraaide stringtoestand breekt de grammatica (een `;` binnen
//     haakjes, een woord na een string, een ander aantal parameters in FILE_NAME, of een DATAKOP die niet klopt of
//     niet door een entiteit gevolgd wordt). Review van #870, ronde 3 tot 6.
//  2. Alleen als (1) niets vond: de regel van main, ongewijzigd: het eerste `DATA;` op codeniveau, buiten een string
//     `'…'` en buiten commentaar `/* … */`, ook midden in een woord.
//  3. Alleen als (1) en (2) niets vonden: de regel van main voor een kapotte kop, ongewijzigd: het eerste `DATA;` aan
//     het begin van een regel, na spaties en tabs (`/^[ \t]*DATA;/im`). Een regel begint aan het begin van de tekst en
//     na `\n`, `\r`, U+2028 en U+2029.
// Welke poging telt, beslist `stepFileLayout` (besluit Trias, wrakko 10 november 2026, review van #870 ronde 7): past
// het HELE bestand in de grammatica (`stepFileGrammar.ts`), dan de eerste DATAKOP daarvan (gelijk aan poging 1). Breekt
// het bestand, dan raadt de app niet: (2) en (3) zijn precies wat main deed, zodat een oud eigen bestand met een kapotte
// naam opent zoals op main. Vinden die niets, dan weigert `readIFC` het bestand (`no-data-section`), ook als (1) een
// DATAKOP vond (review van #870, ronde 8, Terra: anders opende een kapot bestand via een grens die main niet kende).
// Poging 1 beslist dus niets meer; haar code staat er nog en kan weg (knownbug 1054). Ronde 7 liet zien waarom de kop alleen niet
// genoeg is: een kapotte naam kan de grammatica tot en met een valse, geldige DATAKOP volgen. De doelcontrole
// (`foreign/targetModelScan.ts`) gebruikt deze vinder alleen voor een eigen bestand dat breekt (poging 2 en 3).
//
// De vinder leest teken voor teken (`step`), zodat een stroom hem in stukken kan voeden. Als UTF-16-tekst (`readIFC`) is
// elk teken een code-eenheid; als UTF-8-bytes (de doelcontrole) is elk teken een byte, en de bytes `E2 80 A8` en
// `E2 80 A9` zijn U+2028 en U+2029. Andere niet-ASCII-tekens zijn gewone tekens: alleen ASCII telt in deze regels.

import { stepFileGrammar } from './stepFileGrammar';

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
const HASH = 0x23;
const DATA = [0x44, 0x41, 0x54, 0x41]; // D A T A
const ENDSEC = 'ENDSEC';
const upper = (c: number) => (c >= 0x61 && c <= 0x7a ? c - 0x20 : c);
/** Stuurtekens vallen weg (§5.2, §5.6). */
const isControl = (c: number) => c < SPACE || c === 0x7f;
/** Een teken van een woord: sleutelwoord, getal, enumeratie `.T.`, `$`, `*`, `#12`, `@3`, `!EIGEN`. */
const isWordChar = (u: number) => (u >= 0x41 && u <= 0x5a) || (u >= 0x30 && u <= 0x39)
  || u === 0x5f || u === 0x2d || u === 0x2b || u === 0x2e || u === 0x24 || u === STAR || u === HASH || u === 0x40 || u === 0x21;
/** Langer hoeft een woord niet te zijn om de sleutelwoorden hieronder te herkennen. */
const WORD_MAX = 24;
/** Zoveel parameters hebben de verplichte kopentiteiten (ISO 10303-21, §8.2). */
const HEADER_PARAMS: Readonly<Record<string, number>> = { FILE_DESCRIPTION: 2, FILE_NAME: 7, FILE_SCHEMA: 1 };

/** Lexicale toestand van een string: in de string, na `'` (einde of `''`), na `\`, na `\S`, na `\S\`. */
const enum StrLex { Str, Quote, Back, BackS, BackSBack }

/** Eén stap in een string die op `'` begon (stuurtekens zijn al weg): de nieuwe toestand, of `'end'` als de string
 *  vóór dit teken eindigde (dan is dit teken weer code). */
function stringStep(state: StrLex, c: number): StrLex | 'end' {
  switch (state) {
    case StrLex.Str:
      if (c === QUOTE) return StrLex.Quote;
      return c === BACKSLASH ? StrLex.Back : StrLex.Str;
    case StrLex.Quote:
      if (c === QUOTE) return StrLex.Str; // `''` is een aanhalingsteken in de string
      return 'end';
    case StrLex.Back:
      if (c === BACKSLASH) return StrLex.Str; // `\\`
      if (c === 0x53) return StrLex.BackS; // `\S`
      return stringStep(StrLex.Str, c);
    case StrLex.BackS:
      if (c === BACKSLASH) return StrLex.BackSBack;
      return stringStep(StrLex.Str, c);
    case StrLex.BackSBack:
      return StrLex.Str; // het teken na `\S\` hoort bij de string, ook een `'`
  }
}

/** Toestand van `DataHeadCheck`. */
const enum Head { Gap, Slash, Comment, CommentStar, Back, BackLetter, Str, Params, AfterSemi, Endsec, Ok, Fail }

/**
 * De DATAKOP na het woord `DATA`: scheiding, dan `;`, of `(` met een naam en een lijst schema's (strings), `)` en `;`.
 * Daarna scheiding en een entiteit (`#`), `ENDSEC`, of het einde van de tekst. Stuurtekens vallen weg. `end`: direct na
 * de `;`.
 */
class DataHeadCheck {
  state = Head.Gap;
  end = -1;
  /** In de parameters: welk token nu mag (0 naam, 1 `,`, 2 `(`, 3 schema, 4 `,` of `)`, 5 `)`, 6 `;`). */
  private k = -1;
  private str = StrLex.Str;
  /** Waar de scheiding naartoe terugkeert (`Gap`, `Params` of `AfterSemi`). */
  private back = Head.Gap;
  private endsec = 0;

  constructor(readonly at: number) {}

  /** `true` zodra de uitkomst vaststaat (`Ok` of `Fail`). */
  step(c: number, at: number): boolean {
    if (isControl(c)) return false;
    switch (this.state) {
      case Head.Slash:
        if (c !== STAR) return this.fail();
        this.state = Head.Comment;
        return false;
      case Head.Comment:
        if (c === STAR) this.state = Head.CommentStar;
        return false;
      case Head.CommentStar:
        if (c === SLASH) this.state = this.back;
        else if (c !== STAR) this.state = Head.Comment;
        return false;
      case Head.Back:
        if (c !== 0x4e && c !== 0x46) return this.fail();
        this.state = Head.BackLetter;
        return false;
      case Head.BackLetter:
        if (c !== BACKSLASH) return this.fail();
        this.state = this.back; // `\N\` of `\F\`: scheiding
        return false;
      case Head.Str: {
        const next = stringStep(this.str, c);
        if (next !== 'end') { this.str = next; return false; }
        this.state = Head.Params;
        this.k = this.k === 0 ? 1 : 4; // na de naam een `,`; na een schema `,` of `)`
        return this.step(c, at);
      }
      case Head.Endsec:
        if (upper(c) !== ENDSEC.charCodeAt(this.endsec)) return this.fail();
        if (++this.endsec === ENDSEC.length) this.state = Head.Ok;
        return this.state === Head.Ok;
      case Head.Ok:
      case Head.Fail:
        return true;
      default:
        break;
    }
    // Gap, Params, AfterSemi: scheiding eerst.
    if (c === SPACE) return false;
    if (c === SLASH) { this.back = this.state; this.state = Head.Slash; return false; }
    if (c === BACKSLASH) { this.back = this.state; this.state = Head.Back; return false; }
    if (this.state === Head.Gap) {
      if (c === SEMI) { this.end = at + 1; this.state = Head.AfterSemi; return false; }
      if (c === OPEN) { this.state = Head.Params; this.k = 0; return false; }
      return this.fail();
    }
    if (this.state === Head.AfterSemi) {
      if (c === HASH) { this.state = Head.Ok; return true; }
      if (upper(c) === ENDSEC.charCodeAt(0)) { this.state = Head.Endsec; this.endsec = 1; return false; }
      return this.fail();
    }
    // Params
    switch (this.k) {
      case 0: case 3:
        if (c !== QUOTE) return this.fail();
        this.state = Head.Str;
        this.str = StrLex.Str;
        return false;
      case 1:
        if (c !== COMMA) return this.fail();
        this.k = 2;
        return false;
      case 2:
        if (c !== OPEN) return this.fail();
        this.k = 3;
        return false;
      case 4:
        if (c === COMMA) { this.k = 3; return false; }
        if (c !== CLOSE) return this.fail();
        this.k = 5;
        return false;
      case 5:
        if (c !== CLOSE) return this.fail();
        this.k = 6;
        return false;
      default:
        if (c !== SEMI) return this.fail();
        this.end = at + 1;
        this.state = Head.AfterSemi;
        return false;
    }
  }

  /** Aan het einde van de tekst: een kop met `;` zonder iets erna is goed. */
  get okAtEnd(): boolean {
    return this.state === Head.Ok || this.state === Head.AfterSemi;
  }

  private fail(): true {
    this.state = Head.Fail;
    return true;
  }
}

/** Lexicale toestand van poging 1. */
const enum Lex { Code, Str, Bin, Uri, Slash, Comment, CommentStar, Back, BackLetter }
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

/** Regel-verankerd (poging 3): tot het einde van de regel geen kandidaat meer. */
const LINE_DEAD = 5;

export class StepDataSectionFinder {
  /** Positie van de `D` van de sectiekop die `step` met `true` meldde (poging 1). */
  strictAt = -1;
  /** Waar de datasectie van die kop begint: direct na de `;` van de kop. */
  strictEnd = -1;

  // ── Poging 1: de grammatica ──
  private lex = Lex.Code;
  private str = StrLex.Str;
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
  /** Na het woord `DATA` op de plaats van een sectiekop: de controle van de rest van de kop. */
  private head: DataHeadCheck | null = null;

  // ── Poging 2: de regel van main ──
  private old = Old.Code;
  private oldRun = 0;
  private oldAt = -1;
  private oldEnd = -1;

  // ── Poging 3: regel-verankerd ──
  private anchored = -1;
  /** 0 = begin van een regel; 1–4 = zoveel tekens van `DATA` na het begin; `LINE_DEAD`. */
  private line = 0;
  private lineAt = -1;
  // Alleen UTF-8: de twee vorige bytes, voor `E2 80 A8` en `E2 80 A9`.
  private prev1 = -1;
  private prev2 = -1;

  /** `utf8`: de tekens zijn UTF-8-bytes; anders UTF-16-code-eenheden. */
  constructor(private readonly utf8: boolean) {}

  /** Eén teken op positie `at`. `true`: poging 1 vond de sectiekop (de `D` op `strictAt`); de datasectie begint op
   *  `strictEnd`, wat vóór `at` kan liggen (de vinder kijkt na de `;` nog naar het volgende token). */
  step(c: number, at: number): boolean {
    let lineEnd = c === 0x0a || c === 0x0d;
    if (this.utf8) {
      if ((c === 0xa8 || c === 0xa9) && this.prev1 === 0x80 && this.prev2 === 0xe2) lineEnd = true;
      this.prev2 = this.prev1;
      this.prev1 = c;
    } else if (c === 0x2028 || c === 0x2029) {
      lineEnd = true;
    }
    this.lineStep(c, lineEnd, at);
    if (this.oldAt < 0) this.oldStep(c, at);
    if (this.head) return this.headStep(c, at);
    if (this.sec === Sec.Stop) return false;
    if (isControl(c)) return false; // stuurtekens vallen weg, vóór elke andere regel (§5.2, §5.6)
    return this.lexStep(c, at);
  }

  /** Poging 1 aan het einde van de tekst: een sectiekop met niets erna. Pas aan het einde van de tekst definitief. */
  get grammarAtEnd(): { at: number; end: number } | null {
    return this.head?.okAtEnd ? { at: this.keywordAt, end: this.head.end } : null;
  }

  /** Waar de datasectie begint volgens poging 2 (het eerste `DATA;` op codeniveau), zodra die iets vond; anders -1.
   *  Die treffer is meteen definitief: poging 3 telt alleen als poging 2 in het hele bestand niets vindt. */
  get mainEnd(): number {
    return this.oldEnd;
  }

  /** Waar de datasectie begint volgens poging 3 (het eerste `DATA;` aan het begin van een regel), of -1. Telt alleen
   *  als poging 2 in het hele bestand niets vindt. */
  get lineEnd(): number {
    return this.anchored < 0 ? -1 : this.anchored + DATA.length + 1;
  }

  /** Poging 2, anders 3 (de regels van main): waar de datasectie begint als poging 1 niets vond. Pas aan het einde
   *  van de tekst definitief; `null` zonder sectiekop. */
  get fallback(): { at: number; end: number } | null {
    if (this.oldAt >= 0) return { at: this.oldAt, end: this.oldEnd };
    return this.anchored < 0 ? null : { at: this.anchored, end: this.anchored + DATA.length + 1 };
  }

  // ── 1. De grammatica ──────────────────────────────────────────────────────────────────────────────────────────────

  private headStep(c: number, at: number): boolean {
    const head = this.head!;
    if (!head.step(c, at)) return false;
    this.head = null;
    if (head.state !== Head.Ok) return this.stop();
    this.strictAt = this.keywordAt;
    this.strictEnd = head.end;
    this.sec = Sec.Stop;
    return true;
  }

  private lexStep(c: number, at: number): boolean {
    switch (this.lex) {
      case Lex.Str: {
        const next = stringStep(this.str, c);
        if (next !== 'end') { this.str = next; return false; }
        this.lex = Lex.Code;
        break; // einde van de string: dit teken is weer code
      }
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
      if (this.st === St.AfterWord && this.sec === Sec.Between && this.keyword === 'DATA') {
        // De plaats van een sectiekop: de rest van de kop gaat door de controle, ook dit teken.
        this.head = new DataHeadCheck(this.keywordAt);
        return this.headStep(c, at);
      }
    }
    switch (c) {
      case SPACE: return false;
      case SLASH: this.lex = Lex.Slash; return false; // misschien commentaar: scheiding
      case BACKSLASH: this.lex = Lex.Back; return false; // misschien een afdrukcode: scheiding
      case QUOTE: this.lex = Lex.Str; this.str = StrLex.Str; return this.token(ATOM);
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

  /** Een woord is af. */
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

  /** Een token anders dan een woord: `ATOM`, `OTHER` of een leesteken. */
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

  /** Na het eerste woord van een statement (`DATA` op de plaats van een sectiekop gaat naar `DataHeadCheck`). */
  private afterWord(t: number): boolean {
    const kw = this.keyword;
    if (t === SEMI) {
      this.st = St.Stmt;
      switch (this.sec) {
        case Sec.Start: if (kw === 'ISO-10303-21') { this.sec = Sec.Pre; return false; } break;
        case Sec.Pre: if (kw === 'HEADER') { this.sec = Sec.Header; return false; } break;
        case Sec.Header: case Sec.Anchor: if (kw === ENDSEC) { this.sec = Sec.Between; return false; } break;
        case Sec.Between:
          if (kw === 'ANCHOR' || kw === 'REFERENCE') { this.sec = Sec.Anchor; return false; }
          break; // ook `END-ISO-10303-21;`: geen datasectie
        case Sec.Stop: break;
      }
      return this.stop();
    }
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

  // ── 3. Regel-verankerd (de regel van main) ────────────────────────────────────────────────────────────────────────

  private lineStep(c: number, lineEnd: boolean, at: number): void {
    const line = this.line;
    if (lineEnd) { this.line = 0; return; }
    if (line === LINE_DEAD || this.anchored >= 0) return;
    if (line === DATA.length) {
      if (c === SEMI) this.anchored = this.lineAt; // `DATA;` aan het begin van de regel
      this.line = LINE_DEAD;
      return;
    }
    if (line === 0 && (c === SPACE || c === 0x09)) return;
    if (upper(c) !== DATA[line]) { this.line = LINE_DEAD; return; }
    if (line === 0) this.lineAt = at;
    this.line = line + 1;
  }
}

/** Hoe `readIFC` een bestand leest: waar de datasectie begint, of het hele bestand in de grammatica past
 *  (`stepFileGrammar.ts`), en of de grammatica een modelentiteit zag. */
export interface StepFileLayout {
  /** Begin (`at`, de `D`) en leespositie (`end`, direct na de `;` van de kop) van de eerste datasectie; `null` zonder
   *  sectiekop. `grammar`: gevonden met een grammatica, anders met een regel van main. */
  readonly bounds: { at: number; end: number; grammar: boolean } | null;
  /** Het hele bestand past in de grammatica. */
  readonly valid: boolean;
  /** De grammatica zag een entiteit met een modeltype, ook vóór het punt waar het bestand brak (zoals de doelcontrole). */
  readonly model: boolean;
  /** Alleen als `valid`: de enkelvoudige entiteiten volgens de grammatica (`StepFileGrammar.entities`/`entitySignature`). */
  readonly entities: number;
  readonly entitySignature: number;
  /** Alleen als `valid`: de lexer van main leest vanaf de eerste DATA iets anders dan de norm (`StepFileGrammar.lexicalDiff`). */
  readonly lexicalDiff: boolean;
}

/**
 * De regel (besluit Trias, wrakko 10 november 2026):
 *  - past het hele bestand in de grammatica, dan begint de datasectie bij de eerste DATAKOP van die grammatica;
 *  - breekt het bestand, dan precies zoals main: poging 2, anders 3, anders `null` (`no-data-section`). Review van #870,
 *    ronde 8 (Terra): de kop volgens de grammatica (poging 1) telt dan niet meer; die gaf bij een kapot bestand toch
 *    een grens die main niet kende.
 */
export function stepFileLayout(content: string): StepFileLayout {
  const grammar = stepFileGrammar(content);
  const valid = grammar.state === 'valid';
  const entities = valid ? grammar.entities : 0;
  const entitySignature = valid ? grammar.entitySignature : 0;
  const lexicalDiff = valid && grammar.lexicalDiff;
  if (valid && grammar.dataAt >= 0) {
    return { bounds: { at: grammar.dataAt, end: grammar.dataEnd, grammar: true }, valid, model: grammar.model, entities, entitySignature, lexicalDiff };
  }
  const finder = new StepDataSectionFinder(false);
  for (let i = 0; i < content.length; i++) finder.step(content.charCodeAt(i), i);
  const fallback = finder.fallback;
  return { bounds: fallback ? { ...fallback, grammar: false } : null, valid, model: grammar.model, entities, entitySignature, lexicalDiff };
}

/** Begin en leespositie van de datasectie in `content` (`stepFileLayout`); `null` zonder sectiekop. */
export function stepDataSectionBounds(content: string): { at: number; end: number; grammar: boolean } | null {
  return stepFileLayout(content).bounds;
}

/** De positie van de `D` van de sectiekop (`stepDataSectionBounds`), of -1. */
export function indexOfStepDataSection(content: string): number {
  return stepDataSectionBounds(content)?.at ?? -1;
}
