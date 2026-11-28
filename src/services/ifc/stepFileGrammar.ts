import { StepStringState, isStepControl, stepString } from './stepLexical';
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
const LETTER_N = 0x4e;
const LETTER_F = 0x46;

const BOM_BYTES = [0xef, 0xbb, 0xbf];
const upper = (c: number) => (c >= 0x61 && c <= 0x7a ? c - 0x20 : c);
const isUpper = (u: number) => (u >= 0x41 && u <= 0x5a) || u === UNDERSCORE;
const isDigit = (u: number) => u >= 0x30 && u <= 0x39;
const isWordChar = (u: number) => isUpper(u) || isDigit(u)
  || u === MINUS || u === PLUS || u === DOT || u === DOLLAR || u === STAR || u === HASH || u === AT || u === BANG;

const WORD_MAX = 1 << 20;
const DEPTH_MAX = 4096;
const HEADER_ENTITIES: readonly (readonly [string, number])[] = [['FILE_DESCRIPTION', 2], ['FILE_NAME', 7], ['FILE_SCHEMA', 1]];

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MODEL_HASH = new Uint8Array(1 << 16);
const MODEL_TYPE_MAX = Math.max(...[...IFC_BUILDING_MODEL_TYPES].map(type => type.length));
for (const type of IFC_BUILDING_MODEL_TYPES) {
  let h = FNV_OFFSET;
  for (let k = 0; k < type.length; k++) h = Math.imul(h ^ type.charCodeAt(k), FNV_PRIME);
  MODEL_HASH[h & 0xffff] = 1;
}

const enum Lex { Code, Word, Str, BinFirst, Bin, Uri, Slash, Comment, CommentStar, Back, BackLetter }
const enum Sec { Start, Pre, Header, Between, Anchor, Reference, Data, End }
const enum P {
  Stmt,
  Semi,
  HeadOpen,
  Params,
  HeadSemi,
  DataHead,
  InstEq,
  InstVal,
  RecOpen,
  SimpleSemi,
  ComplexNext,
  ComplexSemi,
  AnchorEq,
  AnchorVal,
  RefVal,
}
const enum X { ValueOrClose, Value, AfterKeyword, Sep }
const enum Ctx { Record, List, Typed }
const enum W { Keyword, Name, Enum, Number, Dollar, Star, Bad }

export type StepGrammarState = 'running' | 'valid' | 'failed';

export class StepFileGrammar {
  dataSections = 0;
  model = false;
  failedAt = -1;

  private meta: 'application' | 'pset' | undefined;
  private capture: 'version' | 'identifier' | 'pset' | undefined;
  private captured = '';
  private appVersion = false;
  private appIdentifier = false;
  private opsApplicationLiteral: boolean | undefined;
  private opsPset = false;
  get literalStrings(): boolean { return this.opsApplicationLiteral ?? this.opsPset; }

  private result: StepGrammarState = 'running';
  private lex = Lex.Code;
  private stringState = StepStringState.Text;
  private p = P.Stmt;
  private x = X.ValueOrClose;
  private word = new Uint16Array(128);
  private wordLength = 0;
  private wordAt = -1;
  private wordHash = FNV_OFFSET;
  private lexBack = Lex.Code;
  private nextSec = Sec.Start;
  private headerIndex = 0;
  private headerParams = -1;
  private params = 0;
  private stack = new Uint8Array(64);
  private depth = 0;
  private complexParts = 0;
  private dataHeadK = 0;
  private anchorDepth = 0;
  private anchorTag = false;
  private stage = 0;
  private bom = 0;
  private sec = Sec.Start;

  constructor(private readonly utf8: boolean) {}

  get state(): StepGrammarState { return this.result; }
  get failed(): boolean { return this.result === 'failed'; }

  step(c: number, at: number): void {
    if (this.result === 'failed') return;
    if (this.bom >= 0) {
      if (!this.utf8 && at === 0 && c === 0xfeff) { this.bom = -1; return; }
      if (this.utf8 && at === this.bom && c === BOM_BYTES[this.bom % 3]) { if (++this.bom === 6) this.bom = -1; return; }
      if (this.utf8 && this.bom % 3 !== 0) { this.fail(at); return; }
      this.bom = -1;
    }
    if (isStepControl(c)) {
      if (this.capture && this.stringState !== StepStringState.Quote && this.captured.length < 6) {
        this.captured += String.fromCharCode(c);
      }
      return;
    }
    this.lexStep(c, at);
  }

  run(content: string): void {
    const n = content.length;
    for (let i = 0; i < n; i++) {
      if (this.result === 'failed') return;
      if (this.lex === Lex.Str && this.stringState === StepStringState.Text && !this.capture) {
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

  private lexStep(c: number, at: number): void {
    switch (this.lex) {
      case Lex.Str:
        this.stringState = stepString(this.stringState, c);
        if (this.stringState !== StepStringState.End) {
          if (this.capture && this.captured.length < 6) this.captured += String.fromCharCode(c);
          return;
        }
        if (this.capture === 'version') this.appVersion = this.captured === "0.1'";
        if (this.capture === 'identifier') this.appIdentifier = this.captured === "OPS'";
        if (this.capture === 'pset' && this.captured.startsWith('OPS_')) this.opsPset = true;
        this.capture = undefined;
        this.lex = Lex.Code;
        break;
      case Lex.BinFirst:
        if (c < 0x30 || c > 0x33) { this.fail(at); return; }
        this.lex = Lex.Bin;
        return;
      case Lex.Bin:
        if (c === DQUOTE) { this.lex = Lex.Code; return; }
        if (!isDigit(c) && (c < 0x41 || c > 0x46)) this.fail(at);
        return;
      case Lex.Uri:
        if (c === GT) this.lex = Lex.Code;
        return;
      case Lex.Slash:
        if (c === STAR) { this.lex = Lex.Comment; return; }
        this.fail(at - 1);
        return;
      case Lex.Comment:
        if (c === STAR) this.lex = Lex.CommentStar;
        return;
      case Lex.CommentStar:
        if (c === SLASH) this.lex = this.lexBack;
        else if (c !== STAR) this.lex = Lex.Comment;
        return;
      case Lex.Back:
        if (c !== LETTER_N && c !== LETTER_F) { this.fail(at); return; }
        this.lex = Lex.BackLetter;
        return;
      case Lex.BackLetter:
        if (c !== BACKSLASH) { this.fail(at); return; }
        this.lex = this.lexBack;
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
      this.fail(at);
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
      case QUOTE: this.lex = Lex.Str; this.stringState = StepStringState.Text; this.atom(at); return;
      case DQUOTE: this.lex = Lex.BinFirst; this.atom(at); return;
      case LT: this.lex = Lex.Uri; this.atom(at); return;
      case OPEN: case CLOSE: case COMMA: case SEMI: case EQUALS: this.punct(c, at); return;
      case 0x7b: case 0x7d: case 0x3a:
        if (this.sec !== Sec.Anchor || this.p !== P.AnchorVal) { this.fail(at); return; }
        if (c === 0x7b) this.anchorTag = true;
        return;
      default: this.fail(at);
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

  private wordIs(text: string): boolean {
    if (this.wordLength !== text.length) return false;
    for (let k = 0; k < text.length; k++) if (this.word[k] !== text.charCodeAt(k)) return false;
    return true;
  }

  private isModelWord(): boolean {
    if (this.wordLength > MODEL_TYPE_MAX || MODEL_HASH[this.wordHash & 0xffff] === 0) return false;
    return IFC_BUILDING_MODEL_TYPES.has(this.wordText());
  }

  private wordDone(): void {
    const at = this.wordAt;
    const kind = this.wordKind();
    if (kind === W.Bad) { this.fail(at); return; }
    switch (this.p) {
      case P.Stmt:
        if (kind === W.Keyword) { this.statementKeyword(at); return; }
        if (kind === W.Name && this.word[0] === HASH && this.sec === Sec.Data) {
          this.p = P.InstEq;
          return;
        }
        if (kind === W.Name && this.sec === Sec.Reference) { this.p = P.AnchorEq; return; }
        this.fail(at);
        return;
      case P.Params:
        this.paramWord(kind, at);
        return;
      case P.InstVal:
      case P.ComplexNext:
        if (kind !== W.Keyword) { this.fail(at); return; }
        this.meta = this.p !== P.InstVal || this.dataSections !== 1 ? undefined : this.wordIs('IFCAPPLICATION') ? 'application'
          : this.wordIs('IFCPROPERTYSET') ? 'pset' : undefined;
        this.appVersion = false;
        this.appIdentifier = false;
        if (this.isModelWord()) this.model = true;
        if (this.p === P.ComplexNext) this.complexParts++;
        else this.complexParts = -1;
        this.p = P.RecOpen;
        return;
      case P.AnchorVal:
        if (kind === W.Keyword) {
          if (!this.anchorTag) { this.fail(at); return; }
          this.anchorTag = false;
        }
        return;
      default:
        this.fail(at);
    }
  }

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
        if (this.wordIs('DATA')) { this.stage = 3; this.p = P.DataHead; this.dataHeadK = -1; return; }
        if (this.wordIs('ANCHOR') && this.stage === 0) { this.stage = 1; this.semi(Sec.Anchor); return; }
        if (this.wordIs('REFERENCE') && this.stage <= 1) { this.stage = 2; this.semi(Sec.Reference); return; }
        if (this.wordIs('END-ISO-10303-21')) { this.semi(Sec.End); return; }
        break;
      case Sec.Anchor:
      case Sec.Reference:
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

  private atom(at: number): void {
    switch (this.p) {
      case P.Params:
        if (this.lex === Lex.Str && this.depth === 1) {
          this.capture = this.meta === 'application' && this.params === 2 ? 'version'
            : this.meta === 'application' && this.params === 4 ? 'identifier'
            : this.meta === 'pset' && this.params === 3 ? 'pset' : undefined;
          this.captured = '';
        }
        if (this.lex === Lex.Uri) break;
        if (this.x === X.Value || this.x === X.ValueOrClose) { this.value(); this.x = X.Sep; return; }
        break;
      case P.DataHead:
        if ((this.dataHeadK === 0 || this.dataHeadK === 3) && this.lex === Lex.Str) { this.dataHeadK = this.dataHeadK === 0 ? 1 : 4; return; }
        break;
      case P.Stmt:
        if (this.sec === Sec.Anchor && this.lex === Lex.Uri) { this.p = P.AnchorEq; return; }
        break;
      case P.AnchorVal:
        if (this.anchorTag) break;
        return;
      case P.RefVal:
        if (this.lex !== Lex.Uri) break;
        this.p = P.HeadSemi;
        return;
      default:
        break;
    }
    this.fail(at);
  }

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
        this.p = P.ComplexNext;
        this.complexParts = 0;
        return;
      case P.SimpleSemi:
      case P.ComplexSemi:
        if (c !== SEMI) break;
        if (this.meta === 'application' && this.appIdentifier && this.opsApplicationLiteral === undefined) {
          this.opsApplicationLiteral = this.appVersion;
        }
        this.meta = undefined;
        this.p = P.Stmt;
        return;
      case P.ComplexNext:
        if (c !== CLOSE || this.complexParts === 0) break;
        this.p = P.ComplexSemi;
        return;
      case P.AnchorEq:
        if (c !== EQUALS) break;
        this.p = this.sec === Sec.Reference ? P.RefVal : P.AnchorVal;
        this.anchorDepth = 0;
        this.anchorTag = false;
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
        if (c !== OPEN) break;
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

  private close(at: number): void {
    this.depth--;
    if (this.depth > 0) { this.x = X.Sep; return; }
    if (this.sec === Sec.Header) {
      if (this.headerParams >= 0 && this.params !== this.headerParams) { this.fail(at); return; }
      this.p = P.HeadSemi;
      return;
    }
    this.p = this.complexParts < 0 ? P.SimpleSemi : P.ComplexNext;
  }

  private dataHeadPunct(c: number, at: number): void {
    switch (this.dataHeadK) {
      case -1:
        if (c === SEMI) { this.dataHeadDone(); return; }
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
        if (c === SEMI) { this.dataHeadDone(); return; }
        break;
      default:
        break;
    }
    this.fail(at);
  }

  private dataHeadDone(): void {
    this.dataSections++;
    this.sec = Sec.Data;
    this.p = P.Stmt;
  }
}

export function stepFileGrammar(content: string): StepFileGrammar {
  const grammar = new StepFileGrammar(false);
  grammar.run(content);
  grammar.end(content.length);
  return grammar;
}
