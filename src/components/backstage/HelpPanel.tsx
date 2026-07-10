// Fase 2.10, onderdeel 5 (golf 1): in-app help/documentatie-viewer. Backstage-sectie (net als
// `ExamplesSection` in Backstage.tsx) — GEEN aparte `RibbonTab`/`isFullPanel`-tak in App.tsx
// (architect-besluit 5: alleen Backstage-NavItem + F1, geen ribbon-knop). Manifest + artikelen
// worden at-runtime gefetcht via `BASE_URL`, exact hetzelfde patroon als
// `public/examples/manifest.json` (zie `ExamplesSection` hierboven in Backstage.tsx).
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { renderMiniMarkdown, extractHeadings } from '@/utils/miniMarkdown';
import './HelpPanel.css';

type HelpLayer = 'quickstart' | 'gidsen' | 'referentie';
type HelpLang = 'nl' | 'en';

interface HelpArticleMeta {
  id: string;
  title: Record<HelpLang, string>;
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

  // Taal-koppeling (§3 ontwerp): NL-UI → NL-docs, elke andere UI-taal → EN-docs (zelfde
  // fallback-gedrag als de rest van de app, ReportPanel.tsx:13,38 als precedent).
  const lang: HelpLang = i18n.language.startsWith('nl') ? 'nl' : 'en';

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
      manifest.articles.map(a =>
        fetch(`${import.meta.env.BASE_URL}docs/${lang}/${a.id}.md`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
          .then(text => ({ id: a.id, text, ok: true as const }))
          .catch(err => {
            console.error(`[Help] Artikel "${a.id}" (${lang}) laden mislukt:`, err);
            return { id: a.id, text: '', ok: false as const };
          })
      )
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
