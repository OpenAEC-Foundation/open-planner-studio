import type { NotificationDetailLine } from '@/state/slices/types';

export function notificationDetailText(
  t: (key: NotificationDetailLine['messageKey'], params?: Record<string, string | number>) => string,
  line: NotificationDetailLine,
): string {
  return t(line.messageKey, line.params);
}
