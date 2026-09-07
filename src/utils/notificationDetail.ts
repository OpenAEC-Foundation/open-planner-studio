import type { NotificationDetailLine } from '@/state/slices/types';

/**
 * Eén getypeerde detailregel volgt exact dezelfde i18n-route als de hoofdtoast. Deze pure helper
 * blijft React-vrij zodat de headless planningharnas hem zonder component-runtime kan toetsen.
 */
export function notificationDetailText(
  t: (key: NotificationDetailLine['messageKey'], params?: Record<string, string | number>) => string,
  line: NotificationDetailLine,
): string {
  return t(line.messageKey, line.params);
}
