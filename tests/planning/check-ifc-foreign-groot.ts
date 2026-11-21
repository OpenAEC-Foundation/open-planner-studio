// Eén gegenereerd model van minstens 10 MiB, buiten de tijdzonematrix: dezelfde lezer, één duurwijziging.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const started = performance.now();
const result = execFileSync(process.execPath, [join(root, 'scripts/proef/meet-merge-heropenen.mjs'), '--groot'], {
  cwd: root, encoding: 'utf8', maxBuffer: 1 << 20,
});
console.log(result.trim());
console.log(`OK groot model: beide leeswegen gelijk na duurwijziging zonder F5 (${((performance.now() - started) / 1000).toFixed(2)} s inclusief genereren en bundelen)`);
