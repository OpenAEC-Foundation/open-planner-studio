export type StepValue =
  | { readonly kind: 'atom'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly StepValue[] }
  | { readonly kind: 'typed'; readonly name: string; readonly items: readonly StepValue[] }
  | { readonly kind: 'complex'; readonly items: readonly StepValue[] };

const QUOTE = "'";

function compact(text: string): string {
  let out = '';
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (c === QUOTE) {
      let j = i + 1;
      while (j < text.length && !(text[j] === QUOTE && text[j + 1] !== QUOTE)) j += text[j] === QUOTE ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
    } else {
      if (!/\s/.test(c)) out += c;
      i++;
    }
  }
  return out;
}

type Parsed = readonly [StepValue, number] | undefined;

function parseItems(text: string, at: number, separated: boolean): readonly [StepValue[], number] | undefined {
  const items: StepValue[] = [];
  let i = at + 1;
  if (text[i] === ')') return [items, i + 1];
  for (;;) {
    const item = parseItem(text, i);
    if (!item || item[1] <= i) return undefined;
    items.push(item[0]);
    i = item[1];
    if (text[i] === ')') return [items, i + 1];
    if (separated && text[i] !== ',') return undefined;
    if (separated) i++;
    if (i >= text.length) return undefined;
  }
}

function parseItem(text: string, at: number): Parsed {
  if (text[at] === '(') {
    const list = parseItems(text, at, true);
    return list && [{ kind: 'list', items: list[0] }, list[1]];
  }
  const keyword = /^[A-Z_][A-Z0-9_]*/.exec(text.slice(at, at + 200))?.[0];
  if (keyword && text[at + keyword.length] === '(') {
    const items = parseItems(text, at + keyword.length, true);
    return items && [{ kind: 'typed', name: keyword, items: items[0] }, items[1]];
  }
  let i = at;
  while (i < text.length && text[i] !== ',' && text[i] !== ')') {
    if (text[i] === QUOTE) {
      i++;
      while (i < text.length && !(text[i] === QUOTE && text[i + 1] !== QUOTE)) i += text[i] === QUOTE ? 2 : 1;
    }
    i++;
  }
  return i > at ? [{ kind: 'atom', text: text.slice(at, i) }, i] : undefined;
}

export function entityValue(bytes: Uint8Array, entityStart: number, end: number): StepValue | undefined {
  const text = compact(new TextDecoder('utf-8').decode(bytes.subarray(entityStart, end)));
  const body = text.slice(text.indexOf('=') + 1, text.lastIndexOf(';'));
  if (body.startsWith('(')) {
    const items = parseItems(body, 0, false);
    return items && items[1] === body.length ? { kind: 'complex', items: items[0] } : undefined;
  }
  const value = parseItem(body, 0);
  return value && value[1] === body.length ? value[0] : undefined;
}

export function serializeStepValue(value: StepValue): string {
  switch (value.kind) {
    case 'atom': return value.text;
    case 'list': return `(${value.items.map(serializeStepValue).join(',')})`;
    case 'typed': return `${value.name}(${value.items.map(serializeStepValue).join(',')})`;
    case 'complex': return `(${value.items.map(serializeStepValue).join('')})`;
  }
}

const memberRef = (value: StepValue) => value.kind === 'atom' && /^#\d+$/.test(value.text) ? Number(value.text.slice(1)) : undefined;
const looseRefs = (text: string) => text.startsWith(QUOTE) ? [] : [...text.matchAll(/#(\d+)/g)].map(m => Number(m[1]));

export interface PlaceTriggers {
  readonly direct: number[];
  readonly lists: number[][];
}

export function placeTriggers(value: StepValue, into: PlaceTriggers = { direct: [], lists: [] }): PlaceTriggers {
  if (value.kind === 'atom') {
    for (const id of looseRefs(value.text)) into.direct.push(id);
    return into;
  }
  if (value.kind === 'list') {
    const refs = value.items.map(memberRef);
    if (refs.length > 0 && refs.every(id => id !== undefined)) into.lists.push(refs as number[]);
    else value.items.forEach((item, k) => { if (refs[k] === undefined) placeTriggers(item, into); });
    return into;
  }
  for (const item of value.items) placeTriggers(item, into);
  return into;
}

export function losesItsPlace(value: StepValue, removed: ReadonlySet<number>): boolean {
  if (value.kind === 'atom') return looseRefs(value.text).some(id => removed.has(id));
  if (value.kind === 'list') {
    const refs = value.items.map(memberRef);
    if (refs.length > 0 && refs.every(id => id !== undefined && removed.has(id))) return true;
    return value.items.some((item, k) => refs[k] === undefined && losesItsPlace(item, removed));
  }
  return value.items.some(item => losesItsPlace(item, removed));
}

export function withoutRemovedMembers(value: StepValue, removed: ReadonlySet<number>): StepValue {
  if (value.kind === 'atom') return value;
  const kept = value.kind === 'list' ? value.items.filter(item => { const id = memberRef(item); return id === undefined || !removed.has(id); }) : value.items;
  return { ...value, items: kept.map(item => withoutRemovedMembers(item, removed)) };
}
