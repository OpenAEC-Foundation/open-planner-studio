import { useEffect, useRef, useState } from 'react';
import type { Sequence } from '@/types/sequence';
import { formatLagShort, parseLagInput } from '@/utils/lagFormat';

/** Alleen deze vier velden bepalen de zichtbare lagtekst; type- of eindpuntupdates doen dat niet. */
function lagSignature(seq: Sequence): string {
  return [seq.lagDays, seq.lagUnit ?? '', seq.lagPercent ?? '', seq.lagMinutes ?? ''].join('|');
}

/**
 * Klein lag-invoerveld met MSP-notatie (2d / 3ed / 2u / 50% / -25e%); commit op blur/Enter,
 * herstelt de oude waarde bij onparseerbare invoer (i.p.v. stil terug te springen zonder
 * feedback — de rode rand + title hieronder geven de gebruiker een zichtbare hint, hetzelfde
 * patroon als andere gevalideerde velden in dit paneel). Gedeeld door het eigenschappen-paneel
 * en de relatietabel.
 */
export function SequenceLagInput({ seq, title, className, onCommit, onDraftChange }: {
  seq: Sequence;
  title: string;
  className?: string;
  onCommit: (patch: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>) => void;
  /** Optioneel voor lokale concepten: houd een geldige invoer actueel vóór de blur-commit. */
  onDraftChange?: (patch: Pick<Sequence, 'lagDays' | 'lagUnit' | 'lagPercent' | 'lagMinutes'>) => void;
}) {
  const [val, setVal] = useState(formatLagShort(seq));
  const signature = lagSignature(seq);
  const formattedLagRef = useRef(formatLagShort(seq));
  formattedLagRef.current = formatLagShort(seq);
  useEffect(() => {
    setVal(formattedLagRef.current);
  }, [signature]);
  // Live-afgeleid (zoals `UnitsInput`): rood ZODRA de huidige tekst niet parseerbaar is — dus al
  // tíjdens het typen, niet pas na een stille terugval bij blur (F1-bevinding: het veld sprong
  // eerder terug zonder ENIGE indicatie dat de invoer geweigerd was).
  const invalid = val !== '' && parseLagInput(val) === null;
  const commit = () => {
    const parsed = parseLagInput(val);
    if (parsed) {
      onCommit(parsed);
      setVal(formatLagShort(parsed));
    } else {
      // Onparseerbare invoer: terugvallen op de laatst geldige waarde (bestaand gedrag) — de rode
      // rand hierboven heeft de weigering al zichtbaar gemaakt vóórdat dit gebeurt.
      setVal(formatLagShort(seq));
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
      className={className ?? 'input !text-[10px] !px-1 !py-0.5 w-14 text-right'}
      style={invalid ? { borderColor: 'var(--error)', boxShadow: '0 0 0 1px var(--error)' } : undefined}
    />
  );
}
