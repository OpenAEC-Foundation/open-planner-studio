// Eén eigen datamap per run van de echte-app-proef (`run.sh`; review van #1124). De app krijgt haar via `XDG_DATA_HOME`:
// Tauri neemt daar op Linux zijn `appDataDir` (`<map>/org.openaec.planner`). Daarin het opdrachtkanaal `ops-test` en een
// `.persisted-scope` met één map in /tmp die de planner eerder vrijgaf (#804, knownbug 1762). Zo begint elke run leeg,
// ook een herhaling op dezelfde machine, en ruimt `remove` beide mappen op, met alles wat de app erin schreef.
//
//   node tests/mcp/realApp/runData.mjs create          # drie regels: datamap, ops-test-map, vrijgegeven map
//   node tests/mcp/realApp/runData.mjs remove <map>…   # weg, ook als een map er al niet meer is
//
// Proef: `tests/mcp/cases-real-app-data.ts`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_IDENTIFIER = 'org.openaec.planner';

/** `.persisted-scope` van persisted-scope 2.4.3 (bincode): een lijst toegestane en een lijst verboden patronen, elk
 *  als u64-lengte (little-endian) met daarna de strings, elk ook met een u64-lengte. */
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
  // Buiten de thuismap. De mapkiezer van plugin-dialog geeft een map vrij als `allow_directory(map, false)`: de
  // patronen `map` en `map/*`; persisted-scope zet ze bij de start terug.
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
