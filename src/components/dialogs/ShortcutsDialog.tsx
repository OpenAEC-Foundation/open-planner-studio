import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Keyboard } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import { SHORTCUTS, type ShortcutCategory, type ShortcutCombo } from '@/hooks/keyboard/shortcutRegistry';
import { isMacPlatform, formatComboGroup } from '@/hooks/keyboard/shortcutFormat';

/** Volgorde uit het ontwerpdocument (§"Overzichtsdialoog"). */
const CATEGORY_ORDER: ShortcutCategory[] = ['file', 'edit', 'structure', 'view', 'nav'];

interface ShortcutRow {
  labelKey: string;
  combos: ShortcutCombo[];
}

/**
 * Groepeert `SHORTCUTS` op categorie en dedupliceert op `labelKey`: entries die dezelfde
 * `labelKey` delen zijn per ontwerp aliassen van dezelfde actie (bv. `structure.indent` +
 * `structure.indentAlt`, of de negen `Ctrl+1..9`-documentwissels) en verschijnen dus als ÉÉN rij
 * met alle bijbehorende toetscombinaties — nooit als losse rijen met een identiek label.
 * `displayOnly`-entries (bv. de kale zoom-toetsen die in `useZoomShortcuts.ts` leven) tellen hier
 * gewoon mee: deze dialoog is puur informatief, geen afhandel-pad.
 */
function buildRows(): Record<ShortcutCategory, ShortcutRow[]> {
  const byCategory: Record<ShortcutCategory, ShortcutRow[]> = { file: [], edit: [], structure: [], view: [], nav: [] };
  const index = new Map<string, ShortcutRow>(); // key: `${category}:${labelKey}`

  for (const entry of SHORTCUTS) {
    const key = `${entry.category}:${entry.labelKey}`;
    let row = index.get(key);
    if (!row) {
      row = { labelKey: entry.labelKey, combos: [] };
      index.set(key, row);
      byCategory[entry.category].push(row);
    }
    row.combos.push(entry.combo);
  }
  return byCategory;
}

/**
 * Sneltoetsen-overzichtsdialoog (fase 2.10, golf 3) — Ctrl/Cmd+/ en het "Sneltoetsen"-knopje in de
 * Weergave-ribbontab. Rendert VOLLEDIG uit `SHORTCUTS` (het register is de enige bron van
 * waarheid, zie shortcutRegistry.ts): een nieuwe toets daar verschijnt hier automatisch, zonder
 * een aparte lijst bij te houden. Alleen-lezen — geen instellingen, geen herbind-UI (bewust
 * uitgesteld, zie het ontwerpdocument).
 */
export function ShortcutsDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const close = () => setUI({ showShortcutsDialog: false });

  const rows = useMemo(buildRows, []);
  const isMac = useMemo(isMacPlatform, []);
  const orJoiner = t('shortcuts.orJoiner');

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-shortcuts-dialog': true }}
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
            <Keyboard size={16} />
            {t('shortcuts.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]" aria-label={t('close')}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4 text-xs">
          {CATEGORY_ORDER.map(category => {
            const categoryRows = rows[category];
            if (categoryRows.length === 0) return null;
            return (
              <div key={category}>
                <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  {t(`shortcuts.category.${category}`)}
                </div>
                <div className="flex flex-col gap-0.5">
                  {categoryRows.map(row => (
                    <div
                      key={row.labelKey}
                      className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-[8px] hover:bg-surface-hover"
                    >
                      {/* `row.labelKey` is dynamisch (register-driven, incl. `menu:`/`context.`-
                          verwijzingen naar andere namespaces) — geen statisch literal, dus buiten
                          de gegenereerde resource-key-typing van i18next. Zelfde geaccepteerde
                          patroon als de dynamische `tMenu(... as 'ribbon.calendarDialog.days.1')`-
                          cast in CalendarForm.tsx/WorkTimeEditor.tsx. */}
                      <span className="flex-1 truncate">{t(row.labelKey as 'close')}</span>
                      <span className="flex-shrink-0 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                        {formatComboGroup(row.combos, isMac, orJoiner)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={close} className="btn btn--sm btn--primary">
            {t('close')}
          </button>
        </div>
    </Dialog>
  );
}
