import { useEffect, useRef, useState } from 'react';

/**
 * Invoervelden die de store pas raken als een bewerking áf is, zodat één bewerking één undo-stap is
 * (in plaats van één per toetsaanslag of sleepstap). Tussentijds toont het veld een lokale draft, die
 * een externe wijziging (undo, andere weergave) volgt. Zelfde patroon als de naam-/eenheiddrafts in
 * `ResourceRow` (ResourcePanel.tsx).
 */

/**
 * Kleurkiezer die pas bij het KIEZEN committeert. React's `onChange` is op een `<input type="color">`
 * het native `input`-event, dat de browser tijdens het slepen in de kiezer per tussenkleur vuurt; het
 * native `change`-event komt één keer per gekozen kleur.
 */
export function CommitColorInput({ value, onCommit, label, className }: {
  value: string;
  onCommit: (color: string) => void;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const commit = () => { if (el.value.toLowerCase() !== value.toLowerCase()) onCommit(el.value); };
    el.addEventListener('change', commit);
    return () => el.removeEventListener('change', commit);
  }, [value, onCommit]);
  return (
    <input
      ref={ref}
      type="color"
      aria-label={label}
      title={label}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      className={className}
    />
  );
}

/**
 * Tekstveld dat committeert bij het verlaten van het veld of Enter. Verdwijnt het veld terwijl er nog
 * een ongecommitte draft staat (Escape sluit de dialoog zonder blur-event), dan wordt die alsnog
 * gecommit: wat getypt is, blijft staan — zoals toen elke toets direct de store in ging.
 */
export function CommitTextInput({ value, onCommit, className, placeholder }: {
  value: string;
  onCommit: (text: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  const latest = useRef({ draft, value, onCommit });
  useEffect(() => { latest.current = { draft, value, onCommit }; });
  useEffect(() => () => {
    const pending = latest.current;
    if (pending.draft !== pending.value) pending.onCommit(pending.draft);
  }, []);
  return (
    <input
      className={className}
      value={draft}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); }}
    />
  );
}
