import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, FileText, X } from 'lucide-react';

/**
 * Eén te herstellen document, zoals de {@link RecoveryDialog} het toont.
 * Puur presentatie-data — de dialoog doet zelf geen file-I/O, zodat er geen
 * `@tauri-apps/*`-import in dit component zit en de web-build veilig blijft.
 */
export interface RecoveryEntry {
  /** Stabiele sleutel (document-id of 'legacy'). */
  id: string;
  /** Weergavenaam: bestandsnaam (indien bekend) of projectnaam. */
  name: string;
  /** Volledig pad naar het bronbestand, indien het document ooit is opgeslagen. */
  filePath: string | null;
  /** Aantal taken in de snapshot (goedkoop uit de geparste IFC). */
  taskCount: number;
  /** Tijdstip van de snapshot (mtime van het recovery-bestand), of null. */
  mtime: Date | null;
}

interface RecoveryDialogProps {
  entries: RecoveryEntry[];
  /** Herstel alle documenten en ruim de recovery-bestanden op. */
  onRestore: () => void;
  /** Herstel niets en ruim de recovery-bestanden op. */
  onDiscard: () => void;
  /**
   * Sluit de dialoog zónder op te ruimen en zónder te herstellen. Bewust
   * veilig: de recovery-bestanden blijven staan, zodat een gebruiker die per
   * ongeluk Escape drukt zijn werk niet verliest — bij de volgende start
   * verschijnt de vraag opnieuw.
   */
  onClose: () => void;
}

/**
 * In-app herstel-dialoog: vervangt de native OS-`ask()`. Toont per te herstellen
 * document de naam, het bestandspad, het aantal taken en het tijdstip van de
 * laatste auto-save-snapshot, met de keuze om alles te herstellen of te
 * verwerpen.
 *
 * Gestyled zoals de andere dialogen (UpdateDialog/CloseDocumentDialog):
 * gecentreerde overlay, kaart met header/body/footer en `btn`-knoppen. Doet zelf
 * geen file-I/O — App.tsx levert de data en handelt de keuze af.
 */
export function RecoveryDialog({ entries, onRestore, onDiscard, onClose }: RecoveryDialogProps) {
  const { t, i18n } = useTranslation('common');

  // Escape = veilig sluiten (bestanden blijven staan). Enter = herstellen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter') { e.preventDefault(); onRestore(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onRestore]);

  const fmt = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium', timeStyle: 'short',
  });

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[520px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('recovery.dialogTitle')}
          </span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-[8px]"
            title={t('close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
          <p className="text-text-secondary leading-relaxed">{t('recovery.explanation')}</p>

          <ul className="flex flex-col gap-2">
            {entries.map(entry => (
              <li
                key={entry.id}
                className="flex items-start gap-2.5 bg-surface-hover border border-border rounded-[8px] p-3"
              >
                <FileText size={15} className="text-accent mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-text-primary font-semibold text-[13px] truncate">
                    {entry.name || t('recovery.untitled')}
                  </span>
                  {entry.filePath && (
                    <span className="text-text-secondary truncate" title={entry.filePath}>
                      {entry.filePath}
                    </span>
                  )}
                  <div className="flex items-center gap-3 text-text-secondary mt-0.5">
                    <span>{t('recovery.taskCount', { count: entry.taskCount })}</span>
                    {entry.mtime && (
                      <span>{t('recovery.timeLabel')}: {fmt.format(entry.mtime)}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={onDiscard} className="btn btn--sm btn--secondary">
            {t('recovery.dontRestore')}
          </button>
          <button
            onClick={onRestore}
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            {t('recovery.restore')}
          </button>
        </div>
      </div>
    </div>
  );
}
