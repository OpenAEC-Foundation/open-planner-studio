import { useCallback, useState } from 'react';

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
