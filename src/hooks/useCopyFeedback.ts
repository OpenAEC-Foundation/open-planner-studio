import { useCallback, useState } from 'react';

/**
 * Terugval als de klembord-API ontbreekt of weigert (geen secure context, zoals de dev-server via
 * http, of headless zonder permissie): kopiëren via een verborgen textarea. `true` als de browser
 * het kopiëren meldt. De focus gaat terug naar het element dat hem had (de knop).
 */
export function copyViaTextarea(text: string): boolean {
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { /* geef op */ }
  document.body.removeChild(ta);
  focused?.focus();
  return copied;
}

/**
 * Kopiëren naar het klembord met een tijdelijke "gekopieerd"-markering. `copiedKey` is de sleutel
 * van de knop die net kopieerde (meerdere kopieerknoppen delen zo één staat) en valt na `resetMs`
 * terug op `null` — tenzij er intussen een andere knop kopieerde.
 *
 * `copy` geeft `false` als het klembord ontbreekt of weigert; wie een eigen terugval heeft (de
 * benchmark kopieert dan via een verborgen textarea) roept daarna `markCopied` zelf aan.
 */
export function useCopyFeedback(resetMs: number) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const markCopied = useCallback((key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(current => (current === key ? null : current)), resetMs);
  }, [resetMs]);

  const copy = useCallback(async (text: string, key = 'copied'): Promise<boolean> => {
    if (!navigator.clipboard) return false;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }
    markCopied(key);
    return true;
  }, [markCopied]);

  const resetCopied = useCallback(() => setCopiedKey(null), []);

  return { copiedKey, copy, markCopied, resetCopied };
}
