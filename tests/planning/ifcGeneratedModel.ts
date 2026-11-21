// Dezelfde modelgenerator als de meting van #867; geen groot model als fixture opslaan.
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export function generatedModel(root: string, base: string, mb: number): Uint8Array {
  const generator = readFileSync(join(root, 'scripts/proef/meet-scanner.mjs'), 'utf8');
  const start = generator.indexOf('const GUID_CHARS =');
  const end = generator.indexOf('// ── Het voorbeeld zoals', start);
  if (start < 0 || end < 0) throw new Error('modelgenerator niet gevonden');
  const makeFile = new Function('openSync', 'writeSync', 'closeSync', generator.slice(start, end) + '\nreturn makeFile;')(
    openSync, writeSync, closeSync) as (mb: number, path: string, variant: string, base: string) => number;
  const dir = mkdtempSync(join(tmpdir(), 'ops-1107-model-'));
  try {
    const file = join(dir, 'model.ifc');
    makeFile(mb, file, 'model', base);
    return new Uint8Array(readFileSync(file));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
