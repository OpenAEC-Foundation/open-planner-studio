import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, X } from 'lucide-react';
import type { WorkCalendar, Holiday, WorkTimeBands } from '@/types/calendar';
import { CalendarGeneratorFields } from './CalendarGeneratorFields';
import { WorkTimeEditor } from './WorkTimeEditor';
import { DateTextInput } from '@/components/common/DateTextInput';
import { useAppStore } from '@/state/appStore';
import { isHourCalendar, deriveHoursPerDay, workDaysFromBands } from '@/services/subdayIo';
import { generateId } from '@/utils/id';
import { loadWorkTimePresets, saveWorkTimePresets } from '@/utils/settingsStore';
import {
  CALENDAR_PRESETS, SHIFT_PRESET_LABEL, shiftPresetPatch, patchFromPreset, presetFromCalendar,
  makeBands, type WorkTimePreset,
} from '@/utils/shiftPresets';
import {
  materializeHolidays, computeGenerateSpan, DEFAULT_GEN_PARAMS, type HolidayGenParams,
} from '@/engine/calendar/generateCalendarHolidays';

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Presentational kalenderformulier (naam, werkdagen, uren, feestdagen) — kent geen store.
 * Hergebruikt door `CalendarDialog` (projectkalender) én `ResourceCalendarDialog`
 * (fase 2.5, §3.4); de aanroeper beslist wat er met `onChange`-patches gebeurt en wanneer
 * er gecommit wordt (Apply-knop leeft in de aanroeper, niet hier).
 *
 * `projectYearSpan` (fase 2.8a, §4.4/§7.1): optionele projectperiode (in jaren) van de aanroeper.
 * Stuurt de default generatie-spanne én de hergeneratie-hint wanneer de kalender al
 * `generation`-metadata draagt die de projectperiode niet meer dekt.
 */
export function CalendarForm({
  draft,
  onChange,
  projectYearSpan,
}: {
  draft: WorkCalendar;
  onChange: (patch: Partial<WorkCalendar>) => void;
  projectYearSpan?: { from: number; to: number };
}) {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);

  const [showGenerator, setShowGenerator] = useState(false);
  // Werktijden-UI (§6.6): eigen presets (app-niveau localStorage), banden-editor achter een knop,
  // en een inline naam-invoer voor "Bewaar als preset…".
  const [ownPresets, setOwnPresets] = useState<WorkTimePreset[]>([]);
  const [showBandEditor, setShowBandEditor] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const hourMode = isHourCalendar(draft);

  useEffect(() => { void loadWorkTimePresets().then(setOwnPresets); }, []);

  // Preset toepassen ⇒ workTime + shift + scalar-fallback in één patch (buffer-model).
  const applyPreset = (patch: ReturnType<typeof shiftPresetPatch>) => {
    onChange({
      workTime: patch.workTime,
      shift: patch.shift,
      workDays: patch.workDays,
      workStartHour: patch.workStartHour,
      workEndHour: patch.workEndHour,
      hoursPerDay: patch.hoursPerDay,
    });
    if (!patch.workTime) setShowBandEditor(false); // dag-preset ⇒ editor dicht
  };

  const persistOwnPresets = (list: WorkTimePreset[]) => {
    setOwnPresets(list);
    void saveWorkTimePresets(list);
  };
  const confirmSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    persistOwnPresets([...ownPresets, presetFromCalendar(generateId('wtp'), name, draft)]);
    setPresetName('');
    setSavingPreset(false);
  };
  const deleteOwnPreset = (id: string) => persistOwnPresets(ownPresets.filter(p => p.id !== id));

  // Banden-editor openen ⇒ ontbreekt workTime, seed dan uit de scalar (één band per werkdag), zodat
  // een dag-kalender via de editor een uur-kalender kan worden.
  const openBandEditor = () => {
    if (!draft.workTime) {
      const seed = makeBands(draft.workDays, [{ start: draft.workStartHour * 60, end: draft.workEndHour * 60 }]);
      applyBands(seed);
    }
    setShowBandEditor(true);
  };
  const applyBands = (bands: WorkTimeBands) => {
    onChange({
      workTime: bands,
      hoursPerDay: deriveHoursPerDay(bands, draft.hoursPerDay),
      workDays: workDaysFromBands(bands),
    });
  };
  const [genParams, setGenParams] = useState<HolidayGenParams>(() =>
    draft.generation
      ? {
          country: draft.generation.ruleSetId,
          region: draft.generation.region,
          bouwvak: draft.generation.breakChoice ?? 'geen',
        }
      : DEFAULT_GEN_PARAMS,
  );

  const defaultSpan = projectYearSpan
    ?? (draft.generation
      ? { from: draft.generation.generatedFromYear, to: draft.generation.generatedToYear }
      : computeGenerateSpan(new Date().toISOString().slice(0, 10), undefined));

  const needsRegen = !!draft.generation && !!projectYearSpan
    && (projectYearSpan.from < draft.generation.generatedFromYear
      || projectYearSpan.to > draft.generation.generatedToYear);

  const applyGenerator = () => {
    const { holidays, generation } = materializeHolidays(genParams, defaultSpan.from, defaultSpan.to);
    onChange({ holidays, generation });
    setShowGenerator(false);
  };

  const regenerate = () => {
    if (!draft.generation || !projectYearSpan) return;
    const params: HolidayGenParams = {
      country: draft.generation.ruleSetId,
      region: draft.generation.region,
      bouwvak: draft.generation.breakChoice ?? 'geen',
    };
    const { holidays, generation } = materializeHolidays(params, projectYearSpan.from, projectYearSpan.to);
    onChange({ holidays, generation });
  };

  const toggleWorkDay = (day: number) => {
    const has = draft.workDays.includes(day);
    const workDays = has
      ? draft.workDays.filter(x => x !== day)
      : [...draft.workDays, day].sort((a, b) => a - b);
    onChange({ workDays });
  };

  // Presets (fase 2.8a, §13/out-of-scope — "24/7"-kalender was al gedefinieerd in het ontwerp als
  // workDays [1..7]-preset, maar had geen knop; alleen handmatig 7 dagen aanvinken). Echte
  // dag/nacht-PLOEGEN (twee elkaar afwisselende kalenders) blijven fase 2.8b — dit is uitsluitend
  // de ene-doorlopende-kalender-preset. "Ma-vr" ernaast herstelt symmetrisch de standaard.
  const applyContinuousPreset = () => {
    onChange({ workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24 });
  };
  const applyWeekdaysPreset = () => {
    onChange({ workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8 });
  };

  const updateHoliday = (index: number, patch: Partial<Holiday>) => {
    const holidays = draft.holidays.map((h, i) => (i === index ? { ...h, ...patch } : h));
    onChange({ holidays });
  };

  const addHoliday = () => {
    const today = new Date().toISOString().slice(0, 10);
    onChange({ holidays: [...draft.holidays, { name: '', startDate: today, endDate: today }] });
  };

  const removeHoliday = (index: number) => {
    onChange({ holidays: draft.holidays.filter((_, i) => i !== index) });
  };

  const inputCls =
    'px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(217,119,6,0.2)] transition-[border-color,box-shadow]';

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-text-secondary font-medium">
          {tMenu('ribbon.calendarDialog.name')}
        </label>
        <input
          value={draft.name}
          onChange={e => onChange({ name: e.target.value })}
          className={inputCls}
          autoFocus
        />
      </div>

      {/* Work days */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-text-secondary font-medium">
            {tMenu('ribbon.calendarDialog.workDays')}
          </label>
          {/* Presets (fase 2.8a §13): "Continu (24/7)" zet workDays [1..7] + 0-24u ineens;
              "Ma-vr" herstelt symmetrisch de standaard ma-vr/07-16. */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={applyWeekdaysPreset}
              className="btn btn--sm btn--secondary"
            >
              {tCommon('calendar.preset.weekdays')}
            </button>
            <button
              type="button"
              onClick={applyContinuousPreset}
              className="btn btn--sm btn--secondary"
            >
              {tCommon('calendar.preset.continuous')}
            </button>
          </div>
        </div>
        <div className="flex gap-1.5">
          {WEEK_DAYS.map(day => {
            const active = draft.workDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleWorkDay(day)}
                className={
                  'px-2.5 py-1.5 rounded-[8px] border-[1.5px] transition-colors ' +
                  (active
                    ? 'bg-accent text-white border-accent shadow-[var(--shadow-glow)]'
                    : 'bg-surface border-[var(--theme-control-border)] text-text-secondary hover:bg-surface-hover')
                }
              >
                {tMenu(`ribbon.calendarDialog.days.${day}` as 'ribbon.calendarDialog.days.1')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Work hours — scalar-UI (dag-kalender). Verborgen in uur-modus mét Urenplanning aan; dan
          stuurt de banden-editor de tijden en toont de sectie hieronder de afgeleide hoursPerDay. */}
      {!(enableHourPlanning && hourMode) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">
              {tMenu('ribbon.calendarDialog.startHour')}
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={draft.workStartHour}
              onChange={e => onChange({ workStartHour: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">
              {tMenu('ribbon.calendarDialog.endHour')}
            </label>
            <input
              type="number"
              min={0}
              max={24}
              value={draft.workEndHour}
              onChange={e => onChange({ workEndHour: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">
              {tMenu('ribbon.calendarDialog.hoursPerDay')}
            </label>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={draft.hoursPerDay}
              onChange={e => onChange({ hoursPerDay: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* Werktijden / ploegen (§6.6) — alleen met Urenplanning aan; anders exact de 2.8a scalar-UI. */}
      {enableHourPlanning && (
        <div className="flex flex-col gap-2" data-ops-worktime-section>
          <div className="flex items-center justify-between">
            <label className="text-text-secondary font-medium">{tCommon('calendar.worktime.section')}</label>
            {hourMode && (
              <span className="text-[11px] text-text-secondary">
                {tCommon('calendar.worktime.derivedHpd')}{' '}
                <span className="font-semibold text-accent tabular-nums">{draft.hoursPerDay}u</span>
              </span>
            )}
          </div>

          {/* Preset-rij: ingebouwde presets + eigen presets (met verwijder-kruisje). */}
          <div className="flex flex-wrap gap-1.5">
            {CALENDAR_PRESETS.map(key => (
              <button key={key} type="button" onClick={() => applyPreset(shiftPresetPatch(key))}
                className="btn btn--sm btn--secondary" data-ops-preset={key}>
                {tCommon(SHIFT_PRESET_LABEL[key] as 'calendar.shift.day')}
              </button>
            ))}
            {ownPresets.map(p => (
              <span key={p.id} className="inline-flex items-center rounded-[8px] border-[1.5px] border-[var(--theme-control-border)] overflow-hidden"
                data-ops-own-preset={p.id}>
                <button type="button" onClick={() => applyPreset(patchFromPreset(p))}
                  className="px-2.5 py-1.5 text-text-secondary hover:bg-surface-hover">
                  {p.name}
                </button>
                <button type="button" onClick={() => deleteOwnPreset(p.id)}
                  className="px-1.5 py-1.5 text-text-secondary hover:bg-surface-hover hover:text-red-500"
                  title={tCommon('delete')} data-ops-own-preset-del={p.id}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSavingPreset(v => !v)} className="btn btn--sm btn--secondary" data-ops-preset-saveas>
              {tCommon('calendar.worktime.saveAsPreset')}
            </button>
            <button type="button" onClick={() => (showBandEditor ? setShowBandEditor(false) : openBandEditor())}
              className="btn btn--sm btn--secondary" data-ops-band-editor-toggle>
              {tCommon('calendar.worktime.perWeekday')}
            </button>
          </div>

          {savingPreset && (
            <div className="flex items-center gap-2">
              <input value={presetName} onChange={e => setPresetName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmSavePreset(); } }}
                placeholder={tCommon('calendar.worktime.presetNamePlaceholder')} className={inputCls + ' flex-1'} />
              <button type="button" onClick={confirmSavePreset} disabled={!presetName.trim()}
                className="btn btn--sm btn--primary disabled:opacity-40" data-ops-preset-save>{tCommon('save')}</button>
              <button type="button" onClick={() => { setSavingPreset(false); setPresetName(''); }}
                className="btn btn--sm btn--secondary">{tCommon('cancel')}</button>
            </div>
          )}

          {showBandEditor && draft.workTime && (
            <WorkTimeEditor bands={draft.workTime} onChange={applyBands} />
          )}
        </div>
      )}

      {/* Feestdagen genereren (fase 2.8a, §7.1) — regelgebaseerd, óók voor bestaande kalenders. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowGenerator(v => !v)}
            className="btn btn--sm btn--secondary self-start"
          >
            {tCommon('calendar.generate.button')}
          </button>
          {needsRegen && (
            <div className="flex items-center gap-2 text-[11px] text-text-secondary">
              <span>
                {tCommon('calendar.regen.hint', {
                  from: draft.generation!.generatedFromYear,
                  to: draft.generation!.generatedToYear,
                  year: projectYearSpan!.to,
                })}
              </span>
              <button onClick={regenerate} className="btn btn--sm btn--secondary">
                {tCommon('calendar.regen.button')}
              </button>
            </div>
          )}
        </div>

        {showGenerator && (
          <div className="border border-border rounded-[10px] p-3 flex flex-col gap-3 bg-surface-alt">
            <CalendarGeneratorFields
              value={genParams}
              onChange={patch => setGenParams(p => ({ ...p, ...patch }))}
              fromYear={defaultSpan.from}
              toYear={defaultSpan.to}
              // "Geen feestdagen" hoort er hier óók bij (fase 2.8a QA, fix 6) — pariteit met de
              // wizard: leegt de gegenereerde holidays + generation-metadata via
              // materializeHolidays(country:'none'). "Aangepast…" (extraCountryOptions, alleen de
              // wizard) is hier bewust NIET toegevoegd: je bewerkt al een bestaande kalender in de
              // editor zelf, dus een aparte "open de editor"-optie is zinledig in de editor.
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowGenerator(false)} className="btn btn--sm btn--secondary">
                {tCommon('calendar.generate.cancel')}
              </button>
              <button onClick={applyGenerator} className="btn btn--sm btn--primary">
                {tCommon('calendar.generate.apply')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Holidays */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-text-secondary font-medium">
            {tMenu('ribbon.calendarDialog.holidaysSection')}
          </label>
          <button onClick={addHoliday} className="btn btn--sm btn--secondary flex items-center gap-1">
            <Plus size={12} />
            {tMenu('ribbon.calendarDialog.addHoliday')}
          </button>
        </div>

        {draft.holidays.length === 0 ? (
          <span className="text-text-secondary italic">
            {tMenu('ribbon.calendarDialog.noHolidays')}
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-text-secondary font-medium px-1">
              <span>{tMenu('ribbon.calendarDialog.holidayName')}</span>
              <span>{tMenu('ribbon.calendarDialog.from')}</span>
              <span>{tMenu('ribbon.calendarDialog.until')}</span>
              <span />
            </div>
            {draft.holidays.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                <input
                  value={h.name}
                  onChange={e => updateHoliday(i, { name: e.target.value })}
                  className={inputCls}
                />
                <DateTextInput
                  value={h.startDate}
                  onCommit={v => updateHoliday(i, { startDate: v })}
                  className={inputCls}
                  ariaLabel={tMenu('ribbon.calendarDialog.from')}
                />
                <DateTextInput
                  value={h.endDate}
                  onCommit={v => updateHoliday(i, { endDate: v })}
                  className={inputCls}
                  ariaLabel={tMenu('ribbon.calendarDialog.until')}
                />
                <button
                  onClick={() => removeHoliday(i)}
                  className="p-1.5 hover:bg-surface-hover rounded-[8px] text-text-secondary"
                  title={tCommon('delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
