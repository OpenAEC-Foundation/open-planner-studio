import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, FileText, FolderOpen, Clock, Save, SaveAll, Download,
  Printer, Info, Settings, X, FileType,
} from 'lucide-react';
import { useAppStore, ExportFormat } from '@/state/appStore';
import { BackstageSection, UITheme, UI_THEMES } from '@/state/slices/types';
import { Locale, LANGUAGE_LABELS, supportedLanguages } from '@/i18n/config';
import { saveLocale, saveTheme } from '@/utils/settingsStore';
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
    <div className="backstage" role="region" aria-label="File menu">
      <aside className="backstage-sidebar" aria-label="File navigation">
        <button className="backstage-back" onClick={closeBackstage}>
          <ArrowLeft size={16} /> Terug
        </button>

        {/* Actie-items: triggeren actie en sluiten backstage */}
        <ActionItem icon={<FileText size={14} />} label={tMenu('ribbon.new')} onClick={() => { handleNewProject(); closeBackstage(); }} />
        <ActionItem icon={<FolderOpen size={14} />} label={tMenu('ribbon.open')} onClick={() => { handleOpen(); closeBackstage(); }} />
        <NavItem icon={<Clock size={14} />} label="Recent" active={section === 'recent'} onClick={() => goTo('recent')} />
        <ActionItem icon={<Save size={14} />} label={tMenu('ribbon.save')} onClick={() => { handleSave(); closeBackstage(); }} />
        <ActionItem icon={<SaveAll size={14} />} label="Opslaan als" onClick={() => { handleSaveAs(); closeBackstage(); }} />

        <div className="backstage-nav-divider" />

        <NavItem icon={<Download size={14} />} label="Exporteren" active={section === 'export'} onClick={() => goTo('export')} />
        <NavItem icon={<Printer size={14} />} label={tMenu('ribbon.printPreview')} active={section === 'print'} onClick={() => goTo('print')} />

        <div className="backstage-nav-divider" />

        <NavItem icon={<Info size={14} />} label={tMenu('ribbon.projectInfo')} active={section === 'project-info'} onClick={() => goTo('project-info')} />
        <NavItem icon={<Settings size={14} />} label="Instellingen" active={section === 'settings'} onClick={() => goTo('settings')} />

        <div className="backstage-nav-divider" />

        <ActionItem icon={<X size={14} />} label="Sluit project" onClick={() => { handleNewProject(); closeBackstage(); }} />
      </aside>

      <main className="backstage-main">
        {section === 'recent' && <RecentSection />}
        {section === 'export' && <ExportSection />}
        {section === 'print' && <PrintSection onClose={closeBackstage} />}
        {section === 'project-info' && <ProjectInfoSection onApply={closeBackstage} />}
        {section === 'settings' && <SettingsSection />}
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
  if (confirm('Niet-opgeslagen wijzigingen gaan verloren. Doorgaan?')) {
    useAppStore.getState().newProject();
  }
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
  const recentFiles = useAppStore(s => s.getRecentFiles)();
  const openRecentFile = useAppStore(s => s.openRecentFile);
  const setUI = useAppStore(s => s.setUI);

  return (
    <>
      <h2 className="backstage-title">Recente projecten</h2>
      <p className="backstage-subtitle">Klik om te openen.</p>
      {recentFiles.length === 0 ? (
        <div className="backstage-empty">Nog geen recent geopende projecten.</div>
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
  const exportAs = useAppStore(s => s.exportAs);
  const setUI = useAppStore(s => s.setUI);

  const formats: { format: ExportFormat; label: string; desc: string; icon: string }[] = [
    { format: 'csv',   label: 'CSV (puntkomma-gescheiden)', desc: 'Universele tabel-export. Alle taken met datums en duur.', icon: 'CSV' },
    { format: 'mspdi', label: 'MS Project XML',             desc: 'Te openen in Microsoft Project. Volledige WBS-structuur.', icon: 'XML' },
    { format: 'p6',    label: 'Primavera P6 XML',           desc: 'Voor Oracle Primavera P6.', icon: 'P6' },
    { format: 'ifc',   label: 'IFC 4x3',                    desc: 'BuildingSMART standaard. 4D-koppeling met BIM-modellen.', icon: 'IFC' },
  ];

  const handleExport = (format: ExportFormat) => {
    void exportAs(format);
    setUI({ activeRibbonTab: 'start' });
  };

  return (
    <>
      <h2 className="backstage-title">Exporteren</h2>
      <p className="backstage-subtitle">Kies een formaat. Het project wordt geconverteerd en opgeslagen.</p>
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
  const setUI = useAppStore(s => s.setUI);

  return (
    <>
      <h2 className="backstage-title">Printen</h2>
      <p className="backstage-subtitle">Open het rapportscherm voor afdrukvoorbeeld en instellingen.</p>
      <button
        className="btn btn--primary"
        onClick={() => {
          setUI({ activeRibbonTab: 'report' });
          onClose();
        }}
      >
        Open afdrukvoorbeeld
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Project info section
// ---------------------------------------------------------------------------

function ProjectInfoSection({ onApply }: { onApply: () => void }) {
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
      <h2 className="backstage-title">Project info</h2>
      <p className="backstage-subtitle">Metadata van dit project.</p>

      <div className="backstage-form">
        <div className="backstage-form-row">
          <label>Naam</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="backstage-form-row">
          <label>Beschrijving</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="backstage-form-grid-2">
          <div className="backstage-form-row">
            <label>Auteur</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} />
          </div>
          <div className="backstage-form-row">
            <label>Bedrijf</label>
            <input value={company} onChange={e => setCompany(e.target.value)} />
          </div>
        </div>

        <div className="backstage-form-grid-2">
          <div className="backstage-form-row">
            <label>Startdatum</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="backstage-form-row">
            <label>Einddatum</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="backstage-actions">
          <button className="btn btn--primary" onClick={apply}>Toepassen</button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings section
// ---------------------------------------------------------------------------

const THEME_SWATCHES: Record<UITheme, string[]> = {
  'dark':          ['#2A2A32', '#36363E', '#D97706', '#FAFAF9'],
  'light':         ['#FAFAF9', '#F5F5F4', '#D97706', '#36363E'],
  'high-contrast': ['#000000', '#0a0a0a', '#FFFF00', '#FFFFFF'],
};

function SettingsSection() {
  const { i18n } = useTranslation();
  const setUI = useAppStore(s => s.setUI);
  const currentTheme = useAppStore(s => s.ui.uiTheme);

  const handleThemeChange = (theme: UITheme) => {
    setUI({ uiTheme: theme });
    void saveTheme(theme);
  };

  const handleLocaleChange = (locale: Locale) => {
    void i18n.changeLanguage(locale);
    void saveLocale(locale);
  };

  return (
    <>
      <h2 className="backstage-title">Instellingen</h2>
      <p className="backstage-subtitle">Thema, taal en weergave-instellingen.</p>

      <div className="backstage-form">
        <div className="backstage-form-row">
          <label>Thema</label>
          <div className="backstage-theme-grid">
            {UI_THEMES.map(({ id, label }) => (
              <button
                key={id}
                className={`backstage-theme-card ${currentTheme === id ? 'active' : ''}`}
                onClick={() => handleThemeChange(id)}
              >
                <h4>{label}</h4>
                <div className="backstage-theme-swatches">
                  {THEME_SWATCHES[id].map((hex, i) => (
                    <span key={i} className="backstage-theme-swatch" style={{ background: hex }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="backstage-form-row">
          <label>Taal</label>
          <select value={i18n.language} onChange={e => handleLocaleChange(e.target.value as Locale)}>
            {[...supportedLanguages]
              .sort((a, b) => LANGUAGE_LABELS[a][0].localeCompare(LANGUAGE_LABELS[b][0]))
              .map(code => {
                const [short, label] = LANGUAGE_LABELS[code];
                return <option key={code} value={code}>{short} — {label}</option>;
              })}
          </select>
        </div>
      </div>
    </>
  );
}
