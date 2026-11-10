// De kop en het begin van de datasectie van een STEP-bestand: de ENIGE regels daarvoor (#804 fase 1a, fixronde 4; eis
// van Trias, wrakko 10 november 2026: één bron voor het zoeken naar `DATA;`). `readIFC` (`assertIfcIntegrity` en
// `indexOfDataSection` in `ifcReader.ts`, op tekst) en de doelcontrole (`foreign/targetModelScan.ts`, als stroom van
// bytes) gebruiken allebei deze code. Een tweede kopie van deze regels zou later uit elkaar lopen; dan zag de
// doelcontrole een ander bestand dan de lezer.
//
// De regels volgen ISO 10303-21 editie 3 (eis van Trias na review van #870 ronde 1 tot 4; de tabel met alle vormen staat
// in `tests/planning/ifcDoelBestanden.ts`, `DATA_KOP_VORMEN`):
//  - `DATA_SECTION = "DATA" [ "(" PARAMETER_LIST ")" ] ";" …` (tabel 3), na de `ENDSEC;` van de kop of van de vorige
//    sectie (`EXCHANGE_FILE`). Bij `(` gaat de lezer verder direct na de `(`: de parameters zijn strings en haakjes.
//  - Tokens: een string `'…'` (met `''` als aanhalingsteken), commentaar `/* … */`, en de rest teken voor teken.
//  - Scheiding tussen tokens: de spatie, commentaar en de afdrukcodes `\N\` en `\F\` (§5.6).
//  - Stuurtekens (onder U+0020: regeleindes, tab) vallen weg, ook midden in een token (§5.2, §5.6: "line breaks may
//    appear anywhere within the structure, including within tokens"). `END⏎SEC;` is dus `ENDSEC;`.
//  - Sleutelwoorden zijn in de norm hoofdletters; de app las altijd hoofdletterongevoelig (alleen ASCII), en blijft dat.
// De vinder geeft begin en leespositie (`stepDataSectionBounds`). Twee pogingen, in deze volgorde (het waarom staat bij
// `indexOfDataSection`):
//  1. streng, op codeniveau. `DATA;` direct (zonder scheiding) telt overal, ook midden in een woord, zoals altijd. Elke
//     andere vorm (`DATA(`, `DATA (`, `DATA/*x*/(`, `DATA ;`) telt alleen als het vorige token de `;` van `ENDSEC;` is,
//     en zolang de kop gezond is: elke string staat na `(` of `,` en wordt gevolgd door `,` of `)`, zoals in elke
//     kopentiteit. Een oude, rauw geschreven bestandsnaam met één apostrof (`'Van 't Hof DATA (bouw).ifc'`) draait de
//     stringtoestand om; dan volgt er een letter op een string, en is alles daarna onbetrouwbaar. Zonder die regel werd
//     `DATA (` of `ENDSEC; DATA (` in zo'n naam de sectiekop, en opende een bestaande planning leeg, zonder schema en
//     zonder modelweigering (review van #870, ronde 3 en 4);
//  2. alleen als (1) niets vond: de eerste sectiekop aan het begin van een regel, na spaties en tabs, los van strings
//     (`/^[ \t]*DATA(?:[ \t\n\v\f\r]|<commentaar>)*[;(]/im`). Een regel begint aan het begin van de tekst en na `\n`,
//     `\r`, U+2028 en U+2029. Loopt een poging over een regeleinde en mislukt ze, dan begint de volgende regel een nieuwe
//     poging (`DATA` op de ene regel, `DATA;` op de volgende).
// Vóór 10 november 2026 herkende de vinder alleen `DATA;`: een bestand met alleen `DATA(…);` of `DATA (…);` had voor
// `readIFC` geen datasectie, en de doelcontrole zei "geen model", ook met een wand erin (review van #870, Sol en Terra).
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
const SLASH = 0x2f;
const STAR = 0x2a;
const BACKSLASH = 0x5c;
const SPACE = 0x20;
const DATA = [0x44, 0x41, 0x54, 0x41]; // D A T A, dan `;` of `(`
const ENDSEC = [0x45, 0x4e, 0x44, 0x53, 0x45, 0x43]; // E N D S E C, dan `;`
const SEMI = 0x3b;
const OPEN = 0x28;
const CLOSE = 0x29;
const COMMA = 0x2c;
/** Witruimte in de regel-verankerde poging (`isSpaceCode` van `ifcReader.ts`). */
const isSpace = (c: number) => c === SPACE || (c >= 0x09 && c <= 0x0d);
const upper = (c: number) => (c >= 0x61 && c <= 0x7a ? c - 0x20 : c);

const enum Mode { Code, Str, StrQuote, Slash, Comment, CommentStar, Back, BackLetter }
/** Streng: `DATA` gezien, en daarna scheiding. */
const GAP = 5;
/** Regel-verankerd: `DATA` aan het begin van de regel gezien, en daarna witruimte (ook regeleindes) of commentaar. */
const LINE_GAP = 5;
/** Regel-verankerd: tot het einde van de regel geen treffer meer. */
const LINE_DEAD = 6;
/** Regel-verankerd, in de scheiding na `DATA`: een `/`, misschien het begin van commentaar. */
const LINE_SLASH = 7;
const LINE_COMMENT = 8;
const LINE_COMMENT_STAR = 9;

export class StepDataSectionFinder {
  /** Positie van de `D` van de eerste regel-verankerde sectiekop, of -1. */
  anchored = -1;
  /** Positie direct na de `;` of `(` van die regel-verankerde kop, of -1: daar begint de datasectie. */
  anchoredEnd = -1;
  /** Positie van de `D` van de strenge sectiekop die `step` met `true` meldde. */
  strictAt = -1;
  private mode = Mode.Code;
  /** 0–4: zoveel tekens van `DATA` op een rij (stuurtekens tellen niet); `GAP`: `DATA` en daarna scheiding. */
  private strict = 0;
  /** Was het vorige token van de lopende treffer de `;` van `ENDSEC;`? Alleen dan telt een andere vorm dan `DATA;`. */
  private strictAtSection = false;
  private strictStart = -1;
  /** 0–5: zoveel tekens van `ENDSEC` op een rij; 6: `ENDSEC` gezien, wacht op `;`. */
  private endsec = 0;
  /** Was het vorige token de `;` van `ENDSEC;`? */
  private afterEndsec = false;
  /** De kop volgt tot hier de grammatica van een string (zie de kop van dit bestand). */
  private sound = true;
  /** Het vorige token was een string: het volgende moet `,` of `)` zijn. */
  private afterString = false;
  /** Het laatste betekenisvolle teken op codeniveau (in hoofdletters), of -1. */
  private lastSig = -1;
  /** In `Mode.BackLetter`: de `N` of `F` na de `\`, en zijn positie. */
  private backLetter = -1;
  private backLetterAt = -1;
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

  /** Eén teken op positie `at`. `true`: op `at` eindigt de strenge sectiekop (de `;` of `(`; de `D` staat op
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
    this.anchor(c, at, lineEnd);
    return this.code(c, at);
  }

  // ── 2. Regel-verankerd ────────────────────────────────────────────────────────────────────────────────────────────

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

  // ── 1. Streng ─────────────────────────────────────────────────────────────────────────────────────────────────────

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
        this.afterString = true;
        break; // einde van de string: dit teken is weer code
      case Mode.Slash:
        this.mode = Mode.Code;
        if (c === STAR) { this.mode = Mode.Comment; return false; }
        this.token(SLASH, at - 1); // de `/` was een gewoon teken
        break;
      case Mode.Comment:
        if (c === STAR) this.mode = Mode.CommentStar;
        return false;
      case Mode.CommentStar:
        if (c === SLASH) { this.mode = Mode.Code; this.separator(); }
        else if (c !== STAR) this.mode = Mode.Comment;
        return false;
      case Mode.Back:
        if (c < SPACE) return false;
        if (c === 0x4e || c === 0x46) { this.mode = Mode.BackLetter; this.backLetter = c; this.backLetterAt = at; return false; }
        this.mode = Mode.Code;
        this.token(BACKSLASH, at - 1); // geen afdrukcode: de `\` was een gewoon teken
        break;
      case Mode.BackLetter:
        if (c < SPACE) return false;
        this.mode = Mode.Code;
        if (c === BACKSLASH) { this.separator(); return false; } // `\N\` of `\F\`
        this.token(BACKSLASH, this.backLetterAt - 1);
        this.token(this.backLetter, this.backLetterAt);
        break;
      case Mode.Code:
        break;
    }
    if (c < SPACE) return false; // stuurtekens vallen weg, ook midden in een token (§5.2, §5.6)
    if (c === SPACE) { this.separator(); return false; }
    if (c === SLASH) { this.mode = Mode.Slash; return false; } // misschien commentaar: scheiding
    if (c === BACKSLASH) { this.mode = Mode.Back; return false; } // misschien een afdrukcode: scheiding
    return this.token(c, at);
  }

  /** Scheiding tussen tokens: breekt een woord; `DATA` gevolgd door scheiding wacht nog op `;` of `(`. */
  private separator(): void {
    if (this.strict === DATA.length) this.strict = GAP;
    else if (this.strict !== GAP) this.strict = 0;
    if (this.endsec < ENDSEC.length) this.endsec = 0;
  }

  /** Een betekenisvol teken op codeniveau. `true`: hier eindigt de strenge sectiekop. */
  private token(c: number, at: number): boolean {
    const u = upper(c);
    if (this.afterString) {
      this.afterString = false;
      if (u !== COMMA && u !== CLOSE) this.sound = false;
    }
    if (u === QUOTE && this.lastSig !== OPEN && this.lastSig !== COMMA) this.sound = false;
    if (this.inHead) {
      const direct = this.strict === DATA.length;
      const ok = this.strictAtSection && this.sound;
      if (u === SEMI && (direct || ok)) return this.found();
      if (u === OPEN && ok) return this.found();
      this.strict = 0;
    }
    const atSection = this.afterEndsec;
    this.section(u);
    // `DATA` heeft geen herhaling in zichzelf: na een mismatch kan alleen een nieuwe `D` een treffer beginnen.
    if (u === DATA[this.strict]) {
      if (this.strict === 0) { this.strictAtSection = atSection; this.strictStart = at; }
      this.strict++;
    } else if (u === DATA[0]) {
      this.strict = 1;
      this.strictAtSection = atSection;
      this.strictStart = at;
    } else {
      this.strict = 0;
    }
    this.lastSig = u;
    if (u === QUOTE) this.mode = Mode.Str;
    return false;
  }

  /** Volgt `ENDSEC` en de `;` erna (scheiding ertussen mag, zie `separator`). */
  private section(u: number): void {
    this.afterEndsec = false;
    if (this.endsec === ENDSEC.length) {
      this.endsec = 0;
      if (u === SEMI) { this.afterEndsec = true; return; }
    }
    if (u === ENDSEC[this.endsec]) { this.endsec++; return; }
    // `ENDSEC` herhaalt alleen zijn eerste letter: na `ENDSE` en een mismatch kan de `E` een nieuw begin zijn.
    this.endsec = this.endsec === 5 && u === ENDSEC[1] ? 2 : u === ENDSEC[0] ? 1 : 0;
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
