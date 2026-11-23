import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_IDENTIFIER, OUTSIDE_FILE_NAME, scopeFile } from './persistedScope.mjs';

function create() {
  const data = mkdtempSync('/tmp/ops-real-app-data-');
  const appData = join(data, APP_IDENTIFIER);
  const opsDir = join(appData, 'ops-test');
  mkdirSync(opsDir, { recursive: true });
  const outside = mkdtempSync('/tmp/ops-1762-buiten-');
  writeFileSync(join(appData, '.persisted-scope'), scopeFile([join(outside, OUTSIDE_FILE_NAME)]));
  return [data, opsDir, outside];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...dirs] = process.argv.slice(2);
  if (command === 'create') console.log(create().join('\n'));
  else if (command === 'remove') for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  else { console.error('gebruik: runData.mjs create | remove <map>…'); process.exit(2); }
}
