import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { leaveBackstageGuarded } from '@/components/backstage/backstageLeaveGuard';

export function openHelpArticleGuarded(articleId: string): void {
  leaveBackstageGuarded(() => useAppStore.getState().openHelpArticle(articleId));
}

export interface HelpButtonProps {
  articleId: string;
  onOpen?: (open: () => void) => void;
  disabled?: boolean;
  size?: number;
}

export function HelpButton({ articleId, onOpen, disabled, size = 16 }: HelpButtonProps) {
  const { t } = useTranslation('common');
  const label = t('dialogHelp.button');
  const open = () => openHelpArticleGuarded(articleId);
  return (
    <button
      type="button"
      onClick={() => (onOpen ? onOpen(open) : open())}
      disabled={disabled}
      className="p-1 hover:bg-surface-hover rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label={label}
      title={label}
      data-ops-help-button={articleId}
    >
      <Icon id="ui.help" size={size} />
    </button>
  );
}
