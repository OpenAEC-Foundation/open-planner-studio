import { useState, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { openPrintPreview } from '@/services/print/printPreview';

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

export function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const store = useAppStore();

  const handleNew = useCallback(() => {
    if (store.isDirty && !confirm('Niet-opgeslagen wijzigingen gaan verloren. Doorgaan?')) return;
    store.newProject();
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
    const content = writeIFC(
      store.project,
      store.calendar,
      store.tasks,
      store.sequences,
      store.resources,
      store.assignments,
    );
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
    openPrintPreview(
      store.tasks,
      store.sequences,
      store.calendar,
      store.project.name,
      store.view.viewStartDate,
    );
    setActiveMenu(null);
  }, [store]);

  const menus: Record<string, MenuItem[]> = {
    Bestand: [
      { label: 'Nieuw project', shortcut: 'Ctrl+N', action: handleNew },
      { label: 'Openen...', shortcut: 'Ctrl+O', action: handleOpen },
      { separator: true, label: '' },
      { label: 'Opslaan als IFC...', shortcut: 'Ctrl+S', action: handleSave },
      { separator: true, label: '' },
      { label: 'Afdrukvoorbeeld...', shortcut: 'Ctrl+P', action: handlePrint },
    ],
    Bewerken: [
      { label: 'Ongedaan maken', shortcut: 'Ctrl+Z', action: () => { store.undo(); setActiveMenu(null); } },
      { label: 'Opnieuw', shortcut: 'Ctrl+Y', action: () => { store.redo(); setActiveMenu(null); } },
    ],
    Beeld: [
      { label: 'Inzoomen', shortcut: 'Ctrl++', action: () => { store.setZoom(store.view.zoom + 10); setActiveMenu(null); } },
      { label: 'Uitzoomen', shortcut: 'Ctrl+-', action: () => { store.setZoom(store.view.zoom - 10); setActiveMenu(null); } },
    ],
    Planning: [
      { label: 'CPM berekenen', shortcut: 'F5', action: () => { store.runCPM(); setActiveMenu(null); } },
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
                    className="flex items-center justify-between w-full px-4 py-1.5 hover:bg-accent hover:text-white text-left"
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
      <span className="px-3 text-text-secondary">Open Planner Studio v0.1</span>
    </div>
  );
}
