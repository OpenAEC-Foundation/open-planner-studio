import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type * as Ts from 'typescript';
const ts = createRequire(import.meta.url)('typescript') as typeof Ts;

const actual: Record<string, string[]> = {};
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
  'src/services/fileAccess/atomicWrite.ts': ['tmp', 'p', 'tmp', 'tmp', 'p', 'path', 'path'],
  'src/services/fileAccess/ownFileReplace.ts': ['temp', 'previous', 'file', 'p'],
  'src/services/fileAccess/replaceRecords.ts': ['await join(dir, replaceRecordName(id))', 'record.id'],
  'src/services/mcp/backupService.ts': ['await fs.join(dir, name)', 'dir', 'p'],
  'src/services/mcp/discoveryFiles.ts': ['tmp', 'name', 'path'],
  'src/services/recovery/recoveryStore.ts': ['await join(dir, name)', 'await join(dir, name)', 'manifestPath', 'legacyPath', 'manifestPath', 'await join(dir, name)'],
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
