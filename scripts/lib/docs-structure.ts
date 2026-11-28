import { createHash } from 'node:crypto';

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const FENCE_RE = /^```/;
const UL_RE = /^[-*]\s+\S/;
const OL_RE = /^\d+\.\s+\S/;
const IMAGE_LANG_PLACEHOLDER = '{lang}';

function normalize(md: string): string {
  return md.replace(/\r\n/g, '\n');
}

function hash16(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

export function stripCode(md: string): string {
  return normalize(md)
    .replace(/```[\s\S]*?```/g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
    .replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length));
}

export interface DocSection {
  heading: string | null;
  text: string;
}

export function splitSections(md: string): DocSection[] {
  const sections: DocSection[] = [];
  let heading: string | null = null;
  let lines: string[] = [];
  let inFence = false;
  for (const line of normalize(md).split('\n')) {
    if (FENCE_RE.test(line.trim())) inFence = !inFence;
    const m = !inFence && /^##\s+(.*)$/.exec(line);
    if (m) {
      sections.push({ heading, text: lines.join('\n') });
      heading = m[1].trim();
      lines = [line];
    } else {
      lines.push(line);
    }
  }
  sections.push({ heading, text: lines.join('\n') });
  return sections;
}

export function sectionHash(text: string): string {
  return hash16(normalize(text).trimEnd());
}

export interface DocStructure {
  headings: number[];
  links: string[];
  images: string[];
  listItems: number;
}

export function structureOf(md: string): DocStructure {
  const headings: number[] = [];
  const links: string[] = [];
  const images: string[] = [];
  let listItems = 0;
  for (const line of stripCode(md).split('\n')) {
    const h = HEADING_RE.exec(line);
    if (h) headings.push(h[1].length);
    if (UL_RE.test(line) || OL_RE.test(line)) listItems++;
    for (const m of line.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)) images.push(m[1].trim());
    for (const m of line.matchAll(/(docs|examples|project|settings):\/\/([^\s)\]#]+)/g)) links.push(`${m[1]}://${m[2]}`);
  }
  return { headings, links, images, listItems };
}

export function structureHash(md: string): string {
  return hash16(JSON.stringify(structureOf(md)));
}

export function subsetErrors(md: string, imageCheck?: (path: string, line: number) => string | null): string[] {
  const out: string[] = [];
  const scanLines = stripCode(md).split('\n');

  scanLines.forEach((line, idx) => {
    const n = idx + 1;
    if (/^#{4,}\s/.test(line)) out.push(`${n} h4+ kop niet ondersteund (parser kent alleen #/##/###)`);
    if (/^\s*\|.*\|\s*$/.test(line)) out.push(`${n} tabel-syntax (|) niet ondersteund door miniMarkdown`);
    if (/^\s*>/.test(line)) out.push(`${n} blockquote (>) niet ondersteund door miniMarkdown`);
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) out.push(`${n} horizontale lijn (---/***) niet ondersteund door miniMarkdown`);
    if (/^\s{1,}[-*]\s+\S/.test(line)) {
      out.push(`${n} ingesprongen (geneste) ongeordende lijst-item niet ondersteund — UL_RE vereist regel-start op kolom 0`);
    }
    if (/^\s{1,}\d+\.\s+\S/.test(line)) {
      out.push(`${n} ingesprongen (geneste) geordende lijst-item niet ondersteund — OL_RE vereist regel-start op kolom 0`);
    }
    if (/\[\^[^\]]+\]/.test(line)) out.push(`${n} voetnoot-syntax ([^ref]) niet ondersteund door miniMarkdown`);
    if (/\[[^\]]+\]\[[^\]]*\]/.test(line)) out.push(`${n} reference-style link ([tekst][ref]) niet ondersteund door miniMarkdown`);
    if (/~~[^~]+~~/.test(line)) out.push(`${n} doorhaal-syntax (~~tekst~~) niet ondersteund door miniMarkdown`);
    const htmlTag = /<\/?[a-zA-Z][a-zA-Z0-9]*(\s[^<>]*)?>/.exec(line);
    if (htmlTag) out.push(`${n} raw HTML-tag (${htmlTag[0]}) wordt niet geïnterpreteerd, alleen als platte tekst getoond`);
    for (const lm of line.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
      const href = lm[1];
      if (!href.startsWith('docs://') && !href.startsWith('examples://') && !href.startsWith('settings://')) {
        out.push(`${n} linkschema niet toegestaan (alleen docs://, examples:// en settings://): ${href}`);
      }
    }
  });

  scanLines.forEach((line, idx) => {
    for (const im of line.matchAll(/!\[([^\]]*)\]\(([^)]*)\)/g)) {
      const [, alt, rawPath] = im;
      const n = idx + 1;
      if (!alt.trim()) out.push(`${n} afbeelding zonder alt-tekst: ![](${rawPath}) — beschrijf wat het beeld toont`);
      const path = rawPath.trim();
      if (!path) { out.push(`${n} afbeelding zonder pad: ![${alt}]()`); continue; }
      const leftover = path.split(IMAGE_LANG_PLACEHOLDER).join('').match(/\{[^}]*\}/);
      if (leftover) out.push(`${n} onbekende placeholder ${leftover[0]} in afbeeldingspad (alleen ${IMAGE_LANG_PLACEHOLDER})`);
      const resolved = path.split(IMAGE_LANG_PLACEHOLDER).join('en');
      if (/^[a-z]+:/i.test(resolved) || resolved.startsWith('/') || resolved.split('/').includes('..')) {
        out.push(`${n} afbeeldingspad moet relatief binnen public/docs blijven: ${path}`);
      } else if (imageCheck) {
        const missing = imageCheck(path, n);
        if (missing) out.push(`${n} ${missing}`);
      }
    }
  });
  return out;
}
