import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
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
import { useStoredSettingRefresh } from '@/hooks/useStoredSettingRefresh';
import { EXTENSIONS_ENABLED } from '@/utils/buildFlags';
import { HELP_DOCS_LANG_KEY } from '@/utils/helpArticlePrompt';
import { isSettingId } from '@/utils/settingIds';
import { openSettingsAt } from '@/components/settings/openSettingsAt';

const DOCS_LANG_KEY = HELP_DOCS_LANG_KEY;

const INCLUDE_DRAFTS = import.meta.env.DEV;


interface HelpSelection {
  id: string | null;
  anchor: string | null;
  nonce: number;
}

function isRegistered(a: HelpArticleMeta): a is RegisteredHelpArticle {
  return 'source' in a && 'body' in a;
}

interface LoadedArticle {
  text: string;
  lang: HelpDocLang;
}

interface IndexState {
  lang: HelpDocLang;
  index: HelpDocIndex | null;
}

export function HelpPanel() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon, i18n } = useTranslation('common');
  const openExampleFromString = useAppStore(s => s.openExampleFromString);
  const setUI = useAppStore(s => s.setUI);
  const startQuestionOpen = useAppStore(s => s.ui.pendingActualStartQuestion !== null);
  const pendingHelpArticleId = useAppStore(s => s.ui.pendingHelpArticleId);
  const pendingHelpSection = useAppStore(s => s.ui.pendingHelpSection);
  const tocRef = useRef<HTMLElement>(null);
  const registered = useSyncExternalStore(subscribeRegisteredHelpArticles, getRegisteredHelpArticles);

  const [docsLangOverride, setDocsLangOverride] = useState<HelpDocLang | null>(() => {
    const saved = readLocal(DOCS_LANG_KEY);
    if (saved !== null && !isHelpDocLang(saved)) removeLocal(DOCS_LANG_KEY, 'start');
    return isHelpDocLang(saved) ? saved : null;
  });
  useStoredSettingRefresh(DOCS_LANG_KEY, () => {
    const saved = readLocal(DOCS_LANG_KEY);
    setDocsLangOverride(isHelpDocLang(saved) ? saved : null);
  });
  const uiDocs = resolveHelpDocLang(i18n.language, null);
  const { lang, fallback: uiLangFallback } = resolveHelpDocLang(i18n.language, docsLangOverride);

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

  const navigate = useCallback((target: string) => {
    const { id, anchor } = splitHelpTarget(target);
    setSelection(prev => ({ id, anchor, nonce: prev.nonce + 1 }));
    setUI({ pendingHelpSection: null });
  }, [setUI]);

  useEffect(() => {
    if (!pendingHelpArticleId) return;
    navigate(pendingHelpArticleId);
    setUI({ pendingHelpArticleId: null });
  }, [pendingHelpArticleId, setUI, navigate]);

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

  const manifestArticles = useMemo(
    () => (manifest ? visibleHelpArticles(manifest, INCLUDE_DRAFTS) : []),
    [manifest],
  );
  const registeredArticles = useMemo(
    () => (manifest ? usableRegisteredArticles(manifest, registered) : []),
    [manifest, registered],
  );
  const allArticles = useMemo<HelpArticleMeta[]>(
    () => [...manifestArticles, ...registeredArticles],
    [manifestArticles, registeredArticles],
  );

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
  const docIndex = indexState && indexState.lang === lang ? indexState.index : undefined;

  useEffect(() => {
    if (manifestArticles.length === 0 || docIndex === undefined) return;
    let cancelled = false;
    setArticles({});
    setFailedIds(new Set());
    void Promise.all(
      manifestArticles.map(a => {
        const fetchLang = (l: HelpDocLang) =>
          fetchTextAsset(`${import.meta.env.BASE_URL}docs/${l}/${a.id}.md`).then(text => ({ text, lang: l }));
        const want = articleLang(a.id, lang, docIndex).lang;
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

  const registeredLang: HelpSourceLang = lang === 'nl' ? 'nl' : 'en';

  const shownLangOf = useCallback((a: HelpArticleMeta): HelpDocLang => {
    if (isRegistered(a)) return registeredLang;
    return articles[a.id]?.lang ?? articleLang(a.id, lang, docIndex).lang;
  }, [articles, docIndex, lang, registeredLang]);

  const bodyOf = useCallback((a: HelpArticleMeta): string | undefined => (
    isRegistered(a) ? a.body[registeredLang] : articles[a.id]?.text
  ), [articles, registeredLang]);

  const titleOf = useCallback((a: HelpArticleMeta) => {
    const shown = shownLangOf(a);
    if (!isRegistered(a) && !isHelpSourceLang(shown)) return docIndex?.[a.id]?.title ?? a.title.en;
    return a.title[shown] ?? a.title.en;
  }, [docIndex, shownLangOf]);

  const searchIndex = useMemo(() => allArticles.map(a => {
    const body = bodyOf(a) ?? '';
    return { id: a.id, title: titleOf(a), headings: body ? extractHeadings(body) : [], body };
  }), [allArticles, bodyOf, titleOf]);

  const query = search.trim().toLowerCase();
  const matchedIds = useMemo(() => {
    if (!query) return null;
    return new Set(searchIndex.filter(entry => helpArticleMatches(entry, query)).map(entry => entry.id));
  }, [query, searchIndex]);

  const handleOpenExample = useCallback(async (file: string) => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = await res.text();
      await openExampleFromString(content, file, buildImportLabels(tCommon));
      if (file.startsWith('showcase-')) applyDemoLibraryToShowcaseProject();
      setUI({ activeRibbonTab: 'start' });
    } catch (err) {
      console.error(`[Help] Voorbeeld "${file}" openen mislukt:`, err);
    }
  }, [openExampleFromString, setUI, tCommon]);

  const selectedMeta = manifest && selection.id
    ? resolveHelpArticle(manifest, selection.id, INCLUDE_DRAFTS, registeredArticles)
    : null;
  const selectedId = selectedMeta?.id ?? null;
  const selectedContent = selectedMeta ? bodyOf(selectedMeta) : undefined;
  const selectedFailed = selectedId ? failedIds.has(selectedId) : false;
  const selectedLang: HelpDocLang = selectedMeta ? shownLangOf(selectedMeta) : lang;
  const showLangFallback = uiLangFallback || (!!selectedMeta && selectedContent !== undefined && selectedLang !== lang);
  const showTranslatedNote = !showLangFallback && !!selectedMeta && selectedContent !== undefined
    && selectedLang !== 'nl' && selectedLang !== 'en';
  const showLangNote = showLangFallback || showTranslatedNote;
  const readInLangs = (['en', 'nl'] as const).filter(l => l !== selectedLang);
  const tutorialRoute = useMemo(() => tutorialsInOrder(registeredArticles), [registeredArticles]);
  const neighbours = selectedMeta?.kind === 'tutorial' ? tutorialNeighbours(tutorialRoute, selectedMeta.id) : null;

  const resolveImage = useMemo(() => {
    const own = selectedMeta && isRegistered(selectedMeta) ? selectedMeta.resolveImage : undefined;
    return (src: string) => {
      const path = resolveHelpImagePath(src, selectedLang);
      return own ? own(path) : `${import.meta.env.BASE_URL}docs/${path}`;
    };
  }, [selectedMeta, selectedLang]);

  const openProject = selectedMeta && isRegistered(selectedMeta) ? selectedMeta.openProject : undefined;

  const renderedContent = useMemo(() => {
    if (!selectedContent) return null;
    return renderMiniMarkdown(selectedContent, {
      onNavigate: navigate,
      ...(!startQuestionOpen ? {
        onOpenExample: (f: string) => { void handleOpenExample(f); },
        ...(openProject ? { onOpenProject: openProject } : {}),
        onOpenSetting: (id: string) => { if (isSettingId(id)) openSettingsAt(id); },
      } : {}),
      resolveImage,
    });
  }, [selectedContent, navigate, handleOpenExample, resolveImage, openProject, startQuestionOpen]);

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

  useEffect(() => {
    if (pendingHelpSection !== 'tutorials') return;
    if (!manifestError) {
      if (!manifest || (selectedMeta && selectedContent === undefined && !selectedFailed)) return;
      const section = tocRef.current?.querySelector<HTMLElement>('[data-help-section="kind-tutorial"]');
      section?.scrollIntoView({ block: 'center' });
      section?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    }
    setUI({ pendingHelpSection: null });
  }, [pendingHelpSection, manifest, manifestError, selectedMeta, selectedContent, selectedFailed, setUI]);

  const openTutorialCatalog = () => {
    if (!EXTENSIONS_ENABLED) return;
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
          <Icon id="view.search" size={14} className="help-search-icon" aria-hidden />
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
            {HELP_KINDS.map(kind => {
              if (kind === 'tutorial') {
                const list = tutorialRoute.filter(inSearch);
                if (list.length > 0) return renderTocSection('kind-tutorial', tMenu('backstage.helpKind.tutorial'), list, true);
                if (!EXTENSIONS_ENABLED || tutorialRoute.length > 0 || query) return null;
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
        {showLangNote && (
          <div
            className="help-lang-fallback"
            role="note"
            {...(showLangFallback ? { 'data-help-lang-fallback': true } : { 'data-help-translated-note': true })}
          >
            <span>{tMenu(showLangFallback ? 'backstage.helpLangFallback' : 'backstage.helpTranslatedNote')}</span>
            <span className="help-read-in">
              <span>{tMenu('backstage.helpReadIn')}</span>
              {readInLangs.map(l => (
                <button
                  key={l}
                  type="button"
                  className="btn btn--secondary btn--sm"
                  data-help-read-in={l}
                  onClick={() => changeDocsLang(l)}
                >
                  {LANGUAGE_LABELS[l][1]}
                </button>
              ))}
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
