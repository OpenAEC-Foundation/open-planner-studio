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
  'taskStatus.NOT_STARTED',
  'taskStatus.STARTED',
  'taskStatus.COMPLETED',
  'durationType.WORKTIME',
  'durationType.ELAPSEDTIME',
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
  'taskGrid.summary.baselineMissing',
  'properties.assignments.unitsPerDay',
  'properties.assignments.curve',
  'properties.assignments.remove',
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
  'externalLinks.lagPlaceholder',
] as const;

const root = process.cwd();
const registrySource = fs.readFileSync(
  path.join(root, 'src/engine/taskGrid/taskColumnRegistry.ts'),
  'utf8',
);
const COLUMN_KEYS = [...new Set(
  [...registrySource.matchAll(/labelKey: '(taskGrid\.columns\.[^']+)'/g)].map(match => match[1]),
)].sort();
const COUNTED_TASK_GRID_KEYS = [...new Set(
  [...registrySource.matchAll(/labelForText\?\.\(\s*'([^']+)'\s*,\s*\{\s*count\s*:/g)]
    .map(match => match[1]),
)].sort();
// Issue #89: een validatiecode zonder vertaling viel terug op een Nederlandse `defaultValue`, ook in
// een Engelse interface. Elke code die de bron kan opleveren moet daarom in álle talen bestaan;
// de lijst wordt hier uit de bron gelezen, zodat een nieuwe code zonder tekst de poort rood zet.
// De scan kent de helperfuncties die `taskGrid.validation.<code>` bouwen bij naam; een NIEUWE
// helper met dat sjabloon die hier niet in staat, zet de poort eveneens rood (zie hieronder), zodat
// het gat dat de eerste versie van deze scan had (tokenError/globalError in relationPlan.ts) niet
// stil terug kan komen.
const VALIDATION_SOURCE_FILES = [
  ...fs.readdirSync(path.join(root, 'src/engine/taskGrid'))
    .filter(name => name.endsWith('.ts'))
    .map(name => `src/engine/taskGrid/${name}`),
  'src/state/gridTransaction.ts',
  'src/state/slices/taskGridSlice.ts',
  ...fs.readdirSync(path.join(root, 'src/components/task-grid'))
    .filter(name => name.endsWith('.tsx') || name.endsWith('.ts'))
    .map(name => `src/components/task-grid/${name}`),
];
const VALIDATION_HELPERS = ['failure', 'fail', 'error', 'localError', 'validationError', 'tokenError', 'globalError'];
const helperAlternation = VALIDATION_HELPERS.join('|');
const VALIDATION_CODE_PATTERNS = [
  // helper('code', …) en helper(iets, 'code', …)
  new RegExp(`\\b(?:${helperAlternation})\\((?:[^,()]+,\\s*)?'([a-zA-Z]+)'`, 'g'),
  // helper(voorwaarde ? 'a' : 'b', …) — beide takken
  // (de voorwaarde mag haakjes bevatten, zoals `slice.text.includes('/')`)
  // — maar geen komma: dan is het ternair niet het eerste argument)
  new RegExp(`\\b(?:${helperAlternation})\\([^,?]{0,160}?\\?\\s*'([a-zA-Z]+)'\\s*:\\s*'([a-zA-Z]+)'`, 'g'),
  /\bcode:\s*'([a-zA-Z]+)'/g,
  /taskGrid\.validation\.([a-zA-Z]+)/g,
];
const validationSources = new Map(VALIDATION_SOURCE_FILES.map(file => (
  [file, fs.readFileSync(path.join(root, file), 'utf8')] as const
)));
// relationPlan.ts geeft `relationStructureVerdict`-redenen door als code ('unknown-task' wordt
// 'unknownTask'); die literals staan in de scheduler, buiten de gescande mappen.
const relationRules = fs.readFileSync(path.join(root, 'src/engine/scheduler/relationRules.ts'), 'utf8');
const STRUCTURE_REASONS = [...new Set([...relationRules.matchAll(/reason:\s*'([a-z-]+)'/g)].map(match => match[1]))];
const structureCodes = STRUCTURE_REASONS.map(reason => reason === 'unknown-task' ? 'unknownTask' : reason);
const VALIDATION_KEYS = [...new Set([
  ...[...validationSources.values()].flatMap(source => VALIDATION_CODE_PATTERNS.flatMap(pattern => (
    [...source.matchAll(pattern)].flatMap(match => match.slice(1).filter((code): code is string => Boolean(code)))
  ))),
  ...structureCodes,
])].sort().map(code => `taskGrid.validation.${code}`);
// Elke functie die zelf `taskGrid.validation.${…}` bouwt moet in VALIDATION_HELPERS staan, anders
// ziet de scan haar aanroepen niet.
const UNSCANNED_HELPERS = [...validationSources.entries()].flatMap(([file, source]) => (
  [...source.matchAll(/function (\w+)\([^)]*\)[^{]*\{[\s\S]*?\n\}/g)]
    .filter(match => match[0].includes('taskGrid.validation.${'))
    .map(match => match[1])
    .filter(name => !VALIDATION_HELPERS.includes(name))
    .map(name => `${file}: ${name}`)
));
const REQUIRED_KEYS = [...new Set([...TASK_GRID_KEYS, ...COLUMN_KEYS, ...VALIDATION_KEYS])];
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

ok('De bronscan vindt de validatiecodes uit clipboard, editplan, transactie, editor en relatieplan',
  ['taskGrid.validation.required', 'taskGrid.validation.pasteBounds', 'taskGrid.validation.tsvQuote',
    'taskGrid.validation.documentChanged', 'taskGrid.validation.prepareRejected',
    'taskGrid.validation.clearNotPossible', 'taskGrid.validation.relationSetConflict',
    // via tokenError/globalError, een ternair eerste argument en de structuurredenen
    'taskGrid.validation.duplicateRelationId', 'taskGrid.validation.cycle',
    'taskGrid.validation.externalRelationRequiresDialog', 'taskGrid.validation.relationToken',
    'taskGrid.validation.unknownTask', 'taskGrid.validation.self', 'taskGrid.validation.ancestor']
    .every(key => VALIDATION_KEYS.includes(key)));
ok(`Elke helper die taskGrid.validation.<code> bouwt staat in de scanlijst (ontbreekt: ${UNSCANNED_HELPERS.join(', ') || 'geen'})`,
  UNSCANNED_HELPERS.length === 0);
ok('De structuurredenen van relationRules.ts zijn gevonden', STRUCTURE_REASONS.length >= 3);
ok('De checker vindt alle vier registryteksten die met count worden aangeroepen',
  COUNTED_TASK_GRID_KEYS.length === 4);
for (const key of COUNTED_TASK_GRID_KEYS) {
  for (const locale of LOCALES) {
    const taskLocale = taskByLocale.get(locale);
    ok(`${locale}: ${key} gebruikt geen kale sleutel die CLDR-selectie omzeilt`,
      at(taskLocale, key) === undefined);
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    for (const category of categories) {
      const pluralKey = key.replace(/([^.]+)$/, `$1_${category}`);
      const value = at(taskLocale, pluralKey);
      ok(`${locale}: ${pluralKey} bestaat voor de CLDR-categorie ${category}`,
        typeof value === 'string' && value.trim().length > 0);
      ok(`${locale}: ${pluralKey} interpoleert exact count`,
        typeof value === 'string' && JSON.stringify(variables(value)) === JSON.stringify(['count']));
    }
  }
}

const commonByLocale = new Map(LOCALES.map(locale => [locale, readJson(locale, 'common')] as const));
const relationColumnWords: Record<(typeof LOCALES)[number], readonly [string, string]> = {
  ar: ['السابقة', 'اللاحقة'],
  de: ['Vorgänger', 'Nachfolger'],
  en: ['Predecessors', 'Successors'],
  es: ['Predecesores', 'Sucesores'],
  fa: ['پیش‌نیازها', 'پس‌نیازها'],
  fr: ['Prédécesseurs', 'Successeurs'],
  it: ['Predecessori', 'Successori'],
  ja: ['先行タスク', '後続タスク'],
  ko: ['선행 작업', '후속 작업'],
  nl: ['voorganger', 'opvolger'],
  pl: ['Poprzedniki', 'Następniki'],
  pt: ['Predecessoras', 'Sucessoras'],
  tr: ['Öncüller', 'Ardıllar'],
  zh: ['前置任务', '后续任务'],
};
for (const locale of LOCALES) {
  const value = at(commonByLocale.get(locale), 'notifications.summaryRelationsDropped');
  const [predecessor, successor] = relationColumnWords[locale];
  ok(`${locale}: importwaarschuwing verwijst naar beide relatiekolommen`,
    typeof value === 'string' && value.includes(predecessor) && value.includes(successor));
}
for (const key of [
  'resource.curve.uniform',
  'resource.curve.frontLoaded',
  'resource.curve.backLoaded',
  'resource.curve.bell',
  'resource.curve.earlyPeak',
  'resource.curve.latePeak',
] as const) {
  for (const locale of LOCALES) {
    const value = at(commonByLocale.get(locale), key);
    ok(`${locale}: ${key} bestaat en is niet leeg`, typeof value === 'string' && value.trim().length > 0);
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
const cellEditor = fs.readFileSync(path.join(root, 'src/components/task-grid/TaskCellEditor.tsx'), 'utf8');
const ganttWorkspace = fs.readFileSync(path.join(root, 'src/components/canvas/GanttWorkspace.tsx'), 'utf8');
const taskTooltip = fs.readFileSync(path.join(root, 'src/components/canvas/TaskTooltipContent.tsx'), 'utf8');
const externalLinkDialog = fs.readFileSync(path.join(root, 'src/components/dialogs/ExternalLinkDialog.tsx'), 'utf8');
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
    && !registry.includes('Niet aanwezig in deze baseline')
    && !/compactArraySummary\(value, '(?:onderbreking|duurwandeling|contour|notitie)'\)/.test(registry));
ok('Gantt-splitter en externe ankerwaarschuwing lopen door i18n',
  ganttWorkspace.includes("t('taskGrid.controls.resizeTaskGrid')")
    && !ganttWorkspace.includes('Resize task grid')
    && externalLinkDialog.includes("t('externalLinks.chooseNewAnchorAfterSideChange')")
    && !externalLinkDialog.includes('Kies een nieuw anker:'));
ok('Het gedeelde Gantt- en tabelhoverpaneel toont een vertaald taakstatuslabel',
  taskTooltip.includes('taskStatus.${task.status}') && !taskTooltip.includes('>{task.status}<'));
ok('Externe lagplaceholder loopt door i18n en bevat geen hard Nederlands voorbeeld',
  externalLinkDialog.includes("t('externalLinks.lagPlaceholder')")
    && !externalLinkDialog.includes('0d of 2u'));
ok('Dynamische baselinekolommen gebruiken gelokaliseerde veldnamen',
  registry.includes('taskGrid.summary.baselineVarianceStart')
    && registry.includes('taskGrid.summary.baselineVarianceFinish')
    && registry.includes('taskGrid.summary.baselineVarianceDuration')
    && !registry.includes('`${baseline.name} — ${fieldName}`'));
ok('Cel-editor gebruikt bestaande assignment- en curvelabels plus adapterbooleans',
  cellEditor.includes("properties.assignments.unitsPerDay")
    && cellEditor.includes("properties.assignments.curve")
    && cellEditor.includes("properties.assignments.remove")
    && cellEditor.includes('CURVE_KEY[curve]')
    && cellEditor.includes('adapter.booleanLabels')
    && !cellEditor.includes("labelForOption('assignment.unitsPerDay'")
    && !cellEditor.includes("labelForOption('assignment.curve'")
    && !cellEditor.includes("labelForOption('assignment.remove'")
    && !cellEditor.includes('resourceCurve.')
    && !cellEditor.includes("'boolean.true'")
    && !cellEditor.includes("'boolean.false'"));
ok('Assignment-validatie staat op de focusbare invoervelden en niet op de samengestelde wrapper',
  /className="task-grid-assignment-editor"[\s\S]{0,120}>/.test(cellEditor)
    && !/className="task-grid-assignment-editor"[\s\S]{0,120}aria-invalid/.test(cellEditor)
    && (cellEditor.match(/aria-invalid=\{inputProps\['aria-invalid'\]\}/g)?.length ?? 0) >= 3
    && (cellEditor.match(/aria-describedby=\{inputProps\['aria-describedby'\]\}/g)?.length ?? 0) >= 3);
ok('Relatie-validatie staat op type-, lag- en zoekvelden en niet op de samengestelde wrapper',
  relationEditor.includes('const validationProps = {')
    && (relationEditor.match(/<select\s+\{\.\.\.validationProps\}/g)?.length ?? 0) === 2
    && (relationEditor.match(/<input\s+\{\.\.\.validationProps\}/g)?.length ?? 0) === 3
    && !/<div[^>]*className="task-grid-relation-editor"[^>]*validationProps/.test(relationEditor));

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
