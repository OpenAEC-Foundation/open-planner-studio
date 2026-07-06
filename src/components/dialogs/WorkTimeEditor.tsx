import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { WorkTimeBands } from '@/types/calendar';
import { deriveHoursPerDay, minutesToClock, clockToMinutes } from '@/services/subdayIo';

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
type WD = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Minuten → `'HH:MM'` (voor een `type="time"`-veld). Wrap-tijd (>1440) wordt modulo getoond. */
function toHM(min: number): string {
  return minutesToClock(min).slice(0, 5);
}

/**
 * Volledige banden-editor (fase 2.8b, §6.6c) — achter "Per weekdag instellen…". Per ISO-weekdag een
 * lijst `{start,end}`-banden (tijd-pickers), een nachtploeg-toggle ("volgende dag" = band die
 * middernacht kruist, `end += 1440`), meerdere banden per dag (pauze), "kopieer naar alle
 * werkdagen" en de per-weekdag-som + afgeleide `hoursPerDay` als controlegetal (Bevinding 8).
 *
 * Zuiver presentational: muteert alleen via `onChange` (buffer-model van de kalenderdialoog).
 */
export function WorkTimeEditor({
  bands,
  onChange,
}: {
  bands: WorkTimeBands;
  onChange: (bands: WorkTimeBands) => void;
}) {
  const { t: tMenu } = useTranslation('menu');
  const { t: tCommon } = useTranslation('common');

  const setDay = (wd: WD, list: { start: number; end: number }[]) => {
    const byWeekday = { ...bands.byWeekday, [wd]: list } as WorkTimeBands['byWeekday'];
    onChange({ byWeekday });
  };

  const updateBand = (wd: WD, idx: number, patch: Partial<{ start: number; end: number }>) => {
    const list = (bands.byWeekday[wd] ?? []).map((b, i) => (i === idx ? { ...b, ...patch } : b));
    setDay(wd, list);
  };

  const addBand = (wd: WD) => {
    const list = [...(bands.byWeekday[wd] ?? []), { start: 480, end: 960 }]; // 08:00-16:00
    setDay(wd, list);
  };

  const removeBand = (wd: WD, idx: number) => {
    setDay(wd, (bands.byWeekday[wd] ?? []).filter((_, i) => i !== idx));
  };

  const copyToAllWorkdays = (wd: WD) => {
    const src = (bands.byWeekday[wd] ?? []).map((b) => ({ ...b }));
    const byWeekday = { ...bands.byWeekday } as WorkTimeBands['byWeekday'];
    for (let d = 1 as WD; d <= 5; d = (d + 1) as WD) byWeekday[d] = src.map((b) => ({ ...b }));
    onChange({ byWeekday });
  };

  const dayMinutes = (wd: WD) => (bands.byWeekday[wd] ?? []).reduce((s, b) => s + (b.end - b.start), 0);
  const derivedHpd = deriveHoursPerDay(bands, 0);

  const timeCls =
    'px-1.5 py-1 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[6px] text-text-primary focus:outline-none focus:border-accent';

  return (
    <div className="border border-border rounded-[10px] p-3 flex flex-col gap-2 bg-surface-alt" data-ops-worktime-editor>
      {WEEK_DAYS.map((wd) => {
        const list = bands.byWeekday[wd] ?? [];
        return (
          <div key={wd} className="flex flex-col gap-1 border-b border-[var(--theme-border-light)] pb-2 last:border-0">
            <div className="flex items-center gap-2">
              <span className="w-8 font-medium text-text-secondary">
                {tMenu(`ribbon.calendarDialog.days.${wd}` as 'ribbon.calendarDialog.days.1')}
              </span>
              <span className="text-[10px] text-text-secondary tabular-nums">
                {(dayMinutes(wd) / 60).toFixed(2)}u
              </span>
              <div className="flex-1" />
              <button type="button" onClick={() => addBand(wd)}
                className="p-1 hover:bg-surface-hover rounded-[6px] text-text-secondary" title={tCommon('calendar.worktime.addBand')}>
                <Plus size={12} />
              </button>
              {wd <= 5 && list.length > 0 && (
                <button type="button" onClick={() => copyToAllWorkdays(wd)}
                  className="p-1 hover:bg-surface-hover rounded-[6px] text-text-secondary" title={tCommon('calendar.worktime.copyToAll')}>
                  <Copy size={12} />
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <span className="text-[10px] text-text-secondary italic pl-8">{tCommon('calendar.worktime.noBands')}</span>
            ) : (
              list.map((b, idx) => {
                const nextDay = b.end >= 1440; // 1440 = 24:00 (middernacht volgende dag) ⇒ wrap
                const endClock = b.end % 1440;
                return (
                  <div key={idx} className="flex items-center gap-1.5 pl-8" data-ops-band>
                    <input type="time" value={toHM(b.start)} className={timeCls}
                      onChange={(e) => {
                        const m = clockToMinutes(e.currentTarget.value);
                        if (m != null) updateBand(wd, idx, { start: m });
                      }} />
                    <span className="text-text-secondary">–</span>
                    <input type="time" value={toHM(endClock)} className={timeCls}
                      onChange={(e) => {
                        const m = clockToMinutes(e.currentTarget.value);
                        if (m != null) updateBand(wd, idx, { end: nextDay ? m + 1440 : m });
                      }} />
                    <label className="flex items-center gap-1 text-[10px] text-text-secondary">
                      <input type="checkbox" checked={nextDay} className="accent-accent"
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          updateBand(wd, idx, { end: checked ? endClock + 1440 : endClock });
                        }} />
                      {tCommon('calendar.worktime.nextDay')}
                    </label>
                    <button type="button" onClick={() => removeBand(wd, idx)}
                      className="p-1 hover:bg-surface-hover rounded-[6px] text-text-secondary" title={tCommon('delete')}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] font-medium text-text-secondary">{tCommon('calendar.worktime.derivedHpd')}</span>
        <span className="text-[11px] font-semibold text-accent tabular-nums" data-ops-derived-hpd>{derivedHpd}u</span>
      </div>
    </div>
  );
}
