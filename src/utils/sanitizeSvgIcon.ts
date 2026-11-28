export type SanitizedIcon =
  | { kind: 'text'; text: string }
  | { kind: 'svg'; markup: string };

export interface IconNode {
  tag: string;
  attrs: Array<[string, string]>;
  children: IconNode[];
  text?: string;
}

export const TEXT_NODE_TAG = '#text';

export const ALLOWED_ELEMENTS: ReadonlyMap<string, string> = new Map([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'title', 'desc', 'linearGradient', 'radialGradient',
  'stop', 'clipPath',
].map(name => [name.toLowerCase(), name] as [string, string]));

export const FORBIDDEN_ELEMENTS: ReadonlySet<string> = new Set([
  'script', 'foreignobject', 'use', 'image', 'animate', 'set', 'a',
]);

export const ALLOWED_ATTRIBUTES: ReadonlyMap<string, string> = new Map([
  'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform', 'opacity', 'fill-rule',
  'clip-rule', 'fill-opacity', 'stroke-opacity', 'id', 'offset', 'stop-color',
  'stop-opacity', 'gradientUnits', 'gradientTransform', 'text-anchor', 'font-size',
  'font-family', 'xmlns',
].map(name => [name.toLowerCase(), name] as [string, string]));

const TEXT_HOLDING_ELEMENTS: ReadonlySet<string> = new Set(['text', 'tspan', 'title', 'desc']);

const TEXT_ICON_MAX_CODEPOINTS = 8;

export function asTextIcon(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes('<')) return null;
  if ([...trimmed].length > TEXT_ICON_MAX_CODEPOINTS) return null;
  return trimmed;
}

export function isAllowedElement(tag: string): boolean {
  const key = tag.toLowerCase();
  if (FORBIDDEN_ELEMENTS.has(key)) return false;
  return ALLOWED_ELEMENTS.has(key);
}

export function isAllowedAttribute(name: string): boolean {
  const key = name.toLowerCase();
  if (key.startsWith('on')) return false;
  if (key === 'href' || key.endsWith(':href')) return false;
  if (key === 'style') return false;
  if (key.includes(':')) return false;
  return ALLOWED_ATTRIBUTES.has(key);
}

export function isSafeAttributeValue(value: string): boolean {
  const collapsed = Array.from(value).filter(ch => ch.charCodeAt(0) > 32).join('').toLowerCase();
  if (collapsed.includes('javascript:')) return false;
  if (/url\((?!['"]?#)/.test(collapsed)) return false;
  return true;
}

export function sanitizeIconNode(node: IconNode): IconNode | null {
  if (node.tag === TEXT_NODE_TAG) {
    const text = node.text ?? '';
    return text.length === 0 ? null : { tag: TEXT_NODE_TAG, attrs: [], children: [], text };
  }

  if (!isAllowedElement(node.tag)) return null;
  const canonicalTag = ALLOWED_ELEMENTS.get(node.tag.toLowerCase())!;

  const attrs: Array<[string, string]> = [];
  for (const [name, value] of node.attrs) {
    if (!isAllowedAttribute(name)) continue;
    if (!isSafeAttributeValue(value)) continue;
    attrs.push([ALLOWED_ATTRIBUTES.get(name.toLowerCase())!, value]);
  }

  const keepsText = TEXT_HOLDING_ELEMENTS.has(canonicalTag.toLowerCase());
  const children: IconNode[] = [];
  for (const child of node.children) {
    if (child.tag === TEXT_NODE_TAG && !keepsText) continue;
    const clean = sanitizeIconNode(child);
    if (clean) children.push(clean);
  }

  return { tag: canonicalTag, attrs, children };
}

export function sanitizeIconTree(root: IconNode): IconNode | null {
  if (root.tag.toLowerCase() !== 'svg') return null;
  const clean = sanitizeIconNode(root);
  if (!clean) return null;
  if (!hasVisibleContent(clean)) return null;
  return clean;
}

function hasVisibleContent(node: IconNode): boolean {
  for (const child of node.children) {
    if (child.tag === TEXT_NODE_TAG) {
      if ((child.text ?? '').trim().length > 0) return true;
    } else {
      return true;
    }
  }
  return false;
}

const escapeText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string): string => escapeText(s).replace(/"/g, '&quot;');

export function serializeIconNode(node: IconNode): string {
  if (node.tag === TEXT_NODE_TAG) return escapeText(node.text ?? '');
  const attrs = node.attrs.map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join('');
  const inner = node.children.map(serializeIconNode).join('');
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

function domToIconNode(el: Element): IconNode {
  const attrs: Array<[string, string]> = [];
  for (const attr of Array.from(el.attributes)) attrs.push([attr.name, attr.value]);

  const children: IconNode[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) children.push(domToIconNode(child as Element));
    else if (child.nodeType === 3) children.push({ tag: TEXT_NODE_TAG, attrs: [], children: [], text: child.nodeValue ?? '' });
  }

  return { tag: el.localName || el.tagName, attrs, children };
}

const CACHE_LIMIT = 256;
const cache = new Map<string, SanitizedIcon | null>();

function computeSanitizedIcon(raw: string): SanitizedIcon | null {
  const text = asTextIcon(raw);
  if (text !== null) return { kind: 'text', text };

  if (typeof DOMParser === 'undefined') return null;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  } catch {
    return null;
  }

  const root = doc.documentElement;
  if (!root) return null;
  if (doc.getElementsByTagName('parsererror').length > 0) return null;

  const clean = sanitizeIconTree(domToIconNode(root));
  if (!clean) return null;
  return { kind: 'svg', markup: serializeIconNode(clean) };
}

export function sanitizeSvgIcon(raw: string | null | undefined): SanitizedIcon | null {
  if (!raw) return null;
  const cached = cache.get(raw);
  if (cached !== undefined) return cached;
  const result = computeSanitizedIcon(raw);
  if (cache.size < CACHE_LIMIT) cache.set(raw, result);
  return result;
}
