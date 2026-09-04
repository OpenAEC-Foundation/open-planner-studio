import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeVirtualWindow,
  minimalScrollTopForRow,
  virtualizeTaskColumns,
} from '@/engine/taskGrid/virtualization';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function truthy(label: string, value: boolean): void {
  checks++;
  if (!value) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
}

const ROWS = 50_000;
const ROW_HEIGHT = 36;
const VIEWPORT = 900;
const MAX_MOUNTED = Math.ceil(VIEWPORT / ROW_HEIGHT) + 16;

for (const scrollTop of [0, 18, 36 * 20_000 + 17, ROWS * ROW_HEIGHT - VIEWPORT]) {
  const window = computeVirtualWindow({
    totalRows: ROWS, rowHeight: ROW_HEIGHT, viewportHeight: VIEWPORT, scrollTop,
  });
  truthy(`Mounted budget bij scrollTop ${scrollTop}`, window.mountedRows.length <= MAX_MOUNTED);
  eq(`Topspacer volgt startindex bij ${scrollTop}`, window.topSpacerHeight, window.startIndex * ROW_HEIGHT);
  eq(`Bottomspacer volgt eindindex bij ${scrollTop}`, window.bottomSpacerHeight, (ROWS - window.endIndexExclusive) * ROW_HEIGHT);
  eq(`Eerste aria-index is absoluut bij ${scrollTop}`,
    window.mountedRows[0]?.ariaRowIndex, window.startIndex + 2);
  eq(`Laatste aria-index is absoluut bij ${scrollTop}`,
    window.mountedRows.at(-1)?.ariaRowIndex, window.endIndexExclusive + 1);
  truthy(`Eerste zichtbare rij is gemount bij ${scrollTop}`,
    window.startIndex <= Math.floor(Math.max(0, scrollTop) / ROW_HEIGHT));
  truthy(`Onderste deels zichtbare rij is gemount bij ${scrollTop}`,
    window.endIndexExclusive >= Math.min(ROWS, Math.ceil((Math.max(0, scrollTop) + VIEWPORT) / ROW_HEIGHT)));
}

{
  const target = ROWS - 1;
  const expected = ROWS * ROW_HEIGHT - VIEWPORT;
  eq('Rij 49.999 krijgt minimale scroll naar onderrand',
    minimalScrollTopForRow(target, 0, VIEWPORT, ROW_HEIGHT, ROWS), expected);
  eq('Reeds zichtbare doelrij verandert scroll niet',
    minimalScrollTopForRow(target, expected, VIEWPORT, ROW_HEIGHT, ROWS), expected);
  eq('Eerste rij scrollt exact naar nul',
    minimalScrollTopForRow(0, expected, VIEWPORT, ROW_HEIGHT, ROWS), 0);
}

{
  const columns = Array.from({ length: 12 }, (_, index) => ({
    id: taskColumnId(`c${index}`), width: 100, pinned: index === 0 || index === 11,
  }));
  const visible = virtualizeTaskColumns(columns, 4, 8);
  eq('Kolomwindow bevat gewone bereikindices', visible.map(column => column.id),
    [columns[0], ...columns.slice(4, 8), columns[11]].map(column => column.id));
  eq('Pinned kolom vóór window blijft gemount', visible.some(column => column.id === columns[0].id), true);
  eq('Pinned kolom ná window blijft gemount', visible.some(column => column.id === columns[11].id), true);
  eq('Kolomvirtualisatie dedupliceert overlap met pinned',
    virtualizeTaskColumns(columns, 0, 2).map(column => column.id), [columns[0].id, columns[1].id, columns[11].id]);
}

{
  const empty = computeVirtualWindow({ totalRows: 0, rowHeight: ROW_HEIGHT, viewportHeight: VIEWPORT, scrollTop: 100 });
  eq('Nul rijen mount niets', empty.mountedRows, []);
  eq('Nul rijen heeft nul spacers', [empty.topSpacerHeight, empty.bottomSpacerHeight], [0, 0]);
}

// De pure gridkern mag niet stil een store-, React- of DOM-module worden.
{
  let root = process.cwd();
  if (!existsSync(join(root, 'package.json'))) {
    root = dirname(fileURLToPath(import.meta.url));
    while (!existsSync(join(root, 'package.json')) && dirname(root) !== root) root = dirname(root);
  }
  for (const file of ['rowIndex.ts', 'selection.ts', 'navigation.ts', 'virtualization.ts']) {
    const source = readFileSync(join(root, 'src/engine/taskGrid', file), 'utf8');
    for (const forbidden of ['useAppStore', "from 'react'", 'document.', 'window.']) {
      eq(`${file} blijft vrij van ${forbidden}`, source.includes(forbidden), false);
    }
  }
}

if (diffs.length > 0) {
  console.error(`FAIL task-grid-virtualization: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  task-grid-virtualization: ${checks}/${checks}`);
}
