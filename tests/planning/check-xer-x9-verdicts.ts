// X9 — expliciete grenzen: MCP mag P6-bronvelden niet als invoer herschrijven en moveProject
// behoudt ze als data, zonder ze aan de solver als invoer te geven.
import { readFileSync } from 'node:fs';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

declare const process: { exit(code: number): never };
const failures: string[] = [];
const expect = (label: string, condition: boolean) => { if (!condition) failures.push(label); };
const store = () => useAppStore.getState();
store().newProject();
store().setProject({ startDate: '2032-03-02' });
const id = store().addTask({ name: 'P6 verdict' });
const before = store().tasks.find(task => task.id === id)!;
store().updateTask(id, {
  p6ProjectId: 'P-X9', p6TaskId: 'T-X9', p6CompletePctType: 'CP_Phys',
  p6ExpectedFinish: '2032-03-07', p6DurationType: 'DT_FixedRate', p6ActivityType: 'TT_LOE',
  p6SuspendResume: true, time: { ...before.time, ...createDefaultTaskTime('2032-03-02', 1), stop: '2032-03-03', resume: '2032-03-04' },
} as Partial<Task>);
const result = store().moveProject('2032-03-09');
const after = store().tasks.find(task => task.id === id);
expect('1 moveProject accepteert de planningverschuiving', result.moved === true);
const afterP6 = [
  after?.p6ProjectId, after?.p6TaskId, after?.p6CompletePctType, after?.p6ExpectedFinish,
  after?.p6DurationType, after?.p6ActivityType, after?.p6SuspendResume,
];
expect('2 moveProject bewaart X0/X7 P6-data en verschuift alleen de semantische finishdatum',
  JSON.stringify(afterP6) === JSON.stringify(['P-X9', 'T-X9', 'CP_Phys', '2032-03-14', 'DT_FixedRate', 'TT_LOE', true]));
const mcpFields = readFileSync(new URL('../../src/services/mcp/tools/taskFields.ts', import.meta.url), 'utf8');
expect('3 MCP-verdict blokkeert P6 DurationType als agentinvoer', /p6DurationType: 'P6\\'s eigen Duration Type is via de bridge niet zetbaar/.test(mcpFields));
expect('4 MCP-verdict blokkeert P6 ActivityType als agentinvoer', /p6ActivityType: 'P6\\'s eigen Activity Type is via de bridge niet zetbaar/.test(mcpFields));
expect('5 solverfirewall blijft in de XER-chunkcheck permanent bewaakt',
  readFileSync(new URL('./check-xer-chunk-boundary.ts', import.meta.url), 'utf8').includes("'early_', 'late_', 'restart_date', 'reend_date'"));
if (failures.length === 0) {
  console.log('OK  xer-x9-verdicts: MCP- en moveProject-grenzen expliciet');
  process.exit(0);
}
console.log(`XX  xer-x9-verdicts: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
