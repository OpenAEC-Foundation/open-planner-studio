import { useEffect, useRef, useState } from 'react';

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
