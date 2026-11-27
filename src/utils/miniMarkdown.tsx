import { useState } from 'react';
import type { ReactNode } from 'react';
import { createHeadingSlugger, resolveHelpImagePath } from '@/utils/helpManifest';
import { PromptBlock } from '@/components/common/PromptBlock';

function defaultResolveImage(src: string): string {
  return `${import.meta.env.BASE_URL}docs/${resolveHelpImagePath(src, 'en')}`;
}

export interface MiniMarkdownHandlers {
  onNavigate: (target: string) => void;
  onOpenExample?: (file: string) => void;
  onOpenProject?: (assetName: string) => void;
  onOpenSetting?: (settingId: string) => void;
  resolveImage?: (src: string) => string;
}

const HEADER_RE = /^(#{1,3})\s+(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;
const FENCE_RE = /^```/;
const PROMPT_FENCE = '```prompt';
const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

export function extractHeadings(source: string): string[] {
  const headings: string[] = [];
  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const m = HEADER_RE.exec(rawLine);
    if (m) headings.push(m[2].trim());
  }
  return headings;
}

function readFence(lines: string[], start: number): { opener: string; body: string; next: number } {
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !FENCE_RE.test(lines[i].trim())) {
    body.push(lines[i]);
    i++;
  }
  return { opener: lines[start].trim(), body: body.join('\n'), next: i + 1 };
}

export function promptBlocksOf(source: string): string[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const prompts: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!FENCE_RE.test(lines[i].trim())) { i++; continue; }
    const fence = readFence(lines, i);
    if (fence.opener === PROMPT_FENCE) prompts.push(fence.body);
    i = fence.next;
  }
  return prompts;
}

function MiniMarkdownImage({ alt, src, resolveImage }: { alt: string; src: string; resolveImage?: (src: string) => string }) {
  const [failed, setFailed] = useState(false);
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
  const { onOpenExample, onOpenProject, onOpenSetting } = handlers;
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
  if (href.startsWith('settings://') && onOpenSetting) {
    const id = href.slice('settings://'.length);
    return (
      <button key={key} type="button" className="help-link help-link-internal" data-help-setting={id} onClick={() => onOpenSetting(id)}>
        {label}
      </button>
    );
  }
  return (
    <span key={key} className="help-link help-link-unknown" title={href}>
      {label}
    </span>
  );
}

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

export function renderMiniMarkdown(source: string, handlers: MiniMarkdownHandlers): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  const slug = createHeadingSlugger();
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    if (FENCE_RE.test(line.trim())) {
      const fence = readFence(lines, i);
      i = fence.next;
      if (fence.opener === PROMPT_FENCE) {
        blocks.push(<PromptBlock key={`b${key++}`} text={fence.body} />);
        continue;
      }
      blocks.push(
        <pre className="help-code-block" key={`b${key++}`}>
          <code>{fence.body}</code>
        </pre>
      );
      continue;
    }

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
