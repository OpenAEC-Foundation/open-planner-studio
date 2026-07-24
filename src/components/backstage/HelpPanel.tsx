// Fase 2.10, onderdeel 5 (golf 1): in-app help/documentatie-viewer. Backstage-sectie (net als
// `ExamplesSection` in Backstage.tsx) — GEEN aparte `RibbonTab`/`isFullPanel`-tak in App.tsx
// (architect-besluit 5: alleen Backstage-NavItem + F1, geen ribbon-knop). Manifest + artikelen
// worden at-runtime gefetcht via `BASE_URL`, exact hetzelfde patroon als
// `public/examples/manifest.json` (zie `ExamplesSection` hierboven in Backstage.tsx).
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { LANGUAGE_LABELS } from '@/i18n/config';
import { renderMiniMarkdown, extractHeadings } from '@/utils/miniMarkdown';
import './HelpPanel.css';

// De documentatietaal wordt persistent los van de UI-taal bewaard, zodat een gebruiker de docs in
// bv. Engels kan lezen terwijl de rest van de app in zijn eigen taal blijft.
const DOCS_LANG_KEY = 'ops-docs-locale';

type HelpLayer = 'quickstart' | 'gidsen' | 'referentie';

// Alle UI-locales met een eigen vertaalde docs-map onder public/docs/<lang>/. Elke UI-taal die
// hier niet in staat (of waarvan een specifiek artikel ontbreekt) valt terug op de EN-docs.
const DOC_LANGS = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'] as const;
type HelpLang = (typeof DOC_LANGS)[number];

function resolveDocLang(uiLang: string): HelpLang {
  const base = uiLang.split('-')[0];
  return (DOC_LANGS as readonly string[]).includes(base) ? (base as HelpLang) : 'en';
}

interface HelpArticleMeta {
  id: string;
  // EN is altijd aanwezig als fallback; de overige talen zijn optioneel.
  title: Partial<Record<HelpLang, string>> & { en: string };
  layer: HelpLayer;
  cluster?: string;
}

interface HelpManifest {
  version: number;
  articles: HelpArticleMeta[];
}

const LAYERS: HelpLayer[] = ['quickstart', 'gidsen', 'referentie'];

export function HelpPanel() {
  const { t: tMenu } = useTranslation('menu');
  const { i18n } = useTranslation();
  const openExampleFromString = useAppStore(s => s.openExampleFromString);
  const runCPM = useAppStore(s => s.runCPM);
  const setUI = useAppStore(s => s.setUI);

  // Taal-koppeling (§3 ontwerp): standaard volgt de docs-taal de UI-taal (met EN-fallback per
  // artikel in de body-fetch). De gebruiker kan de docs-taal echter LOS van de UI overrulen —
  // handig omdat de niet-NL/EN-vertalingen maar sporadisch worden bijgewerkt (zie de waarschuwing
  // hieronder). De override is persistent in localStorage.
  const uiDocsLang: HelpLang = resolveDocLang(i18n.language);
  const [docsLangOverride, setDocsLangOverride] = useState<HelpLang | null>(() => {
    const saved = localStorage.getItem(DOCS_LANG_KEY);
    return saved && (DOC_LANGS as readonly string[]).includes(saved) ? (saved as HelpLang) : null;
  });
  const lang: HelpLang = docsLangOverride ?? uiDocsLang;
  // NL/EN zijn de canonieke, meebewegende brontalen; alle andere docs-talen lopen mogelijk achter.
  const isStaleDocsLang = lang !== 'nl' && lang !== 'en';

  // '__auto__' = volg de UI-taal (override wissen); anders een concrete docs-taal vastzetten.
  const changeDocsLang = (value: string) => {
    if (value === '__auto__') {
      setDocsLangOverride(null);
      localStorage.removeItem(DOCS_LANG_KEY);
    } else if ((DOC_LANGS as readonly string[]).includes(value)) {
      setDocsLangOverride(value as HelpLang);
      localStorage.setItem(DOCS_LANG_KEY, value);
    }
  };

  const [manifest, setManifest] = useState<HelpManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [articles, setArticles] = useState<Record<string, string>>({});
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Manifest ophalen (eenmalig).
  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}docs/manifest.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: HelpManifest) => {
        if (cancelled) return;
        setManifest(data);
        setSelectedId(prev => prev ?? data.articles[0]?.id ?? null);
      })
      .catch(err => {
        console.error('[Help] Manifest laden mislukt:', err);
        if (!cancelled) setManifestError(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Alle artikelbodies voor de huidige taal ophalen. Golf 1 heeft er 2 (klein genoeg om zonder
  // apart index-bestand te gebruiken); dit dient tegelijk als de titel+koppen-zoekindex (§2.3
  // MVP) — "bouw 'm client-side uit de gefetchte artikelen die al geladen zijn". Her-fetch bij
  // elke taalwissel via de `lang`-dependency.
  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    setArticles({});
    setFailedIds(new Set());
    Promise.all(
      manifest.articles.map(a => {
        const fetchLang = (l: HelpLang) =>
          fetch(`${import.meta.env.BASE_URL}docs/${l}/${a.id}.md`)
            .then(async r => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              // Vite (dev) en veel statische hosts (prod) serveren voor een ONBEKEND pad hun
              // SPA-fallback (index.html) mét status 200 — `r.ok` is dus geen betrouwbaar
              // "bestaat"-signaal. Herken de fallback aan het HTML-content-type en/of een
              // <!doctype>/<html>-body en behandel 'm als "niet gevonden", anders belandt de
              // rauwe app-HTML als "artikelinhoud" in de markdown-renderer.
              const ct = r.headers.get('content-type') ?? '';
              if (ct.includes('text/html')) throw new Error('SPA-fallback (content-type)');
              const text = await r.text();
              if (/^\uFEFF?\s*<(?:!doctype|html)\b/i.test(text)) throw new Error('SPA-fallback (body)');
              return text;
            });
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
  }, [manifest, lang]);

  const searchIndex = useMemo(() => {
    if (!manifest) return [];
    return manifest.articles.map(a => ({
      id: a.id,
      title: a.title[lang] ?? a.title.en,
      headings: articles[a.id] ? extractHeadings(articles[a.id]) : [],
    }));
  }, [manifest, articles, lang]);

  const query = search.trim().toLowerCase();
  const matchedIds = useMemo(() => {
    if (!query) return null;
    const ids = new Set<string>();
    for (const entry of searchIndex) {
      if (entry.title.toLowerCase().includes(query) || entry.headings.some(h => h.toLowerCase().includes(query))) {
        ids.add(entry.id);
      }
    }
    return ids;
  }, [query, searchIndex]);

  const handleNavigate = (id: string) => setSelectedId(id);

  // Zelfde open-flow als Backstage → Voorbeelden (`ExamplesSection.handleOpen` hierboven in
  // Backstage.tsx): fetch → openExampleFromString → runCPM → terug naar het Start-tabblad.
  const handleOpenExample = async (file: string) => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = await res.text();
      openExampleFromString(content, file);
      runCPM();
      setUI({ activeRibbonTab: 'start' });
    } catch (err) {
      console.error(`[Help] Voorbeeld "${file}" openen mislukt:`, err);
    }
  };

  const selectedMeta = manifest?.articles.find(a => a.id === selectedId) ?? null;
  const selectedContent = selectedId ? articles[selectedId] : undefined;
  const selectedFailed = selectedId ? failedIds.has(selectedId) : false;

  const renderedContent = useMemo(() => {
    if (!selectedContent) return null;
    return renderMiniMarkdown(selectedContent, {
      onNavigate: handleNavigate,
      onOpenExample: (f) => { void handleOpenExample(f); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContent]);

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
          LAYERS.map(layer => {
            const layerArticles = manifest.articles.filter(
              a => a.layer === layer && (!matchedIds || matchedIds.has(a.id))
            );
            if (layerArticles.length === 0) return null;
            return (
              <div className="help-toc-layer" key={layer}>
                <h4 className="help-toc-layer-title">{tMenu(`backstage.helpLayer.${layer}`)}</h4>
                {layerArticles.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={`help-toc-item ${selectedId === a.id ? 'active' : ''}`}
                    onClick={() => handleNavigate(a.id)}
                  >
                    {a.title[lang] ?? a.title.en}
                  </button>
                ))}
              </div>
            );
          })
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
          <div className="help-article-body">{renderedContent}</div>
        )}
      </main>
    </div>
  );
}
