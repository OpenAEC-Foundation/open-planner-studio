// Issue #89 — presentatie van de taakgrid: hiërarchie-inspringing van de naamcel, één tooltip
// per cel (volledige waarde alleen bij afknippen, kolomuitleg altijd, taakkaart alleen op een
// relatielink), de vrijstaande plusknop van de kolomkiezer en de naameditor over de volle
// kolombreedte. Pure functies worden direct getoetst; de DOM-/CSS-afspraken via de bron.
import fs from 'node:fs';
import path from 'node:path';
import { GROUPED_NAME_INDENT_UNIT, TASK_NAME_INDENT_UNIT, taskNameIndent } from '@/engine/taskGrid/nameIndent';
import { isClippedBoxTruncated, isGridCellTruncated, resolveGridCellTitle } from '@/engine/taskGrid/cellTitle';

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
const unit = TASK_NAME_INDENT_UNIT;
eq('Samenvatting op niveau 0 begint bij 0 (triehoekje), een blad laat het slot leeg',
  [taskNameIndent(0, true), taskNameIndent(0, false)], [0, unit]);
eq('Triehoekje van niveau 1 staat op de tekstkolom van niveau 0',
  taskNameIndent(1, true), taskNameIndent(0, false));
eq('Tekst van niveau 1 staat één eenheid voorbij zijn triehoekje, voor blad en samenvatting gelijk',
  [taskNameIndent(1, false), taskNameIndent(1, true) + unit], [2 * unit, 2 * unit]);
eq('Het patroon loopt door op diepere niveaus',
  [taskNameIndent(3, true), taskNameIndent(3, false)], [3 * unit, 4 * unit]);
eq('Negatieve of gebroken diepte klemt op niveau 0', [taskNameIndent(-2, false), taskNameIndent(1.7, true)], [unit, unit]);
// Gegroepeerd: geen boom, dus geen triehoekje-slot; de naam volgt de stap van de groepskop.
eq('Gegroepeerde rijen reserveren geen triehoekje-slot en volgen de groepskopstap',
  [taskNameIndent(0, false, 'grouped'), taskNameIndent(1, false, 'grouped'), taskNameIndent(2, false, 'grouped')],
  [0, GROUPED_NAME_INDENT_UNIT, 2 * GROUPED_NAME_INDENT_UNIT]);
ok('De groepskop in DataGridCore deelt die stap',
  /8 \+ row\.depth \* GROUPED_NAME_INDENT_UNIT/.test(read('src/components/task-grid/DataGridCore.tsx')));

const styles = read('src/styles/globals.css');
const cssRule = (pattern: RegExp): string => pattern.exec(styles)?.[1] ?? '';
const disclosureRule = cssRule(/\.full-task-grid-disclosure\s*\{([^}]*)\}/);
const nameRowRule = cssRule(/\.full-task-grid-name\s*\{([^}]*)\}/);
const disclosureWidth = Number(/width:\s*(\d+)px/.exec(disclosureRule)?.[1] ?? NaN);
const nameGap = Number(/gap:\s*(\d+)px/.exec(nameRowRule)?.[1] ?? NaN);
eq('De inspringeenheid is exact triehoekje plus flex-gap uit globals.css',
  disclosureWidth + nameGap, TASK_NAME_INDENT_UNIT);

const fullGrid = read('src/components/task-grid/FullTaskGrid.tsx');
ok('De naamrij springt in via taskNameIndent (boom óf gegroepeerd) en niet via een losse diepte-vermenigvuldiging',
  /taskNameIndent\(row\.depth,\s*hasDisclosure,\s*nameIndentMode\)/.test(fullGrid)
    && !/row\.depth\s*\*\s*14/.test(fullGrid));
ok('De subtaak-plus wordt rechts uitgelijnd en staat vrij van de kolomrand',
  cssRule(/\.gantt-task-grid-add-child\s*\{([^}]*)\}/).includes('margin-inline-start: auto')
    && /margin-inline-end:\s*[4-9]px/.test(cssRule(/\.gantt-task-grid-add-child\s*\{([^}]*)\}/)));
ok('Auto-fit van de naamkolom telt inspringing en plus mee',
  /leadingWidth:\s*columnId === 'task\.name'/.test(fullGrid)
    && /row\.leadingWidth/.test(read('src/engine/taskGrid/preferences.ts')));
ok('Editorinhoud vult de resterende kolombreedte, ook genest in de naamrij',
  /\.task-grid-cell-content:has\(\.task-grid-editor-host\)\s*\{[^}]*flex:\s*1 1 auto/.test(styles)
    && /\.full-task-grid-name\s*>\s*\.task-grid-editor-host\s*\{[^}]*flex:\s*1 1 auto/.test(styles));

// ── Tooltips ────────────────────────────────────────────────────────────────────────────────
eq('Kolomuitleg wint altijd, ook zonder afknippen',
  resolveGridCellTitle({ tooltip: 'Geen baseline', title: '—', text: '—', truncated: false }), 'Geen baseline');
eq('Een waarde die de zichtbare tekst herhaalt is alleen een tooltip wanneer de cel afknipt',
  [
    resolveGridCellTitle({ title: 'Beton storten fundering', text: 'Beton storten fundering', truncated: false }),
    resolveGridCellTitle({ title: 'Beton storten fundering', text: 'Beton storten fundering', truncated: true }),
  ], [undefined, 'Beton storten fundering']);
eq('Een waarde die méér zegt dan de weergave (ISO-instant, technische JSON) blijft altijd zichtbaar',
  [
    resolveGridCellTitle({ title: '2026-01-01T08:30:45.123Z', text: '01-01-2026 08:30', truncated: false }),
    resolveGridCellTitle({ title: '["r-1","r-2"]', text: '2', truncated: false }),
  ], ['2026-01-01T08:30:45.123Z', '["r-1","r-2"]']);
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
    && /resolveGridCellTitle\(\{/.test(gridCell)
    && /onMouseEnter=\{measureTruncation\}/.test(gridCell));
ok('De contentspan en het naamlabel dragen het clipattribuut waarop de meting steunt, via de gedeelde constante',
  /\[GRID_CLIP_ATTRIBUTE\]:\s*'true'/.test(gridCell)
    && /full-task-grid-name-label"\s+\{\.\.\.\{\s*\[GRID_CLIP_ATTRIBUTE\]:\s*'true'/.test(fullGrid));
ok('Geen rij-hover meer in de gridkern (de taakkaart volgt de muis niet over datarijen)',
  !/onDataRowMouseMove/.test(read('src/components/task-grid/DataGridCore.tsx')));

const relationCell = read('src/components/task-grid/RelationCellEditor.tsx');
const relationChip = /className=\{`task-grid-relation-chip[\s\S]*?<button/.exec(relationCell)?.[0] ?? '';
ok('De relatiechip heeft geen eigen native title meer; de details staan in de hoverkaart',
  relationChip !== '' && !/\btitle=/.test(relationChip)
    && /function RelationTooltipDetails/.test(relationCell)
    && /<RelationTooltipDetails item=\{hover\.item\} \/>/.test(relationCell));
ok('De sturend- en waarschuwingsiconen houden hun eigen tekst als native title',
  /className="task-grid-relation-icon task-grid-relation-icon--driving" title=\{t\('relations\.driving'\)\}/.test(relationCell)
    && /className="task-grid-relation-icon task-grid-relation-icon--warning" title=\{relationWarningTexts\(item, t\)\.join/.test(relationCell));
ok('Elke relatiechip draagt de richting als data-attribuut, zodat de rolkleur uit CSS komt (issue #94)',
  /data-relation-direction=\{item\.direction\}/.test(relationCell));
const relationStyles = read('src/styles/globals.css');
ok('De rolkleur van voorganger/opvolger komt uit thema-variabelen, niet uit --theme-accent op de chip',
  /\.task-grid-relation-chip\[data-relation-direction="predecessor"\][^{]*\{\s*color:\s*var\(--relation-predecessor\);/.test(relationStyles)
    && /\.task-grid-relation-chip\[data-relation-direction="successor"\][^{]*\{\s*color:\s*var\(--relation-successor\);/.test(relationStyles)
    && !/\.task-grid-relation-jump\s*\{[^}]*color:\s*var\(--theme-accent\)/.test(relationStyles));
ok('Sturend is een sterkere tint van dezelfde rolkleur (eigen driving-variabelen), niet los wel/geen kleur',
  /\.task-grid-relation-chip--driving\[data-relation-direction="predecessor"\][\s\S]*?color:\s*var\(--relation-predecessor-driving\);/.test(relationStyles)
    && /\.task-grid-relation-chip--driving\[data-relation-direction="successor"\][\s\S]*?color:\s*var\(--relation-successor-driving\);/.test(relationStyles));
ok('Het warning-icoon houdt zijn eigen --warning-kleur, los van de rolkleur',
  /\.task-grid-relation-chip--warning \.task-grid-relation-icon--warning > svg\s*\{\s*color:\s*var\(--warning,/.test(relationStyles));
for (const theme of ['dark', 'light', 'high-contrast']) {
  const block = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(relationStyles)?.[1] ?? '';
  ok(`Thema "${theme}" definieert alle vier de relatie-rolkleurvariabelen als hex-kleur`,
    block !== ''
      && ['--relation-predecessor', '--relation-predecessor-driving', '--relation-successor', '--relation-successor-driving']
        .every(name => new RegExp(`${name}:\\s*#[0-9A-Fa-f]{6};`).test(block)));
}
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
