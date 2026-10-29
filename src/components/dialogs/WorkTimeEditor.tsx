import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { WorkTimeBands } from '@/types/calendar';
import { ISO_WEEK_DAYS, orderedWeekDays } from '@/utils/weekDays';
import { MinuteTimeInput } from '@/components/common/TimeInput';
import { formatReportNumber } from '@/utils/reportNumber';
type WD = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Blokeinde ⇄ eindveld, in één domein. Een blokeinde is een minuut-vanaf-middernacht van de begindag:
 * tot en met 1440 (= 24:00, middernacht) op dezelfde dag, daarboven "volgende dag" (een nachtblok,
 * bv. 1800 = 06:00 volgende dag). Het eindveld toont een einde tot en met 1440 als dagtijd met
 * `endOfDay` (24:00 of 12:00 AM), en een nachtblok als tijd op de volgende dag (0..1439).
 */
export function bandEndField(end: number): { minutes: number; nextDay: boolean } {
  return end > 1440 ? { minutes: end - 1440, nextDay: true } : { minutes: end, nextDay: false };
}

/** Getypte of gestapte tijd in het eindveld → blokeinde. Zie {@link bandEndField}. */
export function bandEndFromField(minutes: number, nextDay: boolean): number {
  return nextDay ? minutes + 1440 : minutes;
}

/**
 * Blokeinde na typen of stappen in het eindveld. Middernacht (`24:00`, `12:00 AM`, `0:00` bij een
 * nachtblok) is altijd 1440. Verder: een einde op of vóór het begin ligt op de volgende dag, dezelfde
 * regel als `canonicalizeBands` (`subdayIo.ts`) bij het inlezen. Zo wordt 22:00–24:00 met een getypt
 * einde `02:00` een nachtblok tot 1560, en geen blok van 22:00 terug naar 02:00 (−20 uur). Omgekeerd
 * wordt een blok nooit langer dan 24 uur: een nachtblok 22:00–06:00 met getypt einde `23:00` wordt
 * 22:00–23:00 op dezelfde dag (1380), niet 2820.
 */
export function bandEndAfterEdit(start: number, typed: number, nextDay: boolean): number {
  if (typed === 1440) return 1440;
  const end = bandEndFromField(typed, nextDay);
  if (end <= start) return end + 1440;
  // Een blok is nooit langer dan 24 uur: 22:00–06:00 (volgende dag) met getypt einde 23:00 is 22:00–23:00.
  return end - start > 1440 ? end - 1440 : end;
}

/**
 * Volledige banden-editor — achter "Per weekdag instellen…". Per ISO-weekdag een
 * lijst `{start,end}`-banden (tijdvelden volgens de instelling Tijdnotatie), een nachtploeg-toggle ("volgende dag" = band die
 * middernacht kruist, `end += 1440`), meerdere banden per dag (pauze), "kopieer naar alle
 * werkdagen" en de som per weekdag.
 *
 * Zuiver presentational: muteert alleen via `onChange` (buffer-model van de kalenderdialoog).
 */
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
  // Toont de pauze-hint zodra een werkdag meer dan één band heeft (een gat = pauze). Dekt de
  // afgeleide pauze uit de scalar-seed én handmatig toegevoegde pauzes.
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
              <span className="!text-small text-text-secondary italic pl-8">{tCommon('calendar.worktime.noBands')}</span>
            ) : (
              list.map((b, idx) => {
                // 1440 = 24:00 is middernacht aan het eind van de dag, géén "volgende dag".
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
                      {/* Een blok tot 24:00 eindigt al om middernacht: "volgende dag" heeft dan geen
                          betekenis en staat uit. Doorlopen na middernacht: typ een eindtijd vóór het
                          begin (02:00 bij 22:00), dan wordt het vanzelf "volgende dag". */}
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
                      <Trash2 size={12} />
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
