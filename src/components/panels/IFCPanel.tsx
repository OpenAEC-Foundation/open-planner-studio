import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useI18n } from '@/i18n/i18n';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';

export function IFCPanel() {
  const { t } = useI18n();
  const project = useAppStore(s => s.project);
  const calendar = useAppStore(s => s.calendar);
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const loadState = useAppStore(s => s.loadState);
  const setViewStartDate = useAppStore(s => s.setViewStartDate);
  const runCPM = useAppStore(s => s.runCPM);

  const generated = useMemo(() => {
    return writeIFC(project, calendar, tasks, sequences, resources, assignments);
  }, [project, calendar, tasks, sequences, resources, assignments]);

  const [content, setContent] = useState(generated);
  const [dirty, setDirty] = useState(false);

  const handleGenerate = useCallback(() => {
    const ifc = writeIFC(project, calendar, tasks, sequences, resources, assignments);
    setContent(ifc);
    setDirty(false);
  }, [project, calendar, tasks, sequences, resources, assignments]);

  const handleApply = useCallback(() => {
    try {
      const data = readIFC(content);
      loadState(data);
      setViewStartDate(data.project.startDate);
      runCPM();
      setDirty(false);
    } catch (err) {
      alert(`IFC parse error: ${(err as Error).message}`);
    }
  }, [content, loadState, setViewStartDate, runCPM]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
  }, [content]);

  const lineCount = content.split('\n').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-alt">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">{t('ifc.title')}</span>
        <div className="flex-1" />
        <button
          onClick={handleGenerate}
          className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover"
        >
          {t('ifc.generate')}
        </button>
        <button
          onClick={handleApply}
          disabled={!dirty}
          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
        >
          {t('ifc.apply')}
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs border border-border rounded hover:bg-surface-hover"
        >
          {t('ifc.copy')}
        </button>
        <span className="text-[10px] text-text-secondary">{lineCount} {t('ifc.lines')}</span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden relative">
        <textarea
          value={content}
          onChange={e => { setContent(e.target.value); setDirty(true); }}
          spellCheck={false}
          className="absolute inset-0 w-full h-full bg-surface text-text-primary font-mono text-[11px] leading-5 p-3 resize-none outline-none border-none"
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
}
