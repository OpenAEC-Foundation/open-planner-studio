import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { leaveBackstageGuarded } from '@/components/backstage/backstageLeaveGuard';

/**
 * Open Backstage → Help op een artikel (id, alias of `id#anker`), via dezelfde route als "Lees meer"
 * in een melding (`NotificationHost`): `openHelpArticle` achter de Backstage-wegnavigeerbewaking.
 */
export function openHelpArticleGuarded(articleId: string): void {
  leaveBackstageGuarded(() => useAppStore.getState().openHelpArticle(articleId));
}

export interface HelpButtonProps {
  /** Artikel-id uit `src/state/helpArticles.ts` (poort 10 van `verify:docs` bewaakt dat het bestaat). */
  articleId: string;
  /**
   * Onderschept het openen: krijgt de open-functie mee en roept hem zelf aan wanneer het mag (een
   * dialoog sluit eerst, of vraagt eerst wat er met onopgeslagen invoer moet). Weglaten = direct openen.
   */
  onOpen?: (open: () => void) => void;
  disabled?: boolean;
  /** Icoongrootte; standaard gelijk aan het sluitkruisje van `DialogHeader`. */
  size?: number;
}

/**
 * Het ?-knopje van de contextuele hulp (ontwerp gebruikersdocumentatie §8.1). Voor een paneel staat
 * hij los; in een dialoog gebruik je `DialogHeader`'s `help`-prop, die deze knop naast het kruisje
 * zet en de dialoog eerst via zijn eigen route sluit.
 */
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
      <CircleHelp size={size} />
    </button>
  );
}
