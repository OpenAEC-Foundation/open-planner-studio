import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import {
  enableExtension,
  disableExtension,
  removeExtension,
  installFromFile,
  installFromJsFile,
  fetchCatalog,
  installFromCatalog,
} from '@/extensions';
import type { InstalledExtension, CatalogEntry, ExtensionCategory } from '@/extensions/types';
import { Puzzle, FileArchive, FileCode, Plus } from 'lucide-react';
import './ExtensionManagerPanel.css';

type TabId = 'installed' | 'browse';

const CATEGORY_COLORS: Record<ExtensionCategory, string> = {
  'Import/Export': '#06b6d4',
  Planning: '#3b82f6',
  Reporting: '#8b5cf6',
  Utility: '#6b7280',
  Other: '#6b7280',
};

export function ExtensionManagerPanel() {
  const { t } = useTranslation('menu');
  const [activeTab, setActiveTab] = useState<TabId>('installed');
  const [search, setSearch] = useState('');

  return (
    <div className="ext-manager">
      <div className="ext-manager-toolbar">
        <div className="ext-manager-tabs">
          <button
            className={`ext-tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            {t('extensions.installedTab')}
          </button>
          <button
            className={`ext-tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => { setActiveTab('browse'); void fetchCatalog(); }}
          >
            {t('extensions.browseTab')}
          </button>
        </div>

        <div className="ext-manager-actions">
          <button className="ext-install-btn" onClick={() => void installFromFile()} title={t('extensions.installFromZip')}>
            <FileArchive size={14} /> ZIP
          </button>
          <button className="ext-install-btn" onClick={() => void installFromJsFile()} title={t('extensions.installFromJs')}>
            <FileCode size={14} /> JS
          </button>
        </div>
      </div>

      <input
        className="ext-search"
        type="text"
        placeholder={t('extensions.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {activeTab === 'installed' && <InstalledTab search={search} />}
      {activeTab === 'browse' && <BrowseTab search={search} />}
    </div>
  );
}

function InstalledTab({ search }: { search: string }) {
  const { t } = useTranslation('menu');
  const extensions = useAppStore((s) => s.installedExtensions);
  const list = Object.values(extensions);

  const filtered = list.filter((ext) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ext.manifest.name.toLowerCase().includes(q) ||
      ext.manifest.description.toLowerCase().includes(q) ||
      ext.manifest.author.toLowerCase().includes(q) ||
      ext.manifest.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="ext-empty">
        <p>{t('extensions.noExtensions')}</p>
        <p className="ext-empty-hint">{t('extensions.noExtensionsHint')}</p>
      </div>
    );
  }

  return (
    <div className="ext-list">
      {filtered.map((ext) => (
        <InstalledExtensionCard key={ext.id} ext={ext} />
      ))}
    </div>
  );
}

function InstalledExtensionCard({ ext }: { ext: InstalledExtension }) {
  const { t } = useTranslation('menu');
  const [removing, setRemoving] = useState(false);

  const handleToggle = useCallback(async () => {
    if (ext.status === 'enabled') {
      await disableExtension(ext.id);
    } else {
      await enableExtension(ext.id);
    }
  }, [ext.id, ext.status]);

  const handleRemove = useCallback(async () => {
    if (!removing) {
      setRemoving(true);
      return;
    }
    await removeExtension(ext.id);
  }, [ext.id, removing]);

  const isEnabled = ext.status === 'enabled';
  const isLoading = ext.status === 'loading';
  const isError = ext.status === 'error';

  return (
    <div className={`ext-card ${isError ? 'ext-card-error' : ''}`}>
      <div className="ext-card-icon">
        {ext.manifest.icon ? (
          <span dangerouslySetInnerHTML={{ __html: ext.manifest.icon }} />
        ) : (
          <Puzzle size={24} />
        )}
      </div>

      <div className="ext-card-body">
        <div className="ext-card-header">
          <span className="ext-card-name">{ext.manifest.name}</span>
          <span className="ext-card-version">v{ext.manifest.version}</span>
          <span
            className="ext-card-category"
            style={{ color: CATEGORY_COLORS[ext.manifest.category] || '#6b7280' }}
          >
            {ext.manifest.category}
          </span>
        </div>
        <p className="ext-card-desc">{ext.manifest.description}</p>
        <span className="ext-card-author">{ext.manifest.author}</span>
        {isError && ext.error && <p className="ext-card-error-msg">{ext.error}</p>}
      </div>

      <div className="ext-card-actions">
        <button
          className={`ext-toggle ${isEnabled ? 'ext-toggle-on' : ''}`}
          onClick={() => void handleToggle()}
          disabled={isLoading}
          title={isEnabled ? t('extensions.disable') : t('extensions.enable')}
        >
          <div className="ext-toggle-track">
            <div className="ext-toggle-thumb" />
          </div>
        </button>
        <button
          className={`ext-remove-btn ${removing ? 'ext-remove-confirm' : ''}`}
          onClick={() => void handleRemove()}
          title={removing ? t('extensions.confirmRemoveHint') : t('extensions.remove')}
        >
          {removing ? t('extensions.confirm') : t('extensions.remove')}
        </button>
      </div>
    </div>
  );
}

function BrowseTab({ search }: { search: string }) {
  const { t } = useTranslation('menu');
  const catalogEntries = useAppStore((s) => s.catalogEntries);
  const catalogLoading = useAppStore((s) => s.catalogLoading);
  const catalogError = useAppStore((s) => s.catalogError);
  const installed = useAppStore((s) => s.installedExtensions);

  const filtered = catalogEntries.filter((entry) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.author.toLowerCase().includes(q) ||
      entry.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  if (catalogLoading) {
    return <div className="ext-empty"><p>{t('extensions.catalogLoading')}</p></div>;
  }

  if (catalogError) {
    return (
      <div className="ext-empty">
        <p>{t('extensions.catalogError')}{catalogError}</p>
        <button
          className="ext-install-btn"
          onClick={() => void fetchCatalog()}
          style={{ marginTop: 8 }}
        >
          {t('extensions.retry')}
        </button>
      </div>
    );
  }

  if (filtered.length === 0) {
    return <div className="ext-empty"><p>{t('extensions.noCatalogResults')}</p></div>;
  }

  return (
    <div className="ext-list">
      {filtered.map((entry) => (
        <CatalogCard key={entry.id} entry={entry} isInstalled={!!installed[entry.id]} />
      ))}
    </div>
  );
}

function CatalogCard({ entry, isInstalled }: { entry: CatalogEntry; isInstalled: boolean }) {
  const { t } = useTranslation('menu');
  const [installing, setInstalling] = useState(false);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    await installFromCatalog(entry);
    setInstalling(false);
  }, [entry]);

  return (
    <div className="ext-card">
      <div className="ext-card-icon">
        {entry.icon ? (
          <span dangerouslySetInnerHTML={{ __html: entry.icon }} />
        ) : (
          <Plus size={24} />
        )}
      </div>

      <div className="ext-card-body">
        <div className="ext-card-header">
          <span className="ext-card-name">{entry.name}</span>
          <span className="ext-card-version">v{entry.version}</span>
          <span
            className="ext-card-category"
            style={{ color: CATEGORY_COLORS[entry.category] || '#6b7280' }}
          >
            {entry.category}
          </span>
        </div>
        <p className="ext-card-desc">{entry.description}</p>
        <span className="ext-card-author">{entry.author}</span>
      </div>

      <div className="ext-card-actions">
        {isInstalled ? (
          <span className="ext-installed-badge">{t('extensions.installedBadge')}</span>
        ) : (
          <button
            className="ext-install-btn"
            onClick={() => void handleInstall()}
            disabled={installing}
          >
            {installing ? t('extensions.installing') : t('extensions.install')}
          </button>
        )}
      </div>
    </div>
  );
}
