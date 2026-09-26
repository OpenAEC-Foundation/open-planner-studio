/**
 * De ene in-app melding voor een onbruikbaar XER-bronarchief ("openen met melding"). `readIFC` laat
 * zo'n archief vallen en zet `ImportResult.xerArchiveIssue`; deze module maakt daar de
 * gebruikerstekst van — via het meldingenkanaal, nooit een native dialoog.
 *
 * Bladmodule (importeert niets uit `slices/`), zodat zowel `fileSlice` (openen) als `documentSlice`
 * (crashherstel) hem kunnen gebruiken zonder importcyclus.
 */
import type { XerArchiveIssue, XerArchiveIssueCode } from '@/services/importTypes';
import type { NotificationDetailLine, NotificationMessageKey, NotifyInput } from './slices/types';

/** De in-app gids achter de XER-meldingen (openen, exportverlies, onbruikbaar archief). */
export const XER_IMPORT_HELP_ARTICLE_ID = 'gids-xer-import';

/** Eén vertaalde reden per code. `Record` over de gesloten unie ⇒ een nieuwe code zonder tekst is
 *  een compile-fout. */
export const XER_ARCHIVE_REASON_KEYS: Readonly<Record<XerArchiveIssueCode, NotificationMessageKey>> = {
  'schema-version': 'notifications.xerArchiveReasonSchemaVersion',
  'hash-mismatch': 'notifications.xerArchiveReasonHashMismatch',
  truncated: 'notifications.xerArchiveReasonTruncated',
  'bytes-missing': 'notifications.xerArchiveReasonBytesMissing',
  'metadata-invalid': 'notifications.xerArchiveReasonMetadataInvalid',
  structure: 'notifications.xerArchiveReasonStructure',
};

/** Reden(en) + gevolg, zonder kopregel. Dubbele codes (meerdere herstelde documenten) één keer. */
function reasonAndConsequenceLines(issues: readonly XerArchiveIssue[]): NotificationDetailLine[] {
  const codes = [...new Set(issues.map(issue => issue.code))];
  return [
    ...codes.map(code => ({ messageKey: XER_ARCHIVE_REASON_KEYS[code] })),
    { messageKey: 'notifications.xerArchiveUnusableConsequence' },
  ];
}

/**
 * Voeg de archiefmelding toe aan een bestaande bestandsmelding (als detailregels), of maak er een
 * eigen melding van als er geen is. Geen issues ⇒ `notice` ongewijzigd terug.
 */
export function withXerArchiveIssueNotice(
  notice: NotifyInput | undefined,
  issues: readonly (XerArchiveIssue | null | undefined)[],
): NotifyInput | undefined {
  const present = issues.filter((issue): issue is XerArchiveIssue => !!issue);
  if (present.length === 0) return notice;
  const technical = present.map(issue => issue.detail).join('\n');
  if (notice) {
    return {
      ...notice,
      detailLines: [
        ...(notice.detailLines ?? []),
        { messageKey: 'notifications.xerArchiveUnusableLine' },
        ...reasonAndConsequenceLines(present),
      ],
      detail: notice.detail ? `${notice.detail}\n${technical}` : technical,
      helpArticleId: notice.helpArticleId ?? XER_IMPORT_HELP_ARTICLE_ID,
    };
  }
  return {
    severity: 'info',
    messageKey: 'notifications.xerArchiveUnusable',
    detailLines: reasonAndConsequenceLines(present),
    detail: technical,
    helpArticleId: XER_IMPORT_HELP_ARTICLE_ID,
    dedupeKey: 'xer-archive-unusable',
  };
}
