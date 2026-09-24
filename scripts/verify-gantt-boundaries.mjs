#!/usr/bin/env node
// Mechanische eigendomspoort voor de Gantt-shell, coordinators en Canvas-renderers.
// De TypeScript-AST voorkomt dat woorden in commentaar of strings als grenslek tellen. `--root`
// laat de planningstest tijdelijke bronfixtures controleren zonder productiecode te wijzigen.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  location, parse, pathsFor, repositoryRoot, sourceFiles, ts, valueBindings, withoutExtension,
} from './lib/ts-imports.mjs';

const root = repositoryRoot('verify-gantt-boundaries.mjs', resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const { ownPath, normalizedModule } = pathsFor(root);
const violations = [];

function imports(sourceFile) {
  const found = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    found.push({
      statement,
      specifier: statement.moduleSpecifier.text,
      bindings: valueBindings(statement.importClause),
    });
  }
  return found;
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
const tableSurfaceFile = resolve(root, 'src/components/task-grid/FullTaskGrid.tsx');
const ganttRendererModule = withoutExtension(resolve(root, 'src/engine/renderer/GanttRenderer.ts'));
const histogramRendererModule = withoutExtension(resolve(root, 'src/engine/renderer/HistogramRenderer.ts'));
const ganttOptionsModule = withoutExtension(resolve(root, 'src/components/canvas/ganttRenderOptions.ts'));
// De rijsleep is eigendom van de DOM-taakgrid (`ganttEventOwnership.rowdrag`). Het tijdlijncanvas
// mag hem bereiken, maar uitsluitend via de brug — dat is de ENE plek waar die overdracht staat en
// waar hij dus ook te vinden is als iemand hem later weer weghaalt. Een canvasbestand dat de hook
// rechtstreeks importeert bouwt een tweede pad en omzeilt die vindbaarheid (review 2026-09-15).
const rowDragHookModule = withoutExtension(resolve(root, 'src/components/panels/hooks/useTableRowDrag.ts'));
const rowDragBridgeModule = withoutExtension(resolve(root, 'src/components/canvas/ganttRowDragBridge.ts'));
const canvasRootModule = `${withoutExtension(resolve(root, 'src/components/canvas'))}/`;
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
  'startSplitGesture',
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

    if (module === rowDragHookModule
        && fileModule.startsWith(canvasRootModule)
        && fileModule !== rowDragBridgeModule) {
      report(file, sourceFile, imported.statement,
        'canvasbestanden bereiken de rijsleep uitsluitend via ganttRowDragBridge');
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

if (existsSync(tableSurfaceFile)) {
  const sourceFile = parse(tableSurfaceFile);
  for (const imported of imports(sourceFile)) {
    const module = normalizedModule(tableSurfaceFile, imported.specifier);
    const isRenderer = module.startsWith(`${withoutExtension(resolve(root, 'src/engine/renderer'))}/`);
    const isCoordinator = module.startsWith(
      `${withoutExtension(resolve(root, 'src/components/canvas/hooks'))}/useGantt`,
    ) || module === withoutExtension(resolve(
      root,
      'src/components/canvas/hooks/ganttCoordinatorTypes.ts',
    ));
    if (isRenderer || isCoordinator) {
      report(tableSurfaceFile, sourceFile, imported.statement,
        `De Tabel-weergave (FullTaskGrid) mag Gantt-afhankelijkheid '${imported.specifier}' niet importeren`);
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
