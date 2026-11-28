const NAME_START = /[A-Za-z_:À-￿]/;
const NAME_CHAR = /[A-Za-z0-9_:.\-·À-￿]/;

export class XmlNode {
  readonly nodeType: number;
  parentElement: XmlElement | null = null;
  constructor(nodeType: number) { this.nodeType = nodeType; }
}

export class XmlText extends XmlNode {
  constructor(public data: string) { super(3); }
  get textContent(): string { return this.data; }
}

export class XmlElement extends XmlNode {
  readonly tagName: string;
  readonly localName: string;
  readonly childNodes: XmlNode[] = [];
  private readonly attrs = new Map<string, string>();
  constructor(tagName: string) {
    super(1);
    this.tagName = tagName;
    const colon = tagName.indexOf(':');
    this.localName = colon >= 0 ? tagName.slice(colon + 1) : tagName;
  }
  get nodeName(): string { return this.tagName; }
  private readonly elementChildren: XmlElement[] = [];
  get children(): XmlElement[] { return this.elementChildren; }
  get textContent(): string {
    let out = '';
    const stack: XmlNode[] = [this];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node instanceof XmlText) out += node.data;
      else if (node instanceof XmlElement) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
      }
    }
    return out;
  }
  getAttribute(name: string): string | null { return this.attrs.get(name) ?? null; }
  hasAttribute(name: string): boolean { return this.attrs.has(name); }
  setAttribute(name: string, value: string): void { this.attrs.set(name, value); }
  getElementsByTagName(name: string): XmlElement[] {
    const out: XmlElement[] = [];
    const stack: XmlElement[] = [];
    for (let i = this.childNodes.length - 1; i >= 0; i--) {
      const c = this.childNodes[i];
      if (c instanceof XmlElement) stack.push(c);
    }
    while (stack.length > 0) {
      const el = stack.pop()!;
      if (name === '*' || el.tagName === name) out.push(el);
      for (let i = el.childNodes.length - 1; i >= 0; i--) {
        const c = el.childNodes[i];
        if (c instanceof XmlElement) stack.push(c);
      }
    }
    return out;
  }
  append(node: XmlNode): void {
    node.parentElement = this;
    this.childNodes.push(node);
    if (node instanceof XmlElement) this.elementChildren.push(node);
  }
}

export class XmlDocument {
  readonly nodeType = 9;
  constructor(readonly documentElement: XmlElement) {}
  getElementsByTagName(name: string): XmlElement[] {
    const root = this.documentElement;
    return [...(name === '*' || root.tagName === name ? [root] : []), ...root.getElementsByTagName(name)];
  }
}

class XmlSyntaxError extends Error {}

const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const NC_NAME = /^[A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\u{10000}-\u{effff}][A-Z_a-z0-9.\-\u00b7\u0300-\u036f\u203f-\u2040\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\u{10000}-\u{effff}]*$/u;

type NamespaceScope = { parent: NamespaceScope | null; bindings: Map<string, string> };

function qualifiedName(name: string): [string, string] {
  const parts = name.split(':');
  if (parts.length > 2 || parts.some((part) => !NC_NAME.test(part))) {
    throw new XmlSyntaxError(`invalid qualified name ${name}`);
  }
  return parts.length === 2 ? [parts[0], parts[1]] : ['', parts[0]];
}

function namespaceFor(prefix: string, scope: NamespaceScope): string {
  if (prefix === 'xml') return XML_NAMESPACE;
  for (let current: NamespaceScope | null = scope; current; current = current.parent) {
    const value = current.bindings.get(prefix);
    if (value !== undefined) return value;
  }
  if (prefix === '') return '';
  throw new XmlSyntaxError(`unbound namespace prefix ${prefix}`);
}

function validateNamespaces(name: string, attrs: Map<string, string>, parent: NamespaceScope | null): NamespaceScope {
  const scope: NamespaceScope = { parent, bindings: new Map() };
  for (const [attr, uri] of attrs) {
    const [prefix, local] = qualifiedName(attr);
    if (attr !== 'xmlns' && prefix !== 'xmlns') continue;
    const declared = attr === 'xmlns' ? '' : local;
    if (declared === 'xmlns' || uri === XMLNS_NAMESPACE
      || (declared === 'xml' ? uri !== XML_NAMESPACE : uri === XML_NAMESPACE)
      || (declared !== '' && uri === '')) {
      throw new XmlSyntaxError(`invalid namespace declaration ${attr}`);
    }
    scope.bindings.set(declared, uri);
  }
  const [prefix] = qualifiedName(name);
  if (prefix === 'xmlns') throw new XmlSyntaxError('xmlns cannot be an element prefix');
  if (prefix) namespaceFor(prefix, scope);
  const expanded = new Set<string>();
  for (const attr of attrs.keys()) {
    const [attrPrefix, local] = qualifiedName(attr);
    if (attr === 'xmlns' || attrPrefix === 'xmlns') continue;
    const uri = attrPrefix ? namespaceFor(attrPrefix, scope) : '';
    const key = JSON.stringify([uri, local]);
    if (expanded.has(key)) throw new XmlSyntaxError(`duplicate expanded attribute ${attr}`);
    expanded.add(key);
  }
  return scope;
}

const PREDEFINED = new Map([['lt', '<'], ['gt', '>'], ['amp', '&'], ['quot', '"'], ['apos', "'"]]);

function validXmlChar(code: number): boolean {
  return code === 0x9 || code === 0xa || code === 0xd
    || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd)
    || (code >= 0x10000 && code <= 0x10ffff);
}

function decodeEntities(raw: string, at: number): string {
  if (!raw.includes('&')) return raw;
  return raw.replace(/&([^;&\s]*);?/g, (match, ref: string) => {
    if (!match.endsWith(';')) throw new XmlSyntaxError(`unterminated entity reference near offset ${at}`);
    if (ref.startsWith('#x')) {
      const code = Number.parseInt(ref.slice(2), 16);
      if (!/^[0-9a-fA-F]+$/.test(ref.slice(2)) || !validXmlChar(code)) throw new XmlSyntaxError(`invalid character reference &${ref};`);
      return String.fromCodePoint(code);
    }
    if (ref.startsWith('#')) {
      const code = Number.parseInt(ref.slice(1), 10);
      if (!/^\d+$/.test(ref.slice(1)) || !validXmlChar(code)) throw new XmlSyntaxError(`invalid character reference &${ref};`);
      return String.fromCodePoint(code);
    }
    const value = PREDEFINED.get(ref);
    if (value === undefined) throw new XmlSyntaxError(`undefined entity &${ref};`);
    return value;
  });
}

export function parseXml(input: string): XmlDocument {
  const src = (input.charCodeAt(0) === 0xfeff ? input.slice(1) : input).replace(/\r\n?/g, '\n');
  for (const char of src) {
    if (!validXmlChar(char.codePointAt(0)!)) throw new XmlSyntaxError('invalid XML character');
  }
  const n = src.length;
  let i = 0;
  let root: XmlElement | null = null;
  const stack: XmlElement[] = [];
  const scopes = new WeakMap<XmlElement, NamespaceScope>();

  const expectEnd = (marker: string, what: string): number => {
    const end = src.indexOf(marker, i);
    if (end < 0) throw new XmlSyntaxError(`unterminated ${what} at offset ${i}`);
    return end;
  };
  const readName = (): string => {
    const start = i;
    if (i >= n || !NAME_START.test(src[i])) throw new XmlSyntaxError(`expected a name at offset ${i}`);
    i++;
    while (i < n && NAME_CHAR.test(src[i])) i++;
    return src.slice(start, i);
  };
  const skipSpace = () => { while (i < n && /\s/.test(src[i])) i++; };

  while (i < n) {
    if (src[i] !== '<') {
      const end = src.indexOf('<', i);
      const stop = end < 0 ? n : end;
      const raw = src.slice(i, stop);
      if (raw.includes(']]>')) throw new XmlSyntaxError(`CDATA terminator outside CDATA at offset ${i}`);
      if (stack.length === 0) {
        if (raw.trim() !== '') throw new XmlSyntaxError(`text outside the root element at offset ${i}`);
      } else {
        stack[stack.length - 1].append(new XmlText(decodeEntities(raw, i)));
      }
      i = stop;
      continue;
    }
    if (src.startsWith('<?', i)) {
      i = expectEnd('?>', 'processing instruction') + 2;
      continue;
    }
    if (src.startsWith('<!--', i)) {
      i = expectEnd('-->', 'comment') + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      if (stack.length === 0) throw new XmlSyntaxError(`CDATA outside the root element at offset ${i}`);
      const start = i + 9;
      i = start;
      const end = expectEnd(']]>', 'CDATA section');
      stack[stack.length - 1].append(new XmlText(src.slice(start, end)));
      i = end + 3;
      continue;
    }
    if (src.startsWith('<!DOCTYPE', i)) {
      if (root) throw new XmlSyntaxError('DOCTYPE after the root element');
      const end = expectEnd('>', 'DOCTYPE');
      if (src.slice(i, end).includes('[')) {
        throw new XmlSyntaxError('a DOCTYPE with an internal subset (own entities) is not supported');
      }
      i = end + 1;
      continue;
    }
    if (src.startsWith('</', i)) {
      i += 2;
      const name = readName();
      skipSpace();
      if (src[i] !== '>') throw new XmlSyntaxError(`expected '>' at offset ${i}`);
      i++;
      const open = stack.pop();
      if (!open || open.tagName !== name) {
        throw new XmlSyntaxError(`closing tag </${name}> does not match <${open?.tagName ?? '(none)'}>`);
      }
      continue;
    }
    i++;
    const el = new XmlElement(readName());
    const attrs = new Map<string, string>();
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    if (parent) {
      parent.append(el);
    } else {
      if (root) throw new XmlSyntaxError('more than one root element');
      root = el;
    }
    for (;;) {
      const before = i;
      skipSpace();
      if (src.startsWith('/>', i)) { i += 2; break; }
      if (src[i] === '>') { i++; stack.push(el); break; }
      if (i === before) throw new XmlSyntaxError(`expected whitespace or '>' at offset ${i}`);
      const attr = readName();
      skipSpace();
      if (src[i] !== '=') throw new XmlSyntaxError(`expected '=' after attribute ${attr} at offset ${i}`);
      i++;
      skipSpace();
      const quote = src[i];
      if (quote !== '"' && quote !== "'") throw new XmlSyntaxError(`expected a quoted value for ${attr} at offset ${i}`);
      const end = src.indexOf(quote, i + 1);
      if (end < 0) throw new XmlSyntaxError(`unterminated attribute value at offset ${i}`);
      const raw = src.slice(i + 1, end);
      if (raw.includes('<')) throw new XmlSyntaxError(`'<' in attribute value at offset ${i}`);
      if (el.hasAttribute(attr)) throw new XmlSyntaxError(`duplicate attribute ${attr}`);
      const value = decodeEntities(raw.replace(/[\t\n]/g, ' '), i);
      el.setAttribute(attr, value);
      attrs.set(attr, value);
      i = end + 1;
    }
    scopes.set(el, validateNamespaces(el.tagName, attrs, parent ? scopes.get(parent)! : null));
  }
  if (stack.length > 0) throw new XmlSyntaxError(`element <${stack[stack.length - 1].tagName}> is not closed`);
  if (!root) throw new XmlSyntaxError('no root element');
  return new XmlDocument(root);
}

export class XmlDomParser {
  parseFromString(text: string, _type?: string): XmlDocument {
    try {
      return parseXml(String(text));
    } catch (error) {
      if (!(error instanceof XmlSyntaxError)) throw error;
      const failure = new XmlElement('parsererror');
      failure.append(new XmlText(error.message));
      return new XmlDocument(failure);
    }
  }
}

export function installXmlDomParser(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
  if (typeof target.DOMParser === 'undefined') target.DOMParser = XmlDomParser;
}
