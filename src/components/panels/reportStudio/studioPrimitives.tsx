import { createContext, useContext, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconId } from '@/components/icons';

// Bouwstenen van de stappen in de zijbalk van het nieuwe Rapport-tabblad. Elk onderdeel is een
// gewoon formulierelement (checkbox, radiogroep) met toetsenbordbediening: Tab, Spatie/Enter en de
// pijltjes in een keuzegroep.

/** Aan/uit-schakelaar: een echte checkbox, getekend als schakelaar. */
export function StudioSwitch({ checked, onChange, label, sub, title, disabled, dataKey }: {
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
}) {
  return (
    <label className="rs-switch" title={title} data-rs-switch={dataKey}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        data-rs-option={dataKey}
      />
      <span className="rs-switch-track" aria-hidden="true" />
      <span className="rs-switch-label">
        {label}
        {sub && <span className="rs-switch-sub">{sub}</span>}
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

/** Keuzekaart in een radiogroep (stap Taken): titel, uitleg en een aantal rechts. */
export function StudioChoiceGroup<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: readonly { value: T; title: ReactNode; text: ReactNode; count?: ReactNode }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={el => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={i === index ? 0 : -1}
          className="rs-choice"
          onClick={() => onChange(option.value)}
          data-rs-value={option.value}
        >
          <span className="rs-radio" aria-hidden="true" />
          <span className="rs-choice-title">{option.title}</span>
          <span className="rs-count">{option.count}</span>
          <span className="rs-choice-text">{option.text}</span>
        </button>
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
    <div ref={ref} className="rs-warn" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'} data-rs-notice={dataKey}>
      <Icon id={iconId} size={14} />
      <div>
        {children}
        {actions && <div className="rs-warn-actions">{actions}</div>}
      </div>
    </div>
  );
}

/** Groep met een klein kopje. */
export function StudioGroup({ label, children }: { label?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div className="rs-group" role="group" aria-labelledby={label ? id : undefined}>
      {label && <div className="rs-group-label" id={id}>{label}</div>}
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
    <div className="rs-banner" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'} data-rs-banner={dataKey}>
      <Icon id={tone === 'error' ? 'status.error' : 'status.warning'} size={16} />
      <span className="rs-banner-text">{children}</span>
      {action}
    </div>
  );
}
