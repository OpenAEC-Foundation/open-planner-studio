export interface JsonMemberNode {
  readonly keyStart: number;
  readonly keyEnd: number;
  readonly key: string;
  readonly value: JsonNode;
}

export type JsonNode =
  | { readonly kind: 'object'; readonly start: number; readonly end: number; readonly members: readonly JsonMemberNode[] }
  | { readonly kind: 'array'; readonly start: number; readonly end: number; readonly items: readonly JsonNode[] }
  | { readonly kind: 'string'; readonly start: number; readonly end: number; readonly value: string }
  | { readonly kind: 'number' | 'literal'; readonly start: number; readonly end: number };

const MAX_JSON_DEPTH = 256;
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

class JsonSyntax extends Error {}

export function parseJsonTree(text: string): JsonNode | undefined {
  let at = 0;
  const space = () => { while (at < text.length && ' \t\n\r'.includes(text[at])) at++; };
  const fail = (): never => { throw new JsonSyntax(); };
  const string = (): { start: number; end: number; value: string } => {
    const start = at++;
    while (at < text.length) {
      const c = text.charCodeAt(at);
      if (c < 0x20) fail();
      if (c === 0x5c) { at += 2; continue; }
      at++;
      if (c !== 0x22) continue;
      try { return { start, end: at, value: JSON.parse(text.slice(start, at)) as string }; }
      catch { return fail(); }
    }
    return fail();
  };
  const value = (depth: number): JsonNode => {
    if (depth > MAX_JSON_DEPTH) fail();
    space();
    const start = at;
    const c = text[at];
    if (c === '{') {
      at++;
      const members: JsonMemberNode[] = [];
      space();
      if (text[at] === '}') { at++; return { kind: 'object', start, end: at, members }; }
      for (;;) {
        space();
        if (text[at] !== '"') fail();
        const key = string();
        space();
        if (text[at] !== ':') fail();
        at++;
        members.push({ keyStart: key.start, keyEnd: key.end, key: key.value, value: value(depth + 1) });
        space();
        if (text[at] === ',') { at++; continue; }
        if (text[at] === '}') { at++; return { kind: 'object', start, end: at, members }; }
        fail();
      }
    }
    if (c === '[') {
      at++;
      const items: JsonNode[] = [];
      space();
      if (text[at] === ']') { at++; return { kind: 'array', start, end: at, items }; }
      for (;;) {
        items.push(value(depth + 1));
        space();
        if (text[at] === ',') { at++; continue; }
        if (text[at] === ']') { at++; return { kind: 'array', start, end: at, items }; }
        fail();
      }
    }
    if (c === '"') return { kind: 'string', ...string() };
    for (const literal of ['true', 'false', 'null']) {
      if (text.startsWith(literal, at)) { at += literal.length; return { kind: 'literal', start, end: at }; }
    }
    NUMBER.lastIndex = at;
    const m = NUMBER.exec(text);
    if (!m) fail();
    at += m![0].length;
    return { kind: 'number', start, end: at };
  };
  try {
    const root = value(0);
    space();
    return at === text.length ? root : undefined;
  } catch (e) {
    if (e instanceof JsonSyntax) return undefined;
    throw e;
  }
}

export function jsonSlice(text: string, node: { readonly start: number; readonly end: number }): string {
  return text.slice(node.start, node.end);
}

function decimalKey(token: string): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)!;
  let digits = (m[2] + (m[3] ?? '')).replace(/^0+/, '');
  let exponent = BigInt(m[4] ?? '0') - BigInt((m[3] ?? '').length);
  if (digits === '') return `${m[1]}0`;
  while (digits.endsWith('0')) { digits = digits.slice(0, -1); exponent += 1n; }
  return `${m[1]}${digits}e${exponent}`;
}

export function sameNode(a: string, x: JsonNode, b: string, y: JsonNode): boolean {
  if (x.kind !== y.kind) return false;
  if (x.kind === 'string' && y.kind === 'string') return x.value === y.value;
  if (x.kind === 'number') return decimalKey(jsonSlice(a, x)) === decimalKey(jsonSlice(b, y));
  if (x.kind === 'literal') return jsonSlice(a, x) === jsonSlice(b, y);
  if (x.kind === 'array' && y.kind === 'array') {
    return x.items.length === y.items.length && x.items.every((item, k) => sameNode(a, item, b, y.items[k]));
  }
  if (x.kind === 'object' && y.kind === 'object') {
    if (x.members.length !== y.members.length) return false;
    const other = new Map(y.members.map(m => [m.key, m.value]));
    if (other.size !== y.members.length || new Set(x.members.map(m => m.key)).size !== x.members.length) return false;
    return x.members.every(m => other.has(m.key) && sameNode(a, m.value, b, other.get(m.key)!));
  }
  return false;
}

export function sameJsonValue(a: string, b: string): boolean {
  const x = parseJsonTree(a), y = parseJsonTree(b);
  return x !== undefined && y !== undefined && sameNode(a, x, b, y);
}
