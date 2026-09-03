// Issue #89 — presentatie van de taakgrid: hiërarchie-inspringing van de naamcel, één tooltip
// per cel (volledige waarde alleen bij afknippen, kolomuitleg altijd, taakkaart alleen op een
// relatielink), de vrijstaande plusknop van de kolomkiezer en de naameditor over de volle
// kolombreedte. Pure functies worden direct getoetst; de DOM-/CSS-afspraken via de bron.
import fs from 'node:fs';
import path from 'node:path';
import { TASK_NAME_INDENT_UNIT, taskNameIndent, taskNameTextOffset } from '@/engine/taskGrid/nameIndent';
import { isClippedBoxTruncated, resolveGridCellTitle } from '@/engine/taskGrid/cellTitle';
import { isGridCellTruncated } from '@/components/task-grid/GridCell';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, value: boolean): void {
  checks++;
  if (!value) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
}
const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

// ── Inspringing ──────────────────────────────────────────────────────────────────────────────
// Het triehoekje van een subtaak staat waar de naam van zijn ouder begint; een blad zonder
// triehoekje begint zijn naam op dezelfde kolom als een samenvatting op hetzelfde niveau.
eq('Samenvatting op niveau 0 begint bij 0 (triehoekje) en tekst bij één eenheid',
  [taskNameIndent(0, true), taskNameTextOffset(0)], [0, TASK_NAME_INDENT_UNIT]);
eq('Blad op niveau 0 laat het triehoekje-slot leeg en begint zijn tekst op dezelfde kolom',
  [taskNameIndent(0, false), taskNameTextOffset(0)], [TASK_NAME_INDENT_UNIT, TASK_NAME_INDENT_UNIT]);
eq('Triehoekje van niveau 1 staat op de tekstkolom van niveau 0',
  taskNameIndent(1, true), taskNameTextOffset(0));
eq('Tekst van niveau 1 staat één eenheid voorbij zijn triehoekje, voor blad en samenvatting gelijk',
  [taskNameIndent(1, false), taskNameIndent(1, true) + TASK_NAME_INDENT_UNIT, taskNameTextOffset(1)],
  [2 * TASK_NAME_INDENT_UNIT, 2 * TASK_NAME_INDENT_UNIT, 2 * TASK_NAME_INDENT_UNIT]);
eq('Het patroon loopt door op diepere niveaus',
  [taskNameIndent(3, true), taskNameIndent(3, false)], [3 * TASK_NAME_INDENT_UNIT, 4 * TASK_NAME_INDENT_UNIT]);
eq('Negatieve of gebroken diepte klemt op niveau 0', [taskNameIndent(-2, false), taskNameIndent(1.7, true)], [TASK_NAME_INDENT_UNIT, TASK_NAME_INDENT_UNIT]);

const styles = read('src/styles/globals.css');
const cssRule = (pattern: RegExp): string => pattern.exec(styles)?.[1] ?? '';
const disclosureRule = cssRule(/\.full-task-grid-disclosure\s*\{([^}]*)\}/);
const nameRowRule = cssRule(/\.full-task-grid-name\s*\{([^}]*)\}/);
const disclosureWidth = Number(/width:\s*(\d+)px/.exec(disclosureRule)?.[1] ?? NaN);
const nameGap = Number(/gap:\s*(\d+)px/.exec(nameRowRule)?.[1] ?? NaN);
eq('De inspringeenheid is exact triehoekje plus flex-gap uit globals.css',
  disclosureWidth + nameGap, TASK_NAME_INDENT_UNIT);

const fullGrid = read('src/components/task-grid/FullTaskGrid.tsx');
ok('De naamrij springt in via taskNameIndent en niet via een losse diepte-vermenigvuldiging',
  /paddingInlineStart:\s*taskNameIndent\(row\.depth,\s*hasDisclosure\)/.test(fullGrid)
    && !/row\.depth\s*\*\s*14/.test(fullGrid));
ok('De subtaak-plus staat ná de naamtekst en wordt rechts uitgelijnd',
  /\{body\}[\s\S]*?className="gantt-task-grid-add-child"/.test(fullGrid)
    && cssRule(/\.gantt-task-grid-add-child\s*\{([^}]*)\}/).includes('margin-inline-start: auto'));
ok('De naameditor staat binnen dezelfde inspringrij als de naamtekst',
  /renderNameRow\(task,\s*editor,\s*true\)/.test(fullGrid)
    && /\.full-task-grid-name\s*>\s*\.task-grid-editor-host\s*\{[^}]*flex:\s*1 1 auto/.test(styles));
ok('De celinhoud met een editor vult de resterende kolombreedte',
  /\.task-grid-cell-content:has\(\.task-grid-editor-host\)\s*\{[^}]*flex:\s*1 1 auto/.test(styles));

// ── Tooltips ────────────────────────────────────────────────────────────────────────────────
eq('Kolomuitleg wint altijd, ook zonder afknippen',
  resolveGridCellTitle({ tooltip: 'Geen baseline', title: '—', truncated: false }), 'Geen baseline');
eq('Volledige waarde alleen wanneer de cel afknipt',
  [
    resolveGridCellTitle({ title: 'Beton storten fundering', truncated: false }),
    resolveGridCellTitle({ title: 'Beton storten fundering', truncated: true }),
  ], [undefined, 'Beton storten fundering']);
eq('Zonder enige bron geen tooltip', resolveGridCellTitle({ truncated: true }), undefined);
eq('Afknippen is meer inhoud dan zichtbaar', [
  isClippedBoxTruncated({ scrollWidth: 120, clientWidth: 80 }),
  isClippedBoxTruncated({ scrollWidth: 80, clientWidth: 80 }),
], [true, false]);
eq('Een cel is afgeknipt zodra één van zijn clipboxen afknipt (bv. het geneste naamlabel)', [
  isGridCellTruncated({ querySelectorAll: () => [{ scrollWidth: 80, clientWidth: 80 }, { scrollWidth: 90, clientWidth: 60 }] }),
  isGridCellTruncated({ querySelectorAll: () => [{ scrollWidth: 80, clientWidth: 80 }] }),
  isGridCellTruncated({ querySelectorAll: () => [] }),
], [true, false, false]);

const gridCell = read('src/components/task-grid/GridCell.tsx');
ok('GridCell zet de native title niet meer onvoorwaardelijk op de volledige celwaarde',
  !/title=\{model\.title\}/.test(gridCell)
    && /resolveGridCellTitle\(\{\s*tooltip:\s*model\.tooltip,\s*title:\s*model\.title,\s*truncated\s*\}\)/.test(gridCell)
    && /onMouseEnter=\{measureTruncation\}/.test(gridCell));
ok('De contentspan en het naamlabel dragen het clipattribuut waarop de meting steunt',
  /className="task-grid-cell-content"\s+data-grid-clip="true"/.test(gridCell)
    && /className="full-task-grid-name-label"\s+data-grid-clip="true"/.test(fullGrid));
ok('De taakkaart volgt niet meer de muis over gewone datarijen',
  !/onDataRowMouseMove/.test(fullGrid)
    && !/HoverTooltip/.test(fullGrid)
    && !/onDataRowMouseMove/.test(read('src/components/task-grid/DataGridCore.tsx')));

const relationCell = read('src/components/task-grid/RelationCellEditor.tsx');
const relationChip = /className=\{`task-grid-relation-chip[\s\S]*?<button/.exec(relationCell)?.[0] ?? '';
ok('De relatiechip heeft geen eigen native title meer; de details staan in de hoverkaart',
  relationChip !== '' && !/\btitle=/.test(relationChip)
    && /function RelationTooltipDetails/.test(relationCell)
    && /<RelationTooltipDetails item=\{hover\.item\} \/>/.test(relationCell));
ok('De relatielink onderdrukt de celtooltip erboven met een lege title',
  /className="task-grid-relation-jump"\s+title=""/.test(relationCell));
ok('De relatiecel meet afknippen op zijn eigen clipbox',
  /className="task-grid-relation-cell"\s+data-grid-clip="true"/.test(relationCell));

// ── Validatiemeldingen ──────────────────────────────────────────────────────────────────────
ok('Wissen, plakken en de celeditor vallen terug op vertaalde algemene meldingen, niet op Nederlands',
  !/defaultValue:\s*'Wissen/.test(fullGrid)
    && !/defaultValue:\s*'Plakken/.test(fullGrid)
    && !/defaultValue:\s*'De ingevoerde waarde/.test(fullGrid)
    && /validationMessage\(planned\.errors\[0\],\s*'taskGrid\.validation\.clearNotPossible'\)/.test(fullGrid)
    && /validationMessage\(result\.errors\[0\],\s*'taskGrid\.validation\.clearFailed'\)/.test(fullGrid)
    && /validationMessage\(planned\.errors\[0\],\s*'taskGrid\.validation\.pasteNotPossible'\)/.test(fullGrid)
    && /validationMessage\(result\.errors\[0\],\s*'taskGrid\.validation\.pasteFailed'\)/.test(fullGrid)
    && /validationMessage\(\{\s*messageKey\s*\},\s*'taskGrid\.validation\.invalid'\)/.test(fullGrid));

if (diffs.length) {
  for (const diff of diffs) console.log(`XX ${diff}`);
  console.log(`XX ${diffs.length} afwijking(en) in taakgrid-presentatie`);
  process.exit(1);
}
console.log(`taakgrid-presentatie: ${checks} checks OK`);
