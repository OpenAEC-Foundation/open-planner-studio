import type { XerArchiveIssue, XerArchiveIssueCode } from '@/services/importTypes';
import type { NotificationDetailLine, NotificationMessageKey, NotifyInput } from './slices/types';
import { XER_IMPORT_HELP_ARTICLE_ID } from './helpArticles';

export const XER_ARCHIVE_REASON_KEYS: Readonly<Record<XerArchiveIssueCode, NotificationMessageKey>> = {
  'schema-version': 'notifications.xerArchiveReasonSchemaVersion',
  'hash-mismatch': 'notifications.xerArchiveReasonHashMismatch',
  truncated: 'notifications.xerArchiveReasonTruncated',
  'bytes-missing': 'notifications.xerArchiveReasonBytesMissing',
  'metadata-invalid': 'notifications.xerArchiveReasonMetadataInvalid',
  structure: 'notifications.xerArchiveReasonStructure',
};

function reasonAndConsequenceLines(issues: readonly XerArchiveIssue[]): NotificationDetailLine[] {
  const codes = [...new Set(issues.map(issue => issue.code))];
  return [
    ...codes.map(code => ({ messageKey: XER_ARCHIVE_REASON_KEYS[code] })),
    { messageKey: 'notifications.xerArchiveUnusableConsequence' },
  ];
}

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
