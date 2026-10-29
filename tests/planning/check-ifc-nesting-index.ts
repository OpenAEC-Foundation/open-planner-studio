import './domStub';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { readIFC } from '@/services/ifc/ifcReader';
import { ifcGuid128, ifcObjectSeed, writeIFC } from '@/services/ifc/ifcWriter';
import { parseStep } from './ifcSchemaCheck';
import { createIfcNestingFixture } from './ifcNestingFixture';

let checks = 0;
const same = (actual: unknown, expected: unknown, label: string) => {
  deepStrictEqual(actual, expected, label);
  checks++;
};

// Meerdere relaties voor dezelfde ouder, herhalingen binnen/over relaties, ongeldige refs
// en een kind dat later nog aan een andere ouder hangt. De bestaande bestandsvoorrang blijft:
// eerste verschijning bepaalt de kindvolgorde; laatste ouderrelatie bepaalt child.parentId.
{
  const input = createIfcNestingFixture(20, 'breed');
  const original = writeIFC(input);
  const entities = parseStep(original);
  const ref = (taskId: string) => {
    const guid = `'${ifcGuid128(ifcObjectSeed('task', taskId))}'`;
    const entity = entities.find(e => e.type === 'IFCTASK' && e.args[0].k === 'str' && e.args[0].raw === guid);
    if (!entity) throw new Error(`IFCTASK ontbreekt: ${taskId}`);
    return `#${entity.id}`;
  };
  const [a, b, c, d] = input.tasks;
  const resource = entities.find(e => e.type === 'IFCLABORRESOURCE')!;
  const rel = (id: number, parent: string, children: string) =>
    `#${id}=IFCRELNESTS('nest-${id}',$,$,$,${parent},(${children}));`;
  const text = original.replace(/^#\d+=IFCRELNESTS\([^\n]*\n/gm, '').replace('\nENDSEC;\nEND-ISO', [
    rel(900001, ref(a.id), `${ref(d.id)},#99999999,${ref(b.id)},${ref(d.id)},#${resource.id}`),
    rel(900002, '#99999999', ref(c.id)),
    rel(900003, ref(a.id), `${ref(b.id)},${ref(c.id)},${ref(d.id)}`),
    rel(900004, ref(b.id), ref(c.id)),
    rel(900005, ref(a.id), `${ref(c.id)},${ref(d.id)}`),
    '\nENDSEC;\nEND-ISO',
  ].join('\n'));
  const result = readIFC(text);
  const task = (id: string) => result.tasks.find(t => t.id === id)!;
  same(task(a.id).childIds, [d.id, b.id, c.id], 'kindvolgorde en deduplicatie over relaties');
  same(task(b.id).childIds, [c.id], 'een ander ouderblok houdt zijn eigen lidmaatschap');
  same(task(c.id).parentId, a.id, 'ook een gededupliceerd kind krijgt de laatste ouder');
  same(task(d.id).parentId, a.id, 'onbekende en niet-taakrefs veranderen geen taak');
  same(task(a.id).parentId, null, 'een onbekende ouder wordt overgeslagen');
  // Een nieuwe import krijgt een nieuwe index; na verwijderen van een relatie blijft niets hangen.
  same(readIFC(original).tasks[0].childIds, input.tasks.slice(1).map(t => t.id), 'geen index over imports heen');
}

// Schaalregressie zonder instabiele tijdsgrens; de vergelijkende CI-meting staat apart.
for (const size of [1_000, 5_000, 10_000]) {
  const input = createIfcNestingFixture(size, 'breed');
  const first = readIFC(writeIFC(input));
  same(first.tasks.length, size, `${size}: alle taken ingelezen`);
  same(first.tasks[0].childIds, input.tasks.slice(1).map(t => t.id), `${size}: alle kinderen in volgorde`);
  same(first.tasks.slice(1).every(t => t.parentId === first.tasks[0].id), true, `${size}: alle ouders hersteld`);
  const second = readIFC(writeIFC(first));
  same(second.tasks.map(t => [t.id, t.parentId, t.childIds]), first.tasks.map(t => [t.id, t.parentId, t.childIds]),
    `${size}: opslaan en heropenen houdt de hiërarchie`);
  same(second.ifcGlobalIds, first.ifcGlobalIds, `${size}: GlobalIds blijven gelijk`);
  same(second.resourceCalendars, first.resourceCalendars, `${size}: kalenderinhoud en herkomst blijven gelijk`);
  same(second.baselines, first.baselines, `${size}: baseline blijft gelijk`);
  strictEqual(second.importPristine, true);
  strictEqual(second.recordedSourceFormat, 'mpp');
  checks += 2;
}
console.log(`${checks} IFC-nestingcontroles geslaagd (exit 0)`);
