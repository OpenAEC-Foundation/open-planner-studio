import { StepStringState, isStepControl, stepString } from '../stepLexical';
import { IFC_BUILDING_MODEL_TYPES } from '../ifcBuildingModelTypes';
import { STEP_HEADER, StepDataSectionFinder, startsWithStepHeader } from '../stepDataSection';
import { OLD_OWN_HEADER_PREFIX_MAX, recognizeOldOwnHeader } from '../oldOwnHeader';
import { StepFileGrammar } from '../stepFileGrammar';

export type TargetModelScan = 'model' | 'no-model' | 'not-ifc' | 'unreadable';

export interface TargetSource {
  next(): Promise<Uint8Array | null>;
  seek(offset: number): Promise<void>;
  close?(): Promise<void> | void;
}

export type TargetScanStep = { readonly result: TargetModelScan } | { readonly seek: number } | null;

const QUOTE = 0x27;
const SLASH = 0x2f;
const STAR = 0x2a;
const SEMI = 0x3b;
const OPEN = 0x28;
const CLOSE = 0x29;
const HASH = 0x23;
const EQ = 0x3d;
const BOM = [0xef, 0xbb, 0xbf];
const HEADER = Array.from(STEP_HEADER, c => c.charCodeAt(0));
const HEAD_PROBE = 64;
const TYPE_MAX = 96;
const RETAIN_BYTES = 16 << 20;
const RETAIN_CHUNKS = 4096;
const ARG_PLAIN = new Uint8Array(256).fill(1);
ARG_PLAIN[QUOTE] = 0;
ARG_PLAIN[SLASH] = 0;
ARG_PLAIN[OPEN] = 0;
ARG_PLAIN[CLOSE] = 0;
const CODE_PLAIN = new Uint8Array(256).fill(1);
CODE_PLAIN[QUOTE] = 0;
CODE_PLAIN[SLASH] = 0;
CODE_PLAIN[HASH] = 0;
CODE_PLAIN[0x45] = 0;
const ENDSEC = Array.from('ENDSEC;', c => c.charCodeAt(0));
const WORD = new Uint8Array(256);
for (let b = 0; b < 256; b++) {
  if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x5f) WORD[b] = 1;
}
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MODEL_HASH = new Uint8Array(1 << 16);
for (const type of IFC_BUILDING_MODEL_TYPES) {
  let h = FNV_OFFSET;
  for (let k = 0; k < type.length; k++) h = Math.imul(h ^ type.charCodeAt(k), FNV_PRIME);
  MODEL_HASH[h & 0xffff] = 1;
}
const EMPTY = new Uint8Array(0);
const DATA_SEMI_LENGTH = 5;
const upper = (b: number) => (b >= 0x61 && b <= 0x7a ? b - 0x20 : b);
const isWord = (b: number) => WORD[b] === 1;
const isSpace = (b: number) => b === 0x20 || (b >= 0x09 && b <= 0x0d);
const text = (buf: Uint8Array, length: number) => String.fromCharCode.apply(null, buf.subarray(0, length) as unknown as number[]);

function isModelType(buf: Uint8Array, length: number, hash: number): boolean {
  if (length === 0 || length > TYPE_MAX || MODEL_HASH[hash & 0xffff] === 0) return false;
  return IFC_BUILDING_MODEL_TYPES.has(text(buf, length));
}

const enum Phase { Find, Data, Wait }
const enum Exact { Bom, Space, Collect, Done }
const enum First { Space, Slash, Comment, CommentStar, Keyword, Done }
const enum Strip { Code, Slash, Str, Comment, CommentStar }
const enum Loop { Code, Str, StrQuote, Entity }
const enum Ent { Id0, Id, SpaceId, Eq, Type, SpaceType, Args, ArgStr, ArgStrQuote, ArgSlash, ArgComment, ArgCommentStar, End }

export class TargetModelScanner {
  private result: TargetModelScan | null = null;
  private chunks: Uint8Array[] = [];
  private bases: number[] = [];
  private first = 0;
  private queueBase = 0;
  private queueEnd = 0;
  private maxEnd = 0;
  private pos = 0;
  private eof = false;
  private seekTo = -1;
  private jumped = false;
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
  private phase = Phase.Find;
  private readonly grammar = new StepFileGrammar(true);
  private readonly finder = new StepDataSectionFinder(true);
  private readonly literalFinder = new StepDataSectionFinder(true, true);
  private literalEnd = -1;
  private literalStrings = false;
  private mainEnd = -1;
  private prefix = new Uint8Array(256);
  private prefixLength = 0;
  private ownDataEnd = -1;
  private ops: boolean | null = null;
  private modelPending = false;
  private unreadablePending = false;
  private strip = Strip.Code;
  private stringState = StepStringState.Text;
  private slashAt = 0;
  private loop = Loop.Code;
  private endsec = 0;
  private ent = Ent.Id0;
  private entAt = 0;
  private entStrip = Strip.Code;
  private depth = 0;
  private complex = false;
  private name = 0;
  private readonly type = new Uint8Array(TYPE_MAX);
  private typeLength = 0;
  private typeHash = FNV_OFFSET;

  get done(): TargetModelScan | null { return this.result; }

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
      if (this.pos < this.queueBase) { this.requestSeek(this.pos); return; }
      let k = this.chunks.length - 1;
      while (this.bases[k] > this.pos) k--;
      const chunk = this.chunks[k];
      const base = this.bases[k];
      this.processChunk(chunk, this.pos - base, base);
    }
  }

  private trim(): void {
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

  private frontByte(b: number, abs: number): boolean {
    if (this.contentStart < 0) {
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
    if (this.literalFinder.step(b, abs) && this.literalEnd < 0) this.literalEnd = abs + 1;
    const hit = this.finder.step(b, abs);
    if (hit && this.mainEnd < 0) this.mainEnd = abs + 1;
    return hit;
  }

  private get lineEnd(): number {
    const finder = this.grammar.failed || this.grammar.literalStrings ? this.literalFinder : this.finder;
    return finder.anchored < 0 ? -1 : finder.anchored + DATA_SEMI_LENGTH;
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

  private exactByte(b: number): void {
    if (this.exact === Exact.Done) return;
    if (this.exact === Exact.Bom) {
      if (b === BOM[this.exactBom]) {
        if (++this.exactBom === 3) this.exact = Exact.Space;
        return;
      }
      if (this.exactBom > 0) {
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
    const head = new TextDecoder('utf-8', { ignoreBOM: true }).decode(this.probe.subarray(0, this.probeLength));
    this.exactOk = startsWithStepHeader(head, 0);
    this.exact = Exact.Done;
  }

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

  private finishHead(): void {
    if (this.contentStart < 0) {
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

  private findPass(chunk: Uint8Array, start: number, base: number): void {
    const n = chunk.length;
    const grammar = this.grammar;
    for (let i = start; i < n; i++) {
      const b = chunk[i];
      const abs = base + i;
      this.frontByte(b, abs);
      if (this.result !== null) return;
      if (this.ops === null && this.prefixLength === abs) {
        if (this.prefixLength === this.prefix.length) {
          const grown = new Uint8Array(this.prefix.length * 2);
          grown.set(this.prefix);
          this.prefix = grown;
        }
        this.prefix[this.prefixLength++] = b;
        if (b === 0x0a || this.prefixLength <= STEP_HEADER.length || this.prefixLength === OLD_OWN_HEADER_PREFIX_MAX) this.recognizeOwnHead(false);
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

  private brokenFile(atEof: boolean, next: number): boolean {
    if (this.ops === null && atEof) this.recognizeOwnHead(true);
    if (this.ops === false) { this.unreadable(); this.pos = next; return true; }
    if (this.ops === null) return false;
    return this.followMain(atEof, false);
  }

  private followMain(atEof: boolean, valid: boolean): boolean {
    this.literalStrings = this.grammar.failed || this.grammar.literalStrings;
    const dataEnd = this.ownDataEnd >= 0 ? this.ownDataEnd : this.literalStrings ? this.literalEnd : this.mainEnd;
    const end = dataEnd >= 0 ? dataEnd : atEof ? this.lineEnd : -1;
    if (end < 0) {
      if (!atEof) return false;
      if (valid) this.result = 'no-model';
      else this.unreadable();
      return true;
    }
    this.startData();
    this.moveTo(end);
    this.jumped = false;
    return true;
  }

  private recognizeOwnHead(atEof: boolean): void {
    const own = recognizeOldOwnHeader(this.prefix.subarray(0, this.prefixLength), atEof);
    if (own === undefined) return;
    this.ops = own !== null;
    if (own && own !== 'main') this.ownDataEnd = own.dataStart + DATA_SEMI_LENGTH;
    this.prefix = EMPTY;
  }

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

  private atEnd(): boolean {
    if (this.headOk === null) {
      this.finishHead();
      if (this.result !== null) return false;
    }
    if (this.modelPending) { this.result = 'model'; return false; }
    if (this.unreadablePending) { this.result = 'unreadable'; return false; }
    if (this.phase === Phase.Find) {
      if (!this.grammar.failed && this.grammar.end(this.pos) === 'valid' && this.grammar.dataSections <= 1) {
        if (this.grammar.dataSections === 0) { this.result = 'unreadable'; return false; }
        this.followMain(true, true);
        return this.result === null;
      }
      this.brokenFile(true, this.pos);
      return this.result === null;
    }
    if (this.strip === Strip.Slash) {
      this.strip = Strip.Code;
      this.unit(SLASH, this.slashAt);
      if (this.result !== null) return false;
      if (this.jumped) { this.jumped = false; return true; }
    }
    if (this.loop === Loop.Entity) {
      this.entityFailed();
      this.jumped = false;
      return true;
    }
    this.result = 'no-model';
    return false;
  }

  private dataPass(chunk: Uint8Array, start: number, base: number): void {
    const n = chunk.length;
    let i = start;
    while (i < n) {
      if (this.strip === Strip.Code && this.loop === Loop.Entity && !this.complex) {
        const ent = this.ent;
        if (ent === Ent.Args) {
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
          if (b === QUOTE) { this.strip = Strip.Str; this.stringState = StepStringState.Text; this.ent = Ent.ArgStr; i++; continue; }
        } else if (ent === Ent.Id) {
          while (i < n && WORD[chunk[i]] === 1) i++;
          if (i === n) break;
        } else if (ent === Ent.Type) {
          let hash = this.typeHash;
          let length = this.typeLength;
          for (; i < n; i++) {
            const b = chunk[i];
            if (WORD[b] === 0) break;
            const v = b >= 0x61 ? b - 0x20 : b;
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
      } else if (this.strip === Strip.Str && this.stringState === StepStringState.Text) {
        while (i < n && chunk[i] !== QUOTE && chunk[i] !== 0x5c) i++;
        if (i === n) break;
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

  private dataByte(b: number, abs: number): void {
    switch (this.strip) {
      case Strip.Code:
        if (b === QUOTE) { this.strip = Strip.Str; this.stringState = StepStringState.Text; this.unit(b, abs); return; }
        if (b === SLASH) { this.strip = Strip.Slash; this.slashAt = abs; return; }
        this.unit(b, abs);
        return;
      case Strip.Slash:
        if (isStepControl(b)) return;
        if (b === STAR) { this.strip = Strip.Comment; return; }
        this.strip = Strip.Code;
        this.unit(SLASH, this.slashAt);
        if (this.jumped || this.result !== null || this.phase !== Phase.Data) return;
        this.dataByte(b, abs);
        return;
      case Strip.Str:
        this.stringState = stepString(this.stringState, b, this.literalStrings);
        if (this.stringState !== StepStringState.End) return;
        this.strip = Strip.Code;
        this.unit(QUOTE, abs);
        this.dataByte(b, abs);
        return;
      case Strip.Comment:
        if (b === STAR) this.strip = Strip.CommentStar;
        return;
      case Strip.CommentStar:
        if (isStepControl(b)) return;
        if (b === SLASH) this.strip = Strip.Code;
        else if (b !== STAR) this.strip = Strip.Comment;
        return;
    }
  }

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
    this.phase = Phase.Wait;
  }

  private startEntity(at: number): void {
    this.loop = Loop.Entity;
    this.ent = Ent.Id0;
    this.entAt = at;
    this.entStrip = this.strip;
    this.complex = false;
    this.resetType();
  }

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

  private argUnit(u: number): void {
    if (u === QUOTE) { this.ent = Ent.ArgStr; this.name = 0; return; }
    if (u === SLASH) { this.ent = Ent.ArgSlash; this.name = 0; return; }
    if (u === OPEN) {
      if (this.complex && this.depth === 1 && this.name !== 0) {
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
        if (this.complex) this.entityFailed();
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

  private entityFailed(): void {
    this.strip = this.entStrip;
    this.loop = Loop.Code;
    this.endsec = 0;
    this.complex = false;
    this.moveTo(this.entAt + 1);
  }

  private found(): void {
    if (this.headOk === true) { this.result = 'model'; return; }
    this.modelPending = true;
    this.phase = Phase.Wait;
  }
}

export function targetScanPush(): (chunk: Uint8Array | null) => TargetScanStep {
  const scanner = new TargetModelScanner();
  return chunk => (chunk === null ? scanner.end() : scanner.push(chunk));
}

export async function driveTargetScan(
  source: Pick<TargetSource, 'next' | 'seek'>,
  push: (chunk: Uint8Array | null) => TargetScanStep | Promise<TargetScanStep>,
): Promise<TargetModelScan> {
  for (;;) {
    const step = await push(await source.next());
    if (step === null) continue;
    if ('result' in step) return step.result;
    await source.seek(step.seek);
  }
}

export async function scanTargetSource(source: TargetSource): Promise<TargetModelScan> {
  try {
    return await driveTargetScan(source, targetScanPush());
  } finally {
    await source.close?.();
  }
}

export function scanTargetBlob(blob: Blob): Promise<TargetModelScan> {
  let reader = blob.stream().getReader();
  const cancel = async () => { try { await reader.cancel(); } catch { } };
  return scanTargetSource({
    next: async () => { const r = await reader.read(); return r.done ? null : r.value; },
    seek: async (offset) => { await cancel(); reader = blob.slice(offset).stream().getReader(); },
    close: cancel,
  });
}

export function scanTargetBytes(bytes: Uint8Array): TargetModelScan {
  const scanner = new TargetModelScanner();
  let step = scanner.push(bytes);
  for (;;) {
    if (step === null) step = scanner.end();
    else if ('result' in step) return step.result;
    else step = scanner.push(bytes.subarray(step.seek));
  }
}
