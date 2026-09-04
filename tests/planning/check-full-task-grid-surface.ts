import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const diffs: string[] = [];
let checks = 0;

function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

const app = read('src/App.tsx');
const fullGridPath = path.join(root, 'src/components/task-grid/FullTaskGrid.tsx');
const tableEditor = read('src/components/panels/TableEditor.tsx');
const ribbonConfig = read('src/components/layout/Ribbon/ribbonConfig.tsx');
const englishTaskLocale = read('src/i18n/locales/en/task.json');
const dutchTaskLocale = read('src/i18n/locales/nl/task.json');
const propertiesPanel = read('src/components/panels/TaskPropertiesPanel.tsx');

ok('App importeert FullTaskGrid als de volledige Tabel-surface',
  /import\s+\{\s*FullTaskGrid\s*\}\s+from\s+'@\/components\/task-grid\/FullTaskGrid'/.test(app));
ok('activeTab table rendert FullTaskGrid',
  /activeTab\s*===\s*'table'\s*&&\s*<FullTaskGrid\s*\/>/.test(app));
ok('De nieuwe FullTaskGrid-component bestaat', fs.existsSync(fullGridPath));

if (fs.existsSync(fullGridPath)) {
  const fullGrid = fs.readFileSync(fullGridPath, 'utf8');
  ok('FullTaskGrid gebruikt de gedeelde TaskGrid-component',
    /import\s+\{\s*TaskGrid\s*\}/.test(fullGrid) && /<TaskGrid\b/.test(fullGrid));
  ok('FullTaskGrid gebruikt de gedeelde taakadapter',
    /createTaskGridAdapter/.test(fullGrid));
  ok('FullTaskGrid draagt exact surface-id full-task-grid',
    /surfaceId\s*=\s*["']full-task-grid["']/.test(fullGrid));
  ok('Ontbrekende kolomvertalingen vallen terug op een leesbaar label en nooit op de interne sleutel',
    /function resolveColumnLabel/.test(fullGrid)
      && !/labelForColumn:\s*labelKey\s*=>\s*tTask\(labelKey,\s*\{\s*defaultValue:\s*labelKey/.test(fullGrid));
  ok('De stale-status wordt voor het tonen vertaald',
    /statusText:\s*resolveGridStatusLabel\(\s*base\.statusText/.test(fullGrid));
  ok('Relatiecellen delen issue-65-tooltip en focusOnTask in beide gridsurfaces',
    /<RelationCellContent/.test(fullGrid)
      && /onFocusTask=\{focusOnTask\}/.test(fullGrid)
      && /buildRelationCellItems/.test(fullGrid));
  ok('Externe relatietokens hebben een rechtsklikroute voor bewerken, verversen en verwijderen',
    /onExternalContextMenu/.test(fullGrid)
      && /refreshExternalAnchorsFrom/.test(fullGrid)
      && /removeExternalLink/.test(fullGrid)
      && /<ExternalLinkDialog/.test(fullGrid));
  ok('Open editors en relatiemenu’s zijn aan het actieve document gebonden',
    /activeDocumentId/.test(fullGrid)
      && /documentId:\s*activeDocumentId/.test(fullGrid)
      && /editing\?\.documentId\s*===\s*activeDocumentId/.test(fullGrid)
      && /externalRelationDialog\?\.documentId\s*===\s*activeDocumentId/.test(fullGrid));
  ok('Het externe-relatiemenu focust een menu-item en ondersteunt volledige pijltoetsnavigatie',
    /externalRelationMenuRef/.test(fullGrid)
      && /nextTaskGridMenuIndex/.test(fullGrid)
      && /ArrowDown/.test(fullGrid)
      && /Home/.test(fullGrid)
      && /externalRelationMenu\?\.trigger/.test(fullGrid));
  ok('Auto-fit meet de werkelijk gelokaliseerde celtekst en bindt de cache aan document en font',
    /adapter\.getCell\(row\.rowKey,\s*columnId\)/.test(fullGrid)
      && /taskGridAutoFitValueVersion/.test(fullGrid)
      && /activeDocumentId/.test(fullGrid));
  ok('De Gantt-plus gebruikt een lokale kolomkiezer en activeert niet onbedoeld de Tabel-tab',
    /chooserOpen=\{surfaceId === 'full-task-grid' \? showColumnsDialog : undefined\}/.test(fullGrid)
      && /onChooserOpenChange=\{surfaceId === 'full-task-grid'/.test(fullGrid));
  const clearCommand = /if \(command\.kind === 'clear-cells'\) \{([\s\S]*?)\n    \}/.exec(fullGrid)?.[1] ?? '';
  ok('Delete en Backspace plannen een atomaire cel-clear en verwijderen geen taken',
    /planTaskGridClear\(clipboardEnvironment\(\)\)/.test(clearCommand)
      && !/deleteTasksBulk/.test(clearCommand));
  ok('Pastevalidatie gebruikt geen hardgecodeerde enabledByBatch-whitelist meer',
    !read('src/state/gridTransaction.ts').includes('enabledByBatch'));
  ok('Selectiewissels gebruiken een vooraf gebouwde adapterdomeinprojectie',
    /createTaskGridAdapter\(\{[\s\S]*?selectedTaskIds[\s\S]*?\}, adapterDomain\)/.test(fullGrid));
  const adapterDomainMemo = fullGrid.match(
    /const adapterDomain = useMemo\([\s\S]*?\n  const adapter = useMemo/,
  )?.[0] ?? '';
  ok('De stabiele adapterdomeinmemo hangt niet van selectedTaskIds af',
    adapterDomainMemo.length > 0 && !adapterDomainMemo.includes('selectedTaskIds'));
}

ok('Het eigenschappenpaneel volgt de actieve taak, ook binnen een meervoudige selectie',
  /activeTaskId/.test(propertiesPanel)
    && !/selectedTaskIds\.length\s*>\s*1/.test(propertiesPanel)
    && /tasks\.find\(t\s*=>\s*t\.id\s*===\s*activeTaskId\)/.test(propertiesPanel));

ok('TableEditor bevat geen parallelle interne celrenderer meer',
  !/function FieldCell|const renderCell\s*=|const renderColumnCell\s*=/.test(tableEditor));
ok('De Tabel-tab toont de gedeelde voorganger- en opvolgerknoppen',
  /const tableTab[\s\S]*traceGroup[\s\S]*tableColumnsGroup/.test(ribbonConfig));
ok('Engels en Nederlands bevatten de nieuwe tabelbediening en kolomcategorieen', (() => {
  const en = JSON.parse(englishTaskLocale);
  const nl = JSON.parse(dutchTaskLocale);
  return en.table?.addColumn === 'Add column'
    && nl.table?.addColumn === 'Kolom toevoegen'
    && en.taskGrid?.category?.constraints === 'Constraints'
    && nl.taskGrid?.category?.constraints === 'Beperkingen'
    && en.table?.calculatedReadOnly === 'This calculated column cannot be edited.'
    && nl.table?.calculatedReadOnly === 'Deze berekende kolom kan niet worden bewerkt.';
})());

if (diffs.length > 0) {
  console.error(`FAIL full-task-grid-surface: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  full-task-grid-surface: ${checks}/${checks}`);
