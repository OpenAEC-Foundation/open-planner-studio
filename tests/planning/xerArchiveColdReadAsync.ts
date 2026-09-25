// Kindproces B-officieel voor X9: alleen de publieke asynchrone IFC-ingang mag de lazy XER-lezer laden.
import { readFileSync } from 'node:fs';
import { readIFCWithXerReconstruction } from '@/services/formatRegistry';
import { decodeXerSourceArchive, sha256Hex } from '@/services/xerSourceArchive';

const source = process.argv[2];
if (!source) throw new Error('X9 koude async-lezer mist bronpad');

const parsed = await readIFCWithXerReconstruction(readFileSync(source, 'utf8'));
if (!parsed.xerSourceArchive || !parsed.xer) {
  throw new Error('X9 koude async-lezer reconstrueerde geen XER-bronarchief');
}
process.stdout.write(JSON.stringify({
  sourceProjectId: parsed.xer.sourceProjectId,
  taskCount: parsed.tasks.length,
  sha256: sha256Hex(decodeXerSourceArchive(parsed.xerSourceArchive)),
}));
