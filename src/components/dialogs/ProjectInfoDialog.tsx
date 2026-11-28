import { useRef, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { ProjectInfoPanelContent, type ProjectInfoPanelContentHandle } from '@/components/settings/ProjectInfoPanelContent';
import { PROJECT_INFO_HELP_ARTICLE_ID } from '@/state/helpArticles';

export function ProjectInfoDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const isNew = useAppStore(s => s.ui.showNewProjectDialog);
  const setUI = useAppStore(s => s.setUI);
  const panelRef = useRef<ProjectInfoPanelContentHandle>(null);
  const [canSubmit, setCanSubmit] = useState(true);
  const [dirty, setDirty] = useState(false);

  const close = () => setUI({ showProjectInfoDialog: false, showNewProjectDialog: false });
  const submit = () => panelRef.current?.submit();

  return (
    <Dialog
      onCancel={close}
      onConfirm={submit}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-project-dialog': isNew ? 'new' : 'info' }}
    >
        <DialogHeader
          title={isNew ? tMenu('newProject.title') : tMenu('projectInfo.title')}
          onClose={close}
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
