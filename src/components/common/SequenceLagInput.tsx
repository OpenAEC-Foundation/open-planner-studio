import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sequence } from '@/types/sequence';
import { formatLagShort, parseLagInput } from '@/utils/lagFormat';
import { parseableHourSuffix } from '@/utils/durationFormat';

function lagSignature(seq: Sequence): string {
  return [seq.lagDays, seq.lagUnit ?? '', seq.lagPercent ?? '', seq.lagMinutes ?? ''].join('|');
}

export function SequenceLagInput({ seq, title, className, onCommit, onDraftChange }: {
  seq: Sequence;
  title: string;
  className?: string;
  onCommit: (patch: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>) => void;
  onDraftChange?: (patch: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>) => void;
}) {
  const { t } = useTranslation('common');
  const hourSuffix = parseableHourSuffix(t('duration.suffixHour'));
  const [val, setVal] = useState(formatLagShort(seq, hourSuffix));
  const signature = lagSignature(seq);
  const formattedLagRef = useRef(formatLagShort(seq, hourSuffix));
  formattedLagRef.current = formatLagShort(seq, hourSuffix);
  useEffect(() => {
    setVal(formattedLagRef.current);
  }, [signature, hourSuffix]);
  const invalid = val !== '' && parseLagInput(val) === null;
  const commit = () => {
    const parsed = parseLagInput(val);
    if (parsed) {
      onCommit(parsed);
      setVal(formatLagShort(parsed, hourSuffix));
    } else {
      setVal(formatLagShort(seq, hourSuffix));
    }
  };
  return (
    <input
      value={val}
      title={title}
      aria-invalid={invalid || undefined}
      placeholder="0d"
      onChange={e => {
        const next = e.target.value;
        setVal(next);
        const parsed = parseLagInput(next);
        if (parsed) onDraftChange?.(parsed);
      }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onClick={e => e.stopPropagation()}
      className={className ?? 'input !text-small !px-1 !py-0.5 w-14 text-right'}
      style={invalid ? { borderColor: 'var(--error)', boxShadow: '0 0 0 1px var(--error)' } : undefined}
    />
  );
}
