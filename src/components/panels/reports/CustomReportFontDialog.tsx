import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import {
  canListSystemFonts, FontPickError, fontFromFiles, listSystemFonts,
  type FontPickFailure, type PickedFont, type SystemFontFamily,
} from '@/services/pdf/systemFonts';
import { REPORT_HELP_ARTICLE_ID } from '@/state/helpArticles';

const isTauri = () => '__TAURI_INTERNALS__' in window;

type ListState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; families: SystemFontFamily[] }
  | { kind: 'denied' }
  | { kind: 'unsupported' };

/**
 * *Ander lettertype…* (issue #770, besluit Ethan 14 november 2026): een lettertype van deze computer of een
 * lettertypebestand. Wat niet kiesbaar is, staat in de lijst met de reden erbij. In de browser vraagt de lijst
 * eerst toestemming (alleen Chrome en Edge), daarom pas na een klik; in de desktopapp verschijnt hij meteen.
 */
export function CustomReportFontDialog({ onPicked, onClose }: {
  /** Krijgt het gekozen lettertype; geeft een fout als bewaren mislukt (de dialoog blijft dan open). */
  onPicked: (font: PickedFont) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation('report');
  const [list, setList] = useState<ListState>(() => (canListSystemFonts() ? { kind: 'idle' } : { kind: 'unsupported' }));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Redenen die pas bij het kiezen bleken (browser): die familie is daarna niet meer kiesbaar. */
  const [lateRefusals, setLateRefusals] = useState<ReadonlyMap<string, FontPickFailure>>(new Map());
  const fileInput = useRef<HTMLInputElement>(null);

  const showList = () => {
    setList({ kind: 'loading' });
    listSystemFonts().then(
      families => setList({ kind: 'ready', families }),
      () => setList({ kind: 'denied' }),
    );
  };
  // Desktop: meteen. Browser: pas na de klik op de knop (de toestemmingsvraag hoort bij een handeling).
  useEffect(() => { if (isTauri()) showList(); }, []);

  const reasonText = (reason: FontPickFailure) => t(`customFont.refusal.${reason}`);

  const pick = async (key: string, load: () => Promise<PickedFont>, name?: string) => {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      const font = await load();
      await onPicked(font);
    } catch (err) {
      if (err instanceof FontPickError) {
        if (name) setLateRefusals(prev => new Map(prev).set(name, err.reason));
        setMessage(t('customFont.refused', { name: name ?? t('customFont.theFile'), reason: reasonText(err.reason) }));
      } else {
        setMessage(t('customFont.saveFailed'));
      }
    } finally {
      setBusy(null);
    }
  };

  const shown = useMemo(() => {
    if (list.kind !== 'ready') return [];
    const q = query.trim().toLocaleLowerCase();
    return q ? list.families.filter(f => f.name.toLocaleLowerCase().includes(q)) : list.families;
  }, [list, query]);

  return (
    <Dialog
      onCancel={onClose}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[520px] max-w-[92vw] max-h-[80vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-custom-font-dialog': '' }}
    >
      <DialogHeader title={t('customFont.title')} onClose={onClose} help={{ articleId: REPORT_HELP_ARTICLE_ID }} />
      <div className="flex-1 min-h-0 flex flex-col gap-3 p-4 text-small leading-4">
        <p className="text-text-secondary">{t('customFont.intro')}</p>

        {list.kind === 'idle' && (
          <button type="button" className="btn btn--sm btn--secondary self-start" onClick={showList}>{t('customFont.showList')}</button>
        )}
        {list.kind === 'loading' && <p className="text-text-secondary" role="status">{t('customFont.loadingList')}</p>}
        {list.kind === 'unsupported' && <p className="text-text-secondary">{t('customFont.noList')}</p>}
        {list.kind === 'denied' && <p className="text-text-secondary">{t('customFont.listDenied')}</p>}
        {list.kind === 'ready' && (
          <>
            <input
              type="search"
              className="input w-full"
              placeholder={t('customFont.search')}
              aria-label={t('customFont.search')}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <ul className="flex-1 min-h-[160px] overflow-y-auto border border-border rounded-md" aria-label={t('customFont.listLabel')}>
              {shown.length === 0 && <li className="px-3 py-2 text-text-secondary">{t('customFont.empty')}</li>}
              {shown.map(family => {
                const refusal = family.refusal ?? lateRefusals.get(family.name) ?? null;
                return (
                  <li key={family.name}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-hover disabled:opacity-60 disabled:hover:bg-transparent flex flex-col"
                      disabled={refusal !== null || busy !== null}
                      onClick={() => { void pick(family.name, family.load, family.name); }}
                    >
                      <span>{family.name}{busy === family.name ? ` — ${t('customFont.loadingFont')}` : ''}</span>
                      {refusal && <span className="text-caption text-text-secondary">{reasonText(refusal)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {message && <p className="text-danger" role="alert">{message}</p>}
      </div>
      <div className="flex justify-between gap-2 px-4 py-3 border-t border-border">
        <input
          ref={fileInput}
          type="file"
          accept=".ttf,.otf,.ttc,font/ttf,font/otf,font/collection"
          multiple
          hidden
          data-ops-custom-font-file=""
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) void pick('file', () => fontFromFiles(files));
          }}
        />
        <button type="button" className="btn btn--sm btn--secondary" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
          {busy === 'file' ? t('customFont.loadingFont') : t('customFont.chooseFile')}
        </button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={onClose}>{t('customFont.cancel')}</button>
      </div>
    </Dialog>
  );
}
