import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';

const TONES = {
  warning: {
    className: 'flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium',
    style: {
      background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
      borderColor: 'var(--warning)',
      color: 'var(--theme-warning-text)',
    },
    role: 'alert',
  },
  dim: {
    className: 'flex items-center gap-2 mx-2 mt-2 px-2.5 py-1.5 rounded-[8px] border font-medium text-text-secondary',
    style: {
      background: 'color-mix(in srgb, var(--theme-text-dim) 12%, transparent)',
      borderColor: 'var(--theme-text-dim)',
    },
    role: 'status',
  },
} as const;

export function StatusBanner({ tone, children, bannerProps, inline = false }: {
  tone: keyof typeof TONES;
  children: ReactNode;
  inline?: boolean;
  bannerProps?: Record<string, unknown>;
}) {
  const { className, style, role } = TONES[tone];
  const classes = inline ? className.replace('mx-2 mt-2 ', '') : className;
  return (
    <div className={classes} style={style} role={role} {...bannerProps}>
      <Icon id={tone === 'warning' ? 'status.warning' : 'status.info'} size={14} className="shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
