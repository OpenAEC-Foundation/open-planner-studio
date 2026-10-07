import { useRef, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { ProjectInfoPanelContent, type ProjectInfoPanelContentHandle } from '@/components/settings/ProjectInfoPanelContent';
import { PROJECT_INFO_HELP_ARTICLE_ID } from '@/state/helpArticles';

/**
 * Dubbel-modus dialoog — een dunne chrome-wrapper rond het gedeelde `ProjectInfoPanelContent`
 * (naar het model van `SettingsPanelContent`):
 *  - Projectinfo bewerken (ui.showProjectInfoDialog) — wijzigt het actieve project (`mode="edit"`).
 *  - Nieuw-project-wizard (ui.showNewProjectDialog) — maakt een nieuw document met metadata, een
 *    kalender-preset en een fasering-template (`mode="wizard"`).
 * Wordt conditioneel gemount (één van beide vlaggen), dus de content-state initialiseert vers.
 *
 * De velden + commit-logica leven in `ProjectInfoPanelContent`; deze wrapper levert alleen de
 * Dialog-chrome (header/Esc/Enter/footer-knoppen; bewust géén backdrop-close) en roept `submit()` aan via een `ref`,
 * omdat `Dialog`'s `onConfirm` (Enter-afhandeling) op het buitenste element zit, vóór het gedeelde
 * component gemount wordt.
 */
export function ProjectInfoDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const isNew = useAppStore(s => s.ui.showNewProjectDialog);
  const setUI = useAppStore(s => s.setUI);
  const panelRef = useRef<ProjectInfoPanelContentHandle>(null);
  // Uit zolang de draft ongeldig is (eigen rekenprofiel zonder naam); Enter loopt via submit(), dat zelf ook weigert.
  const [canSubmit, setCanSubmit] = useState(true);
  // Wijkt de draft af van het project (zelfde maatstaf als Toepassen)? Dan vraagt de ?-knop eerst
  // Opslaan / Annuleren / Terug; zonder wijziging opent Help meteen.
  const [dirty, setDirty] = useState(false);

  const close = () => setUI({ showProjectInfoDialog: false, showNewProjectDialog: false });
  const submit = () => panelRef.current?.submit();

  return (
    // Esc sluit, Enter = primaire actie (Aanmaken/Toepassen), met de standaard
    // textarea/dropdown/IME-uitzonderingen (o.a. de omschrijving-textarea en de land/template-Selects).
    // Een klik naast het paneel sluit NIET: een gebruiker die per ongeluk buiten de
    // wizard klikt, verliest anders alles wat hij al had ingetypt. Alleen Annuleren/X/Esc sluiten.
    <Dialog
      onCancel={close}
      onConfirm={submit}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-project-dialog': isNew ? 'new' : 'info' }}
    >
        <DialogHeader
          title={isNew ? tMenu('newProject.title') : tMenu('projectInfo.title')}
          onClose={close}
          // Alleen bij Projectinformatie (besluit eigenaar); Opslaan = Toepassen (`submit` bewaart en
          // sluit, en geeft `false` bij een ongeldige draft).
          help={isNew ? undefined : {
            articleId: PROJECT_INFO_HELP_ARTICLE_ID,
            confirmLeave: { dirty, onSave: () => panelRef.current?.submit() ?? false },
          }}
        />

        <div className="flex-1 overflow-y-auto p-4">
          <ProjectInfoPanelContent ref={panelRef} mode={isNew ? 'wizard' : 'edit'} onDone={close} autoFocusName onValidityChange={setCanSubmit} onDirtyChange={setDirty} />
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={close} className="btn btn--sm btn--secondary" data-ops-project-cancel>{tCommon('cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]" data-ops-project-primary>
            {isNew ? tCommon('create') : tCommon('apply')}
          </button>
        </div>
    </Dialog>
  );
}
