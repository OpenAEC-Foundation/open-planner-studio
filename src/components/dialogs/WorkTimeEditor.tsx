import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import type { WorkTimeBands } from '@/types/calendar';
import { ISO_WEEK_DAYS, orderedWeekDays } from '@/utils/weekDays';
import { MinuteTimeInput } from '@/components/common/TimeInput';
import { formatReportNumber } from '@/utils/reportNumber';
type WD = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function bandEndField(end: number): { minutes: number; nextDay: boolean } {
  return end > 1440 ? { minutes: end - 1440, nextDay: true } : { minutes: end, nextDay: false };
}

export function bandEndFromField(minutes: number, nextDay: boolean): number {
  return nextDay ? minutes + 1440 : minutes;
}

export function bandEndAfterEdit(start: number, typed: number, nextDay: boolean): number {
  if (typed === 1440) return 1440;
  const end = bandEndFromField(typed, nextDay);
  if (end <= start) return end + 1440;
  return end - start > 1440 ? end - 1440 : end;
}

export function WorkTimeEditor({
  bands,
  onChange,
  weekStartDay,
}: {
  bands: WorkTimeBands;
  onChange: (bands: WorkTimeBands) => void;
  weekStartDay: 'monday' | 'sunday';
}) {
  const { t: tMenu, i18n } = useTranslation('menu');
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
    const list = [...(bands.byWeekday[wd] ?? []), { start: 480, end: 960 }];
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
  const hasBreak = ISO_WEEK_DAYS.some((wd) => (bands.byWeekday[wd] ?? []).length > 1);
  const visibleWeekDays = orderedWeekDays(weekStartDay);

  const timeCls =
    'w-[6.5rem] px-1.5 py-1 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[6px] text-text-primary focus:outline-none focus:border-accent';

  return (
    <div className="border border-border rounded-[10px] p-3 flex flex-col gap-2 bg-surface-alt" data-ops-worktime-editor>
      {visibleWeekDays.map((wd) => {
        const list = bands.byWeekday[wd] ?? [];
        return (
          <div key={wd} className="flex flex-col gap-1 border-b border-[var(--theme-border-light)] pb-2 last:border-0"
            data-ops-worktime-day={wd}>
            <div className="flex items-center gap-2">
              <span className="w-8 font-medium text-text-secondary">
                {tMenu(`ribbon.calendarDialog.days.${wd}`)}
              </span>
              <span className="!text-small text-text-secondary tabular-nums" data-ops-worktime-day-hours>
                {tMenu('ribbon.calendarDialog.hoursValue', { hours: formatReportNumber(dayMinutes(wd) / 60, i18n.language) })}
              </span>
              <div className="flex-1" />
              <button type="button" onClick={() => addBand(wd)}
                className="p-1 hover:bg-surface-hover rounded-[6px] text-text-secondary" title={tCommon('calendar.worktime.addBand')}>
                <Icon id="calendar.work-band-add" size={12} />
              </button>
              {wd <= 5 && list.length > 0 && (
                <button type="button" onClick={() => copyToAllWorkdays(wd)}
                  className="p-1 hover:bg-surface-hover rounded-[6px] text-text-secondary" title={tCommon('calendar.worktime.copyToAll')}>
                  <Icon id="calendar.copy-workdays" size={12} />
                </button>
              )}
            </div>
            {list.length === 0 ? (
              <span className="!text-small text-text-secondary italic pl-8">{tCommon('calendar.worktime.noBands')}</span>
            ) : (
              list.map((b, idx) => {
                const { minutes: endMinutes, nextDay } = bandEndField(b.end);
                return (
                  <div key={idx} className="flex items-center gap-1.5 pl-8" data-ops-band>
                    <MinuteTimeInput minutes={b.start % 1440} className={timeCls}
                      ariaLabel={tCommon('calendar.worktime.bandStart')}
                      increaseLabel={tCommon('calendar.simpleBreak.increaseTime')}
                      decreaseLabel={tCommon('calendar.simpleBreak.decreaseTime')}
                      dataAttribute="band-start"
                      onCommit={(m) => updateBand(wd, idx, { start: m })} />
                    <span className="text-text-secondary">–</span>
                    <MinuteTimeInput minutes={endMinutes} endOfDay className={timeCls}
                      ariaLabel={tCommon('calendar.worktime.bandEnd')}
                      increaseLabel={tCommon('calendar.simpleBreak.increaseTime')}
                      decreaseLabel={tCommon('calendar.simpleBreak.decreaseTime')}
                      dataAttribute="band-end"
                      onCommit={(m) => updateBand(wd, idx, { end: bandEndAfterEdit(b.start, m, nextDay) })} />
                    <label className="flex items-center gap-1 !text-small text-text-secondary">
                      <input type="checkbox" checked={nextDay} disabled={b.end === 1440} className="accent-accent"
                        data-ops-band-next-day
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          updateBand(wd, idx, { end: bandEndFromField(endMinutes, checked) });
                        }} />
                      {tCommon('calendar.worktime.nextDay')}
                    </label>
                    <button type="button" onClick={() => removeBand(wd, idx)}
                      className="p-1 hover:bg-surface-hover rounded-[6px] text-text-secondary" title={tCommon('delete')}>
                      <Icon id="edit.delete" size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
      {hasBreak && (
        <span className="!text-small text-text-secondary italic" data-ops-break-hint>
          {tCommon('calendar.worktime.breakHint')}
        </span>
      )}
    </div>
  );
}
