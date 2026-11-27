import { createContext, Fragment, useContext, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconId } from '@/components/icons';

export function StudioSwitch({ checked, onChange, label, sub, title, disabled, dataKey, focusSeq }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  sub?: ReactNode;
  title?: string;
  disabled?: boolean;
  dataKey?: string;
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
  ariaLabel?: string;
  title?: string;
}

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

export interface ChoiceOption<T extends string> {
  value: T;
  title: ReactNode;
  text?: ReactNode;
  count?: ReactNode;
  icon?: ReactNode;
  groupLabel?: ReactNode;
  groupInfo?: { text: string; label: string };
  dataLayout?: string;
}

export function StudioChoiceGroup<T extends string>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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

const StepMountedContext = createContext<{ readonly current: boolean } | null>(null);

export function StudioStepScroll({ className, children, ...rest }: {
  className: string;
  children: ReactNode;
  id?: string;
  'data-rs-step-body'?: string;
  'data-rs-pop-body'?: boolean;
}) {
  const mounted = useRef(false);
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

const NOTE_TONE = { warn: 'ops-note--warning', info: 'ops-note--info', error: 'rs-note--error' } as const;

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

export function StudioGroup({ label, children }: { label?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div className="rs-group" role="group" aria-labelledby={label ? id : undefined}>
      {label && <div className="ui-card-header rs-group-label" id={id}>{label}</div>}
      {children}
    </div>
  );
}

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
