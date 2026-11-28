import { recognizeOldOwnHeader } from './oldOwnHeader';
import { StepStringState, isStepControl, stepString } from './stepLexical';

export const STEP_HEADER = 'ISO-10303-21;';

export function startsWithStepHeader(text: string, at: number): boolean {
  return text.slice(at, at + STEP_HEADER.length).toUpperCase() === STEP_HEADER;
}

const QUOTE = 0x27;
const SLASH = 0x2f;
const STAR = 0x2a;
const DATA = [0x44, 0x41, 0x54, 0x41, 0x3b];

const enum Mode { Code, Str, Slash, Comment, CommentStar }
const LINE_DEAD = 6;

export class StepDataSectionFinder {
  anchored = -1;
  private mode = Mode.Code;
  private stringState = StepStringState.Text;
  private strict = 0;
  private line = 0;
  private lineAt = -1;
  private prev1 = -1;
  private prev2 = -1;

  constructor(private readonly utf8: boolean, private readonly literalStrings = false) {}

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
        break;
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
    if (u === DATA[this.strict]) {
      this.strict++;
      if (this.strict === DATA.length) { this.strict = 0; return true; }
    } else {
      this.strict = u === DATA[0] ? 1 : 0;
    }
    return false;
  }
}

export function indexOfStepDataSection(content: string, literalStrings = false): number {
  const oldOwn = recognizeOldOwnHeader(content);
  if (oldOwn && oldOwn !== 'main') return oldOwn.dataStart;
  const finder = new StepDataSectionFinder(false, literalStrings);
  for (let i = 0; i < content.length; i++) {
    if (finder.step(content.charCodeAt(i), i)) return i - 4;
  }
  return finder.anchored;
}
