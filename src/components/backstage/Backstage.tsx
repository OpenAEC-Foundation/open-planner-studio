import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, FolderOpen, Clock, Save, SaveAll, Download,
  Printer, Info, Settings, X, FileType, Puzzle, Upload, BookOpen, Compass, LifeBuoy, Building2,
} from 'lucide-react';
import { useAppStore, ExportFormat } from '@/state/appStore';
import { EXPORT_FORMATS } from '@/services/formatRegistry';
import { BackstageSection } from '@/state/slices/types';
import { SettingsPanelContent } from '@/components/settings/SettingsPanelContent';
import { ProjectInfoPanelContent, type ProjectInfoPanelContentHandle } from '@/components/settings/ProjectInfoPanelContent';
import { ExtensionManagerPanel } from '@/components/backstage/ExtensionManagerPanel';
import { HelpPanel } from '@/components/backstage/HelpPanel';
import { LibrarySection } from './LibrarySection';
import { useDocumentActions } from '@/components/layout/DocumentChrome/useDocumentCards';
import { ExtensionIcon } from '@/components/common/ExtensionIcon';
import type { ExtensionImporter } from '@/state/slices/extensionSlice';
import { supportsHandles } from '@/services/fileAccess';
import { fromExtImportResult } from '@/extensions/extMappers';
import { applyDemoLibraryToShowcaseProject } from '@/state/demoLibraryShowcase';
import { buildImportLabels } from '@/i18n/importLabels';
import type { ImportLabels } from '@/services/importTypes';
import './Backstage.css';

export function Backstage() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const section = useAppStore(s => s.ui.backstageSection);

  // Issue #37: "Sluit project" sloot niets — het riep `handleNewProject()` aan (copy-paste van de
  // New-knop) en toonde dus de projectwizard. Het sluiten loopt nu via exact dezelfde route als de
  // document-chrome (tabstrip/projectbalk/overzicht): `closeWithGuard` → dirty toont de 3-weg
  // sluit-bevestiging, schoon sluit meteen.
  const { closeWithGuard } = useDocumentActions();
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const isDirty = useAppStore(s => s.isDirty); // top-level = het actieve document

  const closeBackstage = () => {
    // Terug naar Start-tab
    setUI({ activeRibbonTab: 'start' });
  };

  const handleCloseProject = () => {
    // Backstage éérst dicht: de sluit-bevestiging hoort boven de gewone werkruimte te staan, niet
    // achter/onder het File-menu dat de hele body overneemt.
    closeBackstage();
    closeWithGuard({ id: activeDocumentId, isDirty });
  };

  // Esc sluit backstage
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBackstage();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const goTo = (s: BackstageSection) => setUI({ backstageSection: s });

  return (
    <div className="backstage" role="region" aria-label={tMenu('backstage.fileMenu')}>
      <aside className="backstage-sidebar" aria-label={tMenu('backstage.fileNav')}>
        <button className="backstage-back" onClick={closeBackstage}>
          <ArrowLeft size={16} /> {tMenu('backstage.back')}
        </button>

        {/* Actie-items: triggeren actie en sluiten backstage */}
        <ActionItem icon={<FileText size={14} />} label={tMenu('ribbon.new')} onClick={() => { handleNewProject(); closeBackstage(); }} />
        <ActionItem icon={<FolderOpen size={14} />} label={tMenu('ribbon.open')} onClick={() => { handleOpen(buildImportLabels(tCommon)); closeBackstage(); }} />
        <NavItem icon={<Clock size={14} />} label={tMenu('backstage.recent')} active={section === 'recent'} onClick={() => goTo('recent')} />
        {/* data-tour-anchor (fase 2.10, onderdeel 3, tourstap 6): voorbeelden-navitem. */}
        <NavItem icon={<BookOpen size={14} />} label={tMenu('backstage.examples')} active={section === 'examples'} onClick={() => goTo('examples')} tourAnchor="backstage-examples" />
        <ActionItem icon={<Save size={14} />} label={tMenu('ribbon.save')} onClick={() => { handleSave(); closeBackstage(); }} />
        <ActionItem icon={<SaveAll size={14} />} label={tMenu('backstage.saveAs')} onClick={() => { handleSaveAs(); closeBackstage(); }} />

        <div className="backstage-nav-divider" />

        <NavItem icon={<Download size={14} />} label={tMenu('backstage.export')} active={section === 'export'} onClick={() => goTo('export')} />
        <NavItem icon={<Upload size={14} />} label={tMenu('extensions.import')} active={section === 'import'} onClick={() => goTo('import')} />
        <NavItem icon={<Printer size={14} />} label={tMenu('ribbon.printPreview')} active={section === 'print'} onClick={() => goTo('print')} />

        <div className="backstage-nav-divider" />

        <NavItem icon={<Info size={14} />} label={tMenu('ribbon.projectInfo')} active={section === 'project-info'} onClick={() => goTo('project-info')} />
        <NavItem icon={<Settings size={14} />} label={tMenu('backstage.settings')} active={section === 'settings'} onClick={() => goTo('settings')} />
        <NavItem icon={<Puzzle size={14} />} label={tMenu('extensions.title')} active={section === 'extensions'} onClick={() => goTo('extensions')} />
        <NavItem icon={<Building2 size={14} />} label={tMenu('backstage.library')} active={section === 'library'} onClick={() => goTo('library')} />

        <div className="backstage-nav-divider" />

        {/* Fase 2.10, onderdeel 5 (golf 1): help/documentatie-viewer — architect-besluit 5
            (bindend ontwerp §2.1): Backstage-NavItem als primaire ingang, in het "leer de app
            kennen"-rijtje naast de rondleiding-herstart hieronder. */}
        <NavItem icon={<LifeBuoy size={14} />} label={tMenu('backstage.help')} active={section === 'help'} onClick={() => goTo('help')} />

        <div className="backstage-nav-divider" />

        {/* [Rondleiding] (fase 2.10, onderdeel 3, herstart-ingang §5/§6 — architect-besluit 3:
            BEIDE ingangen, ribbon + Backstage). Actie-item (geen `section`): sluit Backstage en
            start de TourOverlay direct, zonder de WelcomeDialog ertussen. */}
        <ActionItem
          icon={<Compass size={14} />}
          label={tCommon('tour.backstageRestart')}
          onClick={() => { closeBackstage(); setUI({ showTourOverlay: true, tourStepIndex: 0 }); }}
        />

        <div className="backstage-nav-divider" />

        <ActionItem icon={<X size={14} />} label={tMenu('backstage.closeProject')} onClick={handleCloseProject} />
      </aside>

      <main className="backstage-main">
        {section === 'recent' && <RecentSection />}
        {section === 'examples' && <ExamplesSection />}
        {section === 'export' && <ExportSection />}
        {section === 'import' && <ImportSection />}
        {section === 'print' && <PrintSection onClose={closeBackstage} />}
        {section === 'project-info' && <ProjectInfoSection onApply={closeBackstage} />}
        {section === 'settings' && <SettingsSection />}
        {section === 'extensions' && <ExtensionsSection />}
        {section === 'library' && <LibrarySection />}
        {section === 'help' && <HelpSection />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar items
// ---------------------------------------------------------------------------

function NavItem({ icon, label, active, onClick, tourAnchor }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick: () => void;
  /** Fase 2.10, onderdeel 3: optioneel `data-tour-anchor`-attribuut voor de TourOverlay. */
  tourAnchor?: string;
}) {
  return (
    <button
      className={`backstage-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      {...(tourAnchor ? { 'data-tour-anchor': tourAnchor } : {})}
    >
      <span className="backstage-nav-icon">{icon}</span>
      {label}
    </button>
  );
}

function ActionItem({ icon, label, onClick }: {
  icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button className="backstage-nav-item" onClick={onClick}>
      <span className="backstage-nav-icon">{icon}</span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Action handlers (gedeeld)
// ---------------------------------------------------------------------------

function handleNewProject() {
  // Nieuw-project-wizard (metadata + kalender + fasering-template).
  useAppStore.getState().setUI({ showNewProjectDialog: true });
}

// `labels` — de store-laag heeft geen `t(...)`; zie ImportLabels/buildImportLabels.
function handleOpen(labels: ImportLabels) {
  void useAppStore.getState().openFile(labels);
}

function handleSave() {
  void useAppStore.getState().saveFile();
}

function handleSaveAs() {
  void useAppStore.getState().saveFileAs();
}

// ---------------------------------------------------------------------------
// Recent section
// ---------------------------------------------------------------------------

function RecentSection() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const recentFiles = useAppStore(s => s.recentFiles);
  const openRecentFile = useAppStore(s => s.openRecentFile);
  const setUI = useAppStore(s => s.setUI);

  if (!supportsHandles()) return null; // fallback-web: recents verbergen (spec §6)

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.recentTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.recentSubtitle')}</p>
      {recentFiles.length === 0 ? (
        <div className="backstage-empty">{tMenu('backstage.recentEmpty')}</div>
      ) : (
        <div className="backstage-recent-list">
          {recentFiles.map(e => (
            <button
              key={e.id}
              className="backstage-recent-item"
              onClick={() => {
                void openRecentFile(e.id, buildImportLabels(tCommon));
                setUI({ activeRibbonTab: 'start' });
              }}
            >
              <span className="backstage-recent-thumb"><FileType size={20} /></span>
              <span className="backstage-recent-info">
                <span className="backstage-recent-name">{e.name}</span>
                <span className="backstage-recent-path">{e.ref.kind === 'path' ? e.ref.path : e.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Examples section — meegeleverde voorbeeldprojecten (data-gedreven via manifest)
// ---------------------------------------------------------------------------

interface ExampleEntry {
  file: string;
  name: string;
  description: string;
  category?: 'showcase' | 'basic';
  tags?: string[];
}

function ExamplesSection() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const openExampleFromString = useAppStore(s => s.openExampleFromString);
  const setUI = useAppStore(s => s.setUI);

  const [examples, setExamples] = useState<ExampleEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}examples/manifest.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: { examples?: ExampleEntry[] }) => {
        if (!cancelled) setExamples(Array.isArray(data.examples) ? data.examples : []);
      })
      .catch(err => {
        console.error('[Voorbeelden] Manifest laden mislukt:', err);
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const handleOpen = async (ex: ExampleEntry) => {
    setLoading(ex.file);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}examples/${ex.file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = await res.text();
      openExampleFromString(content, ex.name, buildImportLabels(tCommon));
      // Showcase-voorbeelden delen één demo-resourcebibliotheek (issue #19, user-verzoek). De
      // laadgrens heeft al gerekend; het linken herleidt zelf de resourcebelasting opnieuw.
      if (ex.category === 'showcase') applyDemoLibraryToShowcaseProject();
      setUI({ activeRibbonTab: 'start' });
    } catch (err) {
      console.error(`[Voorbeelden] Openen van "${ex.file}" mislukt:`, err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.examplesTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.examplesSubtitle')}</p>
      {error ? (
        <div className="backstage-empty">{tMenu('backstage.examplesError')}</div>
      ) : examples === null ? (
        <div className="backstage-empty">{tMenu('backstage.examplesLoading')}</div>
      ) : examples.length === 0 ? (
        <div className="backstage-empty">{tMenu('backstage.examplesEmpty')}</div>
      ) : (
        <>
          {(() => {
            const showcases = examples.filter(e => e.category === 'showcase');
            const basics = examples.filter(e => e.category !== 'showcase');
            const card = (ex: ExampleEntry, showcase: boolean) => (
              <button
                key={ex.file}
                className={`backstage-export-card${showcase ? ' backstage-example-card-showcase' : ''}`}
                disabled={loading !== null}
                onClick={() => void handleOpen(ex)}
              >
                <span className="backstage-export-icon"><BookOpen size={20} /></span>
                <span className="backstage-export-info">
                  <h4>
                    {ex.name}
                    {showcase && <span className="backstage-example-badge">{tMenu('backstage.examplesShowcaseBadge')}</span>}
                  </h4>
                  <p>{ex.description}</p>
                  {ex.tags && ex.tags.length > 0 && (
                    <span className="backstage-example-tags">
                      {ex.tags.map(tag => (
                        <span key={tag} className="backstage-example-tag">{tag}</span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            );
            return (
              <>
                {showcases.length > 0 && (
                  <>
                    <h3 className="backstage-example-heading">{tMenu('backstage.examplesShowcaseHeading')}</h3>
                    <div className="backstage-export-grid backstage-example-grid-showcase">
                      {showcases.map(ex => card(ex, true))}
                    </div>
                  </>
                )}
                {basics.length > 0 && (
                  <>
                    <h3 className="backstage-example-heading">{tMenu('backstage.examplesBasicHeading')}</h3>
                    <div className="backstage-export-grid">
                      {basics.map(ex => card(ex, false))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Export section
// ---------------------------------------------------------------------------

function ExportSection() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const exportAs = useAppStore(s => s.exportAs);
  const exportProjectWithPool = useAppStore(s => s.exportProjectWithPool);
  const setUI = useAppStore(s => s.setUI);
  const companyId = useAppStore(s => s.project.companyId);
  const [alsoPool, setAlsoPool] = useState(false);

  // Geen stale true laten hangen als het project z'n bedrijfskoppeling verliest (bijv. door te
  // wisselen naar een ongekoppeld document) — anders blijft het vinkje aan staan voor een checkbox
  // die niet eens meer zichtbaar is.
  useEffect(() => {
    if (!companyId) setAlsoPool(false);
  }, [companyId]);

  const formats: { format: ExportFormat; label: string; desc: string; icon: string }[] = EXPORT_FORMATS.map(
    (f) => ({ format: f.format, label: tMenu(f.labelKey), desc: tMenu(f.descKey), icon: f.icon }),
  );

  // K7: bij een cyclische planning geeft exportAs { ok: false } met cpmResult.error terug.
  // Backstage vervangt de hele body, dus GanttCanvas is hier niet gemonteerd en de cyclus-toast
  // (die in GanttCanvas leeft) vuurt niet — toon de fout daarom zelf in de bestaande
  // backstage-stijl. Tussenstand: K8 trekt dit foutkanaal samen tot één toast in uiSlice.
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    // Pool-ernaast geldt alleen voor de IFC-kaart (spec §4: het is een IFC-tweede-bestand, geen
    // embed in CSV/MSPDI/P6). Bij een ander formaat blijft het bestaande pad ongemoeid. Beide
    // paden geven hetzelfde ExportResult terug, dus de K7-foutafhandeling geldt voor allebei.
    const result = format === 'ifc' && alsoPool
      ? await exportProjectWithPool()
      : await exportAs(format);
    if (!result.ok) {
      // Blijf in Backstage zodat de fout zichtbaar is; ga niet terug naar het Start-tab.
      setExportError(result.error);
      return;
    }
    setExportError(null);
    setUI({ activeRibbonTab: 'start' });
  };

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.exportTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.exportSubtitle')}</p>
      {exportError && (
        <div className="backstage-empty">{exportError}</div>
      )}
      <div className="backstage-export-grid">
        {formats.map(f => (
          <button key={f.format} className="backstage-export-card" onClick={() => void handleExport(f.format)}>
            <span className="backstage-export-icon">{f.icon}</span>
            <span className="backstage-export-info">
              <h4>{f.label}</h4>
              <p>{f.desc}</p>
            </span>
          </button>
        ))}
      </div>
      {companyId && (
        <label className="flex items-center gap-2 mt-1 text-xs">
          <input type="checkbox" checked={alsoPool} onChange={e => setAlsoPool(e.target.checked)} className="accent-accent" />
          <span>{tCommon('companyLibrary.exportWithPool')}</span>
        </label>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Print section — opent Report-tab
// ---------------------------------------------------------------------------

function PrintSection({ onClose }: { onClose: () => void }) {
  const { t: tMenu } = useTranslation('menu');
  const setUI = useAppStore(s => s.setUI);

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.printTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.printSubtitle')}</p>
      <button
        className="btn btn--primary"
        onClick={() => {
          setUI({ activeRibbonTab: 'report' });
          onClose();
        }}
      >
        {tMenu('backstage.openPrintPreview')}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Project info section
// ---------------------------------------------------------------------------

function ProjectInfoSection({ onApply }: { onApply: () => void }) {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const panelRef = useRef<ProjectInfoPanelContentHandle>(null);

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.projectInfoTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.projectInfoSubtitle')}</p>

      <div className="backstage-form">
        <ProjectInfoPanelContent ref={panelRef} mode="edit" onDone={onApply} />

        <div className="backstage-actions">
          <button className="btn btn--primary" onClick={() => panelRef.current?.submit()}>{tCommon('apply')}</button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings section — gedeelde settings-UI (zelfde als gear-dialog/ribbon)
// ---------------------------------------------------------------------------

function SettingsSection() {
  const { t: tMenu } = useTranslation('menu');
  return (
    <>
      <h2 className="backstage-title">{tMenu('ribbon.projectSettings')}</h2>
      <SettingsPanelContent />
    </>
  );
}

// ---------------------------------------------------------------------------
// Import section — importers geregistreerd door extensies
// ---------------------------------------------------------------------------

function ImportSection() {
  const { t: tMenu } = useTranslation('menu');
  const importers = useAppStore(s => s.extensionImporters);
  const loadState = useAppStore(s => s.loadState);
  const setUI = useAppStore(s => s.setUI);

  const handleImport = (imp: ExtensionImporter) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = imp.fileExtensions.join(',');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('cancel', () => input.remove());
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); return; }
      try {
        // De importer levert een EXT-facing resultaat; map het naar de interne loadState-vorm.
        const result = fromExtImportResult(await imp.handler(file));
        loadState(result);
        setUI({ activeRibbonTab: 'start' });
      } catch (err) {
        console.error('[Extensies] Import mislukt:', err);
      } finally {
        input.remove();
      }
    };
    input.click();
  };

  return (
    <>
      <h2 className="backstage-title">{tMenu('extensions.import')}</h2>
      <p className="backstage-subtitle">{tMenu('extensions.importSubtitle')}</p>
      {importers.length === 0 ? (
        <div className="backstage-empty">{tMenu('extensions.importEmpty')}</div>
      ) : (
        <div className="backstage-export-grid">
          {importers.map(imp => (
            <button key={`${imp.extensionId}:${imp.id}`} className="backstage-export-card" onClick={() => handleImport(imp)}>
              {/* K6a: importer-iconen komen uit draaiende extensiecode — hygiëne, maar loopt
                  langs dezelfde sanitizer als de manifest-iconen. */}
              <span className="backstage-export-icon"><ExtensionIcon raw={imp.icon} fallback={<Upload size={20} />} /></span>
              <span className="backstage-export-info">
                <h4>{imp.name}</h4>
                <p>{imp.description} ({imp.fileExtensions.join(', ')})</p>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Extensies section
// ---------------------------------------------------------------------------

function ExtensionsSection() {
  const { t: tMenu } = useTranslation('menu');
  return (
    <>
      <h2 className="backstage-title">{tMenu('extensions.title')}</h2>
      <p className="backstage-subtitle">{tMenu('extensions.subtitle')}</p>
      <ExtensionManagerPanel />
    </>
  );
}

// ---------------------------------------------------------------------------
// Help/documentatie section (fase 2.10, onderdeel 5, golf 1)
// ---------------------------------------------------------------------------

function HelpSection() {
  const { t: tMenu } = useTranslation('menu');
  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.help')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.helpSubtitle')}</p>
      <HelpPanel />
    </>
  );
}
