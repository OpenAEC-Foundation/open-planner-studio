// Een kleine XML-DOM voor de headless MCP-server: Node 22 heeft geen `DOMParser`, en de MSPDI- en
// P6-XML-lezers van de app (`src/services/msproject/mspdiReader.ts`, `src/services/p6/p6xmlReader.ts`)
// gebruiken die. De server zet deze parser als `globalThis.DOMParser` (zie `installXmlDomParser`); de
// app zelf houdt de DOMParser van de browser of de webview.
//
// Wat de lezers echt gebruiken (nagelopen 2026-10-23), en dus wat hier bestaat:
//   Document: `documentElement`, `getElementsByTagName` (inclusief het wortelelement)
//   Element:  `tagName`, `localName`, `children`, `parentElement`, `textContent`,
//             `getElementsByTagName` (alle nakomelingen, in documentvolgorde; `*` = alle),
//             plus `getAttribute`/`hasAttribute`/`childNodes`/`nodeType` voor de volledigheid.
// Namen worden vergeleken als gekwalificeerde naam (`prefix:naam`), zoals de browser doet in een
// XML-document; `localName` is het deel na de dubbele punt.
//
// Strikter dan nodig voor de veiligheid: een DOCTYPE met een interne subset (eigen entiteiten) wordt
// geweigerd, dus geen entiteit-expansie en geen externe entiteiten. Alleen de vijf vaste entiteiten en
// numerieke tekenverwijzingen. Een fout in de XML geeft, net als in de browser, een document met een
// `parsererror`-element; de lezers controleren daarop.

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
  /** Live lijst van de element-kinderen (zoals `HTMLCollection`), bijgehouden in `append`: de lezers
   *  vragen `children.length` en `children[i]` in een lus, dus geen nieuwe lijst per aanroep. */
  private readonly elementChildren: XmlElement[] = [];
  get children(): XmlElement[] { return this.elementChildren; }
  get textContent(): string {
    // Zonder recursie: een diep geneste XML mag de stack niet opblazen.
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
  /** Alle nakomelingen met deze gekwalificeerde naam (`*` = alle), in documentvolgorde. */
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

const PREDEFINED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(raw: string, at: number): string {
  if (!raw.includes('&')) return raw;
  return raw.replace(/&([^;&\s]*);?/g, (match, ref: string) => {
    if (!match.endsWith(';')) throw new XmlSyntaxError(`unterminated entity reference near offset ${at}`);
    if (ref.startsWith('#x') || ref.startsWith('#X')) {
      const code = Number.parseInt(ref.slice(2), 16);
      if (!/^[0-9a-fA-F]+$/.test(ref.slice(2)) || code > 0x10ffff) throw new XmlSyntaxError(`invalid character reference &${ref};`);
      return String.fromCodePoint(code);
    }
    if (ref.startsWith('#')) {
      const code = Number.parseInt(ref.slice(1), 10);
      if (!/^\d+$/.test(ref.slice(1)) || code > 0x10ffff) throw new XmlSyntaxError(`invalid character reference &${ref};`);
      return String.fromCodePoint(code);
    }
    const value = PREDEFINED[ref];
    if (value === undefined) throw new XmlSyntaxError(`undefined entity &${ref};`);
    return value;
  });
}

/** Parse XML-tekst. Gooit `XmlSyntaxError` bij een fout; `DOMParser` hieronder maakt daar een
 *  `parsererror`-document van. */
export function parseXml(input: string): XmlDocument {
  const src = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const n = src.length;
  let i = 0;
  let root: XmlElement | null = null;
  const stack: XmlElement[] = [];

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
    // Starttag. Het element hangt meteen aan zijn ouder (de bovenste open tag) of wordt de wortel.
    i++;
    const el = new XmlElement(readName());
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
      el.setAttribute(attr, decodeEntities(raw, i));
      i = end + 1;
    }
  }
  if (stack.length > 0) throw new XmlSyntaxError(`element <${stack[stack.length - 1].tagName}> is not closed`);
  if (!root) throw new XmlSyntaxError('no root element');
  return new XmlDocument(root);
}

/** De `DOMParser`-vorm die de lezers gebruiken: `new DOMParser().parseFromString(text, type)`. */
export class XmlDomParser {
  parseFromString(text: string, _type?: string): XmlDocument {
    try {
      return parseXml(String(text));
    } catch (error) {
      if (!(error instanceof XmlSyntaxError)) throw error;
      // Zoals de browser: een document met een `parsererror`-element en de reden als tekst.
      const failure = new XmlElement('parsererror');
      failure.append(new XmlText(error.message));
      return new XmlDocument(failure);
    }
  }
}

/** Zet de parser als `globalThis.DOMParser`, alleen als er nog geen is (de app heeft er altijd een). */
export function installXmlDomParser(target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): void {
  if (typeof target.DOMParser === 'undefined') target.DOMParser = XmlDomParser;
}
