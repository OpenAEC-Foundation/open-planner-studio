import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X, type LucideIcon } from 'lucide-react';

interface NoticeStripProps {
  icon: LucideIcon;
  text: ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** Weglaten = geen kruisje: een MODUS mag niet wegklikbaar zijn zonder hem te verlaten. */
  onDismiss?: () => void;
  role?: 'status';
  /** Data-attributen voor de self-test-harness, op de strook, de actieknop en het kruisje. */
  stripProps?: Record<string, unknown>;
  actionProps?: Record<string, unknown>;
  dismissProps?: Record<string, unknown>;
}

/**
 * De accentstrook onder het lint (modus- en aanbodmeldingen): icoon, uitleg, één primaire knop en
 * optioneel een kruisje. Gedeeld door Split-/DependencyMode-, HourData-, StructureLocked- en
 * RecordedDatesNotice.
 */
export function NoticeStrip({
  icon: Icon, text, actionLabel, onAction, onDismiss, role, stripProps, actionProps, dismissProps,
}: NoticeStripProps) {
  const { t } = useTranslation('common');
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-small leading-4 border-b border-border"
      style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
      role={role}
      {...stripProps}
    >
      <Icon size={14} className="shrink-0 text-accent" />
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
          <X size={14} />
        </button>
      )}
    </div>
  );
}
