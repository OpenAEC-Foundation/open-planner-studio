import type { NotifyInput } from '@/state/slices/types';

/** Eén geslaagde export geeft één verslag: bijkomende meldingen mogen de verliesmelding
 *  met haar gidslink niet uit de begrensde toaststapel duwen (knownbug 483).
 *  Deze exportmeldingen zijn vertaalde info zonder acties of technische fouttekst. */
export function bundleExportNotices(notices: readonly NotifyInput[]): NotifyInput | null {
  const [primary, ...details] = notices;
  if (!primary) return null;
  return {
    ...primary,
    // Altijd meegeven, ook leeg: een herhaalde export moet oude detailregels kunnen wissen.
    detailLines: [
      ...(primary.detailLines ?? []),
      ...details.flatMap(notice => [
        {
          messageKey: notice.messageKey,
          params: notice.params,
          numberParams: notice.numberParams,
          helpArticleId: notice.helpArticleId,
        },
        ...(notice.detailLines ?? []),
      ]),
    ],
    ...(details.length > 0 ? { durationMs: Math.max(primary.durationMs ?? 5000, 15000) } : {}),
  };
}
