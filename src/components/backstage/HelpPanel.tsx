// In-app help/documentatie-viewer. Backstage-sectie (net als
// `ExamplesSection` in Backstage.tsx) — GEEN aparte `RibbonTab`/`isFullPanel`-tak in App.tsx
// (alleen Backstage-NavItem + F1, geen ribbon-knop). Manifest + artikelen
// worden at-runtime gefetcht via `BASE_URL`, exact hetzelfde patroon als
// `public/examples/manifest.json` (zie `ExamplesSection` hierboven in Backstage.tsx).
//
// Manifest v2 (ontwerp gebruikersdocumentatie §6, bijgesteld 2026-09-28): artikelen met de oude
// `layer` staan in de oude secties, artikelen met een `kind` in de nieuwe (How-to · Uitleg ·
// Referentie). De sectie Tutorials komt niet uit het manifest maar uit het register
// (`utils/helpArticleRegistry.ts`) dat een tutorialextensie vult: genummerd volgens de leerroute, met
// Vorige/Volgende onder elke tutorial. `draft`-artikelen bestaan alleen in dev — in productie zijn ze
// onvindbaar, ook via zoeken, een `docs://`-link, een alias of `openHelpArticle`. De regels zelf
// staan puur in `utils/helpManifest.ts`.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { LANGUAGE_LABELS, supportedLanguages, type Locale } from '@/i18n/config';
import { renderMiniMarkdown, extractHeadings } from '@/utils/miniMarkdown';
import {
  HELP_KINDS, HELP_LAYERS, helpArticleMatches, helpImageLang, resolveHelpArticle, resolveHelpImagePath,
  splitHelpTarget, tutorialNeighbours, tutorialsInOrder, usableRegisteredArticles, visibleHelpArticles,
  type HelpArticleMeta, type HelpManifest,
} from '@/utils/helpManifest';
import {
  getRegisteredHelpArticles, subscribeRegisteredHelpArticles, type RegisteredHelpArticle,
} from '@/utils/helpArticleRegistry';
import { fetchTextAsset } from '@/utils/textAsset';
import { applyDemoLibraryToShowcaseProject } from '@/state/demoLibraryShowcase';
import { buildImportLabels } from '@/i18n/importLabels';
import './HelpPanel.css';
import { readLocal, removeLocal, writeLocal } from '@/utils/settingsStore';

// De documentatietaal wordt persistent los van de UI-taal bewaard, zodat een gebruiker de docs in
// bv. Engels kan lezen terwijl de rest van de app in zijn eigen taal blijft.
const DOCS_LANG_KEY = 'ops-docs-locale';

// Drafts (nieuwe manifestartikelen in aanbouw) alleen in de dev-build; de productiebuild ziet ze nooit.
const INCLUDE_DRAFTS = import.meta.env.DEV;

// Alle UI-locales met een eigen vertaalde docs-map onder public/docs/<lang>/. Elke UI-taal die
// hier niet in staat (of waarvan een specifiek artikel ontbreekt) valt terug op de EN-docs.
// De keuzelijst is exact de productbrede i18n-set. Daardoor kan een nieuwe UI-taal niet stil
// ontbreken in Help; `verify:docs` bewaakt vervolgens dat elke taal ook een docs-map heeft.
const DOC_LANGS = supportedLanguages;
type HelpLang = Locale;

function resolveDocLang(uiLang: string): HelpLang {
  const base = uiLang.split('-')[0];
  return (DOC_LANGS as readonly string[]).includes(base) ? (base as HelpLang) : 'en';
}

/** Wat de viewer toont: het gevraagde doel (id of alias, eventueel met anker). `nonce` laat een
 *  tweede klik op hetzelfde anker opnieuw scrollen. */
interface HelpSelection {
  id: string | null;
  anchor: string | null;
  nonce: number;
}

function isRegistered(a: HelpArticleMeta): a is RegisteredHelpArticle {
  return 'source' in a && 'body' in a;
}

export function HelpPanel() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon, i18n } = useTranslation('common');
  const openExampleFromString = useAppStore(s => s.openExampleFromString);
  const setUI = useAppStore(s => s.setUI);
  // "Lees meer"-diepe-link vanuit een melding of het eigenschappenpaneel
  // (`openHelpArticle` in uiSlice.ts). Eenmalig-verzoek-patroon: lezen + direct weer op `null`.
  const pendingHelpArticleId = useAppStore(s => s.ui.pendingHelpArticleId);
  const registered = useSyncExternalStore(subscribeRegisteredHelpArticles, getRegisteredHelpArticles);

  // Taal-koppeling: standaard volgt de docs-taal de UI-taal (met EN-fallback per
  // artikel in de body-fetch). De gebruiker kan de docs-taal echter LOS van de UI overrulen —
  // handig omdat de niet-NL/EN-vertalingen maar sporadisch worden bijgewerkt (zie de waarschuwing
  // hieronder). De override is persistent in localStorage.
  const uiDocsLang: HelpLang = resolveDocLang(i18n.language);
  const [docsLangOverride, setDocsLangOverride] = useState<HelpLang | null>(() => {
    const saved = readLocal(DOCS_LANG_KEY);
    return saved && (DOC_LANGS as readonly string[]).includes(saved) ? (saved as HelpLang) : null;
  });
  const lang: HelpLang = docsLangOverride ?? uiDocsLang;
  // NL/EN zijn de canonieke, meebewegende brontalen; alle andere docs-talen lopen mogelijk achter.
  const isStaleDocsLang = lang !== 'nl' && lang !== 'en';

  // '__auto__' = volg de UI-taal (override wissen); anders een concrete docs-taal vastzetten.
  const changeDocsLang = (value: string) => {
    if (value === '__auto__') {
      setDocsLangOverride(null);
      removeLocal(DOCS_LANG_KEY);
    } else if ((DOC_LANGS as readonly string[]).includes(value)) {
      setDocsLangOverride(value as HelpLang);
      writeLocal(DOCS_LANG_KEY, value);
    }
  };

  const [manifest, setManifest] = useState<HelpManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [articles, setArticles] = useState<Record<string, string>>({});
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<HelpSelection>({ id: null, anchor: null, nonce: 0 });
  const [search, setSearch] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // `target` = artikel-id of alias, eventueel met `#anker` (docs://-link, openHelpArticle).
  const navigate = useCallback((target: string) => {
    const { id, anchor } = splitHelpTarget(target);
    setSelection(prev => ({ id, anchor, nonce: prev.nonce + 1 }));
  }, []);

  // Een "lees meer"-link zette `ui.pendingHelpArticleId`; selecteer dat
  // artikel en consumeer het verzoek meteen (net als `pendingNewResource` elders). Volgorde-veilig
  // t.o.v. de manifest-fetch hieronder: die zet de selectie alleen als er nog geen is (eerste
  // zichtbare artikel als default), dus een al gezette `pendingHelpArticleId`-selectie overleeft een
  // latere manifest-load. Werkt ook vóórdat het manifest binnen is — de alias- en draftresolutie
  // gebeurt pas bij het tekenen, dus ná de manifest-fetch op het juiste artikel.
  useEffect(() => {
    if (!pendingHelpArticleId) return;
    navigate(pendingHelpArticleId);
    setUI({ pendingHelpArticleId: null });
  }, [pendingHelpArticleId, setUI, navigate]);

  // Manifest ophalen (eenmalig).
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}docs/manifest.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: HelpManifest) => {
        if (cancelled) return;
        setManifest(data);
        const first = visibleHelpArticles(data, INCLUDE_DRAFTS)[0]?.id ?? null;
        setSelection(prev => (prev.id !== null ? prev : { id: first, anchor: null, nonce: prev.nonce + 1 }));
      })
      .catch(err => {
        console.error('[Help] Manifest laden mislukt:', err);
        if (!cancelled) setManifestError(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Alleen de zichtbare manifestartikelen: een draft wordt in productie niet eens opgehaald.
  const manifestArticles = useMemo(
    () => (manifest ? visibleHelpArticles(manifest, INCLUDE_DRAFTS) : []),
    [manifest],
  );
  // Geregistreerde (extensie-)tutorials, zonder id's die het manifest al gebruikt.
  const registeredArticles = useMemo(
    () => (manifest ? usableRegisteredArticles(manifest, registered) : []),
    [manifest, registered],
  );
  const allArticles = useMemo<HelpArticleMeta[]>(
    () => [...manifestArticles, ...registeredArticles],
    [manifestArticles, registeredArticles],
  );

  // Alle artikelbodies voor de huidige taal ophalen (zonder apart index-bestand); dit dient
  // tegelijk als de zoekindex, client-side opgebouwd uit de gefetchte artikelen.
  // Her-fetch bij elke taalwissel via de `lang`-dependency.
  useEffect(() => {
    if (manifestArticles.length === 0) return;
    let cancelled = false;
    setArticles({});
    setFailedIds(new Set());
    void Promise.all(
      manifestArticles.map(a => {
        // `fetchTextAsset` draagt de "bestaat dit echt?"-poort: status + SPA-fallback-body-sniff.
        // Bewust GEEN content-type-check meer — de Tauri-webview labelt élk `.md`-bestand als
        // `text/html` (onbekende extensie ⇒ MimeType::Html), waardoor een header-check in de
        // uitgeleverde desktopbuild ALLE artikelen verwierp ("Artikel niet gevonden") terwijl de
        // browserbuild het niet liet zien. Zie de toelichting in src/utils/textAsset.ts.
        const fetchLang = (l: HelpLang) =>
          fetchTextAsset(`${import.meta.env.BASE_URL}docs/${l}/${a.id}.md`);
        // Val per artikel terug op EN als de vertaling voor deze taal (nog) ontbreekt.
        return fetchLang(lang)
          .catch(() => (lang === 'en' ? Promise.reject(new Error('geen EN-fallback')) : fetchLang('en')))
          .then(text => ({ id: a.id, text, ok: true as const }))
          .catch(err => {
            console.error(`[Help] Artikel "${a.id}" (taal ${lang}, incl. EN-fallback) laden mislukt:`, err);
            return { id: a.id, text: '', ok: false as const };
          });
      })
    ).then(results => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      const failed = new Set<string>();
      for (const r of results) {
        if (r.ok) map[r.id] = r.text;
        else failed.add(r.id);
      }
      setArticles(map);
      setFailedIds(failed);
    });
    return () => { cancelled = true; };
  }, [manifestArticles, lang]);

  // De tekst van een artikel in de huidige docstaal: gefetcht (manifest) of meegeleverd (register,
  // alleen nl en en — elke andere docstaal toont en).
  const bodyOf = useCallback((a: HelpArticleMeta): string | undefined => (
    isRegistered(a) ? a.body[helpImageLang(lang)] : articles[a.id]
  ), [articles, lang]);

  const titleOf = useCallback((a: HelpArticleMeta) => a.title[lang] ?? a.title.en, [lang]);

  // Zoekindex: titel, koppen én de volledige artikeltekst.
  const searchIndex = useMemo(() => allArticles.map(a => {
    const body = bodyOf(a) ?? '';
    return { id: a.id, title: titleOf(a), headings: body ? extractHeadings(body) : [], body };
  }), [allArticles, bodyOf, titleOf]);

  const query = search.trim().toLowerCase();
  const matchedIds = useMemo(() => {
    if (!query) return null;
    return new Set(searchIndex.filter(entry => helpArticleMatches(entry, query)).map(entry => entry.id));
  }, [query, searchIndex]);

  // Zelfde open-flow als Backstage → Voorbeelden (`ExamplesSection.handleOpen` hierboven in
  // Backstage.tsx): fetch → openExampleFromString → runCPM → terug naar het Start-tabblad.
  const handleOpenExample = useCallback(async (file: string) => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = await res.text();
      await openExampleFromString(content, file, buildImportLabels(tCommon));
      // Showcase-voorbeelden delen één demo-resourcebibliotheek: zelfde
      // volgorde als Backstage → Voorbeelden (`ExamplesSection.handleOpen`). Deze aanroeper kent
      // alleen de bestandsnaam (geen manifest-`category`) — de showcase-bestanden dragen allemaal het
      // `showcase-`-voorvoegsel (zie `public/examples/manifest.json`), de basisvoorbeelden niet.
      if (file.startsWith('showcase-')) applyDemoLibraryToShowcaseProject();
      setUI({ activeRibbonTab: 'start' });
    } catch (err) {
      console.error(`[Help] Voorbeeld "${file}" openen mislukt:`, err);
    }
  }, [openExampleFromString, setUI, tCommon]);

  // Alias- en draftresolutie: een oud id opent het nieuwe artikel; een draft in productie (direct of
  // via een alias) levert `null` op en dus "artikel niet gevonden".
  const selectedMeta = manifest && selection.id
    ? resolveHelpArticle(manifest, selection.id, INCLUDE_DRAFTS, registeredArticles)
    : null;
  const selectedId = selectedMeta?.id ?? null;
  const selectedContent = selectedMeta ? bodyOf(selectedMeta) : undefined;
  const selectedFailed = selectedId ? failedIds.has(selectedId) : false;
  const tutorialRoute = useMemo(() => tutorialsInOrder(registeredArticles), [registeredArticles]);
  const neighbours = selectedMeta?.kind === 'tutorial' ? tutorialNeighbours(tutorialRoute, selectedMeta.id) : null;

  // Afbeeldingen per bron: een manifestartikel uit `public/docs` met `{lang}` = de docstaal, een
  // geregistreerd artikel via de resolver van zijn bron (bijv. de assets van de extensie).
  const resolveImage = useMemo(() => {
    const own = selectedMeta && isRegistered(selectedMeta) ? selectedMeta.resolveImage : undefined;
    return (src: string) => {
      const path = resolveHelpImagePath(src, lang);
      return own ? own(path) : `${import.meta.env.BASE_URL}docs/${path}`;
    };
  }, [selectedMeta, lang]);

  // `project://`-links bestaan alleen in geregistreerde artikelen: hun bron (de extensie) opent het
  // meegeleverde projectbestand als nieuw document.
  const openProject = selectedMeta && isRegistered(selectedMeta) ? selectedMeta.openProject : undefined;

  const renderedContent = useMemo(() => {
    if (!selectedContent) return null;
    return renderMiniMarkdown(selectedContent, {
      onNavigate: navigate,
      onOpenExample: (f) => { void handleOpenExample(f); },
      ...(openProject ? { onOpenProject: openProject } : {}),
      resolveImage,
    });
  }, [selectedContent, navigate, handleOpenExample, resolveImage, openProject]);

  // Na een artikelwissel: naar het anker scrollen als de link er een had, anders naar boven. De
  // scrollcontainer is `.backstage-main` (de omringende Backstage-sectie), niet het paneel zelf.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !renderedContent) return;
    if (selection.anchor) {
      const target = Array.from(body.querySelectorAll<HTMLElement>('[data-help-anchor]'))
        .find(el => el.dataset.helpAnchor === selection.anchor);
      if (target) { target.scrollIntoView({ block: 'start' }); return; }
    }
    const scroller = body.closest('.backstage-main');
    if (scroller) scroller.scrollTop = 0;
  }, [renderedContent, selection.anchor, selection.nonce]);

  const inSearch = (a: HelpArticleMeta) => !matchedIds || matchedIds.has(a.id);
  // De nieuwe indeling is "live" in dev, of in productie zodra er een niet-draft `kind`-artikel of
  // een geregistreerde tutorial is. Tot fase 4 ziet een gebruiker dus geen lege nieuwe secties.
  const newStructureLive = INCLUDE_DRAFTS || allArticles.some(a => a.kind !== undefined);

  const openTutorialCatalog = () => {
    setUI({ backstageSection: 'extensions', pendingExtensionsTab: 'browse' });
  };

  const renderTocSection = (key: string, title: string, list: HelpArticleMeta[], numbered: boolean) => (
    <div className="help-toc-layer" key={key} data-help-section={key}>
      <h4 className="help-toc-layer-title">{title}</h4>
      {list.map((a, idx) => (
        <button
          key={a.id}
          type="button"
          className={`help-toc-item ${selectedId === a.id ? 'active' : ''}`}
          data-help-article={a.id}
          onClick={() => navigate(a.id)}
        >
          {numbered && <span className="help-toc-order">{idx + 1}.</span>}
          {titleOf(a)}
          {a.draft && <span className="help-toc-draft">{tMenu('backstage.helpDraft')}</span>}
        </button>
      ))}
    </div>
  );

  const tutorialNumber = selectedMeta?.kind === 'tutorial'
    ? tutorialRoute.findIndex(a => a.id === selectedMeta.id) + 1
    : 0;

  return (
    <div className="help-panel">
      <aside className="help-toc" aria-label={tMenu('backstage.help')}>
        <div className="help-search-wrap">
          <Search size={14} className="help-search-icon" aria-hidden />
          <input
            className="help-search"
            type="search"
            placeholder={tMenu('backstage.helpSearchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="help-docslang-wrap">
          <label className="help-docslang-label" htmlFor="help-docslang">
            {tMenu('backstage.helpDocsLang')}
          </label>
          <select
            id="help-docslang"
            className="help-docslang"
            value={docsLangOverride ?? '__auto__'}
            onChange={e => changeDocsLang(e.target.value)}
          >
            <option value="__auto__">
              {tMenu('backstage.helpDocsLangAuto')} ({LANGUAGE_LABELS[uiDocsLang][1]})
            </option>
            {DOC_LANGS.map(l => (
              <option key={l} value={l}>{LANGUAGE_LABELS[l][1]}</option>
            ))}
          </select>
        </div>

        {manifestError ? (
          <div className="backstage-empty">{tMenu('backstage.helpLoadError')}</div>
        ) : !manifest ? (
          <div className="backstage-empty">{tMenu('backstage.helpLoading')}</div>
        ) : (
          <>
            {/* Oude indeling (overgangsperiode tot fase 4). */}
            {HELP_LAYERS.map(layer => {
              const list = manifestArticles.filter(a => a.layer === layer && inSearch(a));
              return list.length === 0 ? null : renderTocSection(`layer-${layer}`, tMenu(`backstage.helpLayer.${layer}`), list, false);
            })}
            {/* Nieuwe indeling: Tutorials (leerroute, uit het register) · How-to · Uitleg · Referentie. */}
            {newStructureLive && HELP_KINDS.map(kind => {
              if (kind === 'tutorial') {
                const list = tutorialRoute.filter(inSearch);
                if (list.length > 0) return renderTocSection('kind-tutorial', tMenu('backstage.helpKind.tutorial'), list, true);
                // Geen tutorial geregistreerd: wijs de weg naar de catalogus (niet tijdens zoeken).
                if (tutorialRoute.length > 0 || query) return null;
                return (
                  <div className="help-toc-layer" key="kind-tutorial" data-help-section="kind-tutorial">
                    <h4 className="help-toc-layer-title">{tMenu('backstage.helpKind.tutorial')}</h4>
                    <p className="help-toc-empty">{tMenu('backstage.helpTutorialsEmpty')}</p>
                    <button type="button" className="help-toc-install" data-help-install-tutorials onClick={openTutorialCatalog}>
                      {tMenu('backstage.helpTutorialsInstall')}
                    </button>
                  </div>
                );
              }
              const list = manifestArticles.filter(a => a.kind === kind && inSearch(a));
              return list.length === 0 ? null : renderTocSection(`kind-${kind}`, tMenu(`backstage.helpKind.${kind}`), list, false);
            })}
          </>
        )}
      </aside>

      <main className="help-article">
        {isStaleDocsLang && (
          <div className="help-stale-warning" role="note">
            <span className="help-stale-text">{tMenu('backstage.helpStale')}</span>
            <span className="help-stale-actions">
              <button type="button" className="help-stale-btn" onClick={() => changeDocsLang('en')}>
                {LANGUAGE_LABELS.en[1]}
              </button>
              <button type="button" className="help-stale-btn" onClick={() => changeDocsLang('nl')}>
                {LANGUAGE_LABELS.nl[1]}
              </button>
            </span>
          </div>
        )}
        {!manifest ? null : !selectedMeta || selectedFailed ? (
          <div className="backstage-empty">{tMenu('backstage.helpArticleNotFound')}</div>
        ) : selectedContent === undefined ? (
          <div className="backstage-empty">{tMenu('backstage.helpLoading')}</div>
        ) : (
          <>
            {tutorialNumber > 0 && (
              <p className="help-tutorial-step" data-help-tutorial-step={tutorialNumber}>
                {tMenu('backstage.helpTutorialStep', { number: tutorialNumber, total: tutorialRoute.length })}
              </p>
            )}
            <div className="help-article-body" ref={bodyRef} data-help-current={selectedId ?? undefined}>{renderedContent}</div>
            {neighbours && (neighbours.prev || neighbours.next) && (
              <nav className="help-tutorial-nav" aria-label={tMenu('backstage.helpKind.tutorial')}>
                {neighbours.prev ? (
                  <button type="button" className="help-tutorial-nav-btn" data-help-tutorial-nav="prev" onClick={() => navigate(neighbours.prev!.id)}>
                    <span className="help-tutorial-nav-label">{tMenu('backstage.helpTutorialPrev')}</span>
                    <span className="help-tutorial-nav-title">{titleOf(neighbours.prev)}</span>
                  </button>
                ) : <span />}
                {neighbours.next && (
                  <button type="button" className="help-tutorial-nav-btn help-tutorial-nav-next" data-help-tutorial-nav="next" onClick={() => navigate(neighbours.next!.id)}>
                    <span className="help-tutorial-nav-label">{tMenu('backstage.helpTutorialNext')}</span>
                    <span className="help-tutorial-nav-title">{titleOf(neighbours.next)}</span>
                  </button>
                )}
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
