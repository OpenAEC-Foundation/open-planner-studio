import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { documentTitle } from '@/utils/documents';

/**
 * Sluit-bevestiging met drie keuzes bij een document met niet-opgeslagen
 * wijzigingen: Opslaan (bewaart, evt. via 'Opslaan als…', dan sluiten),
 * Niet opslaan (sluit en verwerpt), Annuleren (laat open).
 *
 * Werkt voor elk document — ook een inactief tabblad: omdat opslaan op de
 * top-level (actieve) state werkt, maken we het te sluiten document eerst
 * actief en sluiten het daarna.
 */
export function CloseDocumentDialog() {
  const { t } = useTranslation('common');
  const pendingId = useAppStore((s) => s.ui.pendingCloseDocId);
  const activeId = useAppStore((s) => s.activeDocumentId);
  const documents = useAppStore((s) => s.documents);
  const project = useAppStore((s) => s.project);
  const filePath = useAppStore((s) => s.filePath);
  const setUI = useAppStore((s) => s.setUI);
  const closeDocument = useAppStore((s) => s.closeDocument);
  const switchDocument = useAppStore((s) => s.switchDocument);
  const saveFile = useAppStore((s) => s.saveFile);
  const openerRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const activeElement = document.activeElement;
    openerRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    cancelButtonRef.current?.focus();
  }, [pendingId]);

  if (!pendingId) return null;

  const entry = documents.find((d) => d.id === pendingId);
  const proj = pendingId === activeId ? project : entry?.payload?.project;
  const fp = pendingId === activeId ? filePath : entry?.payload?.filePath ?? null;
  const name = documentTitle(fp, proj?.name ?? '') || t('project.untitled');

  const restoreOpenerFocus = () => {
    const opener = openerRef.current;
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus();
    });
  };
  const cancel = () => {
    setUI({ pendingCloseDocId: null });
    restoreOpenerFocus();
  };
  const dontSave = () => { closeDocument(pendingId); setUI({ pendingCloseDocId: null }); };
  const save = async () => {
    let closed = false;
    if (pendingId !== useAppStore.getState().activeDocumentId) switchDocument(pendingId);
    try {
      await saveFile();
      // Alleen sluiten als het opslaan ook echt lukte (bij een geannuleerde 'Opslaan als…' of een
      // schrijffout blijft isDirty staan → document open laten, geen werk verliezen).
      if (!useAppStore.getState().isDirty) {
        closeDocument(pendingId);
        closed = true;
      }
    } finally {
      // Ongeacht de afloop moet de bevestiging weg, anders blokkeert een mislukte opslag de hele
      // app. Blijft nodig óók nu `saveFile` zelf vangt — verdedigingslinie tegen een throw hogerop.
      setUI({ pendingCloseDocId: null });
      if (!closed) restoreOpenerFocus();
    }
  };

  return (
    <div
      onClick={cancel}
      data-ops-close-dialog
      style={{
        position: 'absolute', inset: 0, zIndex: 80,
        background: 'rgba(15,16,20,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', animation: 'ops-fade 0.1s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, maxWidth: '90%', background: 'var(--theme-surface-elevated)',
          border: '1px solid var(--theme-border)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-pop)', padding: 20,
        }}
      >
        <h3 style={{
          margin: '0 0 8px', fontFamily: "'Space Grotesk', sans-serif", fontSize: 'calc(15px * var(--ui-font-scale, 1))',
          fontWeight: 700, color: 'var(--theme-text)',
        }}>
          {t('documents.closeTitle')}
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: 'calc(13px * var(--ui-font-scale, 1))', lineHeight: 1.5, color: 'var(--theme-text-dim)' }}>
          {t('documents.closeBody', { name })}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button ref={cancelButtonRef} className="btn btn--secondary btn--sm" onClick={cancel}>{t('cancel')}</button>
          <button className="btn btn--danger btn--sm" onClick={dontSave}>{t('documents.dontSave')}</button>
          <button className="btn btn--primary btn--sm" onClick={() => void save()}>{t('save')}</button>
        </div>
      </div>
    </div>
  );
}
