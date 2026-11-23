import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_IDENTIFIER = 'org.openaec.planner';

function scopeFile(allowed) {
  const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
  const str = s => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([u64(b.length), b]); };
  return Buffer.concat([u64(allowed.length), ...allowed.map(str), u64(0)]);
}

function create() {
  const data = mkdtempSync('/tmp/ops-real-app-data-');
  const appData = join(data, APP_IDENTIFIER);
  const opsDir = join(appData, 'ops-test');
  mkdirSync(opsDir, { recursive: true });
  const granted = mkdtempSync('/tmp/ops-1762-vrijgegeven-');
  writeFileSync(join(appData, '.persisted-scope'), scopeFile([granted, `${granted}/*`]));
  return [data, opsDir, granted];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...dirs] = process.argv.slice(2);
  if (command === 'create') console.log(create().join('\n'));
  else if (command === 'remove') for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  else { console.error('gebruik: runData.mjs create | remove <map>…'); process.exit(2); }
}
