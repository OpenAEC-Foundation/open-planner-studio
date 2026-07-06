import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Select } from '@/components/common/Select';
import { HOLIDAY_SETS, type HolidayCountry } from '@/engine/calendar/holidays';
import {
  materializeHolidays, type HolidayGenParams, type BouwvakChoice, type GeneratorCountry,
} from '@/engine/calendar/generateCalendarHolidays';

const COUNTRIES: HolidayCountry[] = ['NL', 'DE', 'BE', 'FR', 'UK', 'AT', 'CH'];
const BOUWVAK_CHOICES: BouwvakChoice[] = ['geen', 'noord', 'midden', 'zuid'];
/** i18n-sleutels (§11) gebruiken `none` voor de "geen bouwvak"-keuze; de interne `BouwvakChoice`
 *  gebruikt `'geen'` (matcht `generateRegionalBreak`/`CalendarGeneration.breakChoice`). */
const BOUWVAK_I18N_KEY: Record<BouwvakChoice, 'none' | 'noord' | 'midden' | 'zuid'> = {
  geen: 'none', noord: 'noord', midden: 'midden', zuid: 'zuid',
};

/**
 * Gedeelde feestdagen-generator-velden (ontwerp §7.1/§7.2): land/regio, NL-bouwvak
 * (default GEEN — harde eis TODO.md r192-194) en een compacte preview met uitklapbare
 * lijst. Hergebruikt door de wizard (`ProjectInfoDialog`) en `CalendarForm`
 * ("Feestdagen genereren…"). Store-loos, puur presentational.
 */
export function CalendarGeneratorFields({
  value,
  onChange,
  fromYear,
  toYear,
  /** `'none'` optie tonen (wizard: "Geen feestdagen"); CalendarForm heeft die niet nodig
   *  omdat een lege generatie daar zinledig is (je bewerkt al een bestaande kalender). */
  allowNone = true,
  /** Overschrijft het label van de `'none'`-optie (wizard gebruikt de eigen `menu:wizard.calendar.none`). */
  noneLabel,
  /** Extra, ondoorzichtige land-opties (wizard: "Aangepast…") — de aanroeper rendert zelf wat er
   *  gebeurt als zo'n optie gekozen wordt; deze component toont dan alleen de kale select. */
  extraCountryOptions = [],
}: {
  value: Omit<HolidayGenParams, 'country'> & { country: string };
  onChange: (patch: Partial<HolidayGenParams>) => void;
  fromYear: number;
  toYear: number;
  allowNone?: boolean;
  noneLabel?: string;
  extraCountryOptions?: { value: string; label: string }[];
}) {
  const { t: tCommon } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);

  const isKnownCountry = value.country === 'none' || (COUNTRIES as string[]).includes(value.country);
  const set = isKnownCountry && value.country !== 'none' ? HOLIDAY_SETS[value.country as HolidayCountry] : undefined;
  const hasRegions = !!set?.regions && set.regions.length > 0;

  const countryOptions = [
    ...COUNTRIES.map(c => ({ value: c, label: tCommon(`calendar.countryName.${c}` as 'calendar.countryName.NL') })),
    ...(allowNone ? [{ value: 'none', label: noneLabel ?? tCommon('calendar.countryName.none') }] : []),
    ...extraCountryOptions,
  ];

  const preview = useMemo(
    () => (isKnownCountry ? materializeHolidays(value as HolidayGenParams, fromYear, toYear) : { holidays: [], generation: undefined }),
    [value, fromYear, toYear, isKnownCountry],
  );

  return (
    <div className="flex flex-col gap-3 text-xs" data-ops-calendar-generator>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tCommon('calendar.generate.country')}</label>
          <Select
            aria-label={tCommon('calendar.generate.country')}
            value={value.country}
            onChange={v => onChange({
              country: v as GeneratorCountry,
              region: undefined,
              // Bouwvak is alleen zinvol bij NL — verlaat het land, reset de keuze.
              ...(v !== 'NL' ? { bouwvak: 'geen' as BouwvakChoice } : {}),
            })}
            options={countryOptions}
          />
        </div>
        {hasRegions && (
          <div className="flex flex-col gap-1">
            <label className="text-text-secondary font-medium">{tCommon('calendar.generate.region')}</label>
            <Select
              aria-label={tCommon('calendar.generate.region')}
              value={value.region ?? ''}
              onChange={v => onChange({ region: v || undefined })}
              options={[
                { value: '', label: tCommon('calendar.generate.regionNone') },
                ...(set!.regions ?? []).map(r => ({ value: r.id, label: r.name })),
              ]}
            />
          </div>
        )}
      </div>

      {value.country === 'NL' && (
        <div className="flex flex-col gap-1">
          <label className="text-text-secondary font-medium">{tCommon('calendar.generate.bouwvakLabel')}</label>
          <div className="flex gap-1.5">
            {BOUWVAK_CHOICES.map(choice => {
              const active = value.bouwvak === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onChange({ bouwvak: choice })}
                  className={
                    'px-2.5 py-1.5 rounded-[8px] border-[1.5px] transition-colors ' +
                    (active
                      ? 'bg-accent text-white border-accent shadow-[var(--shadow-glow)]'
                      : 'bg-surface border-[var(--theme-control-border)] text-text-secondary hover:bg-surface-hover')
                  }
                >
                  {tCommon(`calendar.generate.bouwvak.${BOUWVAK_I18N_KEY[choice]}` as 'calendar.generate.bouwvak.none')}
                </button>
              );
            })}
          </div>
          {value.bouwvak !== 'geen' && (
            <span className="text-[11px] italic text-text-secondary">
              {tCommon('calendar.generate.bouwvakHint')}
            </span>
          )}
        </div>
      )}

      {/* Compacte preview (§7.2): samenvattingsregel + uitklapbare lijst i.p.v. een volle tabel.
          Onbekende/ondoorzichtige landkeuzes ("Aangepast…") hebben geen zinvolle preview. */}
      {isKnownCountry && (
      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary"
          disabled={preview.holidays.length === 0}
        >
          {preview.holidays.length > 0 ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : null}
          <span>
            {preview.holidays.length === 0
              ? tCommon('calendar.countryName.none')
              : tCommon('calendar.generate.preview', { n: preview.holidays.length, from: fromYear, to: toYear })}
          </span>
        </button>
        {expanded && preview.holidays.length > 0 && (
          <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 pl-5">
            {preview.holidays.map((h, i) => (
              <div key={i} className="flex justify-between gap-2 text-[11px] text-text-secondary">
                <span className="truncate">{h.name}</span>
                <span className="shrink-0">{h.startDate}{h.endDate !== h.startDate ? ` – ${h.endDate}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
