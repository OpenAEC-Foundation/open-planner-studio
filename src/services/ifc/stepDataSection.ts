// De kop en het begin van de datasectie van een STEP-bestand: de ENIGE regels daarvoor (#804 fase 1a, fixronde 4; eis
// van Trias, wrakko 10 november 2026: één bron voor het zoeken naar `DATA;`). `readIFC` (`assertIfcIntegrity` en
// `indexOfDataSection` in `ifcReader.ts`, op tekst) en de doelcontrole (`foreign/targetModelScan.ts`, als stroom van
// bytes) gebruiken allebei deze code. Een tweede kopie van deze regels zou later uit elkaar lopen; dan zag de
// doelcontrole een ander bestand dan de lezer.
//
// De sectiekop is `DATA`, dan `;` of `(` (ISO 10303-21 editie 3: `DATA('naam',('schema'));`, ook voor de eerste
// sectie), met witruimte of commentaar ertussen (de scheiding van tabel 3: `DATA ('naam',…);`, `DATA/*x*/(`). Bij `(`
// gaat de lezer verder direct na de `(`: de parameters bevatten strings en haakjes, geen entiteit. De vinder geeft
// begin en leespositie (`stepDataSectionBounds`); de kop is dus niet altijd vijf tekens. Twee pogingen, in deze
// volgorde (het waarom staat bij `indexOfDataSection`):
//  1. streng: de eerste sectiekop op codeniveau, dus buiten een string `'…'` (met `''` als aanhalingsteken) en buiten
//     commentaar `/* … */`. Hoofdletterongevoelig (alleen ASCII). `DATA;` ook midden in een woord (zoals altijd); de
//     andere vormen alleen als er geen woordteken (letter, cijfer, `_`, `!`) vóór de `D` staat, anders telt een
//     kopentiteit met een naam als `METADATA(` mee;
//  2. alleen als (1) niets vond: de eerste sectiekop aan het begin van een regel, na spaties en tabs, los van strings en
//     commentaar (`/^[ \t]*DATA\s*[;(]/im`; commentaar tussen `DATA` en `(` telt hier niet). Een regel begint aan het
//     begin van de tekst en na `\n`, `\r`, U+2028 en U+2029.
// Vóór 10 november 2026 herkende de vinder alleen `DATA;`: een bestand met alleen `DATA(…);` of `DATA (…);` had voor
// `readIFC` geen datasectie, en de doelcontrole zei "geen model", ook met een wand erin (review van #870, Sol en Terra,
// ronde 1 en 2).
//
// De vinder leest teken voor teken (`step`), zodat een stroom hem in stukken kan voeden. Als UTF-16-tekst (`readIFC`) is
// elk teken een code-eenheid; als UTF-8-bytes (de doelcontrole) is elk teken een byte, en de bytes `E2 80 A8` en
// `E2 80 A9` zijn U+2028 en U+2029. Andere niet-ASCII-tekens spelen geen rol: alleen ASCII telt in deze regels.

/** De verplichte kop van een STEP-bestand. */
export const STEP_HEADER = 'ISO-10303-21;';

/** Begint `text` op positie `at` met de kop `ISO-10303-21;` (hoofdletterongevoelig, zoals `toUpperCase`)? */
export function startsWithStepHeader(text: string, at: number): boolean {
  return text.slice(at, at + STEP_HEADER.length).toUpperCase() === STEP_HEADER;
}

const QUOTE = 0x27;
const SLASH = 0x2f;
const STAR = 0x2a;
const DATA = [0x44, 0x41, 0x54, 0x41]; // D A T A, dan `;` of `(`
const SEMI = 0x3b;
const OPEN = 0x28;
/** Woordteken vóór de `D`: dan is `DATA (` of `DATA ;` geen sectiekop (`DATA;` direct erna wel, zoals altijd). */
const isWordCode = (u: number) => (u >= 0x30 && u <= 0x39) || (u >= 0x41 && u <= 0x5a) || u === 0x5f || u === 0x21;
/** Witruimte tussen `DATA` en `;`/`(` (`isSpaceCode` van `ifcReader.ts`). */
const isSpace = (c: number) => c === 0x20 || (c >= 0x09 && c <= 0x0d);

const enum Mode { Code, Str, StrQuote, Slash, Comment, CommentStar }
/** Streng: `DATA` gezien, en daarna witruimte of commentaar (de scheiding van ISO 10303-21, tabel 3). */
const GAP = 5;
/** Regel-verankerd: `DATA` aan het begin van de regel gezien, en daarna witruimte (ook regeleindes). */
const LINE_GAP = 5;
/** Regel-verankerd: tot het einde van de regel geen treffer meer. */
const LINE_DEAD = 6;

export class StepDataSectionFinder {
  /** Positie van de `D` van de eerste regel-verankerde sectiekop, of -1. */
  anchored = -1;
  /** Positie direct na de `;` of `(` van die regel-verankerde kop, of -1: daar begint de datasectie. */
  anchoredEnd = -1;
  /** Positie van de `D` van de strenge sectiekop die `step` met `true` meldde. */
  strictAt = -1;
  private mode = Mode.Code;
  /** 0–4: zoveel tekens van `DATA` op codeniveau op een rij; `GAP`: `DATA` en daarna scheiding. */
  private strict = 0;
  /** Was het teken vóór de `D` van de lopende treffer een woordteken? */
  private strictAfterWord = false;
  private strictStart = -1;
  /** Was het vorige teken op codeniveau een woordteken? */
  private lastWord = false;
  /** 0 = begin van een regel; 1–4 = zoveel tekens van `DATA` na het begin; `LINE_GAP`; `LINE_DEAD`. */
  private line = 0;
  private lineAt = -1;
  // Alleen UTF-8: de twee vorige bytes, voor `E2 80 A8` en `E2 80 A9`.
  private prev1 = -1;
  private prev2 = -1;

  /** `utf8`: de tekens zijn UTF-8-bytes; anders UTF-16-code-eenheden. */
  constructor(private readonly utf8: boolean) {}

  /** Eén teken op positie `at`. `true`: op `at` eindigt de strenge sectiekop (de `;` of `(`; de `D` staat op
   *  `strictAt`). De datasectie begint op `at + 1`. */
  step(c: number, at: number): boolean {
    this.anchor(c, at);
    return this.code(c, at);
  }

  private anchor(c: number, at: number): void {
    let lineEnd = c === 0x0a || c === 0x0d;
    if (this.utf8) {
      if ((c === 0xa8 || c === 0xa9) && this.prev1 === 0x80 && this.prev2 === 0xe2) lineEnd = true;
      this.prev2 = this.prev1;
      this.prev1 = c;
    } else if (c === 0x2028 || c === 0x2029) {
      lineEnd = true;
    }
    const line = this.line;
    if (line === DATA.length || line === LINE_GAP) {
      // Na `DATA` aan het begin van de regel: witruimte (ook een regeleinde), dan `;` of `(`.
      if (isSpace(c)) { this.line = LINE_GAP; return; }
      if ((c === SEMI || c === OPEN) && this.anchored < 0) { this.anchored = this.lineAt; this.anchoredEnd = at + 1; }
      this.line = lineEnd ? 0 : LINE_DEAD;
      return;
    }
    if (lineEnd) { this.line = 0; return; }
    if (line === LINE_DEAD) return;
    if (line === 0 && (c === 0x20 || c === 0x09)) return;
    const u = c >= 0x61 && c <= 0x7a ? c - 0x20 : c;
    if (u !== DATA[line]) { this.line = LINE_DEAD; return; }
    if (line === 0) this.lineAt = at;
    this.line = line + 1;
  }

  /** Na `DATA` (direct, of na scheiding) staat de vinder tussen `DATA` en `;`/`(`. */
  private get inHead(): boolean {
    return this.strict === DATA.length || this.strict === GAP;
  }

  private code(c: number, at: number): boolean {
    switch (this.mode) {
      case Mode.Str:
        if (c === QUOTE) this.mode = Mode.StrQuote;
        return false;
      case Mode.StrQuote:
        if (c === QUOTE) { this.mode = Mode.Str; return false; } // `''` is een aanhalingsteken in de string
        this.mode = Mode.Code;
        break; // einde van de string: dit teken is weer code
      case Mode.Slash:
        this.mode = Mode.Code;
        if (c === STAR) { this.mode = Mode.Comment; return false; }
        // De `/` was code: geen scheiding na `DATA`.
        this.strict = 0;
        this.lastWord = false;
        break; // dit teken is ook code
      case Mode.Comment:
        if (c === STAR) this.mode = Mode.CommentStar;
        return false;
      case Mode.CommentStar:
        if (c === SLASH) {
          this.mode = Mode.Code;
          if (this.inHead) this.strict = GAP; // commentaar na `DATA` is scheiding
        } else if (c !== STAR) this.mode = Mode.Comment;
        return false;
      case Mode.Code:
        break;
    }
    if (c === QUOTE) { this.strict = 0; this.lastWord = false; this.mode = Mode.Str; return false; }
    if (c === SLASH) {
      // Begint hier commentaar, dan blijft een lopende `DATA` staan (zie `Mode.Slash`/`Mode.CommentStar`).
      if (!this.inHead) this.strict = 0;
      this.lastWord = false;
      this.mode = Mode.Slash;
      return false;
    }
    const u = c >= 0x61 && c <= 0x7a ? c - 0x20 : c;
    const afterWord = this.lastWord;
    this.lastWord = isWordCode(u);
    if (this.inHead) {
      const direct = this.strict === DATA.length;
      if (u === SEMI && (direct || !this.strictAfterWord)) return this.found();
      if (u === OPEN && !this.strictAfterWord) return this.found();
      if (isSpace(c)) { this.strict = GAP; return false; }
      this.strict = 0;
    }
    // `DATA` heeft geen herhaling in zichzelf: na een mismatch kan alleen een nieuwe `D` een treffer beginnen.
    if (u === DATA[this.strict]) {
      if (this.strict === 0) { this.strictAfterWord = afterWord; this.strictStart = at; }
      this.strict++;
    } else if (u === DATA[0]) {
      this.strict = 1;
      this.strictAfterWord = afterWord;
      this.strictStart = at;
    } else {
      this.strict = 0;
    }
    return false;
  }

  private found(): true {
    this.strictAt = this.strictStart;
    this.strict = 0;
    return true;
  }
}

/** Begin (`at`, de `D`) en leespositie (`end`, direct na de `;` of `(`) van de datasectie in `content`: streng, anders
 *  regel-verankerd; `null` zonder sectiekop. `readIFC` gebruikt dit; de doelcontrole voedt dezelfde vinder als stroom. */
export function stepDataSectionBounds(content: string): { at: number; end: number } | null {
  const finder = new StepDataSectionFinder(false);
  for (let i = 0; i < content.length; i++) {
    if (finder.step(content.charCodeAt(i), i)) return { at: finder.strictAt, end: i + 1 };
  }
  return finder.anchored < 0 ? null : { at: finder.anchored, end: finder.anchoredEnd };
}

/** De positie van de `D` van de sectiekop (`stepDataSectionBounds`), of -1. */
export function indexOfStepDataSection(content: string): number {
  return stepDataSectionBounds(content)?.at ?? -1;
}
