// Een reproduceerbare SHA256SUMS naast de bestaande handtekeningen; ook voor de SuperCloud.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function writeReleaseChecksums(directory) {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter(e => e.isFile() && e.name !== 'SHA256SUMS').map(e => e.name).sort();
  if (!names.length) throw new Error('Geen releasebestanden om te hashen');
  const lines = names.map(name => {
    if (/[\r\n\\]/.test(name)) throw new Error('Bestandsnaam past niet in SHA256SUMS');
    return `${createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')}  ${name}\n`;
  }).join('');
  writeFileSync(join(directory, 'SHA256SUMS'), lines);
  return lines;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeReleaseChecksums(resolve(process.argv[2]));
}
