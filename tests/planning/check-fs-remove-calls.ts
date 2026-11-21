// #804, knownbug 2027: de app wist met plugin-fs nooit een map met inhoud. De toestemming voor een map (de mapkiezer
// bij Ctrl+S buiten de thuismap) geldt voor alle bestandsopdrachten die de app heeft, ook `remove`, en plugin-fs toetst
// daarbij alleen het opgegeven pad: met `recursive` wist het de hele boom eronder (`remove_dir_all`), zonder alleen een
// lege map (`remove_dir`). Deze broncontrole bewaakt die grens: nergens in `src/` een `remove(…, { recursive })`, en elke
// `remove` in een bestand dat plugin-fs gebruikt staat op de lijst hieronder, met wat ze wist. Een nieuwe aanroep is dan
// een bewuste keuze, met een regel erbij.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type * as Ts from 'typescript';
const ts = createRequire(import.meta.url)('typescript') as typeof Ts;

/** Per bestand met plugin-fs: het eerste argument van elke `remove`-aanroep, in volgorde. */
const actual: Record<string, string[]> = {};
/** Elke `remove` in `src/` met een optie `recursive`, ook buiten de bestanden met plugin-fs. */
const recursive: string[] = [];

const calleeName = (node: Ts.CallExpression) => ts.isIdentifier(node.expression) ? node.expression.text
  : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';

function scan(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { scan(path); continue; }
    if (!/\.tsx?$/.test(path)) continue;
    const text = readFileSync(path, 'utf8');
    const usesPluginFs = text.includes("'@tauri-apps/plugin-fs'");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const visit = (node: Ts.Node) => {
      if (ts.isCallExpression(node) && calleeName(node) === 'remove') {
        const withRecursive = node.arguments.some(arg => ts.isObjectLiteralExpression(arg)
          && arg.properties.some(p => p.name !== undefined && p.name.getText(source) === 'recursive'));
        if (withRecursive) recursive.push(`${path}: ${node.getText(source)}`);
        if (usesPluginFs) (actual[path] ??= []).push(node.arguments[0]?.getText(source) ?? '');
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
scan('src');

const expected: Record<string, string[]> = {
  // Het eigen tijdelijke bestand naast het doel (`save-<id>.ops-save.tmp`), twee keer de doorgeefluiken van `TauriFs`,
  // en een eigen onvolledig bestand na een mislukte exclusieve aanmaak.
  'src/services/fileAccess/atomicWrite.ts': ['tmp', 'p', 'tmp', 'tmp', 'p', 'path', 'path'],
  // De vervanging: het eigen tijdelijke bestand, de opzijgezette versie (`.ops-vorige-<id>`), een restbestand bij het
  // herstel, en het doorgeefluik.
  'src/services/fileAccess/ownFileReplace.ts': ['temp', 'previous', 'file', 'p'],
  // Herstelrecords van de vervanging in de app-datamap.
  'src/services/fileAccess/replaceRecords.ts': ['await join(dir, replaceRecordName(id))', 'record.id'],
  // MCP-backups in de eigen app-datamap: oude backupbestanden, en `dir`: een LEGE map van een nooit opgeslagen document
  // (zonder `recursive` weigert plugin-fs een map met inhoud).
  'src/services/mcp/backupService.ts': ['await fs.join(dir, name)', 'dir', 'p'],
  // De ontdekkingsbestanden van de MCP-bridge (app-datamap): een eigen halffabricaat en een eigen bestand.
  'src/services/mcp/discoveryFiles.ts': ['tmp', 'name', 'path'],
  // Herstelsnapshots, manifesten en het oude manifest in de herstelmap.
  'src/services/recovery/recoveryStore.ts': ['await join(dir, name)', 'await join(dir, name)', 'manifestPath', 'legacyPath', 'manifestPath', 'await join(dir, name)'],
  // De dev-brug: het verwerkte opdrachtbestand `cmd.json`.
  'src/utils/devBridge.ts': ['cmdPath'],
};

const failures: string[] = [];
for (const call of recursive) failures.push(`remove met recursive (wist een hele map): ${call}`);
for (const path of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
  if (JSON.stringify(actual[path]) !== JSON.stringify(expected[path])) {
    failures.push(`${path}: ${JSON.stringify(actual[path])} ≠ ${JSON.stringify(expected[path])}`);
  }
}
for (const failure of failures) console.log(`XX ${failure}`);
console.log(`Wissen met plugin-fs: ${Object.values(actual).flat().length} aanroepen; ${failures.length} afwijkingen.`);
if (failures.length) process.exitCode = 1;
