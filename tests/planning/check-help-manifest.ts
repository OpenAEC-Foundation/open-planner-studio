// Help-viewer, manifest v2 (ontwerp gebruikersdocumentatie §6/§8, bijgesteld 2026-09-28) — de pure
// regels achter `HelpPanel.tsx`, `miniMarkdown.tsx` en `verify-docs.ts`. Exit 0 = groen.
//
// Waarom hier en niet (alleen) in de browser: de browsertestserver draait uitsluitend Vite-dev, dus
// "draft verborgen in productie" is daar niet te zien. De viewer filtert via dezelfde functies met
// `INCLUDE_DRAFTS = import.meta.env.DEV`; deze check bewijst het productiegedrag (`includeDrafts =
// false`) op de functies zelf en pint dat de viewer ze ook echt zo aanroept.
//
// Mutatiebewijs: `visibleHelpArticles` de filter laten weglaten ⇒ 02/05/06 rood; de alias ook laten
// volgen als het oude id nog bestaat ⇒ 09 rood; `headingSlug` de `&` laten houden ⇒ 20 rood; in
// `helpArticleRegistry` de nl-body niet eisen ⇒ 41 rood.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  createHeadingSlugger, extractHeadingSlugs, headingSlug, helpArticleMatches, resolveHelpArticle,
  resolveHelpImagePath, splitHelpTarget, tutorialNeighbours, tutorialsInOrder, usableRegisteredArticles,
  visibleHelpArticles, type HelpManifest,
} from '@/utils/helpManifest';
import {
  getRegisteredHelpArticles, registerHelpArticles, resetRegisteredHelpArticles, subscribeRegisteredHelpArticles,
  type RegisteredHelpArticleInput,
} from '@/utils/helpArticleRegistry';
import { renderMiniMarkdown } from '@/utils/miniMarkdown';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const ok = (label: string, cond: boolean) => { checks++; if (!cond) diffs.push(label); };

const manifest: HelpManifest = {
  version: 2,
  articles: [
    { id: 'quick-start', title: { nl: 'Snel starten', en: 'Quick start' }, layer: 'quickstart' },
    { id: 'howto-kalender', title: { nl: 'Kalender maken', en: 'Create a calendar' }, kind: 'howto' },
    { id: 'uitleg-kritiek-pad', title: { nl: 'Kritiek pad', en: 'Critical path' }, kind: 'uitleg', draft: true },
  ],
  aliases: { 'gids-oud': 'howto-kalender', 'gids-naar-draft': 'uitleg-kritiek-pad', 'quick-start': 'howto-kalender' },
};
const ids = (list: readonly { id: string }[]) => list.map(a => a.id);

// 1. Draft: productie ziet hem niet, dev wel.
eq('01 dev: alle artikelen', ids(visibleHelpArticles(manifest, true)), ['quick-start', 'howto-kalender', 'uitleg-kritiek-pad']);
eq('02 prod: draft weg', ids(visibleHelpArticles(manifest, false)), ['quick-start', 'howto-kalender']);
eq('03 dev: draft direct te openen', resolveHelpArticle(manifest, 'uitleg-kritiek-pad', true)?.id, 'uitleg-kritiek-pad');
eq('04 dev: alias naar draft volgt', resolveHelpArticle(manifest, 'gids-naar-draft', true)?.id, 'uitleg-kritiek-pad');
eq('05 prod: draft direct ⇒ niet gevonden', resolveHelpArticle(manifest, 'uitleg-kritiek-pad', false), null);
eq('06 prod: alias naar draft ⇒ niet gevonden', resolveHelpArticle(manifest, 'gids-naar-draft', false), null);

// 2. Aliassen.
eq('07 alias opent het nieuwe artikel', resolveHelpArticle(manifest, 'gids-oud', false)?.id, 'howto-kalender');
eq('08 onbekend id ⇒ niet gevonden', resolveHelpArticle(manifest, 'bestaat-niet', true), null);
eq('09 een bestaand id wint van een (verboden) alias met dezelfde sleutel', resolveHelpArticle(manifest, 'quick-start', false)?.id, 'quick-start');

// 3. docs://-doel met anker.
eq('10 id zonder anker', splitHelpTarget('howto-kalender'), { id: 'howto-kalender', anchor: null });
eq('11 id met anker', splitHelpTarget('howto-kalender#stap-2'), { id: 'howto-kalender', anchor: 'stap-2' });
eq('12 leeg anker telt niet', splitHelpTarget('howto-kalender#'), { id: 'howto-kalender', anchor: null });

// 4. Kopankers in de GitHub-vorm (zodat ze ook op de wiki werken).
eq('20 & en leestekens weg, spaties worden streepjes', headingSlug('Relaties & constraints'), 'relaties--constraints');
eq('21 opmaak en code weg', headingSlug('Stap 1: klik op `Bereken` (**F5**)'), 'stap-1-klik-op-bereken-f5');
eq('22 letters met accent blijven', headingSlug('Wat je nu ziet, en waarom'), 'wat-je-nu-ziet-en-waarom');
eq('23 niet-Latijns schrift blijft', headingSlug('المسار الحرج'), 'المسار-الحرج');
const slug = createHeadingSlugger();
eq('24 dubbele koppen krijgen -1, -2', [slug('Stappen'), slug('Stappen'), slug('Stappen')], ['stappen', 'stappen-1', 'stappen-2']);
eq('25 koppen in een codeblok tellen niet', extractHeadingSlugs('# Titel\n\n```\n# geen kop\n```\n\n## Stap\n'), ['titel', 'stap']);

// 5. Afbeeldingspad met {lang}: nl ⇒ nl, en en elke andere docstaal ⇒ en.
eq('30 nl', resolveHelpImagePath('img/{lang}/tut-3.webp', 'nl'), 'img/nl/tut-3.webp');
eq('31 en', resolveHelpImagePath('img/{lang}/tut-3.webp', 'en'), 'img/en/tut-3.webp');
eq('32 de valt terug op en', resolveHelpImagePath('img/{lang}/tut-3.webp', 'de'), 'img/en/tut-3.webp');
eq('33 zonder placeholder ongewijzigd', resolveHelpImagePath('img/vast.webp', 'nl'), 'img/vast.webp');

// 6. Zoeken ook in de artikeltekst.
const entry = { title: 'Kalender maken', headings: ['Feestdagen'], body: 'De bouwvak valt in de zomer.' };
ok('34 zoekt in de titel', helpArticleMatches(entry, 'kalender'));
ok('35 zoekt in een kop', helpArticleMatches(entry, 'feestdag'));
ok('36 zoekt in de tekst', helpArticleMatches(entry, 'bouwvak'));
ok('37 geen treffer', !helpArticleMatches(entry, 'kraan'));

// 7. Het register (tutorials uit een extensie).
const tut = (id: string, order: number): RegisteredHelpArticleInput => ({
  id, kind: 'tutorial', order,
  title: { nl: `Tutorial ${id}`, en: `Tutorial ${id} (en)` },
  body: { nl: `# ${id}\n\nTekst.`, en: `# ${id}\n\nText.` },
});
resetRegisteredHelpArticles();
let notified = 0;
const stop = subscribeRegisteredHelpArticles(() => { notified++; });
const first = registerHelpArticles('ext-tutorials', [tut('tut-b', 2), tut('tut-a', 1), tut('tut-c', 3)]);
ok('38 geldige set geregistreerd', first.ok);
eq('39 abonnee gewaarschuwd', notified, 1);
eq('40 tutorials in leerroute', ids(tutorialsInOrder(getRegisteredHelpArticles())), ['tut-a', 'tut-b', 'tut-c']);
const noNl = { ...tut('tut-x', 4), body: { nl: '', en: 'Text.' } };
const bad = registerHelpArticles('ext-ander', [noNl, { ...tut('tut-a', 1) }]);
ok('41 ongeldige set: niets geregistreerd, fouten terug', !bad.ok && bad.errors.some(e => e.includes('body.nl')) && bad.errors.some(e => e.includes('andere bron')));
const wrongKind = registerHelpArticles('ext-ander', [{ ...tut('tut-y', 1), kind: 'howto' as unknown as 'tutorial' }]);
ok('42 alleen kind tutorial', !wrongKind.ok);
const badOrder = registerHelpArticles('ext-ander', [tut('tut-z', 0)]);
ok('43 order moet ≥ 1 zijn', !badOrder.ok);
eq('44 register ongewijzigd na afgekeurde sets', getRegisteredHelpArticles().length, 3);
const route = tutorialsInOrder(getRegisteredHelpArticles());
eq('45 eerste tutorial: geen vorige', [tutorialNeighbours(route, 'tut-a').prev?.id ?? null, tutorialNeighbours(route, 'tut-a').next?.id], [null, 'tut-b']);
eq('46 middelste tutorial', [tutorialNeighbours(route, 'tut-b').prev?.id, tutorialNeighbours(route, 'tut-b').next?.id], ['tut-a', 'tut-c']);
eq('47 laatste tutorial: geen volgende', tutorialNeighbours(route, 'tut-c').next, null);
// Een extensie kan een manifestartikel of alias niet kapen.
const clash = registerHelpArticles('ext-kaper', [{ ...tut('quick-start', 9) }, { ...tut('gids-oud', 10) }, { ...tut('tut-d', 4) }]);
ok('48 botsende id\'s mogen registreren…', clash.ok);
eq('49 …maar de viewer laat ze vallen', ids(usableRegisteredArticles(manifest, getRegisteredHelpArticles())), ['tut-b', 'tut-a', 'tut-c', 'tut-d']);
eq('50 geregistreerde tutorial is te openen', resolveHelpArticle(manifest, 'tut-b', false, usableRegisteredArticles(manifest, getRegisteredHelpArticles()))?.id, 'tut-b');
if (clash.ok) clash.unregister();
if (first.ok) {
  const replaced = registerHelpArticles('ext-tutorials', [tut('tut-a', 1)]);
  eq('51 opnieuw registreren vervangt de set van die bron', ids(getRegisteredHelpArticles()), ['tut-a']);
  first.unregister();
  eq('52 een oude unregister raakt de nieuwe set niet', ids(getRegisteredHelpArticles()), ['tut-a']);
  if (replaced.ok) replaced.unregister();
}
eq('53 na unregister leeg', getRegisteredHelpArticles().length, 0);
stop();
resetRegisteredHelpArticles();

// 8. miniMarkdown: ankers op koppen, blokafbeelding, pluggable afbeeldingsresolver, docs://#anker.
//    Op de React-elementboom (niet via SSR: de afbeelding gebruikt een hook en de testbundel heeft
//    een eigen React-kopie naast die van react-dom/server).
type AnyProps = Record<string, unknown> & { children?: ReactNode };
const el = (n: ReactNode) => (isValidElement(n) ? (n as ReactElement<AnyProps>) : null);
const kids = (n: ReactNode): ReactNode[] => {
  const c = el(n)?.props.children;
  return c === undefined ? [] : Array.isArray(c) ? c : [c];
};
const resolver = (src: string) => `/ext/${resolveHelpImagePath(src, 'nl')}`;
const navigated: string[] = [];
const blocks = renderMiniMarkdown(
  '# Titel\n\n## Stap 1: kalender\n\nTekst met ![inline](img/x.webp) beeld.\n\n![De kalenderdialoog](img/{lang}/kal.webp)\n\nZie [stap](docs://howto-kalender#stap-1-kalender).\n',
  { onNavigate: t => navigated.push(t), onOpenExample: () => {}, resolveImage: resolver },
);
eq('60 blokken: h1, h2, p, figure, p', blocks.map(b => el(b)?.type), ['h1', 'h2', 'p', 'figure', 'p']);
eq('61 kop draagt een stabiel anker', [el(blocks[1])?.props.id, el(blocks[1])?.props['data-help-anchor']], ['help-stap-1-kalender', 'stap-1-kalender']);
const figureImg = el(kids(blocks[3])[0]);
eq('62 figure bevat de afbeelding met alt', [figureImg?.props.alt, figureImg?.props.src], ['De kalenderdialoog', 'img/{lang}/kal.webp']);
eq('63 de resolver van de bron vult {lang} in', (figureImg?.props.resolveImage as ((s: string) => string) | undefined)?.('img/{lang}/kal.webp'), '/ext/img/nl/kal.webp');
ok('64 inline-afbeelding blijft in de alinea', kids(blocks[2]).some(k => el(k)?.props.alt === 'inline'));
const link = kids(blocks[4]).map(el).find(k => k?.type === 'button');
(link?.props.onClick as (() => void) | undefined)?.();
eq('65 docs://id#anker navigeert met anker', navigated, ['howto-kalender#stap-1-kalender']);

// 9. De viewer gebruikt deze regels echt, met drafts alleen in dev.
const panel = readFileSync(resolve(process.cwd(), 'src/components/backstage/HelpPanel.tsx'), 'utf8');
ok('70 HelpPanel: drafts alleen in dev', panel.includes('const INCLUDE_DRAFTS = import.meta.env.DEV;'));
ok('71 HelpPanel: nooit rechtstreeks over manifest.articles (altijd via de draftfilter)', !panel.includes('manifest.articles') && !panel.includes('data.articles'));
ok('72 HelpPanel: resolutie via resolveHelpArticle met INCLUDE_DRAFTS', /resolveHelpArticle\(manifest, selection\.id, INCLUDE_DRAFTS/.test(panel));

// 10. Het echte manifest is v2 met een aliasobject.
const real = JSON.parse(readFileSync(resolve(process.cwd(), 'public/docs/manifest.json'), 'utf8')) as HelpManifest;
eq('80 manifest v2', real.version, 2);
ok('81 aliases is een object', !!real.aliases && typeof real.aliases === 'object' && !Array.isArray(real.aliases));
ok('82 geen tutorials in het manifest', real.articles.every(a => a.kind !== 'tutorial' && a.order === undefined));

if (diffs.length === 0) console.log(`OK: help-manifest v2 — ${checks} checks groen`);
else { console.log(`XX help-manifest v2 — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
