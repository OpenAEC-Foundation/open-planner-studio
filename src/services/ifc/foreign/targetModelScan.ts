// Bevat een bestaand doel van Opslaan als, een export of AutoSave een gebouwmodel (#804 fase 1a, fixronde 2–4)? Besluit
// Trias (wrakko, 9 november 2026): de app controleert het gekozen bestaande doel zelf. Is het een IFC met een
// `IfcProduct` of `IfcTypeProduct` (dezelfde ingecheckte type-inventaris als de modelweigering bij openen,
// `IFC_BUILDING_MODEL_TYPES`), dan schrijft de app niet. Zo is ook een gewijzigde modelversie, of een modelbestand dat
// niet open is, beschermd.
//
// De regel (besluit Trias, wrakko 10 november 2026, review van #870 ronde 7): de lezer leest het hele bestand met de
// grammatica van ISO 10303-21 (`stepFileGrammar.ts`, dezelfde code als `readIFC`), als stroom van bytes:
//  1. de kop: `assertIfcIntegrity` (BOM, witruimte, `ISO-10303-21;`; de kopregel uit `stepDataSection.ts`). Een ander
//     eerste statement is 'not-ifc';
//  2. ziet de grammatica een entiteit met een modeltype (ook als deel van een complexe instantie, en ook vóór het
//     bestand ergens breekt): 'model', meteen;
//  3. past het hele bestand in de grammatica, met precies één datasectie: de regel van main (stap 5), zodat de lezer
//     'model' zegt als de grammatica óf `readIFC` een model ziet. Vindt main geen `DATA;`, dan 'no-model' (de grammatica
//     las het hele bestand zonder model). Zonder datasectie: 'unreadable', zoals `readIFC` weigert. Review van #870,
//     ronde 10: een wand in `/⏎* … */` is voor de norm commentaar, maar `readIFC` weigert hem als model; main weigerde
//     het doel dan ook. Niets slechter dan main;
//  4. breekt het bestand, of heeft het meer dan één datasectie, en is het van een ander programma: 'unreadable'. Bij
//     twijfel weigeren (de regel van #867). `readIFC` leest zoals main alleen de eerste datasectie; wat erna staat zou
//     opslaan stil wissen (besluit Trias, wrakko 10 november 2026, review van #870 ronde 10);
//  5. breekt het bestand, of heeft het meer dan één datasectie, en schreef OPS het (de vaste kop van OPS, en de regel met FILE_NAME eindigt met
//     originating_system 'Open Planner Studio'): de regel van main, zodat de planner kan blijven opslaan. OPS
//     v2026.2.0 tot en met v2026.7.12 schreef naam, auteur en bedrijf rauw in FILE_NAME (commit 771db15cb), en oudere
//     versies schreven ook andere dingen buiten de norm (zoals `IFCREAL(NaN)`). De lezer leest dan zoals `readIFC` zo'n
//     bestand leest: vanaf het begin van de datasectie volgens main (`StepDataSectionFinder`: het eerste `DATA;` op
//     codeniveau, anders het eerste aan het begin van een regel), met de lus van `parseSTEP`:
//      a. commentaar weg, zoals `stripStepComments`;
//      b. op codeniveau een `'…'` overslaan, bij `#` een entiteit proberen (`#id = TYPE (…) ;`, met haakjes op diepte,
//         strings en commentaar in de argumenten), tot de eerste `ENDSEC;` op codeniveau. Mislukt een
//         entiteit, dan leest `readIFC` verder vanaf het teken na de `#`; deze lezer spoelt daarvoor terug (uit het
//         geheugen, of door de bron opnieuw te lezen vanaf die positie).
//     Dan zegt de lezer 'model' precies als `readIFC` het bestand weigert met `building-model`. Stap a en b zijn een
//     tweede vorm van de regels in `ifcReader.ts` (`stripStepComments`, `parseSTEP`, `readEntity`): die werken op de hele
//     tekst, deze als stroom. `check-ifc-target-model-scan.ts` vergelijkt beide. Wijzig je de regels daar, wijzig ze
//     dan hier ook.
//
// De uitkomst en wat hij betekent (fixronde 3: een scan zonder uitkomst is geen vrijbrief):
//  - 'model': niet schrijven.
//  - 'no-model': de lezer las het HELE bestand zonder modelentiteit. Schrijven mag.
//  - 'not-ifc': het bestand begint niet met `ISO-10303-21;` (CSV, XML, JSON, een leeg bestand). Schrijven mag.
//  - 'unreadable': een STEP-bestand dat de lezer niet betrouwbaar kan lezen. Niet schrijven.
// Een andere uitkomst bestaat niet. Stopt het lezen vóór het einde (een leesfout), dan is er geen uitkomst; de aanroeper
// telt dat als "niet leesbaar".
//
// Bewust strenger dan `readIFC` (dan weigert de app een write die de lezer zou toestaan, nooit andersom): commentaar
// vóór de kop (fixronde 3: het eerste statement telt) met een modelentiteit; een modelentiteit vóór het punt waar het
// bestand breekt; en elk bestand van een ander programma dat breekt.
//
// De lezer stopt bij de eerste modelentiteit. Een groot bestand zonder model leest hij helemaal, maar als stroom.
import { IFC_BUILDING_MODEL_TYPES } from '../ifcBuildingModelTypes';
import { STEP_HEADER, StepDataSectionFinder, startsWithStepHeader } from '../stepDataSection';
import { StepFileGrammar } from '../stepFileGrammar';

/** Uitkomst van de controle; zie de kop van dit bestand voor de betekenis. */
export type TargetModelScan = 'model' | 'no-model' | 'not-ifc' | 'unreadable';

/** Een bron die de doelcontrole leest, ook opnieuw vanaf een positie (terugspoelen, de tweede lezing). */
export interface TargetSource {
  /** Het volgende stuk, of `null` aan het einde. Een fout gaat door naar de aanroeper. */
  next(): Promise<Uint8Array | null>;
  /** Lees hierna verder vanaf `offset` (bytes vanaf het begin van het bestand). */
  seek(offset: number): Promise<void>;
  /** Sluit de bron; ook na een fout. */
  close?(): Promise<void> | void;
}

/** Wat de lezer na een stuk vraagt: de uitkomst, verder lezen vanaf `seek`, of (`null`) het volgende stuk. */
export type TargetScanStep = { readonly result: TargetModelScan } | { readonly seek: number } | null;

const QUOTE = 0x27; // '
const SLASH = 0x2f; // /
const STAR = 0x2a; // *
const SEMI = 0x3b; // ;
const OPEN = 0x28; // (
const CLOSE = 0x29; // )
const HASH = 0x23; // #
const EQ = 0x3d; // =
const BOM = [0xef, 0xbb, 0xbf];
const HEADER = Array.from(STEP_HEADER, c => c.charCodeAt(0));
/** Zoveel bytes na BOM en witruimte decodeert de kopcontrole; genoeg voor de 13 tekens van de kop. */
const HEAD_PROBE = 64;
/** Zoveel bytes van een type houdt de lezer vast; elk modeltype is korter. */
const TYPE_MAX = 96;
/** Zoveel houdt de lezer vast voor terugspoelen; daarboven leest hij de bron opnieuw vanaf die positie. */
const RETAIN_BYTES = 16 << 20;
const RETAIN_CHUNKS = 4096;
/** Bytes die in de argumenten van een entiteit niets doen (alleen `'`, `/`, `(` en `)` tellen). */
const ARG_PLAIN = new Uint8Array(256).fill(1);
ARG_PLAIN[QUOTE] = 0;
ARG_PLAIN[SLASH] = 0;
ARG_PLAIN[OPEN] = 0;
ARG_PLAIN[CLOSE] = 0;
/** Bytes die tussen entiteiten niets doen (alleen `'`, `/` en `#` tellen). */
const CODE_PLAIN = new Uint8Array(256).fill(1);
CODE_PLAIN[QUOTE] = 0;
CODE_PLAIN[SLASH] = 0;
CODE_PLAIN[HASH] = 0;
CODE_PLAIN[0x45] = 0; // `E`: misschien het begin van `ENDSEC;`
/** `ENDSEC;`, waar de lus van `parseSTEP` in een kapot bestand stopt (zoals main). */
const ENDSEC = Array.from('ENDSEC;', c => c.charCodeAt(0));
/** `isWordCode` als tabel. */
const WORD = new Uint8Array(256);
for (let b = 0; b < 256; b++) {
  if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x5f) WORD[b] = 1;
}
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
const EMPTY = new Uint8Array(0);
/** De lengte van `DATA;`. */
const DATA_SEMI_LENGTH = 5;
/** Zo begint elk bestand dat OPS schreef (alle versies), tot en met `FILE_NAME(`; regeleinde `\n` (of `\r\n`). */
const OPS_HEAD = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [SchedulingView]'),'2;1');\nFILE_NAME(";
/** Zo eindigt de regel met FILE_NAME in elk bestand dat OPS schreef: originating_system 'Open Planner Studio'. */
const OPS_NAME_END = ",'Open Planner Studio 0.1','Open Planner Studio','');";
/** Zoveel bytes vooraan houdt de lezer vast voor de herkenning van een eigen bestand. */
const OPS_PREFIX_MAX = 64 << 10;

const upper = (b: number) => (b >= 0x61 && b <= 0x7a ? b - 0x20 : b);
/** `isWordCode` en `isSpaceCode` van `ifcReader.ts`. */
const isWord = (b: number) => WORD[b] === 1;
const isSpace = (b: number) => b === 0x20 || (b >= 0x09 && b <= 0x0d);
const text = (buf: Uint8Array, length: number) => String.fromCharCode.apply(null, buf.subarray(0, length) as unknown as number[]);

/** Is het type (`length` bytes in `buf`, met hash `hash`) een modeltype? Een te lang type is het nooit. */
function isModelType(buf: Uint8Array, length: number, hash: number): boolean {
  if (length === 0 || length > TYPE_MAX || MODEL_HASH[hash & 0xffff] === 0) return false;
  return IFC_BUILDING_MODEL_TYPES.has(text(buf, length));
}

const enum Phase { Find, Data, Wait }
/** De kop zoals `assertIfcIntegrity`: één U+FEFF, witruimte, dan de eerste `HEAD_PROBE` bytes. */
const enum Exact { Bom, Space, Collect, Done }
/** De kop zoals fixronde 3: witruimte en commentaar, dan `ISO-10303-21;` als eerste statement. */
const enum First { Space, Slash, Comment, CommentStar, Keyword, Done }
/** Commentaar weghalen (`stripStepComments`). */
const enum Strip { Code, Slash, Str, StrQuote, Comment, CommentStar }
/** De lus van `parseSTEP`. */
const enum Loop { Code, Str, StrQuote, Entity }
/** `readEntity`. */
const enum Ent { Id0, Id, SpaceId, Eq, Type, SpaceType, Args, ArgStr, ArgStrQuote, ArgSlash, ArgComment, ArgCommentStar, End }

export class TargetModelScanner {
  private result: TargetModelScan | null = null;
  // ── Invoer: de stukken vanaf de oudste positie die terugspoelen nog nodig heeft ──
  private chunks: Uint8Array[] = [];
  private bases: number[] = [];
  private first = 0;
  private queueBase = 0;
  private queueEnd = 0;
  /** Tot hier las de lezer de bron al eens. */
  private maxEnd = 0;
  private pos = 0;
  private eof = false;
  private seekTo = -1;
  private jumped = false;
  // ── Kop ──
  /** Waar de tekst begint: na de BOM die de decoder weghaalt (3), anders 0; -1 = nog niet bekend. */
  private contentStart = -1;
  private headOk: boolean | null = null;
  private headPos = 0;
  private exact = Exact.Bom;
  private exactBom = 0;
  private readonly probe = new Uint8Array(HEAD_PROBE);
  private probeLength = 0;
  private exactOk: boolean | null = null;
  private firstState = First.Space;
  private firstLength = 0;
  private firstOk: boolean | null = null;
  // ── Datasectie zoeken ──
  private phase = Phase.Find;
  /** De grammatica van het hele bestand (`stepFileGrammar.ts`). */
  private readonly grammar = new StepFileGrammar(true);
  /** De regels van main voor het begin van de datasectie, voor een eigen bestand dat breekt. */
  private readonly finder = new StepDataSectionFinder(true);
  /** Direct na het eerste `DATA;` op codeniveau (de `;` plus één), of -1. Dat telt meteen; anders aan het einde het
   *  eerste `DATA;` aan het begin van een regel (`finder.anchored`). */
  private mainEnd = -1;
  /** De eerste bytes, voor de herkenning van een eigen bestand. */
  private readonly prefix = new Uint8Array(OPS_PREFIX_MAX);
  private prefixLength = 0;
  /** Schreef OPS dit bestand? `null` = nog niet bekend. Alleen nodig als de grammatica breekt. */
  private ops: boolean | null = null;
  private modelPending = false;
  /** De grammatica vond geen datasectie, maar de kop is nog niet beslist (een heel kort bestand): wachten. */
  private unreadablePending = false;
  // ── Datasectie lezen ──
  private strip = Strip.Code;
  private slashAt = 0;
  private loop = Loop.Code;
  /** Zoveel tekens van `ENDSEC;` staan er nu op codeniveau achter elkaar. */
  private endsec = 0;
  private ent = Ent.Id0;
  private entAt = 0;
  private entStrip = Strip.Code;
  private depth = 0;
  private complex = false;
  /** In een complexe instantie: 0 = geen naam, 1 = in een naam, 2 = een naam en daarna witruimte. */
  private name = 0;
  private readonly type = new Uint8Array(TYPE_MAX);
  private typeLength = 0;
  private typeHash = FNV_OFFSET;

  /** De uitkomst zodra die vaststaat (dan kan de lezer stoppen), anders `null`. */
  get done(): TargetModelScan | null { return this.result; }

  /**
   * Het volgende stuk van de bron. Na `{ seek }` begint het volgende stuk op die positie. Geeft de uitkomst zodra die
   * vaststaat ('model' of 'not-ifc'; 'no-model' alleen via `end()`).
   */
  push(chunk: Uint8Array): TargetScanStep {
    if (this.result !== null) return { result: this.result };
    this.seekTo = -1;
    this.eof = false;
    if (chunk.length > 0) {
      this.chunks.push(chunk);
      this.bases.push(this.queueEnd);
      this.queueEnd += chunk.length;
      if (this.queueEnd > this.maxEnd) this.maxEnd = this.queueEnd;
      this.syncBase();
    }
    this.run();
    return this.step();
  }

  /**
   * Het einde van de bron: alles vanaf de laatste positie is gelezen. Eindigt de bron na terugspoelen vóór wat de lezer
   * al eens las (een `seek` die niet werkt, of een bestand dat tijdens het lezen korter werd), dan is dat een leesfout:
   * nooit een eindeloze lus.
   */
  end(): TargetScanStep {
    if (this.result !== null) return { result: this.result };
    if (this.queueEnd < this.maxEnd) {
      throw new Error(`De bron eindigt na terugspoelen op ${this.queueEnd}, maar was al tot ${this.maxEnd} gelezen.`);
    }
    this.eof = true;
    this.run();
    return this.step();
  }

  private step(): TargetScanStep {
    if (this.result !== null) return { result: this.result };
    if (this.seekTo >= 0) return { seek: this.seekTo };
    return null;
  }

  private syncBase(): void {
    this.queueBase = this.first < this.chunks.length ? this.bases[this.first] : this.queueEnd;
  }

  private run(): void {
    for (;;) {
      if (this.result !== null || this.seekTo >= 0) return;
      if (this.pos >= this.queueEnd) {
        if (!this.eof) { this.trim(); return; }
        if (!this.atEnd()) return;
        continue;
      }
      // Vangnet: `moveTo` vraagt het terugspoelen al aan; hier komt de lus dus niet.
      if (this.pos < this.queueBase) { this.requestSeek(this.pos); return; }
      let k = this.chunks.length - 1;
      while (this.bases[k] > this.pos) k--;
      const chunk = this.chunks[k];
      const base = this.bases[k];
      this.processChunk(chunk, this.pos - base, base);
    }
  }

  /** Houd alleen vast wat terugspoelen nog nodig heeft: vanaf het teken na de `#` van een lopende entiteit. */
  private trim(): void {
    // Een eigen bestand dat breekt, en een bestand dat (tot nu toe) in de grammatica past: daarna leest de lezer vanaf de
    // regel van main. Houd dat deel vast, zodat hij niet opnieuw hoeft te lezen. Zolang niet bekend is of het een eigen
    // bestand is: alles.
    const main = this.mainEnd >= 0 ? this.mainEnd : this.lineEnd;
    const pending = this.phase !== Phase.Find ? -1 : this.ops === null ? 0 : this.ops || !this.grammar.failed ? main : -1;
    const keep = this.phase === Phase.Data && this.loop === Loop.Entity ? this.entAt + 1
      : pending >= 0 ? Math.min(pending, this.pos) : this.pos;
    while (this.first < this.chunks.length && this.bases[this.first] + this.chunks[this.first].length <= keep) {
      this.chunks[this.first] = EMPTY;
      this.first++;
    }
    const live = this.chunks.length - this.first;
    if (this.queueEnd - (live > 0 ? this.bases[this.first] : this.queueEnd) > RETAIN_BYTES || live > RETAIN_CHUNKS) {
      // Te veel: loslaten. Mislukt de entiteit later, dan leest de lezer de bron opnieuw vanaf die positie.
      this.first = this.chunks.length;
    }
    if (this.first > 0 && this.first * 2 >= this.chunks.length) {
      this.chunks = this.chunks.slice(this.first);
      this.bases = this.bases.slice(this.first);
      this.first = 0;
    }
    this.syncBase();
  }

  private requestSeek(target: number): void {
    this.chunks = [];
    this.bases = [];
    this.first = 0;
    this.queueBase = this.queueEnd = this.pos = target;
    this.seekTo = target;
    this.eof = false;
  }

  /** Verder lezen vanaf `target`: uit het geheugen, of de bron opnieuw vanaf daar. */
  private moveTo(target: number): void {
    this.pos = target;
    this.jumped = true;
    if (target < this.queueBase) this.requestSeek(target);
  }

  private processChunk(chunk: Uint8Array, start: number, base: number): void {
    if (this.phase === Phase.Find) { this.findPass(chunk, start, base); return; }
    if (this.headOk === null) {
      this.headOnly(chunk, start, base);
      if (this.result !== null) return;
    }
    if (this.phase === Phase.Wait) { this.pos = base + chunk.length; return; }
    this.dataPass(chunk, start, base);
  }

  // ── Kop ────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Eén byte vóór de datasectie: de BOM van de decoder, dan de kop en de vinder van `DATA;`. `true` = streng `DATA;`. */
  private frontByte(b: number, abs: number): boolean {
    if (this.contentStart < 0) {
      // De decoder (`TextDecoder`, `File.text()`) haalt een UTF-8-BOM vooraan weg: de tekst begint daarna.
      if (abs < 3 && b === BOM[abs]) {
        if (abs === 2) { this.contentStart = 3; this.headPos = 3; }
        return false;
      }
      this.contentStart = 0;
      for (let k = 0; k < abs; k++) if (this.textByte(BOM[k], k)) return true;
    }
    return this.textByte(b, abs);
  }

  private textByte(b: number, abs: number): boolean {
    if (this.headOk === null && abs >= this.headPos) {
      this.headPos = abs + 1;
      this.headByte(b);
      if (this.result !== null) return false;
    }
    const hit = this.finder.step(b, abs);
    if (hit && this.mainEnd < 0) this.mainEnd = abs + 1;
    return hit;
  }

  /** Direct na het eerste `DATA;` aan het begin van een regel, of -1. */
  private get lineEnd(): number {
    return this.finder.anchored < 0 ? -1 : this.finder.anchored + DATA_SEMI_LENGTH;
  }

  private headOnly(chunk: Uint8Array, start: number, base: number): void {
    for (let j = Math.max(start, this.headPos - base); j < chunk.length && this.headOk === null; j++) {
      this.headPos = base + j + 1;
      this.headByte(chunk[j]);
    }
  }

  private headByte(b: number): void {
    this.exactByte(b);
    this.firstByte(b);
    this.decideHead();
  }

  /** `assertIfcIntegrity`: één U+FEFF vooraan, witruimte (`isSpaceCode`), dan de kop. */
  private exactByte(b: number): void {
    if (this.exact === Exact.Done) return;
    if (this.exact === Exact.Bom) {
      if (b === BOM[this.exactBom]) {
        if (++this.exactBom === 3) this.exact = Exact.Space;
        return;
      }
      if (this.exactBom > 0) {
        // Toch geen U+FEFF: die bytes zijn tekst.
        for (let k = 0; k < this.exactBom; k++) this.probe[this.probeLength++] = BOM[k];
        this.exact = Exact.Collect;
      } else {
        this.exact = Exact.Space;
      }
    }
    if (this.exact === Exact.Space) {
      if (isSpace(b)) return;
      this.exact = Exact.Collect;
    }
    this.probe[this.probeLength++] = b;
    if (this.probeLength === HEAD_PROBE) this.decideExact();
  }

  private decideExact(): void {
    // Dezelfde vergelijking als `assertIfcIntegrity` (`toUpperCase`, ook voor niet-ASCII), op de gedecodeerde tekst.
    const head = new TextDecoder('utf-8', { ignoreBOM: true }).decode(this.probe.subarray(0, this.probeLength));
    this.exactOk = startsWithStepHeader(head, 0);
    this.exact = Exact.Done;
  }

  /** Fixronde 3: na witruimte en commentaar moet het eerste statement `ISO-10303-21;` zijn. */
  private firstByte(b: number): void {
    switch (this.firstState) {
      case First.Done:
        return;
      case First.Slash:
        if (b === STAR) this.firstState = First.Comment;
        else this.firstDone(false);
        return;
      case First.Comment:
        if (b === STAR) this.firstState = First.CommentStar;
        return;
      case First.CommentStar:
        if (b === SLASH) this.firstState = First.Space;
        else if (b !== STAR) this.firstState = First.Comment;
        return;
      case First.Space:
        if (b <= 0x20) return;
        if (b === SLASH) { this.firstState = First.Slash; return; }
        this.firstState = First.Keyword;
        break;
      case First.Keyword:
        break;
    }
    if (upper(b) !== HEADER[this.firstLength]) { this.firstDone(false); return; }
    if (++this.firstLength === HEADER.length) this.firstDone(true);
  }

  private firstDone(ok: boolean): void {
    this.firstOk = ok;
    this.firstState = First.Done;
  }

  private decideHead(): void {
    if (this.headOk !== null) return;
    if (this.exactOk === true || this.firstOk === true) this.headOk = true;
    else if (this.exactOk === false && this.firstOk === false) this.headOk = false;
    else return;
    if (!this.headOk) this.result = 'not-ifc';
    else if (this.modelPending) this.result = 'model';
    else if (this.unreadablePending) this.result = 'unreadable';
  }

  /** Het einde van het bestand vóór een beslissing over de kop. */
  private finishHead(): void {
    if (this.contentStart < 0) {
      // Een kort bestand dat met een deel van de BOM begint: dat deel is tekst.
      this.contentStart = 0;
      for (let k = 0; k < this.queueEnd && k < 3; k++) this.headByte(BOM[k]);
    }
    if (this.exact === Exact.Bom && this.exactBom > 0) {
      for (let k = 0; k < this.exactBom; k++) this.probe[this.probeLength++] = BOM[k];
      this.exact = Exact.Collect;
    }
    if (this.exact === Exact.Collect) this.decideExact();
    else if (this.exact !== Exact.Done) this.exactOk = false;
    if (this.firstState !== First.Done) this.firstDone(false);
    this.decideHead();
  }

  // ── Datasectie zoeken ──────────────────────────────────────────────────────────────────────────────────────────

  private findPass(chunk: Uint8Array, start: number, base: number): void {
    const n = chunk.length;
    const grammar = this.grammar;
    for (let i = start; i < n; i++) {
      const b = chunk[i];
      const abs = base + i;
      this.frontByte(b, abs);
      if (this.result !== null) return;
      if (this.prefixLength === abs && abs < OPS_PREFIX_MAX) {
        this.prefix[this.prefixLength++] = b;
        if (this.ops === null && (b === 0x0a || this.prefixLength === OPS_PREFIX_MAX)) this.ops = this.isOwnFile(false);
      }
      if (!grammar.failed) {
        grammar.step(b, abs);
        if (grammar.model) { this.pos = abs + 1; this.found(); return; }
        if (!grammar.failed) continue;
      }
      if (this.brokenFile(false, abs + 1)) return;
    }
    this.pos = base + n;
  }

  /**
   * De grammatica brak. Een bestand van een ander programma: 'unreadable'. Een eigen bestand (oude versies schreven de
   * kop rauw, besluit Trias, wrakko 10 november 2026): de regel van main, zodat de planner kan blijven opslaan. De lezer
   * leest dan vanaf het begin van de datasectie volgens main (poging 2, anders 3), met de lus van `parseSTEP`; zo zegt
   * hij 'model' precies als `readIFC` het bestand weigert. `true` als de lezer van plaats verandert of klaar is.
   */
  private brokenFile(atEof: boolean, next: number): boolean {
    if (this.ops === null) this.ops = this.isOwnFile(atEof);
    if (this.ops === false) { this.unreadable(); this.pos = next; return true; }
    if (this.ops === null) return false; // de regel met FILE_NAME is nog niet compleet
    return this.followMain(atEof, false);
  }

  /** Lees verder vanaf het begin van de datasectie volgens main, met de lus van `parseSTEP`. Vindt main geen `DATA;`:
   *  'no-model' als de grammatica het hele bestand zonder model las (`valid`), anders 'unreadable'. `true` als de lezer
   *  van plaats verandert of klaar is. */
  private followMain(atEof: boolean, valid: boolean): boolean {
    const end = this.mainEnd >= 0 ? this.mainEnd : atEof ? this.lineEnd : -1;
    if (end < 0) {
      if (!atEof) return false; // nog geen `DATA;` op codeniveau: verder lezen (aan het begin van een regel telt pas aan het einde)
      if (valid) this.result = 'no-model';
      else this.unreadable();
      return true;
    }
    this.startData();
    this.moveTo(end);
    this.jumped = false;
    return true;
  }

  /** Schreef OPS dit bestand? Vooraan staat de kop van OPS, en de regel met FILE_NAME eindigt met originating_system
   *  'Open Planner Studio'. `null`: nog niet te zeggen (de bytes zijn er nog niet). */
  private isOwnFile(atEof: boolean): boolean | null {
    let k = 0;
    const p = this.prefix;
    const length = this.prefixLength;
    const complete = atEof || length === OPS_PREFIX_MAX;
    // Een BOM vooraan: de decoder haalt hem weg.
    if (length >= 3 && p[0] === BOM[0] && p[1] === BOM[1] && p[2] === BOM[2]) k = 3;
    // De vaste kop, met `\r\n` of `\n`.
    for (let h = 0; h < OPS_HEAD.length; h++, k++) {
      const want = OPS_HEAD.charCodeAt(h);
      if (want === 0x0a && k < length && p[k] === 0x0d) k++;
      if (k >= length) return complete ? false : null;
      if (p[k] !== want) return false;
    }
    // De rest van de regel met FILE_NAME.
    let lineEnd = k;
    while (lineEnd < length && p[lineEnd] !== 0x0a && p[lineEnd] !== 0x0d) lineEnd++;
    if (lineEnd === length) return complete ? false : null;
    const tail = OPS_NAME_END.length;
    if (lineEnd - k < tail) return false;
    for (let t = 0; t < tail; t++) if (p[lineEnd - tail + t] !== OPS_NAME_END.charCodeAt(t)) return false;
    return true;
  }

  /** De grammatica vond geen datasectie: 'unreadable', zodra de kop beslist is (een andere kop is 'not-ifc'). */
  private unreadable(): void {
    if (this.headOk === true) { this.result = 'unreadable'; return; }
    this.unreadablePending = true;
    this.phase = Phase.Wait;
  }

  private startData(): void {
    this.phase = Phase.Data;
    this.strip = Strip.Code;
    this.loop = Loop.Code;
    this.endsec = 0;
  }

  /** Alles gelezen (vanaf de laatste positie). `true` = er is verder te lezen (terugspoelen, de tweede lezing). */
  private atEnd(): boolean {
    if (this.headOk === null) {
      this.finishHead();
      if (this.result !== null) return false;
    }
    if (this.modelPending) { this.result = 'model'; return false; }
    if (this.unreadablePending) { this.result = 'unreadable'; return false; }
    if (this.phase === Phase.Find) {
      // Het hele bestand past in de grammatica, zonder modelentiteit (die had de lezer al gemeld). Zonder datasectie
      // weigert `readIFC` het bestand: dan ook geen vrijbrief (besluit Trias, review van #870 ronde 6). Met één datasectie
      // nog de regel van main: weigert `readIFC` het als model, dan ook het doel (ronde 10). Met meer dan één datasectie
      // leest `readIFC` alleen de eerste (zoals main): dan de regel voor een kapot bestand (besluit Trias, ronde 10).
      if (!this.grammar.failed && this.grammar.end(this.pos) === 'valid' && this.grammar.dataSections <= 1) {
        if (this.grammar.dataSections === 0) { this.result = 'unreadable'; return false; }
        this.followMain(true, true);
        return this.result === null;
      }
      this.brokenFile(true, this.pos);
      return this.result === null;
    }
    if (this.strip === Strip.Slash) {
      // `stripStepComments`: een `/` aan het einde blijft staan.
      this.strip = Strip.Code;
      this.unit(SLASH, this.slashAt);
      if (this.result !== null) return false;
      if (this.jumped) { this.jumped = false; return true; }
    }
    if (this.loop === Loop.Entity) {
      // `readEntity` mislukt aan het einde van de tekst: `parseSTEP` leest verder vanaf het teken na de `#`.
      this.entityFailed();
      this.jumped = false;
      return true;
    }
    this.result = 'no-model';
    return false;
  }

  // ── Datasectie lezen ───────────────────────────────────────────────────────────────────────────────────────────

  private dataPass(chunk: Uint8Array, start: number, base: number): void {
    const n = chunk.length;
    let i = start;
    while (i < n) {
      // Snelle paden: dezelfde stappen als `dataByte` en `unit`, zonder functieaanroep per byte (een groot bestand zonder
      // model leest de lezer helemaal). Elk pad stopt bij een byte die de toestand anders verandert; die gaat hieronder
      // door `dataByte`.
      if (this.strip === Strip.Code && this.loop === Loop.Entity && !this.complex) {
        const ent = this.ent;
        if (ent === Ent.Args) {
          // Haakjes op diepte; stop bij `'` of `/`, of bij de sluithaak op diepte 0.
          let depth = this.depth;
          let b = 0;
          for (; i < n; i++) {
            b = chunk[i];
            if (ARG_PLAIN[b] === 1) continue;
            if (b === OPEN) { depth++; continue; }
            if (b === CLOSE && --depth > 0) continue;
            break;
          }
          this.depth = depth;
          if (i === n) break;
          if (b === CLOSE) { this.ent = Ent.End; i++; continue; }
          if (b === QUOTE) { this.strip = Strip.Str; this.ent = Ent.ArgStr; i++; continue; }
        } else if (ent === Ent.Id) {
          while (i < n && WORD[chunk[i]] === 1) i++;
          if (i === n) break;
        } else if (ent === Ent.Type) {
          let hash = this.typeHash;
          let length = this.typeLength;
          for (; i < n; i++) {
            const b = chunk[i];
            if (WORD[b] === 0) break;
            const v = b >= 0x61 ? b - 0x20 : b; // a-z → A-Z (cijfers en `_` liggen lager)
            hash = Math.imul(hash ^ v, FNV_PRIME);
            if (length < TYPE_MAX) this.type[length] = v;
            length++;
          }
          this.typeHash = hash;
          this.typeLength = length;
          if (i === n) break;
        }
      } else if (this.strip === Strip.Code && this.loop === Loop.Code && this.endsec === 0) {
        while (i < n && CODE_PLAIN[chunk[i]] === 1) i++;
        if (i === n) break;
      } else if (this.strip === Strip.Str
        && (this.loop === Loop.Str || (this.loop === Loop.Entity && this.ent === Ent.ArgStr))) {
        const j = chunk.indexOf(QUOTE, i);
        if (j < 0) { i = n; break; }
        if (j + 1 < n) {
          // `''` blijft in de string; een ander teken sluit hem (zoals `StrQuote`), en dat teken is weer code.
          if (chunk[j + 1] === QUOTE) { i = j + 2; continue; }
          this.strip = Strip.Code;
          if (this.loop === Loop.Str) this.loop = Loop.Code;
          else this.ent = Ent.Args;
          i = j + 1;
          continue;
        }
        i = j; // de `'` is de laatste byte van het stuk: de gewone weg
      } else if (this.strip === Strip.Comment) {
        const j = chunk.indexOf(STAR, i);
        if (j < 0) { i = n; break; }
        i = j;
      }
      this.dataByte(chunk[i], base + i);
      i++;
      if (this.jumped) { this.jumped = false; return; }
      if (this.result !== null || this.phase !== Phase.Data) { this.pos = base + i; return; }
    }
    this.pos = base + n;
  }

  /** Eén byte door `stripStepComments`: commentaar valt weg, de rest gaat als teken naar de lus. */
  private dataByte(b: number, abs: number): void {
    switch (this.strip) {
      case Strip.Code:
        if (b === QUOTE) { this.strip = Strip.Str; this.unit(b, abs); return; }
        if (b === SLASH) { this.strip = Strip.Slash; this.slashAt = abs; return; }
        this.unit(b, abs);
        return;
      case Strip.Slash:
        if (b === STAR) { this.strip = Strip.Comment; return; }
        this.strip = Strip.Code;
        this.unit(SLASH, this.slashAt);
        if (this.jumped || this.result !== null || this.phase !== Phase.Data) return;
        this.dataByte(b, abs);
        return;
      case Strip.Str:
        if (b === QUOTE) this.strip = Strip.StrQuote;
        this.unit(b, abs);
        return;
      case Strip.StrQuote:
        if (b === QUOTE) { this.strip = Strip.Str; this.unit(b, abs); return; } // `''` in de string
        this.strip = Strip.Code;
        this.dataByte(b, abs);
        return;
      case Strip.Comment:
        if (b === STAR) this.strip = Strip.CommentStar;
        return;
      case Strip.CommentStar:
        if (b === SLASH) this.strip = Strip.Code;
        else if (b !== STAR) this.strip = Strip.Comment;
        return;
    }
  }

  /** Eén teken (zonder commentaar) in de lus van `parseSTEP`. */
  private unit(u: number, at: number): void {
    switch (this.loop) {
      case Loop.Entity:
        this.entityUnit(u);
        return;
      case Loop.Str:
        if (u === QUOTE) this.loop = Loop.StrQuote;
        return;
      case Loop.StrQuote:
        if (u === QUOTE) { this.loop = Loop.Str; return; }
        this.loop = Loop.Code;
        break;
      case Loop.Code:
        break;
    }
    if (u === QUOTE) { this.endsec = 0; this.loop = Loop.Str; return; }
    if (u === HASH) { this.endsec = 0; this.startEntity(at); return; }
    this.endsecUnit(u);
  }

  /** Review van #870, ronde 8 (Terra): `parseSTEP` stopt in een kapot bestand bij de eerste `ENDSEC;` op codeniveau
   *  (zoals main); daarna leest hij niets meer. Na `ENDSE` kan de `E` het begin van een nieuwe `ENDSEC;` zijn. */
  private endsecUnit(u: number): void {
    let k = this.endsec;
    for (;;) {
      if (u === ENDSEC[k]) { k++; break; }
      if (k === 0) break;
      k = k === 5 ? 1 : 0;
    }
    if (k < ENDSEC.length) { this.endsec = k; return; }
    this.endsec = 0;
    if (this.headOk === true) { this.result = 'no-model'; return; }
    this.phase = Phase.Wait; // de kop is nog niet beslist: aan het einde 'no-model'
  }

  private startEntity(at: number): void {
    this.loop = Loop.Entity;
    this.ent = Ent.Id0;
    this.entAt = at;
    // De toestand van `stripStepComments` ná de `#`: daar gaat terugspoelen verder.
    this.entStrip = this.strip;
    this.complex = false;
    this.resetType();
  }

  /** `readEntity`, teken voor teken. */
  private entityUnit(u: number): void {
    switch (this.ent) {
      case Ent.Id0:
        if (isWord(u)) { this.ent = Ent.Id; return; }
        this.entityFailed();
        return;
      case Ent.Id:
        if (isWord(u)) return;
        if (isSpace(u)) { this.ent = Ent.SpaceId; return; }
        if (u === EQ) { this.ent = Ent.Eq; return; }
        this.entityFailed();
        return;
      case Ent.SpaceId:
        if (isSpace(u)) return;
        if (u === EQ) { this.ent = Ent.Eq; return; }
        this.entityFailed();
        return;
      case Ent.Eq:
        if (isSpace(u)) return;
        if (isWord(u)) { this.ent = Ent.Type; this.pushType(u); return; }
        if (u === OPEN) {
          // `#n=(`: een complexe instantie. `readEntity` mislukt hier; deze lezer kijkt eerst naar de deeltypen.
          this.complex = true;
          this.ent = Ent.Args;
          this.depth = 1;
          this.name = 0;
          return;
        }
        this.entityFailed();
        return;
      case Ent.Type:
        if (isWord(u)) { this.pushType(u); return; }
        if (isSpace(u)) { this.ent = Ent.SpaceType; return; }
        if (u === OPEN) { this.ent = Ent.Args; this.depth = 1; return; }
        this.entityFailed();
        return;
      case Ent.SpaceType:
        if (isSpace(u)) return;
        if (u === OPEN) { this.ent = Ent.Args; this.depth = 1; return; }
        this.entityFailed();
        return;
      case Ent.Args:
        this.argUnit(u);
        return;
      case Ent.ArgStr:
        if (u === QUOTE) this.ent = Ent.ArgStrQuote;
        return;
      case Ent.ArgStrQuote:
        if (u === QUOTE) { this.ent = Ent.ArgStr; return; }
        this.ent = Ent.Args;
        this.argUnit(u);
        return;
      case Ent.ArgSlash:
        if (u === STAR) { this.ent = Ent.ArgComment; return; }
        this.ent = Ent.Args;
        this.argUnit(u);
        return;
      case Ent.ArgComment:
        if (u === STAR) this.ent = Ent.ArgCommentStar;
        return;
      case Ent.ArgCommentStar:
        if (u === SLASH) this.ent = Ent.Args;
        else if (u !== STAR) this.ent = Ent.ArgComment;
        return;
      case Ent.End:
        if (isSpace(u)) return;
        if (u === SEMI) { this.entityDone(); return; }
        this.entityFailed();
        return;
    }
  }

  /** Een teken in de argumenten: haakjes op diepte, strings en commentaar overslaan (`skipQuotedOrComment`). */
  private argUnit(u: number): void {
    if (u === QUOTE) { this.ent = Ent.ArgStr; this.name = 0; return; }
    if (u === SLASH) { this.ent = Ent.ArgSlash; this.name = 0; return; }
    if (u === OPEN) {
      if (this.complex && this.depth === 1 && this.name !== 0) {
        // Een deelrecord `A(`: is A een modeltype? (strenger dan `readIFC`, zie de kop van dit bestand)
        if (isModelType(this.type, this.typeLength, this.typeHash)) { this.found(); return; }
      }
      this.depth++;
      this.name = 0;
      return;
    }
    if (u === CLOSE) {
      this.depth--;
      this.name = 0;
      if (this.depth === 0) {
        if (this.complex) this.entityFailed(); // geen entiteit voor `readIFC`: verder na de `#`
        else this.ent = Ent.End;
      }
      return;
    }
    if (!this.complex || this.depth !== 1) return;
    if (isWord(u)) {
      if (this.name !== 1) { this.name = 1; this.resetType(); }
      this.pushType(u);
    } else if (isSpace(u)) {
      if (this.name === 1) this.name = 2;
    } else {
      this.name = 0;
    }
  }

  private pushType(u: number): void {
    const v = upper(u);
    this.typeHash = Math.imul(this.typeHash ^ v, FNV_PRIME);
    if (this.typeLength < TYPE_MAX) this.type[this.typeLength] = v;
    this.typeLength++;
  }

  private resetType(): void {
    this.typeLength = 0;
    this.typeHash = FNV_OFFSET;
  }

  private entityDone(): void {
    if (isModelType(this.type, this.typeLength, this.typeHash)) { this.found(); return; }
    this.loop = Loop.Code;
  }

  /** `readEntity` geeft -1: `parseSTEP` gaat verder op het teken na de `#`, in de toestand van toen. */
  private entityFailed(): void {
    this.strip = this.entStrip;
    this.loop = Loop.Code;
    this.endsec = 0;
    this.complex = false;
    this.moveTo(this.entAt + 1);
  }

  private found(): void {
    if (this.headOk === true) { this.result = 'model'; return; }
    // De kop is nog niet beslist (een heel kort bestand): wachten.
    this.modelPending = true;
    this.phase = Phase.Wait;
  }
}

/** Lees `source` tot de uitkomst vaststaat; stopt bij de eerste modelentiteit. Een leesfout gaat door; de bron gaat dicht. */
export async function scanTargetSource(source: TargetSource): Promise<TargetModelScan> {
  const scanner = new TargetModelScanner();
  try {
    for (;;) {
      const chunk = await source.next();
      const step = chunk === null ? scanner.end() : scanner.push(chunk);
      if (step === null) continue;
      if ('result' in step) return step.result;
      await source.seek(step.seek);
    }
  } finally {
    await source.close?.();
  }
}

/** Een `Blob` (de `File` van een FSA-handle) als stroom; terugspoelen met `slice`. */
export function scanTargetBlob(blob: Blob): Promise<TargetModelScan> {
  let reader = blob.stream().getReader();
  const cancel = async () => { try { await reader.cancel(); } catch { /* al dicht */ } };
  return scanTargetSource({
    next: async () => { const r = await reader.read(); return r.done ? null : r.value; },
    seek: async (offset) => { await cancel(); reader = blob.slice(offset).stream().getReader(); },
    close: cancel,
  });
}

/** Bytes die al in het geheugen staan (bijv. van de site). */
export function scanTargetBytes(bytes: Uint8Array): TargetModelScan {
  const scanner = new TargetModelScanner();
  let step = scanner.push(bytes);
  for (;;) {
    if (step === null) step = scanner.end();
    else if ('result' in step) return step.result;
    else step = scanner.push(bytes.subarray(step.seek));
  }
}
