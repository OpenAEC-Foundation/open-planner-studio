export const FORMAT_NOTICE_KINDS = ['xer', 'mpp', 'mspdi', 'p6xml', 'csv'] as const;
export type FormatNoticeKind = (typeof FORMAT_NOTICE_KINDS)[number];

export function parseFormatNoticeHidden(raw: unknown): FormatNoticeKind[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return FORMAT_NOTICE_KINDS.filter((kind) => raw.includes(kind));
}

export function withFormatNoticeShown(
  hidden: readonly FormatNoticeKind[],
  kind: FormatNoticeKind,
  shown: boolean,
): FormatNoticeKind[] {
  return FORMAT_NOTICE_KINDS.filter((k) => (k === kind ? !shown : hidden.includes(k)));
}
