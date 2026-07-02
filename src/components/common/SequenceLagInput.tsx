import { useEffect, useState } from 'react';
import type { Sequence } from '@/types/sequence';
import { formatLagShort, parseLagInput } from '@/utils/lagFormat';

/**
 * Klein lag-invoerveld met MSP-notatie (2d / 3ed / 50% / -25e%); commit op blur/Enter,
 * herstelt de oude waarde bij onparseerbare invoer. Gedeeld door het eigenschappen-paneel
 * en de relatietabel.
 */
export function SequenceLagInput({ seq, title, className, onCommit }: {
  seq: Sequence;
  title: string;
  className?: string;
  onCommit: (patch: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent'>) => void;
}) {
  const [val, setVal] = useState(formatLagShort(seq));
  useEffect(() => {
    setVal(formatLagShort(seq));
  }, [seq.lagDays, seq.lagUnit, seq.lagPercent]);
  const commit = () => {
    const parsed = parseLagInput(val);
    if (parsed) {
      onCommit(parsed);
      setVal(formatLagShort(parsed));
    } else {
      setVal(formatLagShort(seq));
    }
  };
  return (
    <input
      value={val}
      title={title}
      placeholder="0d"
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onClick={e => e.stopPropagation()}
      className={className ?? 'input !text-[10px] !px-1 !py-0.5 w-14 text-right'}
    />
  );
}
