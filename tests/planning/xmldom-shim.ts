// Minimale XML-DOM voor de golf-4-verificatiescripts (NIET shipped): de P6/MSPDI-readers gebruiken
// de browser-`DOMParser`, die in Node ontbreekt. Ondersteunt precies de API die die readers raken:
// parseFromString, documentElement, getElementsByTagName (descendants), children (element-kinderen),
// localName, tagName, textContent, parentElement. Genoeg voor de WELGEVORMDE XML die onze writers
// produceren (geen namespaces-semantiek, geen CDATA).

const unescape = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

class XNode {
  nodeType: number;
  tagName: string;
  localName: string;
  childNodes: XNode[] = [];
  parentElement: XNode | null = null;
  private _text = '';
  constructor(tagName: string, nodeType = 1) {
    this.nodeType = nodeType;
    this.tagName = tagName;
    this.localName = tagName.includes(':') ? tagName.split(':').pop()! : tagName;
  }
  setText(t: string) { this._text = t; }
  get children(): XNode[] { return this.childNodes.filter((n) => n.nodeType === 1); }
  get textContent(): string {
    if (this.nodeType === 3) return this._text;
    return this.childNodes.map((n) => n.textContent).join('');
  }
  getElementsByTagName(name: string): XNode[] {
    const out: XNode[] = [];
    const walk = (n: XNode) => {
      for (const c of n.children) {
        if (c.tagName === name) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}

class XDocument {
  documentElement: XNode;
  constructor(root: XNode) { this.documentElement = root; }
  getElementsByTagName(name: string): XNode[] {
    if (name === 'parsererror') return [];
    const out = this.documentElement.tagName === name ? [this.documentElement] : [];
    return out.concat(this.documentElement.getElementsByTagName(name));
  }
}

function parseXML(src: string): XDocument {
  const clean = src.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const holder = new XNode('#holder');
  let cur: XNode = holder;
  const re = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    if (m[5] !== undefined) {
      const raw = m[5];
      if (raw.trim().length > 0) {
        const t = new XNode('#text', 3);
        t.setText(unescape(raw));
        t.parentElement = cur;
        cur.childNodes.push(t);
      }
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2];
    const selfClose = m[4] === '/' || /\/\s*$/.test(m[3]);
    if (closing) { cur = cur.parentElement ?? holder; continue; }
    const el = new XNode(name);
    el.parentElement = cur === holder ? null : cur;
    cur.childNodes.push(el);
    if (!selfClose) cur = el;
  }
  const root = holder.children[0];
  return new XDocument(root);
}

class DOMParserShim {
  parseFromString(src: string): XDocument { return parseXML(src); }
}

export function installDOMParser(): void {
  (globalThis as any).DOMParser = DOMParserShim;
}
