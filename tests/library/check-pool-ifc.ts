import { writePoolIFC, readPoolIFC } from '@/services/library/libraryIfc';
import type { CompanyPool } from '@/types/library';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

const cal: WorkCalendar = {
  id: 'pc1', name: 'Ploegkalender', description: 'Ma-vr',
  workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 15, hoursPerDay: 8,
  holidays: [{ name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' }],
};
const resources: Resource[] = [
  { id: 'pr1', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 45, calendarId: 'pc1' },
  { id: 'pr2', name: 'Beton', type: 'MATERIAL', description: '', maxUnits: 1, unitOfMeasure: 'm3' },
];
const pool: CompanyPool = {
  companyId: 'c1', companyName: 'Aannemer BV', poolVersion: 7, modifiedAt: '2026-07-20T09:30:00.000Z',
  calendars: [cal], resources,
};

const ifc = writePoolIFC(pool);
const back = await readPoolIFC(ifc);

assert(back.companyId === 'c1', 'pool round-trip: companyId');
assert(back.companyName === 'Aannemer BV', 'pool round-trip: companyName');
assert(back.poolVersion === 7, 'pool round-trip: poolVersion');
assert(back.modifiedAt === '2026-07-20T09:30:00.000Z', 'pool round-trip: modifiedAt');
assert(back.calendars.length === 1 && back.calendars[0].id === 'pc1', 'pool round-trip: kalender-id behouden');
assert(back.resources.length === 2, 'pool round-trip: aantal resources');
assert(back.resources.find(r => r.id === 'pr1')?.costPerHour === 45, 'pool round-trip: resource-detail');
assert(back.resources.find(r => r.id === 'pr2')?.unitOfMeasure === 'm3', 'pool round-trip: materiaal-eenheid');

const ifc2 = writePoolIFC(back);
const back2 = await readPoolIFC(ifc2);
assert(JSON.stringify(back) === JSON.stringify(back2), 'pool round-trip: idempotent');

let threw = false;
try {
  const projIfc = writePoolIFC(pool).replace(/OPS_Library/g, 'OPS_Iets_Anders');
  await readPoolIFC(projIfc);
} catch { threw = true; }
assert(threw, 'readPoolIFC gooit op een bestand zonder OPS_Library');

function injectPoolJson(ifc: string, json: string): string {
  const encoded = `'${json.replace(/'/g, "''")}'`;
  const re = /IFCPROPERTYSINGLEVALUE\('pool',\$,IFCTEXT\('[\s\S]*?'\),\$\)/;
  const replaced = ifc.replace(re, `IFCPROPERTYSINGLEVALUE('pool',$,IFCTEXT(${encoded}),$)`);
  if (replaced === ifc) throw new Error('injectPoolJson: pool-property niet gevonden (test-fixture kapot)');
  return replaced;
}

{
  const hostileIfc = injectPoolJson(writePoolIFC(pool), '{}');
  let back: CompanyPool | undefined;
  let didThrow = false;
  try { back = await readPoolIFC(hostileIfc); } catch { didThrow = true; }
  assert(!didThrow, 'F2: readPoolIFC gooit niet op een `{}`-poolblob');
  assert(Array.isArray(back?.calendars) && back.calendars.length === 0, 'F2: `{}`-blob ⇒ calendars is een lege array (geen crash op .length)');
  assert(Array.isArray(back?.resources) && back.resources.length === 0, 'F2: `{}`-blob ⇒ resources is een lege array (geen crash op .length)');
  let opsThrew = false;
  try {
    const p2 = { ...back!, companyId: 'c1' };
    p2.calendars.push({ id: 'x', name: 'Vers', description: '', workDays: [1], workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [] });
  } catch { opsThrew = true; }
  assert(!opsThrew, 'F2: de genormaliseerde `{}`-pool is een ECHTE array — .push werkt zonder TypeError');
}

{
  const partialJson = JSON.stringify({ companyId: 'c1', companyName: 'Partieel BV', poolVersion: 4, modifiedAt: '2026-07-20T00:00:00.000Z', calendars: [cal] });
  const hostileIfc2 = injectPoolJson(writePoolIFC(pool), partialJson);
  let back2: CompanyPool | undefined;
  let didThrow2 = false;
  try { back2 = await readPoolIFC(hostileIfc2); } catch { didThrow2 = true; }
  assert(!didThrow2, 'F2: readPoolIFC gooit niet als de pool-JSON geen `resources`-sleutel draagt');
  assert(Array.isArray(back2?.resources) && back2.resources.length === 0, 'F2: ontbrekende resources-sleutel ⇒ lege array (niet undefined)');
  assert(back2?.calendars.length === 1 && back2.calendars[0].id === 'pc1', 'F2: de WEL-aanwezige calendars-sleutel blijft intact naast de ontbrekende resources');
}

console.log(`pool-ifc: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
