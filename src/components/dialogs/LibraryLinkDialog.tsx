import { useTranslation } from 'react-i18next';
import { Link2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';

/**
 * Het gedeelde koppel-/afwijkingenscherm. Twee secties met gedeelde vormtaal:
 *  - Herkennen: niet-gestempelde projectitems met hun unieke naam-match; per stuk of "alle voorstellen".
 *  - Afwijkingen: gestempelde items die deviated/removed zijn; per item bedrijfs- óf bestandswaarden.
 * Anti-dialoog-clausule: NOOIT poolitems één voor één een project in kopiëren — koppelen/optillen
 * bij een koppelmoment. "Later beslissen" sluit het scherm; markeringen blijven; heropbaar via de
 * Projectweergave.
 *
 * NB (verplicht): ELKE uitgang (backdrop-klik, Escape, X, "Later beslissen") loopt
 * door dezelfde `close()` die `showLibraryLinkDialog` op false zet. Data komt live uit de store (geen
 * transient payload) — een openFile naar een ander document terwijl dit scherm openstaat laat dus geen
 * stale inhoud achter (de document-/bibliotheekgrenzen resetten de vlag zelf, zie librarySlice/documentSlice).
 *
 * Stapel-gedrag: "Escape sluit dit scherm" klopt ook wanneer dit scherm gestapeld openstaat boven
 * (of onder) een andere dialoog, bv. WelcomeDialog — `useDialogKeys` houdt een module-globale
 * dialoog-stapel bij en levert Escape/Enter alleen aan de BOVENSTE dialoog.
 */
export function LibraryLinkDialog() {
  const { t } = useTranslation('common');
  const open = useAppStore((s) => s.ui.showLibraryLinkDialog);
  const setUI = useAppStore((s) => s.setUI);
  // Live afgeleid uit de store (geen transient payload): abonneer op de bronnen zodat het scherm
  // herrendert bij elke oplossing/koppeling.
  const resources = useAppStore((s) => s.resources);
  const calendars = useAppStore((s) => s.calendars);
  useAppStore((s) => s.pools);
  const companyId = useAppStore((s) => s.project.companyId);
  const computeRecognition = useAppStore((s) => s.computeRecognition);
  const linkRecognizedItems = useAppStore((s) => s.linkRecognizedItems);
  const resolveDeviation = useAppStore((s) => s.resolveDeviation);
  const onOpenStatusForResource = useAppStore((s) => s.onOpenStatusForResource);
  const onOpenStatusForCalendar = useAppStore((s) => s.onOpenStatusForCalendar);

  if (!open) return null;
  const close = () => setUI({ showLibraryLinkDialog: false });

  const candidates = companyId ? computeRecognition() : [];
  const withMatch = candidates.filter((c) => c.suggestedPoolId);

  // Afwijkingen: gestempelde items die deviated/removed zijn (scope via de getters).
  const deviatedResources = resources.filter((r) => {
    const st = onOpenStatusForResource(r.id); return st === 'deviated' || st === 'removed';
  }).map((r) => ({ id: r.id, name: r.name, status: onOpenStatusForResource(r.id)! }));
  const deviatedCalendars = calendars.filter((c) => {
    const st = onOpenStatusForCalendar(c.id); return st === 'deviated' || st === 'removed';
  }).map((c) => ({ id: c.id, name: c.name, status: onOpenStatusForCalendar(c.id)! }));

  const linkAll = () => linkRecognizedItems(
    withMatch.map((c) => ({ kind: c.kind, projectId: c.projectId, poolId: c.suggestedPoolId! })),
  );

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[640px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-library-link-dialog': true }}
    >
      <DialogHeader title={t('companyLibrary.linkTitle')} onClose={close} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-small leading-4">
        {/* ── Herkennen ── */}
        {candidates.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>{t('companyLibrary.recognizeHeading')}</h3>
              {withMatch.length > 1 && (
                <button onClick={linkAll} className="btn btn--sm btn--secondary flex items-center gap-1">
                  <Link2 size={12} /> {t('companyLibrary.linkAll')}
                </button>
              )}
            </div>
            <p className="text-text-secondary">{t('companyLibrary.recognizeIntro')}</p>
            <ul className="flex flex-col gap-1">
              {candidates.map((c) => (
                <li key={`${c.kind}-${c.projectId}`} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-[8px] border border-border">
                  <span className="flex items-center gap-1.5">
                    <b>{c.projectName}</b>
                    {c.suggestedPoolName
                      ? <span className="text-text-secondary flex items-center gap-1"><ArrowRight size={11} /> {t('companyLibrary.suggestedMatch', { name: c.suggestedPoolName })}</span>
                      : <span className="text-text-secondary italic">{t('companyLibrary.noMatch')}</span>}
                  </span>
                  {c.suggestedPoolId && (
                    <button
                      onClick={() => linkRecognizedItems([{ kind: c.kind, projectId: c.projectId, poolId: c.suggestedPoolId! }])}
                      className="btn btn--sm btn--secondary flex items-center gap-1"
                    >
                      <Link2 size={12} /> {t('companyLibrary.linkThis')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Afwijkingen ── */}
        {(deviatedResources.length > 0 || deviatedCalendars.length > 0) && (
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>{t('companyLibrary.deviationsHeading')}</h3>
            <p className="text-text-secondary">{t('companyLibrary.deviationsIntro')}</p>
            <ul className="flex flex-col gap-2">
              {[...deviatedResources.map((d) => ({ ...d, kind: 'resource' as const })),
                ...deviatedCalendars.map((d) => ({ ...d, kind: 'calendar' as const }))].map((d) => (
                <li key={`${d.kind}-${d.id}`} className="flex flex-col gap-1.5 px-2 py-2 rounded-[8px] border border-border">
                  <div className="flex items-center justify-between">
                    <b>{d.name}</b>
                    <span className="badge badge--red flex items-center gap-1">
                      <AlertCircle size={11} /> {d.status === 'removed' ? t('companyLibrary.notInCompany') : t('companyLibrary.deviates')}
                    </span>
                  </div>
                  {d.status === 'deviated' && (
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <button onClick={() => resolveDeviation({ kind: d.kind, projectId: d.id }, 'company')} className="btn btn--sm btn--secondary">{t('companyLibrary.useCompanyValues')}</button>
                        <button onClick={() => resolveDeviation({ kind: d.kind, projectId: d.id }, 'file')} className="btn btn--sm btn--secondary">{t('companyLibrary.adoptFileValues')}</button>
                      </div>
                      <span className="text-text-secondary italic">{t('companyLibrary.adoptWarning')}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {candidates.length === 0 && deviatedResources.length === 0 && deviatedCalendars.length === 0 && (
          <p className="text-text-secondary italic">{t('companyLibrary.upToDate')}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--primary">{t('companyLibrary.decideLater')}</button>
      </div>
    </Dialog>
  );
}
