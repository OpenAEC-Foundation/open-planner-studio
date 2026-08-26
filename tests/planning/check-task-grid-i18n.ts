import fs from 'node:fs';
import path from 'node:path';

const LOCALES = ['ar', 'de', 'en', 'es', 'fa', 'fr', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'tr', 'zh'] as const;

/** Alle door de nieuwe taakgrid zelf gebruikte teksten; bestaande domeinlabels staan hier ook in,
 * zodat hergebruik niet stil terug kan vallen op de standaardtaal. */
const TASK_GRID_KEYS = [
  'table.addColumn',
  'table.chooseColumn',
  'table.recentColumns',
  'table.noColumns',
  'table.toggleSummary',
  'table.calculatedReadOnly',
  'taskGrid.category.task',
  'taskGrid.category.planning',
  'taskGrid.category.constraints',
  'taskGrid.category.relations',
  'taskGrid.category.resources',
  'taskGrid.category.progress',
  'taskGrid.category.computed',
  'taskGrid.category.baseline',
  'taskGrid.category.custom',
  'taskGrid.category.technical',
  'taskGrid.status.stale',
  'taskGrid.validation.readOnly',
  'taskGrid.validation.invalid',
  'taskGrid.validation.relationToken',
  'taskGrid.validation.externalRelationRequiresDialog',
  'taskGrid.validation.invalidLag',
  'taskGrid.validation.ambiguousWbs',
  'taskGrid.validation.unknownWbs',
  'taskGrid.validation.taskIdentity',
  'taskGrid.validation.cycle',
  'taskGrid.controls.collapse',
  'taskGrid.controls.expand',
  'taskGrid.controls.resize',
  'taskGrid.controls.remove',
  'taskGrid.controls.pin',
  'taskGrid.controls.unpin',
  'taskGrid.controls.autoFit',
  'taskGrid.controls.search',
  'taskGrid.controls.searchResults',
  'taskGrid.controls.noResults',
  'taskGrid.history.addColumn',
  'taskGrid.history.removeColumn',
  'taskGrid.history.pinColumn',
  'taskGrid.history.unpinColumn',
  'taskGrid.history.moveColumn',
  'taskGrid.history.resizeColumn',
  'taskGrid.history.autoFitColumn',
  'taskGrid.summary.activityCodeAssignments',
  'taskGrid.summary.customFields',
  'taskGrid.summary.internalRelations',
  'taskGrid.summary.externalRelations',
  'taskGrid.summary.baselineMissing',
  'relations.jumpTask',
  'relations.externalTask',
  'relations.controlType',
  'relations.controlLag',
  'relations.removeInternal',
  'relations.removeExternal',
  'relations.searchPlaceholder',
  'relations.driving',
  'relations.freeFloat',
  'relations.warnings',
  'relations.warnDropped',
  'relations.warnTruncatedLead',
  'relations.warnLeadExceedsDuration',
  'relations.warnOutOfSequence',
  'relations.warnSourceMissing',
  'externalLinks.projectId',
  'externalLinks.taskId',
  'externalLinks.anchorDate',
  'externalLinks.sourceFile',
  'externalLinks.sourceMissing',
  'externalLinks.source',
  'externalLinks.sourceAvailable',
  'externalLinks.action',
  'externalLinks.edit',
  'externalLinks.refreshSource',
  'externalLinks.deleteRelation',
] as const;

const root = process.cwd();
const registrySource = fs.readFileSync(
  path.join(root, 'src/engine/taskGrid/taskColumnRegistry.ts'),
  'utf8',
);
const COLUMN_KEYS = [...new Set(
  [...registrySource.matchAll(/labelKey: '(taskGrid\.columns\.[^']+)'/g)].map(match => match[1]),
)].sort();
const REQUIRED_KEYS = [...TASK_GRID_KEYS, ...COLUMN_KEYS];
const failures: string[] = [];
let checks = 0;
const ok = (label: string, condition: boolean): void => {
  checks++;
  if (!condition) failures.push(label);
};
const readJson = (locale: string, namespace: string): unknown => JSON.parse(fs.readFileSync(
  path.join(root, 'src/i18n/locales', locale, `${namespace}.json`), 'utf8',
));
const at = (value: unknown, dotted: string): unknown => dotted.split('.').reduce<unknown>((current, key) => (
  current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
), value);
const variables = (text: string): string[] => [...text.matchAll(/{{\s*([A-Za-z0-9_]+)\s*}}/g)]
  .map(match => match[1]).sort();

const taskByLocale = new Map(LOCALES.map(locale => [locale, readJson(locale, 'task')] as const));
const dutch = taskByLocale.get('nl')!;
for (const key of REQUIRED_KEYS) {
  const dutchValue = at(dutch, key);
  ok(`${key}: Nederlandse brontekst bestaat`, typeof dutchValue === 'string' && dutchValue.trim().length > 0);
  const expectedVariables = typeof dutchValue === 'string' ? variables(dutchValue) : [];
  for (const locale of LOCALES) {
    const value = at(taskByLocale.get(locale), key);
    ok(`${locale}: ${key} bestaat en is niet leeg`, typeof value === 'string' && value.trim().length > 0);
    ok(`${locale}: ${key} heeft exact dezelfde interpolatievariabelen`,
      typeof value === 'string' && JSON.stringify(variables(value)) === JSON.stringify(expectedVariables));
  }
}

const english = taskByLocale.get('en')!;
for (const key of [
  'taskGrid.history.addColumn',
  'taskGrid.history.autoFitColumn',
  'taskGrid.summary.baselineMissing',
  'relations.jumpTask',
  'relations.removeExternal',
  'relations.warnOutOfSequence',
  'externalLinks.edit',
  'externalLinks.refreshSource',
] as const) {
  const englishValue = at(english, key);
  for (const locale of LOCALES.filter(candidate => candidate !== 'en')) {
    ok(`${locale}: ${key} valt niet stil terug op Engels`, at(taskByLocale.get(locale), key) !== englishValue);
  }
}

const relationEditor = fs.readFileSync(path.join(root, 'src/components/task-grid/RelationCellEditor.tsx'), 'utf8');
const fullGrid = fs.readFileSync(path.join(root, 'src/components/task-grid/FullTaskGrid.tsx'), 'utf8');
const relationCell = fs.readFileSync(path.join(root, 'src/engine/taskGrid/relationCell.ts'), 'utf8');
const registry = registrySource;
const navigation = fs.readFileSync(path.join(root, 'src/engine/taskGrid/navigation.ts'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8');

ok('relatiecellen en -editor gebruiken de task-namespace',
  /useTranslation\('task'\)/.test(relationEditor));
for (const hardcoded of [
  'Spring naar taak', 'Externe taak', 'Sturend', 'Waarschuwing', 'relatietype', 'vertraging',
  'Verwijder relatie', 'WBS of taaknaam', 'Externe relatie toevoegen', 'Bevroren anker',
]) {
  ok(`relatie-editor bevat geen harde Nederlandse UI-tekst: ${hardcoded}`, !relationEditor.includes(hardcoded));
}
for (const hardcoded of ['Externe relatie bewerken', 'Bron vernieuwen', 'Relatie verwijderen', 'Kolom ${label}']) {
  ok(`taakgridoppervlak bevat geen harde Nederlandse UI-tekst: ${hardcoded}`, !fullGrid.includes(hardcoded));
}
ok('waarschuwingstekst komt via de contextvertaler en niet uit een Nederlandse tabel',
  !relationCell.includes('WARNING_LABELS') && relationCell.includes('labelWarning'));
ok('technische samenvattingen en baselinetooltip gebruiken vertaalsleutels',
  registry.includes('taskGrid.summary.activityCodeAssignments')
    && registry.includes('taskGrid.summary.baselineMissing')
    && !registry.includes('codetoewijzing(en)')
    && !registry.includes('Niet aanwezig in deze baseline'));

ok('RTL-pijlnavigatie volgt de fysieke buren en laat Tab in logische volgorde',
  navigation.includes("const columnDelta = event.key === 'ArrowLeft' ? -1 : 1")
    && navigation.includes("event.key === 'Tab'")
    && !navigation.includes("input.textDirection === 'rtl'"));
ok('forced-colors bewaart niet-kleurkenmerken voor alle kritieke celstaten',
  /@media \(forced-colors: active\)[\s\S]*data-grid-selected[\s\S]*data-grid-active[\s\S]*data-grid-readonly[\s\S]*data-grid-stale[\s\S]*aria-invalid[\s\S]*task-grid-relation-chip--driving/.test(styles));

if (failures.length > 0) {
  console.error(`FAIL task-grid-i18n: ${failures.length}/${checks}`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`OK task-grid-i18n: ${checks}/${checks}`);
