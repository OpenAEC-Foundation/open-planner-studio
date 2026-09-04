import fs from 'node:fs';
import path from 'node:path';

type SourceReference = Readonly<{
  file: string;
  needle: string;
}>;

type ParityRow = Readonly<{
  id: string;
  requirement: string;
  registry: readonly SourceReference[];
  planner: readonly SourceReference[];
  ribbon: readonly SourceReference[];
  automatedChecks: readonly SourceReference[];
  evidenceId: string;
}>;

/**
 * De machineleesbare verwijderpoort uit tabel-overhaul-spec §10.3. De trace-eis is opgesplitst
 * in voorgangers en opvolgers, omdat beide lintacties onafhankelijk beschikbaar moeten blijven.
 */
export const RELATIONS_PANEL_PARITY: readonly ParityRow[] = [
  {
    id: 'internal-crud',
    requirement: 'Interne relaties bekijken, toevoegen, wijzigen en verwijderen',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "relationColumn('predecessor')" }, { file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "relationColumn('successor')" }],
    planner: [{ file: 'src/engine/taskGrid/relationPlan.ts', needle: 'export function planRelationSet' }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonWidgets.tsx', needle: "key: 'draw'" }],
    automatedChecks: [{ file: 'tests/planning/check-relation-set-plan.ts', needle: 'planRelationSet' }, { file: 'tests/planning/check-relation-cell-editor.ts', needle: 'predecessor en successor lezen, tonen, kopieren en schrijven' }],
    evidenceId: 'internal-crud',
  },
  {
    id: 'link-selected',
    requirement: 'Twee geselecteerde taken koppelen',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "id: `relation.${direction}s`" }],
    planner: [{ file: 'src/state/relationActions.ts', needle: 'export function createRelationWithFeedback' }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonWidgets.tsx', needle: "key: 'linkSelected'" }],
    automatedChecks: [{ file: 'tests/planning/check-relation-ribbon-trace.ts', needle: 'geselecteerde taken koppelen gebruikt de bewaakte gedeelde actie' }],
    evidenceId: 'link-selected',
  },
  {
    id: 'driving-free-float',
    requirement: 'Driving en relationele vrije speling bekijken',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "id: 'relation.driving'" }, { file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "id: 'relation.freeFloat'" }],
    planner: [{ file: 'src/engine/taskGrid/relationIndex.ts', needle: 'analysisBySequenceId' }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonConfig.tsx', needle: 'const calcButton' }],
    automatedChecks: [{ file: 'tests/planning/check-relation-cell.ts', needle: 'driving en float komen uit de indexanalyse' }, { file: 'tests/planning/check-task-column-registry.ts', needle: 'relation.driving' }],
    evidenceId: 'driving-free-float',
  },
  {
    id: 'warnings',
    requirement: 'Relatiewaarschuwingen bekijken',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "id: 'relation.warnings'" }],
    planner: [{ file: 'src/engine/taskGrid/relationIndex.ts', needle: "'lead-exceeds-duration'" }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonConfig.tsx', needle: 'const calcButton' }],
    automatedChecks: [{ file: 'tests/planning/check-relation-cell.ts', needle: 'lead groter dan voorgangerduur blijft als waarschuwing zichtbaar' }, { file: 'tests/planning/check-task-column-registry.ts', needle: 'relation.warnings' }],
    evidenceId: 'warnings',
  },
  {
    id: 'external-crud',
    requirement: 'Externe relaties toevoegen, bekijken, vernieuwen en verwijderen',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "id: 'relation.externalTechnical'" }],
    planner: [{ file: 'src/state/slices/taskSlice.ts', needle: 'removeExternalLink:' }, { file: 'src/state/slices/fileSlice.ts', needle: 'refreshAllExternalAnchors:' }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonWidgets.tsx', needle: "key: 'addExternal'" }, { file: 'src/components/layout/Ribbon/ribbonWidgets.tsx', needle: "key: 'refreshExternal'" }],
    automatedChecks: [{ file: 'tests/planning/check-external-link-edit.ts', needle: 'addExternalLink' }, { file: 'tests/planning/check-relation-cell-editor.ts', needle: 'rechtsklik op de externe token' }],
    evidenceId: 'external-crud',
  },
  {
    id: 'local-jump',
    requirement: 'Naar de betrokken lokale taken springen',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: 'buildRelationCellItems' }],
    planner: [{ file: 'src/state/slices/viewSlice.ts', needle: 'focusOnTask:' }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonConfig.tsx', needle: 'relationDropdownItem' }],
    automatedChecks: [{ file: 'tests/planning/check-focus-task.ts', needle: 'beide taskgrids bedraden lokale relaties naar dezelfde focusOnTask-actie' }],
    evidenceId: 'local-jump',
  },
  {
    id: 'predecessor-trace',
    requirement: 'Voorgangers traceren',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "relationColumn('predecessor')" }],
    planner: [{ file: 'src/engine/taskGrid/trace.ts', needle: 'export function buildTrace' }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonConfig.tsx', needle: "id: 'tracePred'" }],
    automatedChecks: [{ file: 'tests/planning/check-relation-ribbon-trace.ts', needle: 'driving voorganger krijgt de sterke voorgangerrol' }],
    evidenceId: 'predecessor-trace',
  },
  {
    id: 'successor-trace',
    requirement: 'Opvolgers traceren',
    registry: [{ file: 'src/engine/taskGrid/taskColumnRegistry.ts', needle: "relationColumn('successor')" }],
    planner: [{ file: 'src/engine/taskGrid/trace.ts', needle: 'export function buildTrace' }],
    ribbon: [{ file: 'src/components/layout/Ribbon/ribbonConfig.tsx', needle: "id: 'traceSucc'" }],
    automatedChecks: [{ file: 'tests/planning/check-relation-ribbon-trace.ts', needle: 'driving opvolger krijgt de sterke opvolgerrol' }],
    evidenceId: 'successor-trace',
  },
] as const;

const root = process.cwd();
const failures: string[] = [];
let checks = 0;
const ok = (label: string, condition: boolean): void => {
  checks++;
  if (!condition) failures.push(label);
};

ok('de matrix bevat exact acht afzonderlijke pariteitsregels', RELATIONS_PANEL_PARITY.length === 8);
ok('iedere matrixregel heeft een uniek id', new Set(RELATIONS_PANEL_PARITY.map(row => row.id)).size === 8);

for (const row of RELATIONS_PANEL_PARITY) {
  ok(`${row.id}: eis is letterlijk benoemd`, row.requirement.trim().length > 0);
  for (const [kind, references] of [
    ['registry', row.registry],
    ['planner', row.planner],
    ['ribbon', row.ribbon],
    ['automatedChecks', row.automatedChecks],
  ] as const) {
    ok(`${row.id}: ${kind} heeft minstens één concrete verwijzing`, references.length > 0);
    for (const reference of references) {
      const fullPath = path.join(root, reference.file);
      ok(`${row.id}: ${reference.file} bestaat`, fs.existsSync(fullPath));
      ok(`${row.id}: ${reference.file} bevat ${JSON.stringify(reference.needle)}`,
        fs.existsSync(fullPath) && fs.readFileSync(fullPath, 'utf8').includes(reference.needle));
    }
  }
}

const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const ribbonSource = fs.readFileSync(path.join(root, 'src/components/layout/Ribbon/Ribbon.tsx'), 'utf8');
const ribbonConfigSource = fs.readFileSync(path.join(root, 'src/components/layout/Ribbon/ribbonConfig.tsx'), 'utf8');
const uiTypesSource = fs.readFileSync(path.join(root, 'src/state/slices/types.ts'), 'utf8');
ok('het oude RelationsPanel-bestand is verwijderd',
  !fs.existsSync(path.join(root, 'src/components/panels/RelationsPanel.tsx')));
ok('App heeft geen import of renderroute voor het oude paneel',
  !appSource.includes('RelationsPanel') && !appSource.includes("activeTab === 'relations'"));
ok('de zichtbare en interne ribbontablijsten bevatten geen relations-tab',
  !/['"]relations['"]/.test(ribbonSource.match(/const tabs:[\s\S]*?];/)?.[0] ?? '')
    && !uiTypesSource.match(/export type RibbonTab[^;]+/)?.[0].includes("'relations'"));
ok('de lintconfig bevat geen zelfstandige relationsTab of beheerknop meer',
  !ribbonConfigSource.includes('const relationsTab')
    && !ribbonConfigSource.includes("activeRibbonTab: 'relations'")
    && !ribbonConfigSource.includes("id: 'manage'"));

const evidencePath = path.join(root, 'docs/superpowers/evidence/tabel-overhaul-relations-parity.md');
ok('het handmatige bewijsdocument bestaat', fs.existsSync(evidencePath));
const evidence = fs.existsSync(evidencePath) ? fs.readFileSync(evidencePath, 'utf8') : '';
ok('bewijs noemt een ISO-datum', /^Datum: \d{4}-\d{2}-\d{2}$/m.test(evidence));
ok('bewijs noemt een volledige buildhash', /^Build: [0-9a-f]{40}$/m.test(evidence));
for (const row of RELATIONS_PANEL_PARITY) {
  ok(`${row.id}: Gantt-route is handmatig groen`, evidence.includes(`| ${row.evidenceId} | Gantt-taskgrid | GREEN |`));
  ok(`${row.id}: volledige Tabel-route is handmatig groen`, evidence.includes(`| ${row.evidenceId} | Volledige Tabel | GREEN |`));
}

if (failures.length > 0) {
  console.error(`XX relations-panel-parity: ${failures.length}/${checks} checks rood`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`OK relations-panel-parity: ${checks}/${checks} checks groen`);
