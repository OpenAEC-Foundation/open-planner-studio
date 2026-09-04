#!/usr/bin/env node
// Mechanische eigendomspoort voor de Gantt-shell, coordinators en Canvas-renderers.
// De TypeScript-AST voorkomt dat woorden in commentaar of strings als grenslek tellen. `--root`
// laat de planningstest tijdelijke bronfixtures controleren zonder productiecode te wijzigen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, '..');
const rootFlag = process.argv.indexOf('--root');
if (rootFlag >= 0 && !process.argv[rootFlag + 1]) {
  console.error('Gebruik: node scripts/verify-gantt-boundaries.mjs [--root <repositorypad>]');
  process.exit(2);
}
const root = resolve(rootFlag >= 0 ? process.argv[rootFlag + 1] : defaultRoot);
const violations = [];

const slash = (value) => value.split(sep).join('/');
const ownPath = (file) => slash(relative(root, file));
const withoutExtension = (value) => slash(value).replace(/\.(?:ts|tsx|mts|js|mjs)$/, '');

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (/\.(?:ts|tsx|mts)$/.test(entry.name)) found.push(target);
    }
  }
  return found.sort();
}

function parse(file) {
  const source = readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

function importTarget(file, specifier) {
  if (specifier.startsWith('@/')) return resolve(root, 'src', specifier.slice(2));
  if (specifier.startsWith('.')) return resolve(dirname(file), specifier);
  return null;
}

function normalizedModule(file, specifier) {
  const target = importTarget(file, specifier);
  return target ? withoutExtension(target) : specifier;
}

function importBindings(statement) {
  const clause = statement.importClause;
  if (!clause || clause.isTypeOnly) return [];
  const bindings = [];
  if (clause.name) bindings.push({ imported: 'default', local: clause.name.text });
  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named)) {
    bindings.push({ imported: '*', local: named.name.text });
  } else if (named && ts.isNamedImports(named)) {
    for (const element of named.elements) {
      if (element.isTypeOnly) continue;
      bindings.push({
        imported: (element.propertyName ?? element.name).text,
        local: element.name.text,
      });
    }
  }
  return bindings;
}

function imports(sourceFile) {
  const found = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    found.push({
      statement,
      specifier: statement.moduleSpecifier.text,
      bindings: importBindings(statement),
    });
  }
  return found;
}

function location(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function report(file, sourceFile, node, message) {
  violations.push(`${ownPath(file)}:${location(sourceFile, node)} — ${message}`);
}

function visitCalls(sourceFile, callback) {
  function visit(node) {
    if (ts.isCallExpression(node)) callback(node);
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
}

const componentsRoot = resolve(root, 'src/components');
const hostFile = withoutExtension(resolve(
  root,
  'src/components/canvas/hooks/useGanttRendererHost.ts',
));
const viewportFile = withoutExtension(resolve(
  root,
  'src/components/canvas/hooks/useGanttViewportCoordinator.ts',
));
const ganttCanvasFile = resolve(root, 'src/components/canvas/GanttCanvas.tsx');
const ganttRendererFile = resolve(root, 'src/engine/renderer/GanttRenderer.ts');
const tableEditorFile = resolve(root, 'src/components/panels/TableEditor.tsx');
const ganttRendererModule = withoutExtension(resolve(root, 'src/engine/renderer/GanttRenderer.ts'));
const histogramRendererModule = withoutExtension(resolve(root, 'src/engine/renderer/HistogramRenderer.ts'));
const ganttOptionsModule = withoutExtension(resolve(root, 'src/components/canvas/ganttRenderOptions.ts'));
const viewportHelpers = new Set([
  'computeGanttScrollBounds',
  'resolveWheelFunction',
  'computeFitToProject',
  'computeFocusTaskHorizontal',
]);
const gestureStarts = new Set([
  'startBarDrag',
  'startPan',
  'startBoxSelect',
  'startRowDrag',
  'startDepDraw',
]);

for (const file of sourceFiles(componentsRoot)) {
  const sourceFile = parse(file);
  const fileModule = withoutExtension(file);
  const fileImports = imports(sourceFile);
  const rendererLocals = new Map();
  const rendererNamespaces = new Map();

  for (const imported of fileImports) {
    const module = normalizedModule(file, imported.specifier);
    if (module === ganttRendererModule || module === histogramRendererModule) {
      const rendererName = module === ganttRendererModule ? 'GanttRenderer' : 'HistogramRenderer';
      for (const binding of imported.bindings) {
        if (binding.imported === '*') {
          rendererNamespaces.set(binding.local, rendererName);
        } else if (binding.imported === rendererName || binding.imported === 'default') {
          rendererLocals.set(binding.local, rendererName);
        }
      }
    }

    if (fileModule !== hostFile && module === ganttOptionsModule
        && imported.bindings.some(binding => binding.imported === 'buildGanttRenderOptions')) {
      report(file, sourceFile, imported.statement,
        'buildGanttRenderOptions mag alleen door useGanttRendererHost worden geïmporteerd');
    }

    if (fileModule !== viewportFile) {
      for (const binding of imported.bindings) {
        if (viewportHelpers.has(binding.imported)) {
          report(file, sourceFile, imported.statement,
            `viewporthelper '${binding.imported}' mag alleen door useGanttViewportCoordinator worden geïmporteerd`);
        }
      }
    }
  }

  function visit(node) {
    if (fileModule !== hostFile && ts.isNewExpression(node)) {
      let rendererName = null;
      if (ts.isIdentifier(node.expression)) {
        rendererName = rendererLocals.get(node.expression.text)
          ?? (node.expression.text === 'GanttRenderer' || node.expression.text === 'HistogramRenderer'
            ? node.expression.text
            : null);
      } else if (ts.isPropertyAccessExpression(node.expression)
          && ts.isIdentifier(node.expression.expression)) {
        const expectedName = rendererNamespaces.get(node.expression.expression.text);
        if (expectedName === node.expression.name.text) rendererName = expectedName;
      }
      if (rendererName) {
        report(file, sourceFile, node,
          `${rendererName}-constructor mag alleen in useGanttRendererHost staan`);
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(sourceFile, visit);
}

if (existsSync(ganttCanvasFile)) {
  const sourceFile = parse(ganttCanvasFile);
  visitCalls(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node.expression)
        && gestureStarts.has(node.expression.name.text)) {
      report(ganttCanvasFile, sourceFile, node,
        `gesture-start '${node.expression.name.text}' hoort uitsluitend bij useGanttPointerCoordinator`);
    }
  });
}

if (existsSync(ganttRendererFile)) {
  const sourceFile = parse(ganttRendererFile);
  for (const imported of imports(sourceFile)) {
    const module = normalizedModule(ganttRendererFile, imported.specifier);
    const isReact = imported.specifier === 'react' || imported.specifier.startsWith('react/');
    const isZustand = imported.specifier === 'zustand' || imported.specifier.startsWith('zustand/');
    const isComponent = module.startsWith(`${withoutExtension(resolve(root, 'src/components'))}/`);
    if (isReact || isZustand || isComponent) {
      report(ganttRendererFile, sourceFile, imported.statement,
        `GanttRenderer mag '${imported.specifier}' niet importeren`);
    }
  }
}

if (existsSync(tableEditorFile)) {
  const sourceFile = parse(tableEditorFile);
  for (const imported of imports(sourceFile)) {
    const module = normalizedModule(tableEditorFile, imported.specifier);
    const isRenderer = module.startsWith(`${withoutExtension(resolve(root, 'src/engine/renderer'))}/`);
    const isCoordinator = module.startsWith(
      `${withoutExtension(resolve(root, 'src/components/canvas/hooks'))}/useGantt`,
    ) || module === withoutExtension(resolve(
      root,
      'src/components/canvas/hooks/ganttCoordinatorTypes.ts',
    ));
    if (isRenderer || isCoordinator) {
      report(tableEditorFile, sourceFile, imported.statement,
        `TableEditor mag Gantt-afhankelijkheid '${imported.specifier}' niet importeren`);
    }
  }
}

if (violations.length === 0) {
  console.log('OK — Gantt-renderer-, viewport-, pointer- en tabelgrenzen bewaakt.');
  process.exit(0);
}

console.error(`XX ${violations.length} overtreding${violations.length === 1 ? '' : 'en'} van Gantt-grenzen:`);
for (const violation of violations) console.error(`  - ${violation}`);
process.exit(1);
