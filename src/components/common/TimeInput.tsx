import { useState } from 'react';
import { B2Icon } from '@/components/common/B2Icon';
import { useTimeNotation } from '@/hooks/displayDate';
import { clockPlaceholder, formatClock, parseClock } from '@/utils/displayTime';

/** Stapgrootte van de pijltjes en de stapknoppen: een kwartier. */
export const TIME_STEP_MINUTES = 15;

type DataAttributes = Record<`data-${string}`, string | boolean | undefined>;

/** De twee kleine stapknoppen (omhoog/omlaag) naast een tijd- of duurveld. */
export function StepButtons({ onStep, increaseLabel, decreaseLabel, dataAttribute }: {
  onStep: (delta: number) => void;
  increaseLabel: string;
  decreaseLabel: string;
  dataAttribute: string;
}) {
  return <span className="flex w-5 shrink-0 flex-col gap-0.5">
    <button type="button" className="flex flex-1 items-center justify-center rounded border border-[var(--theme-control-border)] text-text-secondary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent" aria-label={increaseLabel} title={increaseLabel} onClick={() => onStep(TIME_STEP_MINUTES)} data-ops-scalar-time-step={`${dataAttribute}-up`}>
      <B2Icon name="input.time-increase" size={11} aria-hidden="true" />
    </button>
    <button type="button" className="flex flex-1 items-center justify-center rounded border border-[var(--theme-control-border)] text-text-secondary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent" aria-label={decreaseLabel} title={decreaseLabel} onClick={() => onStep(-TIME_STEP_MINUTES)} data-ops-scalar-time-step={`${dataAttribute}-down`}>
      <B2Icon name="input.time-decrease" size={11} aria-hidden="true" />
    </button>
  </span>;
}

/**
 * Het ene tijdveld van OPS: een gewoon tekstveld met stapknoppen. Een native `type="time"` laat de
 * browser de notatie kiezen (klokje, AM/PM); dit veld volgt altijd de instelling Tijdnotatie. De
 * plaatshouder volgt de notatie; wat de gebruiker typt, leest `parseClock` (beide notaties geldig).
 *
 * Bewust tekstgestuurd: de aanroeper bewaart de tusseninvoer en beslist bij `onCommit` (blur/Enter)
 * wat er met de tekst gebeurt. Voor een veld dat alleen minuten kent, is er {@link MinuteTimeInput}.
 */
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

/**
 * {@link TimeInput} voor een waarde in minuten-vanaf-middernacht (0..1439, of 1440 met `endOfDay`).
 *
 * Het veld toont de modelwaarde, tot de gebruiker typt: dan staat er een concept (`draft`). Pas bij
 * blur/Enter wordt het concept gelezen; een geldige, ándere waarde gaat naar `onCommit`, daarna toont
 * het veld weer het model. Zonder te typen (focus + Tab) is er geen concept en dus nooit een commit;
 * dezelfde waarde opnieuw typen (`12 am` op `12:00 AM`) commit ook niet. De stapknoppen en pijltjes
 * werken in hetzelfde domein als `minutes`: 0..1439, of tot en met 1440 met `endOfDay`.
 */
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
