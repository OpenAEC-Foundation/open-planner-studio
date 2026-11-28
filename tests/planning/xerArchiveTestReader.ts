import { readIFC } from '@/services/ifc/ifcReader';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import { reconstructXerSourceFromBytes } from '@/services/xer/xerReader';

export function readXerArchiveIFC(content: string, labels: ImportLabels = {}): ImportResult {
  return readIFC(content, labels, { reconstructXerArchive: reconstructXerSourceFromBytes });
}
