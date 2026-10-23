// Iedere blijvende berekening hoort bij het B5-protocol. Nieuwe aanroepen vragen een bewuste route.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type * as Ts from 'typescript';
const ts = createRequire(import.meta.url)('typescript') as typeof Ts;
const actual: Record<string, string[]> = {};
function scan(dir: string): void {
  for (const file of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, file.name);
    if (file.isDirectory()) { scan(path); continue; }
    if (!/\.tsx?$/.test(path)) continue;
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: Ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = ts.isIdentifier(node.expression) ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
        if (['runCPM', 'solveProject', 'runInScratchDocument'].includes(callee)) {
          const route = callee === 'runCPM' ? node.arguments.some(arg => /withinEvent:\s*true/.test(arg.getText(source))) ? 'bewerking' : 'bereken'
            : callee;
          (actual[path] ??= []).push(route);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
scan('src');
const expected: Record<string, string[]> = {
  'src/components/dialogs/CalendarDialog.tsx': ['bewerking'],
  'src/components/layout/RecordedDatesNotice.tsx': ['bereken'],
  'src/components/panels/ReportPanel.tsx': ['bereken'],
  'src/components/panels/TaskPropertiesPanel.tsx': ['bereken'],
  'src/components/panels/WarningsPanel.tsx': ['bereken'],
  'src/components/layout/Ribbon/ribbonConfig.tsx': ['bereken'],
  'src/core/index.ts': ['bereken'],
  'src/engine/reports/dcmaAssessment.ts': ['solveProject'], // vluchtig rapport, nooit terugschrijven
  'src/extensions/extensionApi.ts': ['bereken'],
  'src/extensions/retainActiveDocument.ts': ['bereken'], // na de laadgrens
  'src/hooks/keyboard/shortcutRegistry.ts': ['bereken'],
  'src/hooks/keyboard/useKeyboardShortcuts.ts': ['bewerking', 'bereken'], // veldcommit vóór opslaan
  'src/hooks/useAutoCalcCPM.ts': ['bereken'],
  'src/hooks/useExitRecordedDates.ts': ['bewerking'],
  'src/services/library/occupancy.ts': ['solveProject'], // vluchtig op een kloon
  'src/services/mcp/staleGuard.ts': ['bereken'],
  'src/services/mcp/tools/batchTool.ts': ['bewerking'],
  'src/state/documentActivation.ts': ['solveProject', 'solveProject'], // vluchtige teller; laadgrens
  'src/state/runtime/createMcpTransactions.ts': ['bewerking'],
  'src/state/slices/documentSlice.ts': ['solveProject'], // slaat omzetting open over
  'src/state/slices/fileSlice.ts': ['bereken', 'bereken', 'bewerking', 'bewerking'],
  'src/state/slices/librarySlice.ts': ['runInScratchDocument'], // applyLeveling bezit het event
  'src/state/slices/projectSlice.ts': ['bewerking', 'bewerking'],
  'src/state/slices/scheduleSlice.ts': ['solveProject', 'bewerking', 'bewerking'],
  'src/state/slices/schedulingProfileSlice.ts': ['bewerking'],
  'src/utils/qaScenes.ts': ['bereken'], // alleen ontwikkeling
};
const failures: string[] = [];
for (const path of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
  if (JSON.stringify(actual[path]) !== JSON.stringify(expected[path])) failures.push(`${path}: ${JSON.stringify(actual[path])} ≠ ${JSON.stringify(expected[path])}`);
}
for (const error of failures) console.log(`XX rekenroute ${error}`);
console.log(`Rekenroutes: ${Object.values(actual).flat().length} aanroepen; ${failures.length} afwijkingen.`);
if (failures.length) process.exitCode = 1;
