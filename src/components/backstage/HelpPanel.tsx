// In-app help/documentatie-viewer. Backstage-sectie (net als
// `ExamplesSection` in Backstage.tsx) — GEEN aparte `RibbonTab`/`isFullPanel`-tak in App.tsx
// (alleen Backstage-NavItem + F1, geen ribbon-knop). Manifest + artikelen
// worden at-runtime gefetcht via `BASE_URL`, exact hetzelfde patroon als
// `public/examples/manifest.json` (zie `ExamplesSection` hierboven in Backstage.tsx).
//
// Manifest v2 (ontwerp gebruikersdocumentatie §6, bijgesteld 2026-09-28; omgeschakeld in fase 4):
// de artikelen staan per `kind` in de secties How-to · Uitleg · Referentie. De sectie Tutorials komt
// niet uit het manifest maar uit het register
// (`utils/helpArticleRegistry.ts`) dat een tutorialextensie vult: genummerd volgens de leerroute, met
// Vorige/Volgende onder elke tutorial. `draft`-artikelen bestaan alleen in dev — in productie zijn ze
// onvindbaar, ook via zoeken, een `docs://`-link, een alias of `openHelpArticle`. De regels zelf
// staan puur in `utils/helpManifest.ts`.
//
// Talen (vertaalstraat, ontwerp `2026-10-09-vertaalstraat-design.md` §10): nl en en zijn de bron en
// altijd compleet. Een andere taal heeft alleen de artikelen uit haar `public/docs/<taal>/index.json`
// (die de straat genereert); een artikel dat daar niet in staat, leest Engels met een korte melding.
// Richting en `lang` van tekst en titel volgen de taal van de getoonde tekst, niet de UI: een Engelse
// terugval in een ar-interface blijft links-naar-rechts. Een verouderde vertaling toont de viewer
// gewoon (besluit B2); de releasepoort zorgt dat een release alles actueel heeft.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { LANGUAGE_LABELS, localeDirection } from '@/i18n/config';
import { renderMiniMarkdown, extractHeadings } from '@/utils/miniMarkdown';
import {
  HELP_DOC_LANGS, HELP_KINDS, articleLang, helpArticleMatches, isHelpDocLang, isHelpSourceLang, resolveHelpArticle,
  resolveHelpDocLang, resolveHelpImagePath, splitHelpTarget, tutorialNeighbours, tutorialsInOrder,
  usableRegisteredArticles, visibleHelpArticles, type HelpArticleMeta, type HelpDocIndex, type HelpDocLang,
  type HelpManifest, type HelpSourceLang,
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

/** Een opgehaald manifestartikel en de taal waarin het werkelijk binnenkwam (na een eventuele terugval). */
interface LoadedArticle {
  text: string;
  lang: HelpDocLang;
}

/** De index van een docstaal: `undefined` = nog aan het laden, `null` = geen index (alles Engels). */
interface IndexState {
  lang: HelpDocLang;
  index: HelpDocIndex | null;
}

export function HelpPanel() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon, i18n } = useTranslation('common');
  const openExampleFromString = useAppStore(s => s.openExampleFromString);
  const setUI = useAppStore(s => s.setUI);
  // "Lees meer"-diepe-link vanuit een melding of het eigenschappenpaneel
  // (`openHelpArticle` in uiSlice.ts). Eenmalig-verzoek-patroon: lezen + direct weer op `null`.
  const pendingHelpArticleId = useAppStore(s => s.ui.pendingHelpArticleId);
  // "Help › Tutorials" als terugval van de tutorialvraag: dezelfde eenmalig-verzoekvorm, maar voor
  // een sectie van de inhoudsopgave in plaats van een artikel.
  const pendingHelpSection = useAppStore(s => s.ui.pendingHelpSection);
  const tocRef = useRef<HTMLElement>(null);
  const registered = useSyncExternalStore(subscribeRegisteredHelpArticles, getRegisteredHelpArticles);

  // Taal-koppeling: standaard volgt de docstaal de UI-taal. De gebruiker kan de docstaal LOS van de UI
  // vastzetten op een andere taal; die keuze is persistent in localStorage. Een bewaarde waarde die
  // geen docstaal is, valt terug op Auto en wordt opgeruimd.
  const [docsLangOverride, setDocsLangOverride] = useState<HelpDocLang | null>(() => {
    const saved = readLocal(DOCS_LANG_KEY);
    if (saved !== null && !isHelpDocLang(saved)) removeLocal(DOCS_LANG_KEY);
    return isHelpDocLang(saved) ? saved : null;
  });
  const uiDocs = resolveHelpDocLang(i18n.language, null);
  const { lang, fallback: uiLangFallback } = resolveHelpDocLang(i18n.language, docsLangOverride);

  // '__auto__' = volg de UI-taal (override wissen); anders een docstaal vastzetten.
  const changeDocsLang = (value: string) => {
    if (value === '__auto__') {
      setDocsLangOverride(null);
      removeLocal(DOCS_LANG_KEY);
    } else if (isHelpDocLang(value)) {
      setDocsLangOverride(value);
      writeLocal(DOCS_LANG_KEY, value);
    }
  };

  const [manifest, setManifest] = useState<HelpManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [articles, setArticles] = useState<Record<string, LoadedArticle>>({});
  const [indexState, setIndexState] = useState<IndexState | null>(null);
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

  // De index van de docstaal (contract C2): welke artikelen er in die taal zijn, met hun titel. nl en
  // en hebben er geen (altijd compleet). Ontbreekt hij, dan leest alles Engels met de melding.
  useEffect(() => {
    if (isHelpSourceLang(lang)) { setIndexState({ lang, index: null }); return; }
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}docs/${lang}/index.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<HelpDocIndex>; })
      .then(data => {
        if (cancelled) return;
        const valid = !!data && typeof data === 'object' && !Array.isArray(data);
        setIndexState({ lang, index: valid ? data : null });
      })
      .catch(() => { if (!cancelled) setIndexState({ lang, index: null }); });
    return () => { cancelled = true; };
  }, [lang]);
  // `undefined` zolang de index van de huidige taal nog niet binnen is.
  const docIndex = indexState && indexState.lang === lang ? indexState.index : undefined;

  // Alle artikelbodies voor de huidige taal ophalen (zonder apart zoekbestand); dit dient tegelijk
  // als de zoekindex, client-side opgebouwd uit de gefetchte artikelen. Pas als de index binnen is:
  // een artikel dat niet in de index staat, wordt meteen in het Engels opgehaald (geen 404-regen).
  useEffect(() => {
    if (manifestArticles.length === 0 || docIndex === undefined) return;
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
        const fetchLang = (l: HelpDocLang) =>
          fetchTextAsset(`${import.meta.env.BASE_URL}docs/${l}/${a.id}.md`).then(text => ({ text, lang: l }));
        const want = articleLang(a.id, lang, docIndex).lang;
        // Val per artikel terug op EN als de tekst onverhoopt ontbreekt (verify:docs eist nl en en).
        return fetchLang(want)
          .catch(() => (want === 'en' ? Promise.reject(new Error('geen EN-fallback')) : fetchLang('en')))
          .then(loaded => ({ id: a.id, loaded, ok: true as const }))
          .catch(err => {
            console.error(`[Help] Artikel "${a.id}" (taal ${want}, incl. EN-fallback) laden mislukt:`, err);
            return { id: a.id, loaded: null, ok: false as const };
          });
      })
    ).then(results => {
      if (cancelled) return;
      const map: Record<string, LoadedArticle> = {};
      const failed = new Set<string>();
      for (const r of results) {
        if (r.ok) map[r.id] = r.loaded;
        else failed.add(r.id);
      }
      setArticles(map);
      setFailedIds(failed);
    });
    return () => { cancelled = true; };
  }, [manifestArticles, lang, docIndex]);

  // Geregistreerde artikelen (tutorials uit een extensie) bestaan alleen in nl en en.
  const registeredLang: HelpSourceLang = lang === 'nl' ? 'nl' : 'en';

  // De taal waarin een artikel werkelijk getoond wordt: die bepaalt `lang`/`dir` en de taalmelding.
  const shownLangOf = useCallback((a: HelpArticleMeta): HelpDocLang => {
    if (isRegistered(a)) return registeredLang;
    return articles[a.id]?.lang ?? articleLang(a.id, lang, docIndex).lang;
  }, [articles, docIndex, lang, registeredLang]);

  // De tekst van een artikel in de huidige docstaal: gefetcht (manifest) of meegeleverd (register).
  const bodyOf = useCallback((a: HelpArticleMeta): string | undefined => (
    isRegistered(a) ? a.body[registeredLang] : articles[a.id]?.text
  ), [articles, registeredLang]);

  // Titel in de getoonde taal: nl/en uit het manifest, een andere taal uit haar index, anders Engels.
  const titleOf = useCallback((a: HelpArticleMeta) => {
    const shown = shownLangOf(a);
    if (!isRegistered(a) && !isHelpSourceLang(shown)) return docIndex?.[a.id]?.title ?? a.title.en;
    return a.title[shown] ?? a.title.en;
  }, [docIndex, shownLangOf]);

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
  // De taal van de getoonde tekst. Wijkt die af van de gekozen docstaal (het artikel is in die taal
  // er nog niet), dan volgt de melding — net als voor een UI-taal zonder docs.
  const selectedLang: HelpDocLang = selectedMeta ? shownLangOf(selectedMeta) : lang;
  const showLangFallback = uiLangFallback || (!!selectedMeta && selectedContent !== undefined && selectedLang !== lang);
  const tutorialRoute = useMemo(() => tutorialsInOrder(registeredArticles), [registeredArticles]);
  const neighbours = selectedMeta?.kind === 'tutorial' ? tutorialNeighbours(tutorialRoute, selectedMeta.id) : null;

  // Afbeeldingen per bron: een manifestartikel uit `public/docs` met `{lang}` = de docstaal, een
  // geregistreerd artikel via de resolver van zijn bron (bijv. de assets van de extensie).
  const resolveImage = useMemo(() => {
    const own = selectedMeta && isRegistered(selectedMeta) ? selectedMeta.resolveImage : undefined;
    return (src: string) => {
      const path = resolveHelpImagePath(src, selectedLang);
      return own ? own(path) : `${import.meta.env.BASE_URL}docs/${path}`;
    };
  }, [selectedMeta, selectedLang]);

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

  // Verzoek "breng Help › Tutorials in beeld". Pas als het eerste artikel getekend is: inhoudsopgave
  // en artikel delen de scrollcontainer, en de layout-effect hierboven zet die bij een nieuw artikel
  // terug naar boven. Een effect loopt ná de layout-effects van dezelfde commit, dus dit wint.
  useEffect(() => {
    if (pendingHelpSection !== 'tutorials' || !manifest || !renderedContent) return;
    const section = tocRef.current?.querySelector<HTMLElement>('[data-help-section="kind-tutorial"]');
    section?.scrollIntoView({ block: 'center' });
    section?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    setUI({ pendingHelpSection: null });
  }, [pendingHelpSection, manifest, renderedContent, setUI]);

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
          <span className="help-toc-title" dir="auto" lang={shownLangOf(a)}>{titleOf(a)}</span>
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
      <aside ref={tocRef} className="help-toc" aria-label={tMenu('backstage.help')}>
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
              {tMenu('backstage.helpDocsLangAuto')} ({LANGUAGE_LABELS[uiDocs.lang][1]})
            </option>
            {/* Alle docstalen: een taal zonder (volledige) vertaling toont per artikel Engels met de melding. */}
            {HELP_DOC_LANGS.map(l => (
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
            {/* Tutorials (leerroute, uit het register) · How-to · Uitleg · Referentie. Tutorials staan er
                ALTIJD: zonder geregistreerde tutorial wijst de sectie de weg naar de catalogus (de
                tutorialvraag na de eerste rondleiding verwijst naar "Help › Tutorials"). */}
            {HELP_KINDS.map(kind => {
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
        {showLangFallback && (
          <div className="help-lang-fallback" role="note" data-help-lang-fallback>
            {tMenu('backstage.helpLangFallback')}
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
            {/* Richting en taal volgen de getoonde tekst: een ar-artikel loopt rechts-naar-links, een
                Engelse terugval in een ar/fa-interface links-naar-rechts (anders springen leestekens en
                lijsten naar de verkeerde kant). De taalmelding erboven volgt de UI. */}
            <div
              className="help-article-body"
              ref={bodyRef}
              dir={localeDirection(selectedLang)}
              lang={selectedLang}
              data-help-current={selectedId ?? undefined}
            >{renderedContent}</div>
            {neighbours && (neighbours.prev || neighbours.next) && (
              <nav className="help-tutorial-nav" aria-label={tMenu('backstage.helpKind.tutorial')}>
                {neighbours.prev ? (
                  <button type="button" className="help-tutorial-nav-btn" data-help-tutorial-nav="prev" onClick={() => navigate(neighbours.prev!.id)}>
                    <span className="help-tutorial-nav-label">{tMenu('backstage.helpTutorialPrev')}</span>
                    <span className="help-tutorial-nav-title" dir={localeDirection(shownLangOf(neighbours.prev))} lang={shownLangOf(neighbours.prev)}>{titleOf(neighbours.prev)}</span>
                  </button>
                ) : <span />}
                {neighbours.next && (
                  <button type="button" className="help-tutorial-nav-btn help-tutorial-nav-next" data-help-tutorial-nav="next" onClick={() => navigate(neighbours.next!.id)}>
                    <span className="help-tutorial-nav-label">{tMenu('backstage.helpTutorialNext')}</span>
                    <span className="help-tutorial-nav-title" dir={localeDirection(shownLangOf(neighbours.next))} lang={shownLangOf(neighbours.next)}>{titleOf(neighbours.next)}</span>
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
