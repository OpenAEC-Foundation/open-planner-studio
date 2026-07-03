import { useEffect, useState } from 'react';

/**
 * Strikt-positief eenheden-invoerveld (fase 2.5 UX-fix, bevinding 1). Houdt een lokale draft-string
 * bij zodat de gebruiker vrij kan typen, wijst 0/negatieve/lege waarden visueel af (rode rand) en
 * commit ALLEEN geldige (> 0, eindig) waarden naar de store — nooit een clamp naar 0. Bij blur op
 * een ongeldige waarde valt het veld terug op de laatst geldige (opgeslagen) waarde. Fracties zijn
 * toegestaan (materiaal-max.eenheden, halve-dag-toewijzingen), dus `step="any"`.
 */
export function UnitsInput({
  value, onCommit, className = '', title, ariaLabel,
}: {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const [focused, setFocused] = useState(false);

  // Zolang het veld niet in bewerking is, blijft de draft gelijk aan de opgeslagen waarde.
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const parsed = parseFloat(draft);
  const invalid = !(Number.isFinite(parsed) && parsed > 0);

  return (
    <input
      type="number"
      min="0"
      step="any"
      value={draft}
      title={title}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      onFocus={() => setFocused(true)}
      onChange={e => {
        setDraft(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n) && n > 0) onCommit(n);
      }}
      onBlur={() => {
        setFocused(false);
        if (invalid) setDraft(String(value));
      }}
      className={className}
      style={invalid ? { borderColor: 'var(--error)', boxShadow: '0 0 0 1px var(--error)' } : undefined}
    />
  );
}
