// Eigen minimale markdown-subset-parser voor de in-app help-viewer. Geen dependency, geen
// build-stap: runtime-parser die rechtstreeks veilige React-elementen teruggeeft (GEEN
// `dangerouslySetInnerHTML`) — alle tekst die niet als herkende syntax matcht komt terecht als
// gewone React-tekst-node, die React zelf al escaped. Er is dus geen apart escape-mechanisme
// nodig: het ontbreken van `dangerouslySetInnerHTML` IS de veiligheidsgarantie.
//
// Ondersteunde subset (exact wat de docs nodig hebben; `scripts/verify-docs.ts` bewaakt de gidsen):
//   - koppen #, ##, ###
//   - paragrafen (regels gescheiden door een lege regel)
//   - **vet**, *cursief*, inline `code`
//   - codeblokken (```)
//   - ongeordende (- / *) en geordende (1.) lijsten
//   - links: alléén `docs://<article-id>` of `docs://<article-id>#<anker>` (interne viewer-navigatie,
//     het anker is de GitHub-vorm van een kop, zie `headingSlug` in helpManifest.ts) en
//     `examples://<file>` (opent hetzelfde voorbeeld-openpad als Backstage → Voorbeelden) —
//     en — alleen waar de aanroeper `onOpenProject` meegeeft (een artikel of begeleidingsstap van
//     een extensie) — `project://<asset>` (opent een meegeleverd projectbestand als nieuw document).
//     Dit zijn bewust de ENIGE toegestane linkvormen; alles anders, en een schema zonder handler,
//     wordt als platte tekst getoond (geen externe netwerkaanroepen vanuit help-content).
//   - afbeeldingen ![alt](pad) — het pad gaat door `handlers.resolveImage` (per bron: een
//     manifestartikel lost op tegen `${BASE_URL}docs/<pad>` met `{lang}` = de docstaal, een
//     geregistreerd extensieartikel via de resolver van zijn extensie); zonder resolver geldt
//     `${BASE_URL}docs/<pad>` met `{lang}` = en. Ontbreekt het bestand, dan valt de afbeelding terug
//     op een zichtbare placeholder-box met de alt-tekst. Een afbeelding die alléén op een eigen regel
//     staat wordt een blok (`<figure>`), anders staat hij inline in de tekst.
//
// Elke kop krijgt een stabiel anker (`data-help-anchor` + `id="help-<anker>"`), zodat de viewer een
// `docs://id#anker`-link naar die sectie kan laten scrollen.

import { useState } from 'react';
import type { ReactNode } from 'react';
import { createHeadingSlugger, resolveHelpImagePath } from '@/utils/helpManifest';

/** Standaard: een `public/docs`-pad, `{lang}` = en. */
function defaultResolveImage(src: string): string {
  return `${import.meta.env.BASE_URL}docs/${resolveHelpImagePath(src, 'en')}`;
}

export interface MiniMarkdownHandlers {
  /** `target` is het deel na `docs://`: een artikel-id, eventueel met `#anker`. */
  onNavigate: (target: string) => void;
  /** Weglaten = een `examples://`-link is gewone tekst. */
  onOpenExample?: (file: string) => void;
  /** `project://<asset>`-link (extensie-inhoud). Weglaten = gewone tekst. */
  onOpenProject?: (assetName: string) => void;
  /** Afbeeldingspad (zoals in de Markdown) → URL. Weglaten = `public/docs`-pad met `{lang}` = en. */
  resolveImage?: (src: string) => string;
}

const HEADER_RE = /^(#{1,3})\s+(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;
const FENCE_RE = /^```/;
/** Een regel met niets dan één afbeelding ⇒ blokafbeelding. */
const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

/** Licht, regex-gebaseerd: alleen koppen extraheren voor de titel+koppen-zoekindex.
 *  Geen volledige parse nodig — de index heeft alleen de kop-tekst nodig, niet de opmaak erin. */
export function extractHeadings(source: string): string[] {
  const headings: string[] = [];
  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const m = HEADER_RE.exec(rawLine);
    if (m) headings.push(m[2].trim());
  }
  return headings;
}

function MiniMarkdownImage({ alt, src, resolveImage }: { alt: string; src: string; resolveImage?: (src: string) => string }) {
  const [failed, setFailed] = useState(false);
  // Een resolver mag `''` teruggeven voor "bestaat niet" (bv. een ontbrekende extensie-asset).
  const resolved = (resolveImage ?? defaultResolveImage)(src);

  if (failed || !resolved) {
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
  const { onOpenExample, onOpenProject } = handlers;
  if (href.startsWith('examples://') && onOpenExample) {
    const file = href.slice('examples://'.length);
    return (
      <button key={key} type="button" className="help-link help-link-example" onClick={() => onOpenExample(file)}>
        {label}
      </button>
    );
  }
  if (href.startsWith('project://') && onOpenProject) {
    const asset = href.slice('project://'.length);
    return (
      <button key={key} type="button" className="help-link help-link-project" data-help-project={asset} onClick={() => onOpenProject(asset)}>
        {label}
      </button>
    );
  }
  // Onbekend linkschema: bewust geen <a href>/navigatie — alleen docs:// en examples:// zijn
  // toegestane linkvormen in help-content.
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
      nodes.push(<MiniMarkdownImage key={key} alt={match[1]} src={match[2]} resolveImage={handlers.resolveImage} />);
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
  const slug = createHeadingSlugger();
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
      const anchor = slug(headerMatch[2]);
      const anchorProps = { id: `help-${anchor}`, 'data-help-anchor': anchor };
      if (level === 1) blocks.push(<h1 className="help-h1" key={k} {...anchorProps}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 className="help-h2" key={k} {...anchorProps}>{content}</h2>);
      else blocks.push(<h3 className="help-h3" key={k} {...anchorProps}>{content}</h3>);
      i++;
      continue;
    }

    // Blokafbeelding: een regel met alleen een afbeelding.
    const imageLine = IMAGE_LINE_RE.exec(line.trim());
    if (imageLine) {
      blocks.push(
        <figure className="help-figure" key={`b${key++}`}>
          <MiniMarkdownImage alt={imageLine[1]} src={imageLine[2]} resolveImage={handlers.resolveImage} />
        </figure>
      );
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
      !UL_RE.test(lines[i]) && !OL_RE.test(lines[i]) &&
      !IMAGE_LINE_RE.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const text = paraLines.join(' ');
    blocks.push(<p className="help-p" key={`b${key++}`}>{parseInline(text, handlers, `p${key}`)}</p>);
  }

  return blocks;
}
