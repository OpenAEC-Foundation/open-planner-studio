// Register van Help-artikelen die NIET uit `public/docs` komen. Ontwerpbesluit van de eigenaar
// (2026-09-28): de tutorials (tekst, screenshots, projectbestanden) worden uitgeleverd als een
// installeerbare extensie uit de catalogus, niet in de app zelf. De Help-viewer toont ze in de sectie
// Tutorials naast de artikelen uit het manifest; hij weet niet (en hoeft niet te weten) welke bron ze
// aanleverde.
//
// Dit is de interne naad; de extensie-API (`api.help.registerArticles`, contract 1.4.0,
// `src/extensions/helpApi.ts`) roept hem aan met het extensie-id als bron. Eén
// module-globale lijst met abonnees (zelfde soort UI-coördinatie als `backstageLeaveGuard.ts`), geen
// store-state: het is geen documentdata, gaat niet mee in undo of opslaan, en een bron registreert
// en deregistreert zelf.
//
//   const res = registerHelpArticles('open-planner-tutorials', articles, { resolveImage });
//   if (res.ok) … res.unregister() bij uitschakelen/verwijderen van de extensie.
//
// Regels (afgedwongen bij registratie, zodat een fout in een extensie de viewer niet breekt):
//   - alleen `kind: 'tutorial'`; `order` is een positief geheel getal (de leerroute);
//   - titel en tekst in nl én en, niet leeg (de docs kennen alleen die twee talen, §6.2);
//   - een id is uniek over alle bronnen; een bron die opnieuw registreert vervangt haar vorige set.
import type { HelpArticleMeta } from '@/utils/helpManifest';

/** Een artikel zoals een bron het aanlevert: metadata plus de Markdown-tekst per docstaal. */
export interface RegisteredHelpArticleInput {
  id: string;
  kind: 'tutorial';
  order: number;
  title: { nl: string; en: string };
  body: { nl: string; en: string };
}

export interface RegisterHelpArticlesOptions {
  /**
   * Zet een afbeeldingspad uit de artikeltekst om naar een URL. Per bron, zodat een extensie haar
   * eigen assets kan leveren; `{lang}` is dan al vervangen door `nl` of `en`. Weglaten = het pad
   * wordt als `public/docs`-pad opgelost (zoals een manifestartikel).
   */
  resolveImage?: (path: string) => string;
  /**
   * Opent een meegeleverd projectbestand (`project://<naam>`-link in de tekst) als nieuw document.
   * Weglaten = zo'n link is gewone tekst.
   */
  openProject?: (assetName: string) => void;
}

/** Een geregistreerd artikel zoals de viewer het ziet. */
export interface RegisteredHelpArticle extends HelpArticleMeta {
  kind: 'tutorial';
  order: number;
  title: { nl: string; en: string };
  body: { nl: string; en: string };
  /** De bron die het aanleverde (bijv. het extensie-id). */
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

/** Controleer een aangeleverde set zonder iets te registreren. `taken` = id's van andere bronnen. */
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

/**
 * Registreer (of vervang) de artikelen van één bron. Ongeldige invoer registreert niets en geeft de
 * fouten terug; de viewer blijft dan zoals hij was.
 */
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
      if (bySource.get(source) !== registered) return; // al vervangen door een nieuwere set
      bySource = new Map(bySource);
      bySource.delete(source);
      rebuild();
    },
  };
}

/** Huidige artikelen van alle bronnen (stabiele referentie tot de volgende wijziging). */
export function getRegisteredHelpArticles(): readonly RegisteredHelpArticle[] {
  return snapshot;
}

/** Abonneer op wijzigingen (voor `useSyncExternalStore`). Geeft een opzegfunctie. */
export function subscribeRegisteredHelpArticles(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Alleen voor tests: alles leeg. */
export function resetRegisteredHelpArticles(): void {
  bySource = new Map();
  rebuild();
}
