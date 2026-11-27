import { LOCALES, type Locale } from '../i18n/locales';

export type HelpKind = 'tutorial' | 'howto' | 'uitleg' | 'referentie';

export const HELP_KINDS: readonly HelpKind[] = ['tutorial', 'howto', 'uitleg', 'referentie'];
export const MANIFEST_HELP_KINDS: readonly HelpKind[] = ['howto', 'uitleg', 'referentie'];

export const HELP_DOC_LANGS: readonly Locale[] = LOCALES;
export type HelpDocLang = Locale;

export const HELP_SOURCE_LANGS = ['nl', 'en'] as const;
export type HelpSourceLang = typeof HELP_SOURCE_LANGS[number];

export function isHelpDocLang(lang: string | null | undefined): lang is HelpDocLang {
  return (HELP_DOC_LANGS as readonly string[]).includes(lang ?? '');
}

export function isHelpSourceLang(lang: string | null | undefined): lang is HelpSourceLang {
  return (HELP_SOURCE_LANGS as readonly string[]).includes(lang ?? '');
}

export function resolveHelpDocLang(
  uiLang: string,
  saved: string | null | undefined,
): { lang: HelpDocLang; override: HelpDocLang | null; fallback: boolean } {
  const base = uiLang.split('-')[0];
  const override = isHelpDocLang(saved) ? saved : null;
  if (override) return { lang: override, override, fallback: false };
  return isHelpDocLang(base) ? { lang: base, override: null, fallback: false } : { lang: 'en', override: null, fallback: true };
}

export type HelpDocIndex = Record<string, { title: string }>;

export function articleLang(
  id: string,
  lang: HelpDocLang,
  index: HelpDocIndex | null | undefined,
): { lang: HelpDocLang; fallback: boolean } {
  if (isHelpSourceLang(lang)) return { lang, fallback: false };
  if (index && Object.prototype.hasOwnProperty.call(index, id)) return { lang, fallback: false };
  return { lang: 'en', fallback: true };
}

export interface HelpArticleMeta {
  id: string;
  title: Partial<Record<string, string>> & { en: string };
  kind?: HelpKind;
  order?: number;
  draft?: boolean;
}

export interface HelpManifest {
  version: number;
  articles: HelpArticleMeta[];
  aliases?: Record<string, string>;
}

export function visibleHelpArticles(manifest: HelpManifest, includeDrafts: boolean): HelpArticleMeta[] {
  return includeDrafts ? manifest.articles : manifest.articles.filter(a => a.draft !== true);
}

export function resolveHelpArticle<T extends HelpArticleMeta>(
  manifest: HelpManifest,
  id: string,
  includeDrafts: boolean,
  extra: readonly T[] = [],
): HelpArticleMeta | T | null {
  const visible: (HelpArticleMeta | T)[] = [...visibleHelpArticles(manifest, includeDrafts), ...extra];
  const direct = visible.find(a => a.id === id);
  if (direct) return direct;
  if (manifest.articles.some(a => a.id === id)) return null;
  const target = manifest.aliases?.[id];
  if (!target) return null;
  return visible.find(a => a.id === target) ?? null;
}

export function usableRegisteredArticles<T extends HelpArticleMeta>(manifest: HelpManifest, registered: readonly T[]): T[] {
  const taken = new Set([...manifest.articles.map(a => a.id), ...Object.keys(manifest.aliases ?? {})]);
  return registered.filter(r => !taken.has(r.id));
}

export function tutorialsInOrder<T extends HelpArticleMeta>(articles: readonly T[]): T[] {
  return articles
    .filter(a => a.kind === 'tutorial')
    .slice()
    .sort((a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
}

export function tutorialNeighbours<T extends HelpArticleMeta>(
  articles: readonly T[],
  id: string,
): { prev: T | null; next: T | null } {
  const route = tutorialsInOrder(articles);
  const idx = route.findIndex(a => a.id === id);
  if (idx < 0) return { prev: null, next: null };
  return { prev: route[idx - 1] ?? null, next: route[idx + 1] ?? null };
}

export function splitHelpTarget(target: string): { id: string; anchor: string | null } {
  const hash = target.indexOf('#');
  if (hash < 0) return { id: target, anchor: null };
  const anchor = target.slice(hash + 1);
  return { id: target.slice(0, hash), anchor: anchor === '' ? null : anchor };
}

export function headingSlug(rawHeading: string): string {
  return rawHeading
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

export function createHeadingSlugger(): (rawHeading: string) => string {
  const occurrences = new Map<string, number>();
  return (rawHeading: string) => {
    const base = headingSlug(rawHeading);
    let result = base;
    while (occurrences.has(result)) {
      const n = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, n);
      result = `${base}-${n}`;
    }
    occurrences.set(result, 0);
    return result;
  };
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const FENCE_RE = /^```/;

export function extractHeadingSlugs(source: string): string[] {
  const slug = createHeadingSlugger();
  const out: string[] = [];
  let inFence = false;
  for (const line of source.replace(/\r\n/g, '\n').split('\n')) {
    if (FENCE_RE.test(line.trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = HEADING_RE.exec(line);
    if (m) out.push(slug(m[2]));
  }
  return out;
}

export const HELP_IMAGE_LANG_PLACEHOLDER = '{lang}';

export const HELP_IMAGE_LANGS = ['nl', 'en'] as const;
export type HelpImageLang = typeof HELP_IMAGE_LANGS[number];

export function helpImageLang(docLang: string): HelpImageLang {
  return (HELP_IMAGE_LANGS as readonly string[]).includes(docLang) ? docLang as HelpImageLang : 'en';
}

export function resolveHelpImagePath(src: string, docLang: string): string {
  return src.split(HELP_IMAGE_LANG_PLACEHOLDER).join(helpImageLang(docLang));
}

export function helpArticleMatches(
  entry: { title: string; headings: readonly string[]; body: string },
  query: string,
): boolean {
  if (!query) return true;
  return (
    entry.title.toLowerCase().includes(query) ||
    entry.headings.some(h => h.toLowerCase().includes(query)) ||
    entry.body.toLowerCase().includes(query)
  );
}
