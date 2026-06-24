import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, FolderOpen, Clock, Save, SaveAll, Download,
  Printer, Info, Settings, X, FileType, Puzzle, Upload,
} from 'lucide-react';
import { useAppStore, ExportFormat } from '@/state/appStore';
import { BackstageSection } from '@/state/slices/types';
import { SettingsPanelContent } from '@/components/settings/SettingsPanelContent';
import { ExtensionManagerPanel } from '@/components/backstage/ExtensionManagerPanel';
import type { ExtensionImporter } from '@/state/slices/extensionSlice';
import './Backstage.css';

export function Backstage() {
  const { t: tMenu } = useTranslation('menu');
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

        <ActionItem icon={<X size={14} />} label={tMenu('backstage.closeProject')} onClick={() => { handleNewProject(); closeBackstage(); }} />
      </aside>

      <main className="backstage-main">
        {section === 'recent' && <RecentSection />}
        {section === 'export' && <ExportSection />}
        {section === 'import' && <ImportSection />}
        {section === 'print' && <PrintSection onClose={closeBackstage} />}
        {section === 'project-info' && <ProjectInfoSection onApply={closeBackstage} />}
        {section === 'settings' && <SettingsSection />}
        {section === 'extensions' && <ExtensionsSection />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar items
// ---------------------------------------------------------------------------

function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button className={`backstage-nav-item ${active ? 'active' : ''}`} onClick={onClick}>
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
  // Multi-document: 'Nieuw' opent een nieuw tabblad (niet-destructief).
  useAppStore.getState().newDocument();
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
  const recentFiles = useAppStore(s => s.getRecentFiles)();
  const openRecentFile = useAppStore(s => s.openRecentFile);
  const setUI = useAppStore(s => s.setUI);

  return (
    <>
      <h2 className="backstage-title">{tMenu('backstage.recentTitle')}</h2>
      <p className="backstage-subtitle">{tMenu('backstage.recentSubtitle')}</p>
      {recentFiles.length === 0 ? (
        <div className="backstage-empty">{tMenu('backstage.recentEmpty')}</div>
      ) : (
        <div className="backstage-recent-list">
          {recentFiles.map(fp => (
            <button
              key={fp}
              className="backstage-recent-item"
              onClick={() => {
                void openRecentFile(fp);
                setUI({ activeRibbonTab: 'start' });
              }}
            >
              <span className="backstage-recent-thumb"><FileType size={20} /></span>
              <span className="backstage-recent-info">
                <span className="backstage-recent-name">{fp.split(/[/\\]/).pop()}</span>
                <span className="backstage-recent-path">{fp}</span>
              </span>
            </button>
          ))}
        </div>
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
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="backstage-form-row">
            <label>{tMenu('backstage.endDate')}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
