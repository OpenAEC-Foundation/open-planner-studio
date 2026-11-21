import './domStub';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readIFC } from '@/services/ifc/ifcReader';
import { payloadFromImport } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { TASKTIME_SLOT } from '@/services/ifc/ifcTaskSlots';

// Vast repositoryvoorbeeld, alleen de onderzochte slots veranderen; geen solve tussen lezen en meten.
const source = readFileSync('public/examples/showcase-appartementencomplex.ifc', 'utf8');
const line = source.split('\n').find(l => l.startsWith('#55='))!;
assert.ok(line.includes('IFCTASKTIME'));
function taskSlot(slot: number, value: string): string {
  const args = line.slice(line.indexOf('(') + 1, -2).split(',');
  args[slot] = `'${value}'`;
  return source.replace(line, line.slice(0, line.indexOf('(') + 1) + args.join(',') + ');');
}
function time(slot: number, value: string) {
  return readIFC(taskSlot(slot, value)).tasks.find(t => t.name === 'CPT soundings & soil investigation')!.time;
}
let failures = 0;
let checks = 0;
function check(name: string, run: () => void) {
  checks++;
  try { run(); } catch (e) { failures++; console.error('XX', name, String(e)); }
}
for (const [iso, days] of [['P1,5D', 1.5], ['P0Y0M1,5D', 1.5], ['P0Y0M1e-7D', 1e-7]] as const) {
  check(iso, () => assert.equal(time(TASKTIME_SLOT.scheduleDuration, iso).scheduleDuration, days));
}
for (const [iso, minutes] of [['PT4,5H', 270], ['PT90S', 1.5], ['PT30S', .5], ['PT0.01H', .6]] as const) {
  check(iso, () => {
    const imported = readIFC(taskSlot(TASKTIME_SLOT.scheduleDuration, iso));
    assert.ok(Math.abs(imported.tasks.find(t => t.name === 'CPT soundings & soil investigation')!.time.durationMinutes! - minutes) < 1e-9);
    const reread = readIFC(writeIFC(buildWriteIFCInput(payloadFromImport(imported, null), 'planOnly')));
    assert.ok(Math.abs(reread.tasks.find(t => t.name === 'CPT soundings & soil investigation')!.time.durationMinutes! - minutes) < 1e-9);
  });
}
for (const iso of ['P1W', 'P0Y1M0D', 'P1Y0M3D', 'PT-2H', 'PT1H1H', 'P1E1D', 'PT30M12H', 'P', 'PT']) {
  check('weigert ' + iso, () => assert.throws(() => time(TASKTIME_SLOT.scheduleDuration, iso)));
}
for (const [iso, days] of [['P2DT12H', 3.5], ['PT28H', 3.5], ['PT90M', .1875], ['-PT90M', -.1875]] as const) {
  check('speling ' + iso, () => assert.equal(time(TASKTIME_SLOT.totalFloat, iso).totalFloat, days));
}
const lagLine = source.split('\n').find(l => l.startsWith('#631='))!;
assert.ok(lagLine.includes('IFCLAGTIME'));
const lagId = readIFC(source.replace(lagLine, lagLine.replace('P2D', 'P73D'))).sequences.find(s => s.lagDays === 73)!.id;

for (const legacy of [false, true]) {
  for (const [iso, minutes] of [['P1DT0H', 480], ['P1DT2H', 600], ['PT90S', 1.5], ['PT4,5H', 270]] as const) {
    check(`lag ${legacy} ${iso}`, () => {
      const patched = source.replace(lagLine, legacy
        ? `#631=IFCLAGTIME($,$,$,.WORKTIME.,'${iso}');`
        : `#631=IFCLAGTIME($,$,$,IFCDURATION('${iso}'),.WORKTIME.);`);
      const result = readIFC(patched);
      assert.equal(result.sequences.find(s => s.id === lagId)?.lagMinutes, minutes);
    });
  }
}
console.log(`${checks} controles, ${failures} fouten`);
process.exitCode = failures ? 1 : 0;
