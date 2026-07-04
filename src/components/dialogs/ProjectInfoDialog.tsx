import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Select } from '@/components/common/Select';
import { formatDate } from '@/utils/dateUtils';
import { PROJECT_TEMPLATES, templatePhases, buildGeneratedCalendar, type TemplateKey } from '@/utils/projectTemplates';
import { CalendarGeneratorFields } from './CalendarGeneratorFields';
import { computeGenerateSpan, type HolidayGenParams } from '@/engine/calendar/generateCalendarHolidays';
import type { HolidayCountry } from '@/engine/calendar/holidays';

/** Wizard-generatorstatus: `HolidayGenParams` uitgebreid met de wizard-only pseudo-keuze
 *  `'custom'` ("Aangepast…", ontwerp §7.2) — die opent na aanmaken de kalenderdialoog i.p.v.
 *  een land-set te genereren. */
type WizardCalendarState = Omit<HolidayGenParams, 'country'> & { country: HolidayCountry | 'none' | 'custom' };

const DEFAULT_WIZARD_CALENDAR: WizardCalendarState = {
  country: 'NL', region: undefined, bouwvak: 'geen', winterStop: false, // default GEEN bouwvak (harde eis)
};

/**
 * Dubbel-modus dialoog:
 *  - Projectinfo bewerken (ui.showProjectInfoDialog) — wijzigt het actieve project.
 *  - Nieuw-project-wizard (ui.showNewProjectDialog) — maakt een nieuw document met
 *    metadata, een kalender-preset en een fasering-template.
 * Wordt conditioneel gemount (één van beide vlaggen), dus state initialiseert vers.
 */
export function ProjectInfoDialog() {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const isNew = useAppStore(s => s.ui.showNewProjectDialog);
  const project = useAppStore(s => s.project);
  const activeRibbonTab = useAppStore(s => s.ui.activeRibbonTab);
  const setProject = useAppStore(s => s.setProject);
  const createNewProject = useAppStore(s => s.createNewProject);
  const setUI = useAppStore(s => s.setUI);

  const [name, setName] = useState(isNew ? '' : project.name);
  const [description, setDescription] = useState(isNew ? '' : project.description);
  const [author, setAuthor] = useState(isNew ? '' : project.author);
  const [company, setCompany] = useState(isNew ? '' : project.company);
  const [startDate, setStartDate] = useState(isNew ? formatDate(new Date()) : project.startDate);
  const [endDate, setEndDate] = useState(isNew ? '' : project.endDate);
  const [calState, setCalState] = useState<WizardCalendarState>(DEFAULT_WIZARD_CALENDAR);
  const [template, setTemplate] = useState<TemplateKey>('empty');

  // Generatie-spanne bij aanmaak (§4.4): nog geen projecteinde bekend ⇒ startjaar−1..+3.
  const calSpan = useMemo(() => computeGenerateSpan(startDate, endDate || undefined), [startDate, endDate]);

  const close = () => setUI({ showProjectInfoDialog: false, showNewProjectDialog: false });

  const handlePrimary = () => {
    if (isNew) {
      const isCustom = calState.country === 'custom';
      const calendar = isCustom
        ? buildGeneratedCalendar({ country: 'none', bouwvak: 'geen', winterStop: false }, calSpan)
        : buildGeneratedCalendar(calState as HolidayGenParams, calSpan);
      createNewProject({
        name, description, author, company, startDate, endDate,
        calendar,
        phaseNames: templatePhases(template),
      });
      // Verlaat de Backstage zodat het nieuwe project meteen zichtbaar is; "Aangepast…" opent
      // meteen de kalenderdialoog zodat de gebruiker de kalender handmatig kan samenstellen (§7.2).
      setUI({
        showNewProjectDialog: false,
        ...(isCustom ? { showCalendarDialog: true } : {}),
        ...(activeRibbonTab === 'file' ? { activeRibbonTab: 'start' as const } : {}),
      });
    } else {
      setProject({ name, description, author, company, startDate, endDate });
      setUI({ showProjectInfoDialog: false });
    }
  };

  // Esc sluit dialog (LAYOUTS.md §3.3)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  const templateLabel: Record<TemplateKey, string> = {
    empty: tMenu('newProject.tmplEmpty'),
    woningbouw: tMenu('newProject.tmplWoningbouw'),
    utiliteit: tMenu('newProject.tmplUtiliteit'),
  };
  const templateOptions = PROJECT_TEMPLATES.map(t => ({ value: t.key, label: templateLabel[t.key] }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={close}>
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        data-ops-project-dialog={isNew ? 'new' : 'info'}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {isNew ? tMenu('newProject.title') : tMenu('projectInfo.title')}
          </span>
          <button onClick={close} className="p-1 hover:bg-surface-hover rounded-[8px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.name')}</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} autoFocus />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tMenu('projectInfo.description')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.author')}</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.company')}</label>
              <input value={company} onChange={e => setCompany(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.startDate')}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-text-secondary font-medium">{tMenu('projectInfo.endDate')}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {isNew && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-text-secondary font-medium">{tMenu('newProject.template')}</label>
                <Select aria-label={tMenu('newProject.template')} value={template}
                  onChange={v => setTemplate(v as TemplateKey)} options={templateOptions} />
              </div>

              {/* Feestdagen-generator (fase 2.8a, §7.2): land/regio, bouwvak (default GEEN — harde
                  eis), vaste winterstop + compacte preview. "Aangepast…" (extra optie in de
                  land-select) verbergt de rest van de generator (leeg gestart; de kalenderdialoog
                  opent na aanmaken om handmatig te bewerken, zie `handlePrimary`). */}
              <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
              <span className="text-text-secondary font-medium">{tMenu('wizard.calendar.country')}</span>
              <CalendarGeneratorFields
                value={calState}
                onChange={patch => setCalState(s => ({ ...s, ...patch }))}
                fromYear={calSpan.from}
                toYear={calSpan.to}
                noneLabel={tMenu('wizard.calendar.none')}
                extraCountryOptions={[{ value: 'custom', label: tMenu('wizard.calendar.custom') }]}
              />
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={close} className="btn btn--sm btn--secondary">{tCommon('cancel')}</button>
          <button onClick={handlePrimary} className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]">
            {isNew ? tCommon('create') : tCommon('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
