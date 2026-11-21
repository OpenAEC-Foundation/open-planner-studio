import { createContext, Fragment, useContext, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconId } from '@/components/icons';

// Bouwstenen van de stappen in de zijbalk van het Rapport-tabblad. Elk onderdeel is een
// gewoon formulierelement (checkbox, radiogroep) met toetsenbordbediening: Tab, Spatie/Enter en de
// pijltjes in een keuzegroep.

/** Aan/uit-schakelaar: het vinkje van de app (een echte checkbox). */
export function StudioSwitch({ checked, onChange, label, sub, title, disabled, dataKey, focusSeq }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  /** Korte uitleg onder het label. */
  sub?: ReactNode;
  /** Uitleg in de tooltip, als het label op zich duidelijk is en de regel niet hoger mag worden. */
  title?: string;
  disabled?: boolean;
  /** `data-rs-option` voor tests en het papier. */
  dataKey?: string;
  /** Een nieuw getal zet de focus op dit vinkje (een klik op het deel van het papier dat het aanzet). */
  focusSeq?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSeq === undefined) return;
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [focusSeq]);
  return (
    <label className="rs-check" title={title} data-rs-switch={dataKey}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        data-rs-option={dataKey}
      />
      <span className="rs-check-label">
        {label}
        {sub && <span className="rs-hint block">{sub}</span>}
      </span>
    </label>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Toegankelijke naam als `label` een pictogram is. */
  ariaLabel?: string;
  title?: string;
}

/** Gesegmenteerde keuze (radiogroep): pijltjes links/rechts kiezen, Tab verlaat de groep. */
export function StudioSegmented<T extends string>({ value, options, onChange, ariaLabel, disabled, dataKey }: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  dataKey?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const dir = (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && rtl ? -step : step;
    const next = (index + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="rs-seg" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} data-rs-segmented={dataKey}>
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={el => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.ariaLabel}
          title={option.title}
          tabIndex={i === index ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          data-rs-value={option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Eén keuze in de stap Taken. `text` maakt er een kaart van; zonder `text` is het een regel (een layout). */
export interface ChoiceOption<T extends string> {
  value: T;
  title: ReactNode;
  text?: ReactNode;
  count?: ReactNode;
  /** Icoon vóór de titel (de layouts, met hetzelfde icoon als op het lint). */
  icon?: ReactNode;
  /** Kopje vóór deze keuze (bijv. "Layouts"); hoort bij dezelfde radiogroep, dus de pijltjes lopen door. */
  groupLabel?: ReactNode;
  /** Een i-icoon naast het kopje met deze uitleg als tooltip (eerste regel vet), en zijn toegankelijke naam. */
  groupInfo?: { text: string; label: string };
  /** `data-rs-layout` voor tests. */
  dataLayout?: string;
}

/** Keuzes in één radiogroep (stap Taken): pijltjes kiezen, Tab verlaat de groep. */
export function StudioChoiceGroup<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Alleen vanaf een keuze: de pijltjes op het i-icoon bij een kopje kiezen niets.
    if ((e.target as HTMLElement).getAttribute('role') !== 'radio') return;
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="rs-choices" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {options.map((option, i) => (
        <Fragment key={option.value}>
          {option.groupLabel && (
            <div className="ui-card-header rs-group-label rs-choices-label">
              <span aria-hidden="true">{option.groupLabel}</span>
              {/* Het i-icoon van de app (TooltipHost, `data-tooltip-instant`): hover, focus, klik of tik. */}
              {option.groupInfo && (
                <button type="button" className="rs-info-btn" title={option.groupInfo.text}
                  aria-label={option.groupInfo.label} data-tooltip-instant="true" data-tooltip-lead="true" data-rs-group-info>
                  <Icon id="help.context-hint" size={14} aria-hidden />
                </button>
              )}
            </div>
          )}
          <button
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            tabIndex={i === index ? 0 : -1}
            className="rs-choice"
            data-compact={option.text ? undefined : 'true'}
            onClick={() => onChange(option.value)}
            data-rs-value={option.value}
            data-rs-layout={option.dataLayout}
          >
            <span className="rs-radio" aria-hidden="true" />
            <span className="rs-choice-title">{option.icon}{option.title}</span>
            <span className="rs-count">{option.count}</span>
            {option.text && <span className="rs-choice-text">{option.text}</span>}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Of de stap al stond toen een melding verscheen. Een melding die later komt dan de stap zelf (na een keuze
 * in de stap) schuift in beeld; een melding die er bij het openen al is, laat de stap bovenaan staan.
 */
const StepMountedContext = createContext<{ readonly current: boolean } | null>(null);

/**
 * Het scrollvak van een stap (zijbalk en zwevend venster). Een nieuwe melding erin komt vanzelf in beeld,
 * ook als de stap op een laag scherm moet scrollen.
 */
export function StudioStepScroll({ className, children, ...rest }: {
  className: string;
  children: ReactNode;
  id?: string;
  'data-rs-step-body'?: string;
  'data-rs-pop-body'?: boolean;
}) {
  const mounted = useRef(false);
  // Na de eerste render: kinderen zetten hun effect vóór dit effect, dus wat er bij het openen al staat,
  // ziet hier nog `false`.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return (
    <StepMountedContext.Provider value={mounted}>
      <div className={className} {...rest}>{children}</div>
    </StepMountedContext.Provider>
  );
}

/** De tint van een melding: het blok `.ops-note` van de app, met de accentbalk in de kleur van de toon. */
const NOTE_TONE = { warn: 'ops-note--warning', info: 'ops-note--info', error: 'rs-note--error' } as const;

/** Melding in de stap waar je hem oplost, direct onder de keuze die hem geeft, met optionele acties. */
export function StudioNotice({ tone = 'warn', children, actions, dataKey }: {
  tone?: 'warn' | 'info' | 'error';
  children: ReactNode;
  actions?: ReactNode;
  dataKey?: string;
}) {
  const iconId: IconId = tone === 'error' ? 'status.error' : tone === 'info' ? 'status.info' : 'status.warning';
  const stepMounted = useContext(StepMountedContext);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Verschijnt hij na een keuze in een open stap, dan in beeld (de stap kan op een laag scherm scrollen).
    if (stepMounted?.current) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [stepMounted]);
  return (
    <div ref={ref} className={`ops-note ${NOTE_TONE[tone]} rs-note`} role={tone === 'error' ? 'alert' : 'status'} data-rs-notice={dataKey}>
      <Icon id={iconId} size={14} aria-hidden />
      <div className="ops-note-lines">
        <span>{children}</span>
        {actions && <div className="rs-note-actions">{actions}</div>}
      </div>
    </div>
  );
}

/** Groep met een klein kopje. */
export function StudioGroup({ label, children }: { label?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div className="rs-group" role="group" aria-labelledby={label ? id : undefined}>
      {label && <div className="ui-card-header rs-group-label" id={id}>{label}</div>}
      {children}
    </div>
  );
}

/**
 * Balk boven het papier voor wat over het hele rapport gaat (de planning is niet doorgerekend, of heeft
 * een fout), met één actie. Staat in beide standen van de zijbalk in beeld.
 */
export function PaperBanner({ tone, children, action, dataKey }: {
  tone: 'warn' | 'error';
  children: ReactNode;
  action?: ReactNode;
  dataKey: string;
}) {
  return (
    <div className={`ops-note ${NOTE_TONE[tone]} rs-banner`} role={tone === 'error' ? 'alert' : 'status'} data-rs-banner={dataKey}>
      <Icon id={tone === 'error' ? 'status.error' : 'status.warning'} size={16} aria-hidden />
      <span className="rs-banner-text">{children}</span>
      {action}
    </div>
  );
}
