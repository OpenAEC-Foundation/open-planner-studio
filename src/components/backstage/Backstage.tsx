import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, FolderOpen, Clock, Save, SaveAll, Download,
  Printer, Info, Settings, X, FileType, Puzzle, Upload, BookOpen, Compass, LifeBuoy,
} from 'lucide-react';
import { useAppStore, ExportFormat } from '@/state/appStore';
import { BackstageSection } from '@/state/slices/types';
import { SettingsPanelContent } from '@/components/settings/SettingsPanelContent';
import { DateTextInput } from '@/components/common/DateTextInput';
import { ExtensionManagerPanel } from '@/components/backstage/ExtensionManagerPanel';
import { HelpPanel } from '@/components/backstage/HelpPanel';
import type { ExtensionImporter } from '@/state/slices/extensionSlice';
import { supportsHandles } from '@/services/fileAccess';
import './Backstage.css';

export function Backstage() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const section = useAppStore(s => s.ui.backstageSection);

  const closeBackstage = () => {
    // Terug naar Start-tab
    setUI({ activeRibbonTab: 'start' });
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
        <ActionItem icon={<FolderOpen size={14} />} label={tMenu('ribbon.open')} onClick={() => { handleOpen(); closeBackstage(); }} />
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

        <ActionItem icon={<X size={14} />} label={tMenu('backstage.closeProject')} onClick={() => { handleNewProject(); closeBackstage(); }} />
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

function handleOpen() {
  void useAppStore.getState().openFile();
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
                void openRecentFile(e.id);
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
  const openExampleFromString = useAppStore(s => s.openExampleFromString);
  const runCPM = useAppStore(s => s.runCPM);
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
      openExampleFromString(content, ex.name);
      runCPM();
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
  const exportAs = useAppStore(s => s.exportAs);
  const setUI = useAppStore(s => s.setUI);

  const formats: { format: ExportFormat; label: string; desc: string; icon: string }[] = [
    { format: 'csv',   label: tMenu('export.csvLabel'),   desc: tMenu('export.csvDesc'),   icon: 'CSV' },
    { format: 'mspdi', label: tMenu('export.mspdiLabel'), desc: tMenu('export.mspdiDesc'), icon: 'XML' },
    { format: 'p6',    label: tMenu('export.p6Label'),    desc: tMenu('export.p6Desc'),    icon: 'P6' },
    { format: 'ifc',   label: tMenu('export.ifcLabel'),   desc: tMenu('export.ifcDesc'),   icon: 'IFC' },
  ];

  const handleExport = (format: ExportFormat) => {
    void exportAs(format);
    setUI({ activeRibbonTab: 'start' });
  };

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.exportTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.exportSubtitle')}</p>
      <div className="backstage-export-grid">
        {formats.map(f => (
          <button key={f.format} className="backstage-export-card" onClick={() => handleExport(f.format)}>
            <span className="backstage-export-icon">{f.icon}</span>
            <span className="backstage-export-info">
              <h4>{f.label}</h4>
              <p>{f.desc}</p>
            </span>
          </button>
        ))}
      </div>
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
  const project = useAppStore(s => s.project);
  const setProject = useAppStore(s => s.setProject);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [author, setAuthor] = useState(project.author);
  const [company, setCompany] = useState(project.company);
  const [startDate, setStartDate] = useState(project.startDate);
  const [endDate, setEndDate] = useState(project.endDate);

  const apply = () => {
    setProject({ name, description, author, company, startDate, endDate });
    onApply();
  };

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.projectInfoTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.projectInfoSubtitle')}</p>

      <div className="backstage-form">
        <div className="backstage-form-row">
          <label>{tMenu('backstage.name')}</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="backstage-form-row">
          <label>{tMenu('backstage.description')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="backstage-form-grid-2">
          <div className="backstage-form-row">
            <label>{tMenu('backstage.author')}</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} />
          </div>
          <div className="backstage-form-row">
            <label>{tMenu('backstage.company')}</label>
            <input value={company} onChange={e => setCompany(e.target.value)} />
          </div>
        </div>

        <div className="backstage-form-grid-2">
          <div className="backstage-form-row">
            <label>{tMenu('backstage.startDate')}</label>
            <DateTextInput value={startDate} onCommit={setStartDate} ariaLabel={tMenu('backstage.startDate')} />
          </div>
          <div className="backstage-form-row">
            <label>{tMenu('backstage.endDate')}</label>
            <DateTextInput value={endDate} onCommit={setEndDate} ariaLabel={tMenu('backstage.endDate')} />
          </div>
        </div>

        <div className="backstage-actions">
          <button className="btn btn--primary" onClick={apply}>{tCommon('apply')}</button>
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
  const runCPM = useAppStore(s => s.runCPM);
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
        const result = await imp.handler(file);
        loadState(result);
        runCPM();
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
              <span className="backstage-export-icon">{imp.icon ? <span dangerouslySetInnerHTML={{ __html: imp.icon }} /> : <Upload size={20} />}</span>
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
