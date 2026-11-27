import { useState } from 'react';
import { Icon } from '@/components/icons';
import { useTimeNotation } from '@/hooks/displayDate';
import { clockPlaceholder, formatClock, parseClock } from '@/utils/displayTime';

export const TIME_STEP_MINUTES = 15;

type DataAttributes = Record<`data-${string}`, string | boolean | undefined>;

export function StepButtons({ onStep, increaseLabel, decreaseLabel, dataAttribute }: {
  onStep: (delta: number) => void;
  increaseLabel: string;
  decreaseLabel: string;
  dataAttribute: string;
}) {
  return <span className="flex w-5 shrink-0 flex-col gap-0.5">
    <button type="button" className="flex flex-1 items-center justify-center rounded border border-[var(--theme-control-border)] text-text-secondary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent" aria-label={increaseLabel} title={increaseLabel} onClick={() => onStep(TIME_STEP_MINUTES)} data-ops-scalar-time-step={`${dataAttribute}-up`}>
      <Icon id="input.time-increase" size={11} aria-hidden="true" />
    </button>
    <button type="button" className="flex flex-1 items-center justify-center rounded border border-[var(--theme-control-border)] text-text-secondary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent" aria-label={decreaseLabel} title={decreaseLabel} onClick={() => onStep(-TIME_STEP_MINUTES)} data-ops-scalar-time-step={`${dataAttribute}-down`}>
      <Icon id="input.time-decrease" size={11} aria-hidden="true" />
    </button>
  </span>;
}

export function TimeInput({
  id,
  value,
  onTextChange,
  onCommit,
  onStep,
  increaseLabel,
  decreaseLabel,
  className,
  dataAttribute,
  ariaLabel,
  dataAttributes,
}: {
  id?: string;
  value: string;
  onTextChange: (value: string) => void;
  onCommit: () => void;
  onStep: (delta: number) => void;
  increaseLabel: string;
  decreaseLabel: string;
  className: string;
  dataAttribute: string;
  ariaLabel?: string;
  dataAttributes?: DataAttributes;
}) {
  const notation = useTimeNotation();
  return (
    <div className="flex min-w-0 items-stretch gap-1">
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={clockPlaceholder(notation)}
        aria-label={ariaLabel}
        value={value}
        onChange={event => onTextChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onCommit();
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            onStep(event.key === 'ArrowUp' ? TIME_STEP_MINUTES : -TIME_STEP_MINUTES);
          }
        }}
        className={className + ' min-w-0 flex-1'}
        data-ops-time-input={dataAttribute}
        data-ops-time-notation={notation}
        {...dataAttributes}
      />
      <StepButtons onStep={onStep} increaseLabel={increaseLabel} decreaseLabel={decreaseLabel} dataAttribute={dataAttribute} />
    </div>
  );
}

export function MinuteTimeInput({
  minutes,
  onCommit,
  endOfDay = false,
  ...rest
}: {
  minutes: number;
  onCommit: (minutes: number) => void;
  endOfDay?: boolean;
  increaseLabel: string;
  decreaseLabel: string;
  className: string;
  dataAttribute: string;
  ariaLabel?: string;
  dataAttributes?: DataAttributes;
}) {
  const notation = useTimeNotation();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseClock(draft, { endOfDay });
    setDraft(null);
    if (parsed !== undefined && parsed !== minutes) onCommit(parsed);
  };
  const step = (delta: number) => {
    const current = draft === null ? minutes : parseClock(draft, { endOfDay }) ?? minutes;
    const next = current + delta;
    if (next < 0 || next > (endOfDay ? 1440 : 1439)) return;
    setDraft(null);
    onCommit(next);
  };

  return (
    <TimeInput
      {...rest}
      value={draft ?? formatClock(minutes, notation, { endOfDay })}
      onTextChange={setDraft}
      onCommit={commit}
      onStep={step}
    />
  );
}
