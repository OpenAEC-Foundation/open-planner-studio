// Pure regels achter de in-app Help (`public/docs/manifest.json`): welke artikelen zichtbaar zijn,
// hoe een (oud) id of alias naar een artikel leidt, de leerroute van de tutorials, de stabiele
// kop-ankers en de taalvariant van een afbeeldingspad. Geen React, geen store, geen
// `import.meta.env`: de viewer (`HelpPanel.tsx`), `miniMarkdown.tsx`, `scripts/verify-docs.ts` en
// `tests/planning/check-help-manifest.ts` gebruiken exact dezelfde functies, zodat de poort en de
// viewer niet uit elkaar kunnen lopen.
//
// Manifest v2 (ontwerp `docs/superpowers/specs/2026-09-28-gebruikersdocumentatie-diataxis-design.md`
// §6.1, bijgesteld door de eigenaar op 2026-09-28): een artikel heeft óf de oude `layer`
// (overgangsperiode tot fase 4) óf een `kind` uit `howto | uitleg | referentie`. Tutorials staan
// NIET in het manifest: die levert een extensie aan via `helpArticleRegistry.ts`, met hun eigen
// `order` (de leerroute). `draft` verbergt een manifestartikel in productie, en `aliases` laat een oud
// id naar een nieuw artikel wijzen.

export type HelpLayer = 'quickstart' | 'gidsen' | 'referentie';
export type HelpKind = 'tutorial' | 'howto' | 'uitleg' | 'referentie';

/** Volgorde van de oude secties (ongewijzigd t.o.v. manifest v1). */
export const HELP_LAYERS: readonly HelpLayer[] = ['quickstart', 'gidsen', 'referentie'];
/** Vaste volgorde van de vier nieuwe secties (ontwerp §3): Tutorials · How-to · Uitleg · Referentie. */
export const HELP_KINDS: readonly HelpKind[] = ['tutorial', 'howto', 'uitleg', 'referentie'];
/** De soorten die in `public/docs/manifest.json` mogen staan; tutorials komen uit het register. */
export const MANIFEST_HELP_KINDS: readonly HelpKind[] = ['howto', 'uitleg', 'referentie'];

export interface HelpArticleMeta {
  id: string;
  /** EN is altijd aanwezig als terugval; nieuwe (`kind`-)artikelen hebben alleen nl + en. */
  title: Partial<Record<string, string>> & { en: string };
  /** Oude indeling (manifest v1); verdwijnt in fase 4. */
  layer?: HelpLayer;
  /** Nieuwe indeling: in het manifest `howto | uitleg | referentie`, `tutorial` alleen uit het register. */
  kind?: HelpKind;
  /** Alleen bij geregistreerde tutorials: plaats in de leerroute. Niet in het manifest. */
  order?: number;
  /** Zichtbaar in dev, verborgen in productie (ook voor zoeken, links en aliassen). */
  draft?: boolean;
  /** Ongebruikt veld uit v1; blijft tot fase 4 staan. */
  cluster?: string;
}

export interface HelpManifest {
  version: number;
  articles: HelpArticleMeta[];
  /** Oud id → nieuw id. Een alias overschaduwt nooit een bestaand id (`verify:docs`). */
  aliases?: Record<string, string>;
}

/** De artikelen die de viewer mag tonen: in productie zonder drafts, in dev alles. */
export function visibleHelpArticles(manifest: HelpManifest, includeDrafts: boolean): HelpArticleMeta[] {
  return includeDrafts ? manifest.articles : manifest.articles.filter(a => a.draft !== true);
}

/**
 * Het zichtbare artikel achter `id`, gezocht in de manifestartikelen plus de meegegeven extra
 * (geregistreerde) artikelen: een bestaand id wint, anders volgt de manifestalias. Geeft `null` als
 * er geen zichtbaar artikel is — dan toont de viewer "artikel niet gevonden" (ook voor een draft in
 * productie, direct of via een alias). Een manifestartikel wint van een geregistreerd artikel met
 * hetzelfde id: een extensie kan een ingebouwd artikel niet overschrijven.
 */
export function resolveHelpArticle<T extends HelpArticleMeta>(
  manifest: HelpManifest,
  id: string,
  includeDrafts: boolean,
  extra: readonly T[] = [],
): HelpArticleMeta | T | null {
  const visible: (HelpArticleMeta | T)[] = [...visibleHelpArticles(manifest, includeDrafts), ...extra];
  const direct = visible.find(a => a.id === id);
  if (direct) return direct;
  // Een alias wordt alleen gevolgd als het oude id zelf geen manifestartikel (meer) is — ook niet als draft.
  if (manifest.articles.some(a => a.id === id)) return null;
  const target = manifest.aliases?.[id];
  if (!target) return null;
  return visible.find(a => a.id === target) ?? null;
}

/**
 * De geregistreerde artikelen die de viewer naast het manifest mag tonen: geen artikel waarvan het
 * id al een manifestartikel (ook een draft) of een manifestalias is — een extensie kan een ingebouwd
 * artikel of een oude verwijzing niet kapen.
 */
export function usableRegisteredArticles<T extends HelpArticleMeta>(manifest: HelpManifest, registered: readonly T[]): T[] {
  const taken = new Set([...manifest.articles.map(a => a.id), ...Object.keys(manifest.aliases ?? {})]);
  return registered.filter(r => !taken.has(r.id));
}

/**
 * De tutorials in leerroute-volgorde:`order` oplopend, bij gelijke `order` op id (stabiel). De
 * viewer nummert op de positie in deze route (1, 2, 3 …), niet op de ruwe `order`, zodat een gat of
 * een tweede bron geen rare nummering geeft.
 */
export function tutorialsInOrder<T extends HelpArticleMeta>(articles: readonly T[]): T[] {
  return articles
    .filter(a => a.kind === 'tutorial')
    .slice()
    .sort((a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
}

/** Vorige en volgende tutorial binnen de meegegeven (zichtbare) artikelen. */
export function tutorialNeighbours<T extends HelpArticleMeta>(
  articles: readonly T[],
  id: string,
): { prev: T | null; next: T | null } {
  const route = tutorialsInOrder(articles);
  const idx = route.findIndex(a => a.id === id);
  if (idx < 0) return { prev: null, next: null };
  return { prev: route[idx - 1] ?? null, next: route[idx + 1] ?? null };
}

/** Split een `docs://`-doel (`id` of `id#anker`) in id en anker. */
export function splitHelpTarget(target: string): { id: string; anchor: string | null } {
  const hash = target.indexOf('#');
  if (hash < 0) return { id: target, anchor: null };
  const anchor = target.slice(hash + 1);
  return { id: target.slice(0, hash), anchor: anchor === '' ? null : anchor };
}

/**
 * Het anker van een kop, in dezelfde vorm als GitHub (github-slugger): de zichtbare tekst (zonder
 * Markdown-opmaak) in kleine letters, leestekens weg, elke spatie een streepje. Daardoor werkt
 * `docs://id#anker` zowel in de viewer als op de gegenereerde wiki (die de Engelse tekst toont).
 * Een anker volgt de koptekst en dus de taal: een nl-artikel linkt naar nl-ankers.
 */
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

/** Unieke ankers binnen één artikel: een tweede gelijke kop krijgt `-1`, een derde `-2` (zoals GitHub). */
export function createHeadingSlugger(): (rawHeading: string) => string {
  // Zelfde telling als github-slugger: per basisanker een teller die doorloopt tot een vrij anker.
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

/** Alle kopankers van een artikel in volgorde; koppen binnen een codeblok tellen niet (zoals in de viewer). */
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

/** Placeholder in een afbeeldingspad voor de docstaal: `img/{lang}/shot.webp`. */
export const HELP_IMAGE_LANG_PLACEHOLDER = '{lang}';

/** Taalmap van een afbeelding: alleen nl en en hebben eigen beelden, elke andere docstaal toont en. */
export function helpImageLang(docLang: string): 'nl' | 'en' {
  return docLang === 'nl' ? 'nl' : 'en';
}

/** Vult `{lang}` in een afbeeldingspad in voor de gegeven docstaal. */
export function resolveHelpImagePath(src: string, docLang: string): string {
  return src.split(HELP_IMAGE_LANG_PLACEHOLDER).join(helpImageLang(docLang));
}

/** Zoekt `query` (al getrimd en in kleine letters) in titel, koppen en de volledige artikeltekst. */
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
