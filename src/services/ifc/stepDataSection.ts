import { recognizeOldOwnHeader } from './oldOwnHeader';
import { StepStringState, isStepControl, stepString } from './stepLexical';
// De kop en het begin van de datasectie van een STEP-bestand: de ENIGE regels daarvoor (#804 fase 1a, fixronde 4; eis
// van Trias, wrakko 10 november 2026: één bron voor het zoeken naar `DATA;`). `readIFC` (`assertIfcIntegrity` en
// `indexOfDataSection` in `ifcReader.ts`, op tekst) en de doelcontrole (`foreign/targetModelScan.ts`, als stroom van
// bytes) gebruiken allebei deze code. Een tweede kopie van deze regels zou later uit elkaar lopen; dan zag de
// doelcontrole een ander bestand dan de lezer.
//
// `DATA;` zoekt de vinder in twee pogingen, in deze volgorde (het waarom staat bij `indexOfDataSection`):
//  1. streng: het eerste `DATA;` op codeniveau, dus buiten een string `'…'` (met `''` als aanhalingsteken) en buiten
//     commentaar `/* … */`. Hoofdletterongevoelig (alleen ASCII), en ook midden in een woord;
//  2. alleen als (1) niets vond: het eerste `DATA;` aan het begin van een regel, na spaties en tabs, los van strings en
//     commentaar (`/^[ \t]*DATA;/im`). Een regel begint aan het begin van de tekst en na `\n`, `\r`, U+2028 en U+2029.
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
const DATA = [0x44, 0x41, 0x54, 0x41, 0x3b]; // D A T A ;

const enum Mode { Code, Str, Slash, Comment, CommentStar }
/** Regel-verankerd: aan het begin van de regel (alleen spaties en tabs gezien), 1–4 tekens van `DATA;`, of voorbij. */
const LINE_DEAD = 6;

export class StepDataSectionFinder {
  /** Positie van de `D` van het eerste regel-verankerde `DATA;`, of -1. */
  anchored = -1;
  private mode = Mode.Code;
  private stringState = StepStringState.Text;
  /** Zoveel tekens van `DATA;` staan er op codeniveau op een rij. */
  private strict = 0;
  /** 0 = begin van een regel; 1–5 = zoveel tekens van `DATA;` na het begin; `LINE_DEAD` = tot het einde van de regel niet. */
  private line = 0;
  private lineAt = -1;
  // Alleen UTF-8: de twee vorige bytes, voor `E2 80 A8` en `E2 80 A9`.
  private prev1 = -1;
  private prev2 = -1;

  /** `utf8`: de tekens zijn UTF-8-bytes; anders UTF-16-code-eenheden. */
  constructor(private readonly utf8: boolean, private readonly literalStrings = false) {}

  /** Eén teken op positie `at`. `true`: op `at` eindigt het strenge `DATA;` (de `;`; de `D` staat op `at - 4`). */
  step(c: number, at: number): boolean {
    this.anchor(c, at);
    return this.code(c);
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
    if (lineEnd) { this.line = 0; return; }
    const line = this.line;
    if (line === LINE_DEAD) return;
    if (line === 0 && (c === 0x20 || c === 0x09)) return;
    const u = c >= 0x61 && c <= 0x7a ? c - 0x20 : c;
    if (u !== DATA[line]) { this.line = LINE_DEAD; return; }
    if (line === 0) this.lineAt = at;
    this.line = line + 1;
    if (this.line === DATA.length) {
      if (this.anchored < 0) this.anchored = this.lineAt;
      this.line = LINE_DEAD;
    }
  }

  private code(c: number): boolean {
    switch (this.mode) {
      case Mode.Str:
        this.stringState = stepString(this.stringState, c, this.literalStrings);
        if (this.stringState !== StepStringState.End) return false;
        this.mode = Mode.Code;
        break;
      case Mode.Slash:
        if (isStepControl(c)) return false;
        this.mode = Mode.Code;
        if (c === STAR) { this.mode = Mode.Comment; return false; }
        break; // de `/` was code; dit teken ook
      case Mode.Comment:
        if (c === STAR) this.mode = Mode.CommentStar;
        return false;
      case Mode.CommentStar:
        if (isStepControl(c)) return false;
        if (c === SLASH) this.mode = Mode.Code;
        else if (c !== STAR) this.mode = Mode.Comment;
        return false;
      case Mode.Code:
        break;
    }
    if (c === QUOTE) { this.strict = 0; this.mode = Mode.Str; this.stringState = StepStringState.Text; return false; }
    if (c === SLASH) { this.strict = 0; this.mode = Mode.Slash; return false; }
    const u = c >= 0x61 && c <= 0x7a ? c - 0x20 : c;
    // `DATA;` heeft geen herhaling in zichzelf: na een mismatch kan alleen een nieuwe `D` een treffer beginnen.
    if (u === DATA[this.strict]) {
      this.strict++;
      if (this.strict === DATA.length) { this.strict = 0; return true; }
    } else {
      this.strict = u === DATA[0] ? 1 : 0;
    }
    return false;
  }
}

/**
 * Begin van de datasectie in `content`: de positie van de `D` van `DATA;` (streng, anders regel-verankerd), of -1.
 * `readIFC` gebruikt dit; bij precies de oude eigen kop ligt DATA na de vaste kopregels. Voor andere bestanden
 * blijft de vinder gelijk aan main. De doelcontrole deelt die kopherkenning en voedt anders dezelfde vinder als stroom.
 */
export function indexOfStepDataSection(content: string, literalStrings = false): number {
  const oldOwn = recognizeOldOwnHeader(content);
  if (oldOwn) return oldOwn.dataStart;
  const finder = new StepDataSectionFinder(false, literalStrings);
  for (let i = 0; i < content.length; i++) {
    if (finder.step(content.charCodeAt(i), i)) return i - 4;
  }
  return finder.anchored;
}
