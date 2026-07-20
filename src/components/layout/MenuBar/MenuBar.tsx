import { useState, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

export function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { t } = useTranslation('menu');

  const store = useAppStore();

  const handleNew = useCallback(() => {
    // Nieuw-project-wizard (metadata + kalender + fasering-template).
    store.setUI({ showNewProjectDialog: true });
    setActiveMenu(null);
  }, [store]);

  const handleOpen = useCallback(async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ifc';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const content = await file.text();
        const state = readIFC(content);
        store.loadState(state);
        store.setFilePath(file.name);
        store.runCPM();
      };
      input.click();
    } catch (err) {
      console.error('Failed to open file:', err);
    }
    setActiveMenu(null);
  }, [store]);

  const handleSave = useCallback(() => {
    // R1-fix (bug-klasse B4): dezelfde VOLLEDIGE writeIFC-invoer als het canonieke save-pad
    // (fileSlice) via de gedeelde helper — voorheen liet deze browser-quicksave structuur
    // (activity-codes/custom-fields) én baselines/kalender-bibliotheek stil vallen.
    const content = writeIFC(buildWriteIFCInput(store));
    const blob = new Blob([content], { type: 'application/x-step' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.project.name || 'planning'}.ifc`;
    a.click();
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  }, [store]);

  const handlePrint = useCallback(() => {
    store.setUI({ activeRibbonTab: 'report' });
    setActiveMenu(null);
  }, [store]);

  const menus: Record<string, MenuItem[]> = {
    [t('menuBar.file')]: [
      { label: t('menuBar.newProject'), shortcut: 'Ctrl+N', action: handleNew },
      { label: t('menuBar.open'), shortcut: 'Ctrl+O', action: handleOpen },
      { separator: true, label: '' },
      { label: t('menuBar.saveAs'), shortcut: 'Ctrl+S', action: handleSave },
      { separator: true, label: '' },
      { label: t('menuBar.printPreview'), shortcut: 'Ctrl+P', action: handlePrint },
    ],
    [t('menuBar.edit')]: [
      { label: t('menuBar.undo'), shortcut: 'Ctrl+Z', action: () => { store.undo(); setActiveMenu(null); } },
      { label: t('menuBar.redo'), shortcut: 'Ctrl+Y', action: () => { store.redo(); setActiveMenu(null); } },
    ],
    [t('menuBar.view')]: [
      { label: t('menuBar.zoomIn'), shortcut: 'Ctrl++', action: () => { store.setZoom(store.view.zoom + 10); setActiveMenu(null); } },
      { label: t('menuBar.zoomOut'), shortcut: 'Ctrl+-', action: () => { store.setZoom(store.view.zoom - 10); setActiveMenu(null); } },
    ],
    [t('menuBar.planning')]: [
      { label: t('menuBar.calculateCPM'), shortcut: 'F5', action: () => { store.runCPM(); setActiveMenu(null); } },
    ],
  };

  return (
    <div className="flex items-center h-7 bg-surface-alt border-b border-border text-xs select-none">
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="relative">
          <button
            className={`px-3 h-7 hover:bg-surface-hover ${activeMenu === name ? 'bg-surface-hover' : ''}`}
            onMouseDown={() => setActiveMenu(activeMenu === name ? null : name)}
            onMouseEnter={() => activeMenu && setActiveMenu(name)}
          >
            {name}
          </button>
          {activeMenu === name && (
            <div className="absolute left-0 top-7 bg-surface-alt border border-border rounded shadow-lg z-50 min-w-[220px] py-1">
              {items.map((item, i) =>
                item.separator ? (
                  <div key={i} className="h-px bg-border mx-2 my-1" />
                ) : (
                  <button
                    key={i}
                    className="flex items-center justify-between w-full px-4 py-1.5 hover:bg-accent hover:text-accent-on text-left"
                    onClick={item.action}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className="text-text-secondary ml-8">{item.shortcut}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex-1" />
      <span className="px-3 text-text-secondary">{t('menuBar.version')}</span>
    </div>
  );
}
