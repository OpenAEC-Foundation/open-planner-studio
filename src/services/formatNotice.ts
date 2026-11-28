import { detectXmlFlavor, readFormatForFile } from '@/services/formatRegistry';
import type { FormatNoticeKind } from '@/services/formatNoticeKinds';

export function formatNoticeKindFor(name: string, text?: string): FormatNoticeKind | null {
  switch (readFormatForFile(name).id) {
    case 'xer': return 'xer';
    case 'mpp': return 'mpp';
    case 'csv': return 'csv';
    case 'xml': {
      const flavor = text === undefined ? null : detectXmlFlavor(text);
      return flavor === 'p6' ? 'p6xml' : flavor === 'mspdi' ? 'mspdi' : null;
    }
    default: return null;
  }
}

export function formatNoticeToShow(
  name: string,
  text: string | undefined,
  hidden: readonly FormatNoticeKind[],
): FormatNoticeKind | null {
  const kind = formatNoticeKindFor(name, text);
  return kind !== null && !hidden.includes(kind) ? kind : null;
}
