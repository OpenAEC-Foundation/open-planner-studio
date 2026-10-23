import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { B2Icon } from '@/components/common/B2Icon';
import type { B2IconName } from '@/components/common/b2IconNames';

interface NoticeStripProps {
  icon: B2IconName;
  text: ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** Weglaten = geen kruisje: een MODUS mag niet wegklikbaar zijn zonder hem te verlaten. */
  onDismiss?: () => void;
  role?: 'status' | 'alert';
  /** `error`: een weigering (eigenaarsbesluit 2026-10-17) — rood uit het thema i.p.v. de accentkleur. */
  tone?: 'accent' | 'error';
  /** Data-attributen voor de self-test-harness, op de strook, de actieknop en het kruisje. */
  stripProps?: Record<string, unknown>;
  actionProps?: Record<string, unknown>;
  dismissProps?: Record<string, unknown>;
}

/**
 * De accentstrook onder het lint (modus- en aanbodmeldingen, bv. urendata): icoon, uitleg, één primaire knop en
 * optioneel een kruisje. Gedeeld door Split-/DependencyMode-, HourData-, StructureLocked- en
 * RecordedDatesNotice.
 */
export function NoticeStrip({
  icon, text, actionLabel, onAction, onDismiss, role, tone = 'accent', stripProps, actionProps, dismissProps,
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
      <B2Icon name={icon} size={14} className={`shrink-0 ${error ? '' : 'text-accent'}`} style={error ? { color: 'var(--error)' } : undefined} />
      <span className="flex-1">{text}</span>
      <button onClick={() => onAction()} className="btn btn--sm btn--primary" {...actionProps}>
        {actionLabel}
      </button>
      {onDismiss && (
        <button
          onClick={() => onDismiss()}
          className="p-1 hover:bg-surface-hover rounded-[8px] text-text-secondary"
          title={t('close')}
          {...dismissProps}
        >
          <B2Icon name="ui.close" size={14} />
        </button>
      )}
    </div>
  );
}
