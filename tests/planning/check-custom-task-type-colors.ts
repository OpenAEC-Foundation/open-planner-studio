// Issue #856, besluit Ethan 21 november 2026: een eigen werksoort krijgt één keer een kleur die nog
// niet in gebruik is, en houdt die kleur, in de bibliotheek en in het IFC-bestand (`OPS_TaskTypes`,
// veld `color` per definitie). Een bestand zonder dat veld (oud, of van een andere schrijver) opent
// zoals nu en krijgt een vaste kleur; een bestand met het veld houdt precies die kleur.
import './domStub';
import { useAppStore } from '@/state/appStore';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultProject } from '@/state/slices/projectSlice';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { readCSV } from '@/services/csv/csvReader';
import { CUSTOM_TASK_TYPE_COLOR_ORDER, paletteColorForId } from '@/engine/renderer/resourcePalette';
import { TASK_TYPES, type Task } from '@/types/task';
import type { CustomTaskType } from '@/types/taskType';
import { addPersonalTaskType, getPersonalTaskTypes, renamePersonalTaskType } from '@/services/taskTypes/personalTaskTypes';
import { withTaskTypeColors } from '@/services/taskTypes/customTaskTypeColors';
import { resolveBarCategoryValues } from '@/services/print/barColorCategories';
import { TASK_TYPE_BAR_COLOR_FIELD } from '@/types/barColor';

const errors: string[] = [];
let checks = 0;
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};
const ok = (label: string, value: boolean) => eq(label, value, true);

const project = createDefaultProject();
const calendar = createDefaultCalendar();
const taskOf = (id: string, typeId: string): Task => ({
  id, name: id, description: '', wbsCode: id, taskType: 'USERDEFINED', customTaskTypeId: typeId,
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(project.startDate, 1),
});
const tasks = [taskOf('t1', 'ctt-b'), taskOf('t2', 'ctt-a'), taskOf('t3', 'ctt-c')];
const builtinColors = new Set(TASK_TYPES.map(type => paletteColorForId(type)));
const colors = (types: readonly { color?: string }[] | undefined) => (types ?? []).map(type => type.color);

/** Een IFC-bestand zoals een oudere OPS of een andere schrijver het maakt: definities zonder kleur. */
const withoutColorField = (ifc: string) => ifc.replace(/,"color":"#[0-9A-Fa-f]{6}"/g, '');
const write = (types: CustomTaskType[]) => writeIFC({
  project, calendar, tasks, sequences: [], resources: [], assignments: [], customTaskTypes: types,
});

// ── 1. Een bestand zonder het veld ─────────────────────────────────────────────────────────────
const typed: CustomTaskType[] = [
  { id: 'ctt-b', name: 'Bekisting', color: '#000001' },
  { id: 'ctt-a', name: 'Betonstort', color: '#000002' },
  { id: 'ctt-c', name: 'Wapening', color: '#000003' },
];
const oldFile = withoutColorField(write(typed));
ok('oud bestand: heeft echt geen kleurveld', !oldFile.includes('"color"'));
const opened = readIFC(oldFile);
eq('oud bestand: opent met dezelfde ids en namen', opened.customTaskTypes?.map(type => `${type.id}=${type.name}`),
  ['ctt-b=Bekisting', 'ctt-a=Betonstort', 'ctt-c=Wapening']);
eq('oud bestand: de taken houden hun werksoort', opened.tasks.map(task => task.customTaskTypeId), ['ctt-b', 'ctt-a', 'ctt-c']);
// Eerste vrije kleuren, op volgorde van id: ctt-a de eerste, ctt-b de tweede, ctt-c de derde.
eq('oud bestand: elke werksoort krijgt een vrije kleur, op volgorde van id', colors(opened.customTaskTypes),
  [CUSTOM_TASK_TYPE_COLOR_ORDER[1], CUSTOM_TASK_TYPE_COLOR_ORDER[0], CUSTOM_TASK_TYPE_COLOR_ORDER[2]]);
eq('oud bestand: drie verschillende kleuren', new Set(colors(opened.customTaskTypes)).size, 3);
ok('oud bestand: geen kleur van een vaste werkcategorie', colors(opened.customTaskTypes).every(c => !builtinColors.has(c!)));
eq('oud bestand: elke keer openen dezelfde kleuren', colors(readIFC(oldFile).customTaskTypes), colors(opened.customTaskTypes));
// Een andere catalogusvolgorde in het bestand verandert de kleur per werksoort niet.
const reordered = withoutColorField(write([typed[2], typed[0], typed[1]]));
const byId = (types: readonly { id: string; color?: string }[] | undefined) =>
  Object.fromEntries((types ?? []).map(type => [type.id, type.color]).sort(([a], [b]) => (a! < b! ? -1 : 1)));
eq('oud bestand: kleur per werksoort los van de volgorde', byId(readIFC(reordered).customTaskTypes), byId(opened.customTaskTypes));
// Opslaan schrijft de toegekende kleur; daarna blijft ze bij elk openen en opslaan gelijk.
const savedOnce = write(opened.customTaskTypes!);
eq('oud bestand: na opslaan staat de kleur in het bestand', byId(readIFC(savedOnce).customTaskTypes), byId(opened.customTaskTypes));
eq('oud bestand: tweede opslaan identiek', write(readIFC(savedOnce).customTaskTypes!), savedOnce);
// De kleur staat er altijd, ook als het lezen haar zelf zou afleiden: het bestand hangt dan niet meer van die afleiding af.
ok('oud bestand: na opslaan staat elke kleur letterlijk in het bestand',
  opened.customTaskTypes!.every(type => savedOnce.includes(`"id":"${type.id}","name":"${type.name}","color":"${type.color}"`)));
// Een werksoort minder: het lezen zou de kleuren van de anderen anders afleiden, maar ze staan er en blijven.
const fewerFile = writeIFC({ project, calendar, tasks: tasks.filter(task => task.customTaskTypeId !== 'ctt-a'), sequences: [], resources: [], assignments: [], customTaskTypes: opened.customTaskTypes! });
ok('een werksoort minder: het kleurveld staat erin', fewerFile.includes('"color"'));
eq('een werksoort minder: de anderen houden hun kleur', byId(readIFC(fewerFile).customTaskTypes),
  byId(opened.customTaskTypes!.filter(type => type.id !== 'ctt-a')));

// ── 2. Een bestand met het veld houdt precies die kleur ───────────────────────────────────────
const exact: CustomTaskType[] = [
  { id: 'ctt-b', name: 'Bekisting', color: '#12ab9F' }, // geen paletkleur, kleine letters: precies zo
  { id: 'ctt-a', name: 'Betonstort', color: CUSTOM_TASK_TYPE_COLOR_ORDER[0] },
  { id: 'ctt-c', name: 'Wapening', color: CUSTOM_TASK_TYPE_COLOR_ORDER[0] }, // gedeeld blijft gedeeld
];
const exactFile = write(exact);
ok('met kleur: het veld staat in het bestand', exactFile.includes('"color":"#12ab9F"'));
eq('met kleur: openen houdt precies de kleur', readIFC(exactFile).customTaskTypes, exact);
eq('met kleur: opslaan na openen houdt precies de kleur', readIFC(write(readIFC(exactFile).customTaskTypes!)).customTaskTypes, exact);

// Een ongeldige kleur telt als geen kleur; de geldige ernaast blijven.
const brokenFile = exactFile.replace('"color":"#12ab9F"', '"color":"rood"');
const broken = readIFC(brokenFile).customTaskTypes!;
eq('ongeldige kleur: andere werksoorten houden hun kleur', colors(broken).slice(1), [CUSTOM_TASK_TYPE_COLOR_ORDER[0], CUSTOM_TASK_TYPE_COLOR_ORDER[0]]);
eq('ongeldige kleur: krijgt de eerste vrije kleur', broken[0].color, CUSTOM_TASK_TYPE_COLOR_ORDER[1]);

// ── 2b. Genoeg kleuren: twaalf eigen werksoorten, twaalf kleuren, geen van een vaste werkcategorie ──
const twelve = withTaskTypeColors(Array.from({ length: 12 }, (_, i) => ({ id: `w-${String(i).padStart(2, '0')}`, name: `W${i}` })));
eq('twaalf eigen werksoorten: twaalf verschillende kleuren', new Set(twelve.map(type => type.color)).size, 12);
ok('twaalf eigen werksoorten: geen kleur van een vaste werkcategorie', twelve.every(type => !builtinColors.has(type.color)));
// De dertiende: alle twaalf eigen kleuren zijn bezet, maar een vaste kleur (Bouw, Renovatie, …) komt pas als laatste.
const thirteenth = withTaskTypeColors([{ id: 'w-12', name: 'W12' }], twelve)[0];
ok(`de dertiende eigen werksoort deelt een eigen kleur, geen vaste (kreeg ${thirteenth.color})`, !builtinColors.has(thirteenth.color));
ok('de kleuren zijn geen kritiek-rood', !CUSTOM_TASK_TYPE_COLOR_ORDER.includes('#DC2626') && !CUSTOM_TASK_TYPE_COLOR_ORDER.includes('#B91C1C'));

// ── 3. Import zonder kleur (CSV) ──────────────────────────────────────────────────────────────
const csv = readCSV('Name;Task Type\nA;Sloopwerk\nB;Grondwerk\n');
eq('CSV: twee vrije, verschillende kleuren', colors(csv.customTaskTypes).length === 2 && new Set(colors(csv.customTaskTypes)).size, 2);

// ── 4. De bibliotheek ─────────────────────────────────────────────────────────────────────────
// Een bibliotheek van vóór de kleur krijgt bij het lezen een kleur en bewaart die meteen.
localStorage.setItem('ops-personalTaskTypes', JSON.stringify([{ id: 'lib-2', name: 'Metselwerk' }, { id: 'lib-1', name: 'Dakwerk' }]));
const library = getPersonalTaskTypes();
eq('bibliotheek: oude werksoorten krijgen vrije kleuren op volgorde van id', byId(library),
  { 'lib-1': CUSTOM_TASK_TYPE_COLOR_ORDER[0], 'lib-2': CUSTOM_TASK_TYPE_COLOR_ORDER[1] });
eq('bibliotheek: de kleur is meteen bewaard', byId(JSON.parse(localStorage.getItem('ops-personalTaskTypes')!)), byId(library));
// Aanmaken vanuit een taak: vrij in de bibliotheek én in het geopende document (review ronde 2, punt 2).
const inDocument: CustomTaskType[] = [{ id: 'doc-keuring', name: 'Keuring', color: CUSTOM_TASK_TYPE_COLOR_ORDER[2] }];
const added = addPersonalTaskType('Stucwerk', undefined, undefined, inDocument);
eq('bibliotheek: een nieuwe werksoort slaat ook de kleuren van het document over', added?.color, CUSTOM_TASK_TYPE_COLOR_ORDER[3]);
eq('bibliotheek: hernoemen houdt de kleur', renamePersonalTaskType(added!.id, 'Stukadoorswerk')?.color, CUSTOM_TASK_TYPE_COLOR_ORDER[3]);
eq('bibliotheek: met een gegeven kleur blijft die kleur', addPersonalTaskType('Glaswerk', 'lib-glas', '#ABCDEF')?.color, '#ABCDEF');

// ── 5. Het document ───────────────────────────────────────────────────────────────────────────
const S = () => useAppStore.getState();
S().newProject();
S().ensureProjectTaskType(library[0]);
eq('document: een werksoort uit de bibliotheek houdt haar kleur', S().customTaskTypes[0].color, library[0].color);
S().ensureProjectTaskType({ id: 'doc-x', name: 'Zonder kleur' });
ok('document: zonder kleur de eerste vrije kleur in dit document',
  S().customTaskTypes[1].color === CUSTOM_TASK_TYPE_COLOR_ORDER.find(color => color !== library[0].color));
const storeTask = S().addTask({ name: 'Metselen' });
S().updateTask(storeTask, { taskType: 'USERDEFINED', customTaskTypeId: library[0].id });
eq('document: opslaan bewaart de kleur', readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).customTaskTypes?.[0]?.color, library[0].color);

// ── 6. De balk krijgt de bewaarde kleur ───────────────────────────────────────────────────────
const [value] = resolveBarCategoryValues(taskOf('t9', 'ctt-b'), TASK_TYPE_BAR_COLOR_FIELD, {
  resources: [], assignments: [], activityCodeTypes: [], customFieldDefs: [], noneLabel: '—', customTaskTypes: exact,
});
eq('balk: de bewaarde kleur', value?.color, '#12ab9F');

if (errors.length) {
  for (const error of errors) console.log(`XX ${error}`);
  console.log(`check-custom-task-type-colors: ${errors.length} van ${checks} rood`);
  process.exit(1);
}
console.log(`check-custom-task-type-colors: ${checks} checks groen`);
