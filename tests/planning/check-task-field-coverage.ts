import {
  ALL_TASK_FIELD_COVERAGE,
  TASK_FIELD_COVERAGE,
  coverageColumnFamilies,
  validateCoverageAgainstRegistry,
  type FieldCoverage,
} from '@/engine/taskGrid/fieldCoverage';
import type { Task } from '@/types/task';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';

const diffs: string[] = [];
let checks = 0;
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

ok('precies dertien exhaustieve veldtabellen zijn publiek', ALL_TASK_FIELD_COVERAGE.length === 13);
for (const table of ALL_TASK_FIELD_COVERAGE) {
  ok(`${table.typeName}: tabel heeft velden`, Object.keys(table.fields).length > 0);
  for (const [field, coverage] of Object.entries(table.fields)) {
    ok(`${table.typeName}.${field}: classificatie geldig`,
      ['direct', 'composite', 'derived', 'technical'].includes(coverage.kind));
    ok(`${table.typeName}.${field}: concrete dekking aanwezig`, coverage.columnIds.length > 0 || !!coverage.dynamicFamily);
  }
}
ok('alle drie dynamische families zijn benoemd',
  (['activity-code', 'baseline', 'custom-field'] as const).every(family => coverageColumnFamilies.has(family)));

const registry = buildTaskColumnRegistry({
  projectId: 'coverage-project',
  activityCodeTypes: [{ id: 'code', name: 'Code', values: [] }],
  customFieldDefs: [{ id: 'field', name: 'Veld', type: 'text' }],
  baselines: [{
    id: 'baseline', name: 'Baseline', createdAt: '2026-01-01T00:00:00Z',
    tasks: [], projectEnd: '2026-01-01', projectDuration: 0,
  }],
});
const validation = validateCoverageAgainstRegistry(registry);
ok(`iedere vaste coverage-id bestaat in de registry: ${validation.missing.join(', ')}`, validation.missing.length === 0);

// MUTATIEBEWIJS (handmatig): voeg `extraBronveld: string` toe aan één van de dertien broninterfaces.
// `npm run typecheck` moet dan op de bijbehorende `satisfies Record<keyof X, FieldCoverage>`-tabel
// falen. Deze compileerbare spiegel bewijst daarnaast dat een fixture met een extra veld niet door
// het exacte Record-contract past; verwijder tijdelijk `@ts-expect-error` om de compilerfout te zien.
type MutationFixture = Task & { extraBronveld: string };
// @ts-expect-error extraBronveld ontbreekt bewust: dit is het compile-time mutatiebewijs.
const mutationMustFail: Record<keyof MutationFixture, FieldCoverage> = TASK_FIELD_COVERAGE;
void mutationMustFail;

if (diffs.length) {
  console.error(`XX task-field-coverage: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK task-field-coverage: ${checks}/${checks} checks groen`);
