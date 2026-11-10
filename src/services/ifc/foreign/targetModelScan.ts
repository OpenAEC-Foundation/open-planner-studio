// Bevat een bestaand doel van Opslaan als, een export of AutoSave een gebouwmodel (#804 fase 1a, fixronde 2–4)? Besluit
// Trias (wrakko, 9 november 2026): de app controleert het gekozen bestaande doel zelf. Is het een IFC met een
// `IfcProduct` of `IfcTypeProduct` (dezelfde ingecheckte type-inventaris als de modelweigering bij openen,
// `IFC_BUILDING_MODEL_TYPES`), dan schrijft de app niet. Zo is ook een gewijzigde modelversie, of een modelbestand dat
// niet open is, beschermd.
//
// De regel (Trias, fixronde 4): de doelcontrole zegt 'model' precies als `readIFC` het bestand weigert met
// `building-model`. Daarom volgt deze lezer de route van `readIFC` stap voor stap, als stroom van bytes:
//  1. de kop: `assertIfcIntegrity` (BOM, witruimte, `ISO-10303-21;`; de kopregel uit `stepDataSection.ts`);
//  2. het begin van de datasectie: dezelfde `StepDataSectionFinder` als `indexOfDataSection` (`stepDataSection.ts`;
//     eis van Trias: één bron). Eerst het strenge `DATA;`; vindt de lezer dat in het hele bestand niet, dan leest hij
//     het bestand opnieuw vanaf het eerste regel-verankerde `DATA;` (de tweede lezing);
//  3. na `DATA;`: commentaar weg, zoals `stripStepComments`;
//  4. de lus van `parseSTEP` met `readEntity`: op codeniveau een `'…'` overslaan, bij `#` een entiteit proberen
//     (`#id = TYPE (…) ;`, met haakjes op diepte, strings en commentaar in de argumenten), bij `ENDSEC;` stoppen.
//     Mislukt een entiteit, dan leest `readIFC` verder vanaf het teken na de `#`; deze lezer spoelt daarvoor terug
//     (uit het geheugen, of door de bron opnieuw te lezen vanaf die positie).
// Stap 3 en 4 zijn een tweede vorm van de regels in `ifcReader.ts` (`stripStepComments`, `parseSTEP`, `readEntity`):
// die werken op de hele tekst, deze als stroom. Delen kon niet zonder `parseSTEP` om te bouwen.
// `check-ifc-target-model-scan.ts` vergelijkt beide op het hele corpus en op willekeurige invoer (verschiltest).
// Wijzig je de regels daar, wijzig ze dan hier ook.
//
// De uitkomst en wat hij betekent (fixronde 3: een scan zonder uitkomst is geen vrijbrief):
//  - 'model': een entiteit met een modeltype op de route van `readIFC`. Niet schrijven.
//  - 'no-model': de lezer las het HELE bestand (ook na `ENDSEC;`) zonder modelentiteit. Schrijven mag.
//  - 'not-ifc': het bestand begint niet met `ISO-10303-21;` (CSV, XML, JSON, een leeg bestand). Schrijven mag.
// Een andere uitkomst bestaat niet: 'no-model' komt alleen aan het einde van het bestand. Stopt het lezen vóór het einde
// (een leesfout), dan is er geen uitkomst; de aanroeper telt dat als "niet leesbaar".
//
// Bewust strenger dan `readIFC` (besluit; dan weigert de app een write die de lezer zou toestaan, nooit andersom):
//  - een complexe instantie `#n=(A(…)B(…));` met een modeltype als deeltype telt als model (fixronde 3). `readIFC` ziet
//    zo'n instantie niet; een geldig IFC bevat ze niet (knownbug 1016);
//  - een bestand dat `readIFC` niet kan openen, maar dat wel een modelentiteit heeft: commentaar vóór de kop (de regel
//    van fixronde 3: het eerste statement telt), of geen `END-ISO-10303-21;` aan het einde (afgekapt). De lezer kijkt
//    niet naar de sluitmarkering: dan zou hij nooit vroeg kunnen stoppen.
//
// De lezer stopt bij de eerste modelentiteit. Een groot bestand zonder model leest hij helemaal, maar als stroom.
import { IFC_BUILDING_MODEL_TYPES } from '../ifcBuildingModelTypes';
import { STEP_HEADER, StepDataSectionFinder, startsWithStepHeader } from '../stepDataSection';

/** Uitkomst van de controle; zie de kop van dit bestand voor de betekenis. */
export type TargetModelScan = 'model' | 'no-model' | 'not-ifc';

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
/** `ENDSEC;` (hoofdlettergevoelig, zoals `parseSTEP`), met de KMP-tabel: na `ENDSE` past alleen `E` opnieuw. */
const ENDSEC = [0x45, 0x4e, 0x44, 0x53, 0x45, 0x43, 0x3b];
const ENDSEC_FAIL = [0, 0, 0, 0, 1, 0, 0];
/** Zoveel houdt de lezer vast voor terugspoelen; daarboven leest hij de bron opnieuw vanaf die positie. */
const RETAIN_BYTES = 16 << 20;
const RETAIN_CHUNKS = 4096;
/** Bytes die in de argumenten van een entiteit niets doen (alleen `'`, `/`, `(` en `)` tellen). */
const ARG_PLAIN = new Uint8Array(256).fill(1);
ARG_PLAIN[QUOTE] = 0;
ARG_PLAIN[SLASH] = 0;
ARG_PLAIN[OPEN] = 0;
ARG_PLAIN[CLOSE] = 0;
/** Bytes die tussen entiteiten niets doen, zolang er geen deel van `ENDSEC;` loopt (alleen `'`, `/`, `#` en `E` tellen). */
const CODE_PLAIN = new Uint8Array(256).fill(1);
CODE_PLAIN[QUOTE] = 0;
CODE_PLAIN[SLASH] = 0;
CODE_PLAIN[HASH] = 0;
CODE_PLAIN[0x45] = 0; // E
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
const enum Loop { Code, Str, StrQuote, Entity, Done }
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
  private readonly finder = new StepDataSectionFinder(true);
  private secondPass = false;
  private modelPending = false;
  // ── Datasectie lezen ──
  private strip = Strip.Code;
  private slashAt = 0;
  private loop = Loop.Code;
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
    const keep = this.phase === Phase.Data && this.loop === Loop.Entity ? this.entAt + 1 : this.pos;
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
    return this.finder.step(b, abs);
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
    for (let i = start; i < n; i++) {
      const strict = this.frontByte(chunk[i], base + i);
      if (this.result !== null) return;
      if (strict) {
        // `readIFC` leest vanaf het eerste strenge `DATA;`: de datasectie begint na de `;`.
        this.startData();
        this.pos = base + i + 1;
        return;
      }
    }
    this.pos = base + n;
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
    if (this.phase === Phase.Find) {
      if (!this.secondPass && this.finder.anchored >= 0) {
        // Geen streng `DATA;` in het hele bestand (de kop loopt uit de pas, bijvoorbeeld door een losse apostrof):
        // `readIFC` leest dan vanaf het eerste regel-verankerde `DATA;`. Dat leest deze lezer opnieuw.
        this.secondPass = true;
        this.startData();
        this.moveTo(this.finder.anchored + 5);
        this.jumped = false;
        return true;
      }
      this.result = 'no-model'; // geen datasectie: `readIFC` weigert met 'no-data-section'
      return false;
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
      } else if (this.loop === Loop.Done) {
        i = n; // na `ENDSEC;` leest `readIFC` niets meer; deze lezer leest het bestand wel uit
        break;
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
      case Loop.Done:
        return;
      case Loop.Code:
        break;
    }
    if (u === QUOTE) { this.endsec = 0; this.loop = Loop.Str; return; }
    if (u === HASH) { this.endsec = 0; this.startEntity(at); return; }
    let k = this.endsec;
    while (k > 0 && u !== ENDSEC[k]) k = ENDSEC_FAIL[k - 1];
    if (u === ENDSEC[k]) k++;
    if (k === ENDSEC.length) { this.loop = Loop.Done; k = 0; }
    this.endsec = k;
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
    this.endsec = 0;
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
