import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatDecimalInput, isAmbiguousThousands, parseNonNegativeDecimal, parsePositiveDecimal } from '@/utils/decimalInput';
import { mountedPendingTextEdits } from '@/state/pendingTextEdits';

type UnitsInputProps = {
  value: number;
  onCommit: (n: number) => void;
} & SharedInputProps;

type AmountInputProps = {
  value: number | undefined;
  onCommit: (n: number | undefined) => void;
} & SharedInputProps;

export function UnitsInput(props: UnitsInputProps) {
  const { onCommit } = props;
  return <DecimalInput {...props} mode="positive" onCommit={n => { if (n !== undefined) onCommit(n); }} />;
}

export function AmountInput(props: AmountInputProps) {
  return <DecimalInput {...props} mode="amount" />;
}

type SharedInputProps = {
  className?: string;
  title?: string;
  ariaLabel?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  gridCell?: string;
  locale?: string;
  commitOnBlur?: boolean;
  accepts?: (n: number) => boolean;
  onAmbiguous?: (text: string) => void;
};

const EMPTY = Symbol('empty');

function DecimalInput({
  value, onCommit, className = '', title, ariaLabel, onKeyDown, gridCell, locale, commitOnBlur = false, accepts,
  onAmbiguous, mode,
}: SharedInputProps & {
  value: number | undefined;
  onCommit: (n: number | undefined) => void;
  mode: 'positive' | 'amount';
}) {
  const [draft, setDraftState] = useState<string | null>(null);
  const shownValue = value === undefined ? '' : locale ? formatDecimalInput(value, locale) : String(value);
  const text = draft ?? shownValue;
  const ambiguous = (s: string) => !!locale && isAmbiguousThousands(s, locale);
  const parseValid = (s: string): number | typeof EMPTY | null => {
    if (mode === 'amount' && s.trim() === '') return EMPTY;
    if (ambiguous(s)) return null;
    const n = mode === 'amount' ? parseNonNegativeDecimal(s) : parsePositiveDecimal(s);
    return n !== null && (!accepts || accepts(n)) ? n : null;
  };
  const invalid = draft !== null && parseValid(draft) === null;

  const draftRef = useRef<string | null>(null);
  const latest = useRef({ value, shownValue, onCommit, parseValid, ambiguous, onAmbiguous });
  latest.current = { value, shownValue, onCommit, parseValid, ambiguous, onAmbiguous };
  const setDraft = (d: string | null) => { draftRef.current = d; setDraftState(d); };

  const flush = () => {
    const d = draftRef.current;
    draftRef.current = null;
    if (d === null) return;
    const { value: v, shownValue: shown, onCommit: commit, parseValid: parse } = latest.current;
    if (d.trim() === shown) return;
    if (latest.current.ambiguous(d)) { latest.current.onAmbiguous?.(d.trim()); return; }
    const n = parse(d);
    if (n === EMPTY) { if (v !== undefined) commit(undefined); return; }
    if (n !== null && n !== v) commit(n);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij unmount; leest via refs
  useEffect(() => () => { if (commitOnBlur) flush(); }, []);

  useEffect(() => {
    if (!commitOnBlur) return;
    return mountedPendingTextEdits.register({
      commit: () => {
        if (draftRef.current === null) return;
        flush();
        setDraftState(null);
      },
    });
  }, [commitOnBlur]);

  return (
    <input
      {...(locale
        ? { type: 'text', inputMode: 'decimal' as const }
        : { type: 'number', min: '0', step: 'any' })}
      value={text}
      onFocus={event => {
        if (event.currentTarget.dataset.opsRefocus !== 'true') event.currentTarget.select();
      }}
      title={title}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      data-ops-grid-cell={gridCell}
      data-ops-app-keys={commitOnBlur && draft === null ? 'true' : undefined}
      onKeyDown={e => {
        if (commitOnBlur && e.key === 'Enter') {
          e.preventDefault();
          flush();
          e.currentTarget.blur();
        } else if (commitOnBlur && e.key === 'Escape' && draftRef.current !== null) {
          e.stopPropagation();
          draftRef.current = null;
          e.currentTarget.blur();
          return;
        }
        onKeyDown?.(e);
      }}
      onChange={e => {
        setDraft(e.target.value);
        if (!commitOnBlur) {
          const n = parseValid(e.target.value);
          if (n !== null && n !== EMPTY) onCommit(n);
        }
      }}
      onBlur={() => {
        if (commitOnBlur) flush();
        setDraft(null);
      }}
      className={className}
      style={{
        ['--ops-num-chars' as string]: text.length,
        ...(invalid ? { borderColor: 'var(--error)', boxShadow: '0 0 0 1px var(--error)' } : {}),
      }}
    />
  );
}
