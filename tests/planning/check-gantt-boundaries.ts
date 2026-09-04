// Negatieve bewijstest voor de mechanische Gantt-eigendomsgrens.
//
// De echte repository moet groen zijn, woorden in commentaar en strings mogen niets activeren, en
// syntactisch echte grenslekken moeten per eigenaar een gerichte melding en exitcode != 0 geven.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const diffs: string[] = [];
let checks = 0;

function ok(label: string, condition: boolean, detail = ''): void {
  checks++;
  if (!condition) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts', 'verify-gantt-boundaries.mjs');

function run(checkRoot: string) {
  return spawnSync(process.execPath, [script, '--root', checkRoot], {
    cwd: root,
    encoding: 'utf8',
  });
}

function fixture(files: Record<string, string>): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'ops-gantt-boundaries-'));
  for (const [relative, source] of Object.entries(files)) {
    const target = join(fixtureRoot, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, 'utf8');
  }
  return fixtureRoot;
}

const repository = run(root);
ok('1 actuele Gantt-grenzen zijn groen', repository.status === 0,
  `${repository.stdout}${repository.stderr}`.trim());

const cleanRoot = fixture({
  'src/components/canvas/hooks/useGanttRendererHost.ts': [
    "import { GanttRenderer } from '@/engine/renderer/GanttRenderer';",
    "import { HistogramRenderer } from '@/engine/renderer/HistogramRenderer';",
    "import { buildGanttRenderOptions } from '../ganttRenderOptions';",
    'export function host(ctx: CanvasRenderingContext2D) {',
    '  const options = buildGanttRenderOptions({} as never);',
    '  return [new GanttRenderer(ctx, options), new HistogramRenderer(ctx, {} as never)];',
    '}',
  ].join('\n'),
  'src/components/canvas/GanttCanvas.tsx': [
    "// new GanttRenderer(); pointer.startBarDrag(); computeFitToProject();",
    "const misleading = 'buildGanttRenderOptions new HistogramRenderer';",
    'export function GanttCanvas() { return <div>{misleading}</div>; }',
  ].join('\n'),
  'src/engine/renderer/GanttRenderer.ts': "import { barGeometry } from './barGeometry';\nexport class GanttRenderer {}\n",
  'src/components/panels/TableEditor.tsx': 'export function TableEditor() { return <table />; }\n',
});
try {
  const clean = run(cleanRoot);
  ok('2 commentaar, strings en de rendererhost blijven toegestaan', clean.status === 0,
    `${clean.stdout}${clean.stderr}`.trim());
} finally {
  rmSync(cleanRoot, { recursive: true, force: true });
}

const brokenRoot = fixture({
  'src/components/canvas/RogueRenderer.tsx': [
    "import { GanttRenderer as RogueRenderer } from '@/engine/renderer/GanttRenderer';",
    'export const rogue = new RogueRenderer({} as never, {} as never);',
  ].join('\n'),
  'src/components/canvas/RogueHistogram.tsx': [
    "import * as Renderers from '@/engine/renderer/HistogramRenderer';",
    'export const rogue = new Renderers.HistogramRenderer({} as never, {} as never);',
  ].join('\n'),
  'src/components/canvas/RogueOptions.tsx': [
    "import { buildGanttRenderOptions as build } from './ganttRenderOptions';",
    'export const rogue = build({} as never);',
  ].join('\n'),
  'src/components/canvas/GanttCanvas.tsx': [
    "import { computeFitToProject } from '@/utils/ganttViewport';",
    'export function GanttCanvas({ pointer }: { pointer: { startBarDrag(): void } }) {',
    '  computeFitToProject([], new Date(), 1, 1, 1);',
    '  pointer.startBarDrag();',
    '  return <div />;',
    '}',
  ].join('\n'),
  'src/engine/renderer/GanttRenderer.ts': "import { useState } from 'react';\nexport class GanttRenderer { state = useState; }\n",
  'src/components/panels/TableEditor.tsx': [
    "import { useGanttPointerCoordinator } from '../canvas/hooks/useGanttPointerCoordinator';",
    'export const TableEditor = useGanttPointerCoordinator;',
  ].join('\n'),
});
try {
  const broken = run(brokenRoot);
  const output = `${broken.stdout}${broken.stderr}`;
  ok('3 verboden bronconstructies geven exit ongelijk aan nul', broken.status !== 0, output.trim());
  ok('3a constructorlek wordt gemeld', output.includes('RogueRenderer.tsx')
    && output.includes('GanttRenderer'), output.trim());
  ok('3b namespace-constructorlek wordt gemeld', output.includes('RogueHistogram.tsx')
    && output.includes('HistogramRenderer'), output.trim());
  ok('3c renderoptiebuilder buiten de host wordt gemeld', output.includes('RogueOptions.tsx')
    && output.includes('buildGanttRenderOptions'), output.trim());
  ok('3d viewportimport wordt gemeld', output.includes('GanttCanvas.tsx')
    && output.includes('computeFitToProject'), output.trim());
  ok('3e pointerdispatch in de shell wordt gemeld', output.includes('startBarDrag'), output.trim());
  ok('3f rendererafhankelijkheid op React wordt gemeld', output.includes('GanttRenderer.ts')
    && output.includes('react'), output.trim());
  ok('3g TableEditor-import van een coordinator wordt gemeld', output.includes('TableEditor.tsx')
    && output.includes('useGanttPointerCoordinator'), output.trim());
} finally {
  rmSync(brokenRoot, { recursive: true, force: true });
}

if (diffs.length === 0) {
  console.log(`OK: Gantt-grenzen — ${checks} checks groen`);
} else {
  console.log(`XX Gantt-grenzen — ${diffs.length} van ${checks} checks rood:`);
  for (const diff of diffs) console.log(`  - ${diff}`);
  process.exit(1);
}
