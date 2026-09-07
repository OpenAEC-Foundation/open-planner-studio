// Kindproces B-raw voor X9: importeert bewust NIET de XER-reader en gebruikt de lage sync-lezer.
import { readFileSync } from 'node:fs';
import { IfcParseError } from '@/services/ifc/ifcErrors';
import { readIFC } from '@/services/ifc/ifcReader';

const source = process.argv[2];
if (!source) throw new Error('X9 koude raw-lezer mist bronpad');

try {
  const parsed = readIFC(readFileSync(source, 'utf8'));
  process.stdout.write(JSON.stringify({ ok: true, hasArchive: Boolean(parsed.xerSourceArchive) }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    reason: error instanceof IfcParseError ? error.reason : undefined,
    message: error instanceof Error ? error.message : String(error),
  }));
}
