import { skipBlank, skipQuotedOrComment, type StepIndex } from './stepScanner';
import { SINGLE_REFERENCES, type ForeignChange, type ForeignReferences, type ForeignRuleOutcome } from './changeList';

const HASH = 35, QUOTE = 39, OPEN = 40, CLOSE = 41, STAR = 42, COMMA = 44, SLASH = 47;
const isDigit = (c: number) => c >= 48 && c <= 57;
const isSpace = (c: number) => c === 32 || (c >= 9 && c <= 13);
const startsKeyword = (c: number) => (c >= 65 && c <= 90) || c === 95;
const inKeyword = (c: number) => startsKeyword(c) || isDigit(c);

interface ListElement {
  readonly start: number;
  readonly end: number;
  readonly ref: number;
}

interface EntityReferences {
  readonly single: number[];
  readonly lists: ListElement[][];
}

interface Frame {
  readonly list: boolean;
  readonly elements: ListElement[];
  start: number;
  end: number;
  tokens: number;
  refs: number[];
}

function entityReferences(bytes: Uint8Array, entityStart: number, end: number): EntityReferences {
  const single: number[] = [], lists: ListElement[][] = [], stack: Frame[] = [];
  const top = () => stack[stack.length - 1];
  const token = (from: number, to: number, ref = -1) => {
    const frame = top();
    if (!frame) return;
    if (frame.tokens === 0) frame.start = from;
    frame.end = to;
    frame.tokens++;
    if (ref >= 0) frame.refs.push(ref);
  };
  const closeElement = (frame: Frame) => {
    if (frame.tokens === 0) return;
    const pureRef = frame.list && frame.tokens === 1 && frame.refs.length === 1;
    if (frame.list) frame.elements.push({ start: frame.start, end: frame.end, ref: pureRef ? frame.refs[0] : -1 });
    if (!pureRef) for (const ref of frame.refs) single.push(ref);
    frame.tokens = 0;
    frame.refs = [];
  };
  const delimits = (k: number) => {
    const c = bytes[k];
    return isSpace(c) || c === COMMA || c === OPEN || c === CLOSE || c === QUOTE || c === HASH || (c === SLASH && bytes[k + 1] === STAR);
  };
  let i = entityStart + 1;
  while (i < end && isDigit(bytes[i])) i++;
  i = skipBlank(bytes, i) + 1;
  let afterKeyword = false;
  while (i < end) {
    const c = bytes[i];
    if (c === QUOTE || (c === SLASH && bytes[i + 1] === STAR)) {
      const next = skipQuotedOrComment(bytes, i);
      if (c === QUOTE) { token(i, next); afterKeyword = false; }
      i = next;
    } else if (isSpace(c)) {
      i++;
    } else if (c === OPEN) {
      if (!afterKeyword) token(i, i + 1);
      stack.push({ list: !afterKeyword && stack.length > 0, elements: [], start: -1, end: -1, tokens: 0, refs: [] });
      afterKeyword = false;
      i++;
    } else if (c === CLOSE) {
      const frame = stack.pop();
      if (!frame) break;
      closeElement(frame);
      if (frame.list && frame.elements.length > 0) lists.push(frame.elements);
      if (stack.length === 0) break;
      top().end = i + 1;
      i++;
    } else if (c === COMMA) {
      const frame = top();
      if (frame) closeElement(frame);
      afterKeyword = false;
      i++;
    } else if (c === HASH && isDigit(bytes[i + 1])) {
      let j = i + 1, ref = 0;
      while (j < end && isDigit(bytes[j])) ref = ref * 10 + bytes[j++] - 48;
      token(i, j, ref);
      afterKeyword = false;
      i = j;
    } else {
      let j = i + 1;
      const keyword = startsKeyword(c);
      while (j < end && (keyword ? inKeyword(bytes[j]) : !delimits(j))) j++;
      token(i, j);
      afterKeyword = keyword;
      i = j;
    }
  }
  return { single, lists };
}

export function foreignReferences(index: StepIndex, classes: ArrayLike<number>, bytes: Uint8Array,
  inD: ArrayLike<number>): ForeignReferences {
  const inClosure = new Uint8Array(index.count);
  const pieces: number[] = [], queue: number[] = [];
  for (let i = 0; i < index.count; i++) if (inD[i] === 1) queue.push(i);
  while (queue.length > 0) {
    const target = queue.pop()!;
    for (let k = index.inStart(target); k < index.inEnd(target); k++) {
      const piece = index.inSource(k);
      if (piece < 0 || classes[piece] === 1 || inClosure[piece] === 1) continue;
      inClosure[piece] = 1;
      pieces.push(piece);
      queue.push(piece);
    }
  }
  pieces.sort((a, b) => a - b);
  const matters = (id: number) => {
    const chunk = index.chunkOf(String(id));
    return chunk >= 0 && (inClosure[chunk] === 1 || inD[chunk] === 1);
  };
  const stepIds: number[] = [], groupStart = [0], groupSize: number[] = [], targetStart = [0], targets: number[] = [];
  const group = (size: number, ids: readonly number[]) => {
    groupSize.push(size);
    for (const id of ids) targets.push(id);
    targetStart.push(targets.length);
  };
  for (const piece of pieces) {
    const { single, lists } = entityReferences(bytes, index.entityStart(piece), index.end(piece));
    const singles = single.filter(matters);
    if (singles.length > 0) group(SINGLE_REFERENCES, singles);
    for (const elements of lists) {
      const members = elements.filter(e => e.ref >= 0 && matters(e.ref)).map(e => e.ref);
      if (members.length > 0) group(elements.length, members);
    }
    stepIds.push(Number(index.id(piece)));
    groupStart.push(groupSize.length);
  }
  return {
    stepIds: Int32Array.from(stepIds), groupStart: Int32Array.from(groupStart), groupSize: Int32Array.from(groupSize),
    targetStart: Int32Array.from(targetStart), targets: Int32Array.from(targets),
  };
}

function withoutReferences(bytes: Uint8Array, start: number, entityStart: number, end: number, lost: ReadonlySet<number>): Uint8Array {
  const { single, lists } = entityReferences(bytes, entityStart, end);
  if (single.some(id => lost.has(id))) throw new Error('wijzigingslijst: een enkele verwijzing kan niet uit een stuk weg');
  const cuts: [number, number][] = [];
  for (const elements of lists) {
    const kept = elements.map(e => !(e.ref >= 0 && lost.has(e.ref)));
    if (kept.every(Boolean)) continue;
    const first = kept.indexOf(true);
    if (first < 0) throw new Error('wijzigingslijst: een lijst zou leeg worden');
    for (let k = 0; k < elements.length; k++) {
      if (kept[k]) continue;
      cuts.push(k < first ? [elements[k].start, elements[k + 1].start] : [elements[k - 1].end, elements[k].end]);
    }
  }
  cuts.sort((a, b) => a[0] - b[0]);
  const out = new Uint8Array(end - start - cuts.reduce((size, [from, to]) => size + to - from, 0));
  let at = 0, from = start;
  for (const [cutFrom, cutTo] of cuts) {
    out.set(bytes.subarray(from, cutFrom), at);
    at += cutFrom - from;
    from = cutTo;
  }
  out.set(bytes.subarray(from, end), at);
  return out;
}

export function foreignChangeList(outcome: ForeignRuleOutcome, index: StepIndex, bytes: Uint8Array): ForeignChange[] {
  const pieceOf = (id: number) => {
    const chunk = index.chunkOf(String(id));
    if (chunk < 0) throw new Error(`wijzigingslijst: #${id} staat niet in de bron`);
    return chunk;
  };
  const oldBytes = (chunk: number) => bytes.slice(index.start(chunk), index.end(chunk));
  const pieces = [...outcome.dropped, ...outcome.trimmed.keys()].map(id => ({ id, chunk: pieceOf(id) })).sort((a, b) => a.chunk - b.chunk);
  const changes: ForeignChange[] = pieces.map(({ id, chunk }) => {
    const lost = outcome.trimmed.get(id);
    return lost
      ? { kind: 'gewijzigd', id, oldBytes: oldBytes(chunk), newBytes: withoutReferences(bytes, index.start(chunk), index.entityStart(chunk), index.end(chunk), lost) }
      : { kind: 'vervallen', id, oldBytes: oldBytes(chunk) };
  });
  for (const key of outcome.droppedUnusedKeys) {
    changes.push({ kind: 'vervallen', id: key.propertyStepId, oldBytes: oldBytes(pieceOf(key.propertyStepId)), unusedKeyOfTask: key.taskStepId });
  }
  return changes;
}
