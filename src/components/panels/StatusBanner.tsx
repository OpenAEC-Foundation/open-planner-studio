import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

const TONES = {
  // Een echte waarschuwing: semantische --warning-token + per-thema --theme-warning-text, leesbaar
  // in alle drie de thema's.
  warning: {
    className: 'flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium',
    style: {
      background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
      borderColor: 'var(--warning)',
      color: 'var(--theme-warning-text)',
    },
    role: 'alert',
  },
  // Informatief, geen fout: de bestaande "dim"-stijl.
  dim: {
    className: 'flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium text-text-secondary',
    style: {
      background: 'color-mix(in srgb, var(--theme-text-dim) 12%, transparent)',
      borderColor: 'var(--theme-text-dim)',
    },
    role: 'status',
  },
} as const;

/**
 * Banner met driehoek-icoon boven een resourcetabel (Bibliotheek- en Bezettingsweergave).
 * `warning` is een waarschuwing (`role="alert"`), `dim` een melding (`role="status"`).
 */
export function StatusBanner({ tone, children, bannerProps }: {
  tone: keyof typeof TONES;
  children: ReactNode;
  /** Data-attribuut voor de self-test-harness. */
  bannerProps?: Record<string, unknown>;
}) {
  const { className, style, role } = TONES[tone];
  return (
    <div className={className} style={style} role={role} {...bannerProps}>
      <AlertTriangle size={14} className="shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
