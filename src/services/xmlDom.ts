export function descendantText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

export function directChildText(parent: Element, tagName: string): string {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === tagName || child.tagName === tagName) {
      return child.textContent?.trim() || '';
    }
  }
  return '';
}

export function childElementNames(parent: Element): string[] {
  const names: string[] = [];
  for (let i = 0; i < parent.children.length; i++) names.push(parent.children[i].localName);
  return names;
}

export function childElements(parent: Element, localName: string): Element[] {
  const found: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].localName === localName) found.push(parent.children[i]);
  }
  return found;
}

export function startsWithNames(names: readonly string[], prefix: readonly string[]): boolean {
  return prefix.every((name, i) => names[i] === name);
}

export function toInt(text: string, fallback = 0): number {
  const n = parseInt(text);
  return isNaN(n) ? fallback : n;
}

export function toFloat(text: string, fallback = 0): number {
  const n = parseFloat(text);
  return isNaN(n) ? fallback : n;
}
