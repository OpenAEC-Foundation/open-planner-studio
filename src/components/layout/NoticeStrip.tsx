import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconId } from '@/components/icons';

interface NoticeStripProps {
  icon: IconId;
  text: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: { label: string; onAction: () => void; props?: Record<string, unknown> };
  onDismiss?: () => void;
  role?: 'status' | 'alert';
  tone?: 'accent' | 'error';
  stripProps?: Record<string, unknown>;
  actionProps?: Record<string, unknown>;
  dismissProps?: Record<string, unknown>;
}

export function NoticeStrip({
  icon, text, actionLabel, onAction, secondaryAction, onDismiss, role, tone = 'accent', stripProps, actionProps, dismissProps,
}: NoticeStripProps) {
  const { t } = useTranslation('common');
  const error = tone === 'error';
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-small leading-4 border-b border-border"
      style={{
        background: error
          ? 'color-mix(in srgb, var(--error) 14%, transparent)'
          : 'var(--theme-accent-soft, rgba(217,119,6,0.12))',
        color: 'var(--theme-text)',
        ...(error ? { borderInlineStart: '3px solid var(--error)' } : {}),
      }}
      role={role}
      data-ops-notice-tone={tone}
      {...stripProps}
    >
      <Icon id={icon} size={14} className={`shrink-0 ${error ? '' : 'text-text-secondary'}`} style={error ? { color: 'var(--error)' } : undefined} />
      <span className="flex-1">{text}</span>
      {onAction && (
        <button onClick={() => onAction()} className="btn btn--sm btn--primary" {...actionProps}>
          {actionLabel}
        </button>
      )}
      {secondaryAction && (
        <button onClick={() => secondaryAction.onAction()} className="btn btn--sm btn--secondary" {...secondaryAction.props}>
          {secondaryAction.label}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={() => onDismiss()}
          className="p-1 hover:bg-surface-hover rounded-[8px] text-text-secondary"
          title={t('close')}
          {...dismissProps}
        >
          <Icon id="ui.close" size={14} />
        </button>
      )}
    </div>
  );
}
