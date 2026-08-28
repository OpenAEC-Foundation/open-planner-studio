// Testexpliciete toegang tot schema-2: productie opent IFC uitsluitend via de async registry-ingang;
// corpusloze XER-contracttests houden de synchrone lezer bewust klein via dezelfde geïnjecteerde
// reconstructor, zonder een verborgen module-initregistratie te herstellen.
import { readIFC } from '@/services/ifc/ifcReader';
import type { ImportLabels, ImportResult } from '@/services/importTypes';
import { reconstructXerSourceArchiveFromBytes } from '@/services/xer/xerReader';

export function readXerArchiveIFC(content: string, labels: ImportLabels = {}): ImportResult {
  return readIFC(content, labels, { reconstructXerArchive: reconstructXerSourceArchiveFromBytes });
}
