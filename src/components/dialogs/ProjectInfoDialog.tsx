import { useState, useEffect } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export function ProjectInfoDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const project = useAppStore(s => s.project);
  const setProject = useAppStore(s => s.setProject);
  const setUI = useAppStore(s => s.setUI);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [author, setAuthor] = useState(project.author);
  const [company, setCompany] = useState(project.company);
  const [startDate, setStartDate] = useState(project.startDate);
  const [endDate, setEndDate] = useState(project.endDate);

  const handleApply = () => {
    setProject({ name, description, author, company, startDate, endDate });
    setUI({ showProjectInfoDialog: false });
  };

  const handleClose = () => {
    setUI({ showProjectInfoDialog: false });
  };

  // Esc sluit dialog (LAYOUTS.md §3.3)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUI({ showProjectInfoDialog: false });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setUI]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-surface-alt border border-border rounded-lg shadow-xl w-[560px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold">{tMenu('projectInfo.title')}</span>
          <button onClick={handleClose} className="p-1 hover:bg-surface-hover rounded">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.name')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.author')}</label>
              <input
                value={author}
                onChange={e => setAuthor(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.company')}</label>
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1.5 bg-surface border border-border rounded focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={handleClose} className="btn btn--sm btn--secondary">
            {tCommon('cancel')}
          </button>
          <button onClick={handleApply} className="btn btn--sm btn--primary">
            {tCommon('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
