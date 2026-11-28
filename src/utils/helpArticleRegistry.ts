import type { HelpArticleMeta } from '@/utils/helpManifest';

export interface RegisteredHelpArticleInput {
  id: string;
  kind: 'tutorial';
  order: number;
  title: { nl: string; en: string };
  body: { nl: string; en: string };
}

export interface RegisterHelpArticlesOptions {
  resolveImage?: (path: string) => string;
  openProject?: (assetName: string) => void;
}

export interface RegisteredHelpArticle extends HelpArticleMeta {
  kind: 'tutorial';
  order: number;
  title: { nl: string; en: string };
  body: { nl: string; en: string };
  source: string;
  resolveImage?: (path: string) => string;
  openProject?: (assetName: string) => void;
}

export type RegisterHelpArticlesResult =
  | { ok: true; unregister: () => void }
  | { ok: false; errors: string[] };

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

let bySource = new Map<string, RegisteredHelpArticle[]>();
let snapshot: readonly RegisteredHelpArticle[] = [];
const listeners = new Set<() => void>();

function rebuild(): void {
  snapshot = [...bySource.values()].flat();
  for (const listener of listeners) listener();
}

export function validateHelpArticles(
  source: string,
  articles: readonly RegisteredHelpArticleInput[],
  taken: ReadonlySet<string> = new Set(),
): string[] {
  const errors: string[] = [];
  if (!source.trim()) errors.push('bron zonder naam');
  const seen = new Set<string>();
  for (const a of articles) {
    const label = typeof a?.id === 'string' ? a.id : '(zonder id)';
    if (typeof a?.id !== 'string' || !ID_RE.test(a.id)) errors.push(`${label}: ongeldig id (kleine letters, cijfers en streepjes)`);
    else if (seen.has(a.id)) errors.push(`${label}: dubbel id in deze bron`);
    else if (taken.has(a.id)) errors.push(`${label}: id is al geregistreerd door een andere bron`);
    if (typeof a?.id === 'string') seen.add(a.id);
    if (a?.kind !== 'tutorial') errors.push(`${label}: alleen kind "tutorial" kan geregistreerd worden`);
    if (!Number.isInteger(a?.order) || a.order < 1) errors.push(`${label}: order moet een positief geheel getal zijn`);
    for (const lang of ['nl', 'en'] as const) {
      if (typeof a?.title?.[lang] !== 'string' || !a.title[lang].trim()) errors.push(`${label}: title.${lang} ontbreekt of is leeg`);
      if (typeof a?.body?.[lang] !== 'string' || !a.body[lang].trim()) errors.push(`${label}: body.${lang} ontbreekt of is leeg`);
    }
  }
  return errors;
}

export function registerHelpArticles(
  source: string,
  articles: readonly RegisteredHelpArticleInput[],
  options: RegisterHelpArticlesOptions = {},
): RegisterHelpArticlesResult {
  const taken = new Set<string>();
  for (const [other, list] of bySource) if (other !== source) for (const a of list) taken.add(a.id);
  const errors = validateHelpArticles(source, articles, taken);
  if (errors.length > 0) return { ok: false, errors };

  const registered: RegisteredHelpArticle[] = articles.map(a => ({
    id: a.id,
    kind: 'tutorial',
    order: a.order,
    title: { nl: a.title.nl, en: a.title.en },
    body: { nl: a.body.nl, en: a.body.en },
    source,
    ...(options.resolveImage ? { resolveImage: options.resolveImage } : {}),
    ...(options.openProject ? { openProject: options.openProject } : {}),
  }));
  bySource = new Map(bySource);
  bySource.set(source, registered);
  rebuild();
  return {
    ok: true,
    unregister: () => {
      if (bySource.get(source) !== registered) return;
      bySource = new Map(bySource);
      bySource.delete(source);
      rebuild();
    },
  };
}

export function getRegisteredHelpArticles(): readonly RegisteredHelpArticle[] {
  return snapshot;
}

export function subscribeRegisteredHelpArticles(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetRegisteredHelpArticles(): void {
  bySource = new Map();
  rebuild();
}
