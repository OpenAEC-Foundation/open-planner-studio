import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';

export function IFCPanel() {
  const { t } = useTranslation('menu');
  const project = useAppStore(s => s.project);
  const calendar = useAppStore(s => s.calendar);
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const resourceCalendars = useAppStore(s => s.calendars);
  // B4-fix (audit P2): baselines/activeBaselineId meesturen — voorheen schreef dit paneel stil
  // ONVOLLEDIGE IFC (baselines gingen verloren bij genereren/kopiëren vanuit de IFC-tab).
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const loadState = useAppStore(s => s.loadState);
  const setViewStartDate = useAppStore(s => s.setViewStartDate);
  const runCPM = useAppStore(s => s.runCPM);

  const generated = useMemo(() => {
    return writeIFC(buildWriteIFCInput({
      project, calendar, tasks, sequences, resources, assignments,
      activityCodeTypes, customFieldDefs, calendars: resourceCalendars, baselines, activeBaselineId,
    }));
  }, [project, calendar, tasks, sequences, resources, assignments, activityCodeTypes, customFieldDefs, resourceCalendars, baselines, activeBaselineId]);

  const [content, setContent] = useState(generated);
  const [dirty, setDirty] = useState(false);

  const handleGenerate = useCallback(() => {
    const ifc = writeIFC(buildWriteIFCInput({
      project, calendar, tasks, sequences, resources, assignments,
      activityCodeTypes, customFieldDefs, calendars: resourceCalendars, baselines, activeBaselineId,
    }));
    setContent(ifc);
    setDirty(false);
  }, [project, calendar, tasks, sequences, resources, assignments, activityCodeTypes, customFieldDefs, resourceCalendars, baselines, activeBaselineId]);

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
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <span
          className="text-xs font-bold uppercase"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--theme-text-muted)' }}
        >
          {t('ifc.title')}
        </span>
        <div className="flex-1" />
        <button
          onClick={handleGenerate}
          className="px-3 py-1 text-xs bg-accent text-accent-on hover:bg-accent-hover"
          style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-glow)' }}
        >
          {t('ifc.generate')}
        </button>
        <button
          onClick={handleApply}
          disabled={!dirty}
          className="px-3 py-1 text-xs bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          {t('ifc.apply')}
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs hover:bg-surface-hover"
          style={{ border: '1px solid var(--theme-control-border)', borderRadius: 'var(--radius-md)' }}
        >
          {t('ifc.copy')}
        </button>
        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{lineCount} {t('ifc.lines')}</span>
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
