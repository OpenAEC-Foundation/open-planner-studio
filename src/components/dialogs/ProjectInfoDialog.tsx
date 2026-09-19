import { useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import { ProjectInfoPanelContent, type ProjectInfoPanelContentHandle } from '@/components/settings/ProjectInfoPanelContent';

/**
 * Dubbel-modus dialoog — nu een dunne chrome-wrapper rond het gedeelde `ProjectInfoPanelContent`
 * (issue #19, naar het model van `SettingsPanelContent`):
 *  - Projectinfo bewerken (ui.showProjectInfoDialog) — wijzigt het actieve project (`mode="edit"`).
 *  - Nieuw-project-wizard (ui.showNewProjectDialog) — maakt een nieuw document met metadata, een
 *    kalender-preset en een fasering-template (`mode="wizard"`).
 * Wordt conditioneel gemount (één van beide vlaggen), dus de content-state initialiseert vers.
 *
 * De velden + commit-logica leven in `ProjectInfoPanelContent`; deze wrapper levert alleen de
 * Dialog-chrome (header/Esc/backdrop/Enter/footer-knoppen) en roept `submit()` aan via een `ref`,
 * omdat `Dialog`'s `onConfirm` (Enter-afhandeling) op het buitenste element zit, vóór het gedeelde
 * component gemount wordt.
 */
export function ProjectInfoDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const isNew = useAppStore(s => s.ui.showNewProjectDialog);
  const setUI = useAppStore(s => s.setUI);
  const panelRef = useRef<ProjectInfoPanelContentHandle>(null);

  const close = () => setUI({ showProjectInfoDialog: false, showNewProjectDialog: false });
  const submit = () => panelRef.current?.submit();

  return (
    // Esc sluit (LAYOUTS.md §3.3), Enter = primaire actie (Aanmaken/Toepassen), met de standaard
    // textarea/dropdown/IME-uitzonderingen (o.a. de omschrijving-textarea en de land/template-Selects).
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      onConfirm={submit}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-project-dialog': isNew ? 'new' : 'info' }}
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-body leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {isNew ? tMenu('newProject.title') : tMenu('projectInfo.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <ProjectInfoPanelContent ref={panelRef} mode={isNew ? 'wizard' : 'edit'} onDone={close} autoFocusName />
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={close} className="btn btn--sm btn--secondary" data-ops-project-cancel>{tCommon('cancel')}</button>
          <button onClick={submit} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]" data-ops-project-primary>
            {isNew ? tCommon('create') : tCommon('apply')}
          </button>
        </div>
    </Dialog>
  );
}
