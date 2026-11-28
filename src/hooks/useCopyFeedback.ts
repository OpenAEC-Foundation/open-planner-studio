import { useCallback, useState } from 'react';

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
  try { copied = document.execCommand('copy'); } catch { }
  document.body.removeChild(ta);
  focused?.focus();
  return copied;
}

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
