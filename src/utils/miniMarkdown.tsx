// Fase 2.10, onderdeel 5, golf 1: eigen minimale markdown-subset-parser voor de in-app
// help-viewer (architect-besluit 2, route A — bindend ontwerp
// docs/superpowers/specs/2026-07-07-2.10-onderdeel5-docs-design.md §1.2). Geen dependency, geen
// build-stap: runtime-parser die rechtstreeks veilige React-elementen teruggeeft (GEEN
// `dangerouslySetInnerHTML`) — alle tekst die niet als herkende syntax matcht komt terecht als
// gewone React-tekst-node, die React zelf al escaped. Er is dus geen apart escape-mechanisme
// nodig: het ontbreken van `dangerouslySetInnerHTML` IS de veiligheidsgarantie.
//
// Ondersteunde subset (exact wat de docs nodig hebben, zie het ontwerpdocument §1.2):
//   - koppen #, ##, ###
//   - paragrafen (regels gescheiden door een lege regel)
//   - **vet**, *cursief*, inline `code`
//   - codeblokken (```)
//   - ongeordende (- / *) en geordende (1.) lijsten
//   - links: alléén `docs://<article-id>` (interne viewer-navigatie) en
//     `examples://<file>` (opent hetzelfde voorbeeld-openpad als Backstage → Voorbeelden) —
//     dit zijn per architect-besluit de ENIGE toegestane linkvormen; alles anders wordt als
//     platte tekst getoond (geen externe netwerkaanroepen vanuit help-content).
//   - afbeeldingen ![alt](pad) — pad wordt opgelost tegen `${BASE_URL}docs/<pad>`; ontbreekt het
//     bestand (golf 1 heeft nog geen echte screenshots), dan valt de afbeelding terug op een
//     zichtbare placeholder-box met de alt-tekst.

import { useState } from 'react';
import type { ReactNode } from 'react';

export interface MiniMarkdownHandlers {
  onNavigate: (articleId: string) => void;
  onOpenExample: (file: string) => void;
}

const HEADER_RE = /^(#{1,3})\s+(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;
const FENCE_RE = /^```/;

/** Licht, regex-gebaseerd: alleen koppen extraheren voor de titel+koppen-zoekindex (§2.3 MVP).
 *  Geen volledige parse nodig — de index heeft alleen de kop-tekst nodig, niet de opmaak erin. */
export function extractHeadings(source: string): string[] {
  const headings: string[] = [];
  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const m = HEADER_RE.exec(rawLine);
    if (m) headings.push(m[2].trim());
  }
  return headings;
}

function MiniMarkdownImage({ alt, src }: { alt: string; src: string }) {
  const [failed, setFailed] = useState(false);
  const resolved = `${import.meta.env.BASE_URL}docs/${src}`;

  if (failed) {
    return (
      <span className="help-image-placeholder" role="img" aria-label={alt}>
        {alt}
      </span>
    );
  }

  return <img className="help-image" src={resolved} alt={alt} onError={() => setFailed(true)} />;
}

function renderLink(label: ReactNode, href: string, handlers: MiniMarkdownHandlers, key: string): ReactNode {
  if (href.startsWith('docs://')) {
    const id = href.slice('docs://'.length);
    return (
      <button key={key} type="button" className="help-link help-link-internal" onClick={() => handlers.onNavigate(id)}>
        {label}
      </button>
    );
  }
  if (href.startsWith('examples://')) {
    const file = href.slice('examples://'.length);
    return (
      <button key={key} type="button" className="help-link help-link-example" onClick={() => handlers.onOpenExample(file)}>
        {label}
      </button>
    );
  }
  // Onbekend linkschema: bewust geen <a href>/navigatie — alleen docs:// en examples:// zijn
  // toegestane linkvormen in help-content (architect-besluit, ontwerpdocument §"Aanvullende eisen").
  return (
    <span key={key} className="help-link help-link-unknown" title={href}>
      {label}
    </span>
  );
}

// Volgorde is betekenisvol: afbeelding vóór link (beide beginnen met `[`, afbeelding heeft de
// extra `!`-prefix), vet vóór cursief (beide beginnen met `*`, vet heeft er twee).
const INLINE_RE = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

function parseInline(text: string, handlers: MiniMarkdownHandlers, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let idx = 0;
  INLINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${idx++}`;
    if (match[1] !== undefined) {
      nodes.push(<MiniMarkdownImage key={key} alt={match[1]} src={match[2]} />);
    } else if (match[3] !== undefined) {
      nodes.push(renderLink(match[3], match[4], handlers, key));
    } else if (match[5] !== undefined) {
      nodes.push(<strong key={key}>{match[5]}</strong>);
    } else if (match[6] !== undefined) {
      nodes.push(<em key={key}>{match[6]}</em>);
    } else if (match[7] !== undefined) {
      nodes.push(<code className="help-inline-code" key={key}>{match[7]}</code>);
    }
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** Rendert een volledig markdown-brondocument naar een array React-elementen (blok-niveau). */
export function renderMiniMarkdown(source: string, handlers: MiniMarkdownHandlers): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    // Codeblok
    if (FENCE_RE.test(line.trim())) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // sluitende ``` overslaan (indien aanwezig)
      blocks.push(
        <pre className="help-code-block" key={`b${key++}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Koppen
    const headerMatch = HEADER_RE.exec(line);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = parseInline(headerMatch[2], handlers, `h${key}`);
      const k = `b${key++}`;
      if (level === 1) blocks.push(<h1 className="help-h1" key={k}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 className="help-h2" key={k}>{content}</h2>);
      else blocks.push(<h3 className="help-h3" key={k}>{content}</h3>);
      i++;
      continue;
    }

    // Ongeordende lijst
    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lines[i])) {
        items.push(UL_RE.exec(lines[i])![1]);
        i++;
      }
      const k = key++;
      blocks.push(
        <ul className="help-ul" key={`b${k}`}>
          {items.map((item, idx) => <li key={idx}>{parseInline(item, handlers, `b${k}-li${idx}`)}</li>)}
        </ul>
      );
      continue;
    }

    // Geordende lijst
    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push(OL_RE.exec(lines[i])![1]);
        i++;
      }
      const k = key++;
      blocks.push(
        <ol className="help-ol" key={`b${k}`}>
          {items.map((item, idx) => <li key={idx}>{parseInline(item, handlers, `b${k}-oli${idx}`)}</li>)}
        </ol>
      );
      continue;
    }

    // Paragraaf: regels accumuleren tot lege regel of het begin van een ander blok
    const paraLines: string[] = [];
    while (
      i < lines.length && lines[i].trim() !== '' &&
      !HEADER_RE.test(lines[i]) && !FENCE_RE.test(lines[i].trim()) &&
      !UL_RE.test(lines[i]) && !OL_RE.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const text = paraLines.join(' ');
    blocks.push(<p className="help-p" key={`b${key++}`}>{parseInline(text, handlers, `p${key}`)}</p>);
  }

  return blocks;
}
