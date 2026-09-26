import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/common/Dialog';

interface UnappliedChangesDialogProps {
  /** Toepassen uit zolang de draft ongeldig is (eigen rekenprofiel zonder naam). */
  canApply: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onApply: () => void;
}

/**
 * Keuzedialoog bij wegnavigeren uit Backstage → Projectinfo met een niet-toegepaste draft (B2,
 * gebruikstest rekenprofielen 24-09). Zelfde driekeuzepatroon en knopvolgorde als de
 * sluitbevestiging van een document (`CloseDocumentDialogControl`): Annuleren (blijft staan, krijgt
 * de beginfocus), Verwerpen (gooit de draft weg en gaat door), Toepassen (committeert en gaat door).
 * Op de gedeelde `Dialog` (focus-trap, Escape = Annuleren); bewust geen backdrop-klik en geen
 * Enter-als-Toepassen: wegklikken of een losse Enter mag geen projectwijziging committeren.
 */
export function UnappliedChangesDialog({ canApply, onCancel, onDiscard, onApply }: UnappliedChangesDialogProps) {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  return (
    <Dialog
      onCancel={onCancel}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[440px] max-w-[90vw] p-5 flex flex-col gap-3"
      panelProps={{ 'data-ops-unapplied-dialog': '', 'aria-labelledby': 'ops-unapplied-title' }}
    >
      <h3 id="ops-unapplied-title" className="!text-heading leading-6 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
        {tMenu('backstage.unapplied.title')}
      </h3>
      <div className="alert alert--warning" data-ops-unapplied-body>
        {tMenu('backstage.unapplied.body')}
      </div>
      {!canApply && (
        <div className="alert alert--error" data-ops-unapplied-invalid>
          {tMenu('backstage.unapplied.invalid')}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onCancel} data-ops-unapplied-choice="cancel">
          {tCommon('cancel')}
        </button>
        <button type="button" className="btn btn--danger btn--sm" onClick={onDiscard} data-ops-unapplied-choice="discard">
          {tMenu('backstage.unapplied.discard')}
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={onApply} disabled={!canApply} data-ops-unapplied-choice="apply">
          {tCommon('apply')}
        </button>
      </div>
    </Dialog>
  );
}
