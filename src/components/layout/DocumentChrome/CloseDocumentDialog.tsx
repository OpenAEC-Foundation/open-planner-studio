import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { documentTitle } from '@/utils/documents';
import { CloseDocumentDialogControl } from './CloseDocumentDialogControl';
import { createCloseDocumentDialogActions } from './closeDocumentActions';

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
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  const actions = createCloseDocumentDialogActions({
    pendingId,
    getActiveDocumentId: () => useAppStore.getState().activeDocumentId,
    getIsDirty: () => useAppStore.getState().isDirty,
    switchDocument,
    closeDocument,
    saveFile,
    clearPending: () => { setUI({ pendingCloseDocId: null }); },
    restoreOpenerFocus,
  });

  return (
    <CloseDocumentDialogControl
      title={t('documents.closeTitle')}
      body={t('documents.closeBody', { name })}
      cancelLabel={t('cancel')}
      discardLabel={t('documents.dontSave')}
      saveLabel={t('save')}
      cancelButtonRef={cancelButtonRef}
      onCancel={actions.cancel}
      onDiscard={actions.discard}
      onSave={() => { void actions.save(); }}
    />
  );
}
