import {
  bumpPool, isPoolNewer, makeOrigin, findCopyByOrigin,
  copyCalendarToProject, copyResourceToProject,
  diffCalendarVsPool, diffResourceVsPool, applyResourceUpdate, applyCalendarUpdate,
  computeCalendarHash, computeResourceHash, CALENDAR_DIFF_FIELDS, diffKey,
  normalizeName, matchByName, createNameMatcher,
  classifyCalendarOnOpen, classifyResourceOnOpen,
  resolveUniqueCompanyName, isReservedCompanyId, isSafeFileCompanyId, resolvePoolImportPreselection,
  classifyPoolImportIdentityHint,
} from '@/services/library/libraryOps';
import { DEFAULT_COMPANY_ID } from '@/types/library';
import { DEMO_COMPANY_ID } from '@/services/library/demoLibrary';
import type { CompanyPool } from '@/types/library';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource } from '@/types/resource';

let checks = 0; let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}

function cal(id: string, name: string): WorkCalendar {
  return {
    id, name, description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  };
}
function res(id: string, name: string, calendarId?: string): Resource {
  return { id, name, type: 'LABOR', description: '', maxUnits: 1, calendarId };
}
function pool(): CompanyPool {
  return {
    companyId: 'c1', companyName: 'Bedrijf 1', poolVersion: 3, modifiedAt: '2026-07-20T10:00:00.000Z',
    calendars: [cal('pc1', 'Ploegkalender')],
    resources: [res('pr1', 'Timmerman', 'pc1'), res('pr2', 'Kraan')],
  };
}

let n = 0;
const genId = (prefix: string) => `${prefix}-gen-${++n}`;

{
  const p = pool();
  const b = bumpPool(p);
  assert(b.poolVersion === 4, 'bumpPool verhoogt poolVersion');
  assert(b.modifiedAt !== p.modifiedAt, 'bumpPool verse modifiedAt');
  assert(p.poolVersion === 3, 'bumpPool muteert het origineel niet');
}

{
  const local = pool();
  assert(isPoolNewer(undefined, local) === false, 'isPoolNewer: geen lokale pool ⇒ niet nieuwer');
  assert(isPoolNewer({ ...local, poolVersion: 5 }, local) === true, 'isPoolNewer: hogere versie ⇒ nieuwer');
  assert(isPoolNewer({ ...local, poolVersion: 1 }, local) === false, 'isPoolNewer: lagere versie ⇒ niet nieuwer');
  assert(
    isPoolNewer({ ...local, modifiedAt: '2026-07-21T00:00:00.000Z' }, local) === true,
    'isPoolNewer: gelijke versie, recentere modifiedAt ⇒ nieuwer',
  );
}

{
  const local = { ...pool(), poolVersion: 3, modifiedAt: '2026-07-20T15:00:00.000Z' };
  const imported = { ...pool(), poolVersion: 5, modifiedAt: '2026-07-20T09:00:00.000Z' };
  assert(isPoolNewer(local, imported) === true, 'isPoolNewer: lokaal lagere versie maar latere tijd ⇒ toch nieuwer (spec-óf)');

  const same = pool();
  assert(isPoolNewer(same, { ...same }) === false, 'isPoolNewer: gelijke versie/tijd ⇒ niet nieuwer');

  const localOffset = { ...pool(), poolVersion: 7, modifiedAt: '2026-07-20T23:00:00-05:00' };
  const importedLaterString = { ...pool(), poolVersion: 7, modifiedAt: '2026-07-21T00:30:00.000Z' };
  assert(
    isPoolNewer(localOffset, importedLaterString) === true,
    'isPoolNewer: offset-notatie vergelijkt op echte tijd (Date.parse), niet op string-lexicografie',
  );

  const localBad = { ...pool(), poolVersion: 9, modifiedAt: 'niet-een-datum' };
  const importedBad = { ...pool(), poolVersion: 9, modifiedAt: 'ook-geen-datum' };
  assert(isPoolNewer(localBad, importedBad) === false, 'isPoolNewer: onparseerbare tijden aan beide kanten ⇒ gelijk (fallback 0), niet nieuwer');
}

{
  const p = pool();
  const o = makeOrigin(p, 'pr1');
  assert(o.companyId === 'c1' && o.libraryItemId === 'pr1' && o.poolVersion === 3, 'makeOrigin stempelt correct');
  const list: Resource[] = [{ ...res('x', 'x'), libraryOrigin: o }];
  assert(findCopyByOrigin(list, 'c1', 'pr1')?.id === 'x', 'findCopyByOrigin vindt bestaande kopie');
  assert(findCopyByOrigin(list, 'c1', 'pr2') === undefined, 'findCopyByOrigin: geen match');
  assert(findCopyByOrigin(list, 'c2', 'pr1') === undefined, 'findCopyByOrigin: cross-bedrijf-dedupgrens (companyId c2 vindt geen kopie gestempeld met c1)');
}

{
  const p = pool();
  const c1 = copyCalendarToProject(p, 'pc1', [], genId)!;
  assert(c1.reused === false, 'copyCalendar: verse kopie is niet-hergebruikt');
  assert(c1.calendar.id !== 'pc1', 'copyCalendar: verse project-lokale id');
  assert(c1.calendar.libraryOrigin?.libraryItemId === 'pc1', 'copyCalendar: stempel wijst naar pool-id');
  const c2 = copyCalendarToProject(p, 'pc1', [c1.calendar], genId)!;
  assert(c2.reused === true && c2.calendar.id === c1.calendar.id, 'copyCalendar: dedup hergebruikt bestaande kopie');
  assert(copyCalendarToProject(p, 'onbekend', [], genId) === null, 'copyCalendar: onbekende id ⇒ null');
}

{
  const p = pool();
  const r = copyResourceToProject(p, 'pr1', [], [], genId)!;
  assert(r.reused === false, 'copyResource: verse kopie');
  assert(!!r.travelingCalendar && r.travelingCalendar.reused === false, 'copyResource: kalender reist mee');
  assert(r.resource.calendarId === r.travelingCalendar!.calendar.id, 'copyResource: calendarId → project-lokale kalender');
  assert(r.resource.libraryOrigin?.libraryItemId === 'pr1', 'copyResource: stempel');
  const r2 = copyResourceToProject(p, 'pr2', [], [], genId)!;
  assert(r2.travelingCalendar === undefined && r2.resource.calendarId === undefined, 'copyResource: geen kalender ⇒ geen meereizende kopie');
}

{
  const p = pool();
  const existingCal = copyCalendarToProject(p, 'pc1', [], genId)!.calendar;
  const r = copyResourceToProject(p, 'pr1', [], [existingCal], genId)!;
  assert(r.travelingCalendar?.reused === true, 'copyResource: bestaande kalenderkopie wordt hergebruikt');
  assert(r.resource.calendarId === existingCal.id, 'copyResource: calendarId → hergebruikte kalender');
}

{
  const p = pool();
  const copy = copyResourceToProject(p, 'pr2', [], [], genId)!.resource;
  assert(diffResourceVsPool(copy, p).status === 'up-to-date', 'diff: verse kopie is up-to-date');
  const changed = { ...copy, costPerHour: 999 };
  const d = diffResourceVsPool(changed, p);
  assert(d.status === 'changed' && d.fields.some(f => f.field === 'costPerHour'), 'diff: gewijzigd veld gedetecteerd');
  const maxUnitsChanged = { ...copy, maxUnits: copy.maxUnits + 5, availabilitySteps: [{ from: '2030-01-01', maxUnits: 99 }] };
  assert(diffResourceVsPool(maxUnitsChanged, p).status === 'up-to-date', 'F1: maxUnits/availabilitySteps-wijziging levert GEEN afwijking meer op (projectinzet, geen bibliotheekafspraak)');
  const colorChanged = { ...copy, color: '#0EA5E9' };
  assert(diffResourceVsPool(colorChanged, p).status === 'up-to-date', '#21: kleurwijziging levert GEEN afwijking op (presentatie, geen bibliotheekafspraak)');
  assert(computeResourceHash(colorChanged) === computeResourceHash(copy), '#21: kleur zit niet in computeResourceHash');
  const removedPool: CompanyPool = { ...p, resources: [] };
  assert(diffResourceVsPool(copy, removedPool).status === 'removed', 'diff: verwijderd origineel ⇒ removed');
  const c = copyCalendarToProject(p, 'pc1', [], genId)!.calendar;
  assert(diffCalendarVsPool(c, p).status === 'up-to-date', 'diff: kalenderkopie up-to-date');
}

{
  const p = bumpPool(pool());
  const copy = {
    ...res('local-r', 'Oude naam', 'local-cal'),
    maxUnits: 8,
    availabilitySteps: [{ from: '2027-08-30', maxUnits: 2 }],
    libraryOrigin: makeOrigin({ ...p, poolVersion: 3 }, 'pr2'),
  };
  const poolSource = { ...res('pr2', 'Nieuwe naam'), maxUnits: 4, costPerHour: 55 };
  const updated = applyResourceUpdate(copy, { ...p, resources: [poolSource] }, []);
  assert(updated.id === 'local-r', 'applyUpdate: behoudt project-id');
  assert(updated.name === 'Nieuwe naam', 'applyUpdate: neemt pool-naam over (identiteitsveld)');
  assert(updated.costPerHour === 55, 'applyUpdate: neemt pool-costPerHour over (bibliotheekafspraak, RESOURCE_DIFF_FIELDS)');
  assert(updated.calendarId === 'local-cal', 'applyUpdate: behoudt project-lokale calendarId');
  assert(updated.libraryOrigin?.poolVersion === 4, 'applyUpdate: verse poolVersion in stempel');
  assert(updated.maxUnits === 8, 'F1: applyResourceUpdate laat maxUnits van het projectitem ongemoeid (was 8, pool zegt 4)');
  assert(
    JSON.stringify(updated.availabilitySteps) === JSON.stringify([{ from: '2027-08-30', maxUnits: 2 }]),
    'F1: applyResourceUpdate laat availabilitySteps van het projectitem ongemoeid (torenkraan-casus — pool heeft geen availabilitySteps)',
  );
}

{
  const p = pool();
  const copy = { ...res('local-r2', 'Oude naam'), costPerHour: 10, libraryOrigin: makeOrigin(p, 'pr2') };
  const updated = applyResourceUpdate(copy, { ...p, resources: [{ ...res('pr2', 'Oude naam'), costPerHour: 999 }] }, []);
  assert(updated.costPerHour === 999, 'F1 negatieve controle: costPerHour (bibliotheekafspraak, RESOURCE_DIFF_FIELDS) volgt de pool WEL');
}

{
  const p = pool();
  const projectCal: WorkCalendar = {
    ...cal('local-c', 'Oude kalendernaam'),
    hoursPerDay: 9,
    shift: 'SECOND',
    libraryOrigin: makeOrigin(p, 'pc1'),
  };
  const poolCal: WorkCalendar = { ...cal('pc1', 'Nieuwe kalendernaam'), hoursPerDay: 8, shift: 'FIRST' };
  const updated = applyCalendarUpdate(projectCal, { ...p, calendars: [poolCal] });
  assert(updated.id === 'local-c', 'applyCalendarUpdate: behoudt project-id');
  assert(updated.name === 'Nieuwe kalendernaam', 'applyCalendarUpdate: neemt pool-naam over');
  assert(updated.hoursPerDay === 8, 'applyCalendarUpdate: neemt pool-hoursPerDay over (in CALENDAR_DIFF_FIELDS)');
  assert(updated.shift === 'FIRST', 'applyCalendarUpdate: neemt pool-shift over (in CALENDAR_DIFF_FIELDS)');
}

{
  const p = pool();
  const c: WorkCalendar = {
    ...p.calendars[0],
    holidays: [
      { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' },
      { name: 'Nieuwjaar', startDate: '2026-01-01', endDate: '2026-01-01' },
    ],
  };
  const h1 = computeCalendarHash(c);
  const c2: WorkCalendar = { ...c, holidays: [...c.holidays].reverse() };
  assert(computeCalendarHash(c2) === h1, 'computeCalendarHash: array-volgorde telt niet mee (multiset)');
  const c4: WorkCalendar = { ...c, holidays: [c.holidays[0], { ...c.holidays[1], endDate: '2026-01-02' }] };
  assert(computeCalendarHash(c4) !== h1, 'computeCalendarHash: inhoudswijziging in een array-element verandert de hash');
  const c3: WorkCalendar = { ...c, workEndHour: 17 };
  assert(computeCalendarHash(c3) !== h1, 'computeCalendarHash: inhoudswijziging verandert de hash');
  const pWithHolidays: CompanyPool = { ...p, calendars: [c] };
  const projCal: WorkCalendar = { ...c, id: 'proj-x', libraryOrigin: makeOrigin(pWithHolidays, c.id, computeCalendarHash(c)) };
  assert(diffCalendarVsPool(projCal, pWithHolidays).status === 'up-to-date', 'materialisatie ⇒ diff up-to-date');
  assert(projCal.libraryOrigin!.syncedHash === computeCalendarHash(c), 'makeOrigin schrijft de syncedHash');

  const r: Resource = {
    ...p.resources[0],
    maxUnits: 4,
    availabilitySteps: [
      { from: '2026-01-01', maxUnits: 1 },
      { from: '2026-06-01', maxUnits: 2 },
    ],
  };
  const hr = computeResourceHash(r);
  assert(computeResourceHash({ ...r, maxUnits: 999 }) === hr, 'F1: computeResourceHash negeert maxUnits volledig');
  assert(computeResourceHash({ ...r, availabilitySteps: [...r.availabilitySteps!].reverse() }) === hr, 'F1: computeResourceHash negeert availabilitySteps-volgorde');
  assert(computeResourceHash({ ...r, availabilitySteps: [{ from: '2027-01-01', maxUnits: 50 }] }) === hr, 'F1: computeResourceHash negeert availabilitySteps-inhoud');
  assert(computeResourceHash({ ...r, availabilitySteps: undefined }) === hr, 'F1: computeResourceHash negeert het ONTBREKEN van availabilitySteps');
  assert(computeResourceHash({ ...r, name: 'Andere naam' }) !== hr, 'computeResourceHash: naam blijft gehasht');
  assert(computeResourceHash({ ...r, costPerHour: 999 }) !== hr, 'computeResourceHash: tarief/uur blijft gehasht');
  assert(computeResourceHash({ ...r, unitOfMeasure: 'stuks' }) !== hr, 'computeResourceHash: eenheid blijft gehasht');
}

{
  assert(normalizeName('  Ploeg  A ') === normalizeName('ploeg a'), 'normalizeName: trim+case+witruimte');
  const cands = [
    { id: 'a', name: 'Metselaar' },
    { id: 'b', name: 'Timmerman' },
  ];
  assert(matchByName('  metselaar ', cands)?.id === 'a', 'matchByName: exact na normalisatie');
  assert(matchByName('Loodgieter', cands) === null, 'matchByName: geen kandidaat ⇒ null');
  const dup = [{ id: 'a', name: 'Ploeg' }, { id: 'b', name: 'ploeg' }];
  assert(matchByName('PLOEG', dup) === null, 'matchByName: meerdere kandidaten ⇒ null (geen voorstel)');
}

{
  const ZWSP = '​'; const ZWNJ = '‌'; const ZWJ = '‍'; const BOM = '﻿'; const SHY = '­';
  assert(normalizeName(`Kraan${ZWSP}1`) === normalizeName('Kraan1'), 'F6: ZWSP wordt gestript vóór matching');
  assert(normalizeName(`Kraan${ZWNJ}1`) === normalizeName('Kraan1'), 'F6: ZWNJ wordt gestript vóór matching');
  assert(normalizeName(`Kraan${ZWJ}1`) === normalizeName('Kraan1'), 'F6: ZWJ wordt gestript vóór matching');
  assert(normalizeName(`Kraan${BOM}1`) === normalizeName('Kraan1'), 'F6: BOM (midden in de string) wordt gestript vóór matching');
  assert(normalizeName(`Kraan${SHY}1`) === normalizeName('Kraan1'), 'F6: soft-hyphen wordt gestript vóór matching');
  const cranes = [{ id: 'k1', name: 'Kraan1' }];
  assert(matchByName(`Kraan${ZWSP}1`, cranes)?.id === 'k1', 'F6: matchByName matcht een naam met onzichtbaar ZWSP-teken tegen de zichtbaar identieke pool-naam');
  assert(matchByName('Kraan 2', cranes) === null, 'F6: negatieve controle — een écht ander zichtbaar teken matcht niet');

  assert(matchByName('', [{ id: 'e1', name: '' }, { id: 'e2', name: '   ' }]) === null, 'F6: lege target ⇒ null, ook al is er een unieke "lege" kandidaat');
  assert(matchByName('   ', [{ id: 'e1', name: 'Iets' }]) === null, 'F6: pure-witruimte target ⇒ null');

  const nfc = 'café';
  const nfd = 'café';
  assert(normalizeName(nfc) === normalizeName(nfd), 'F6: NFC/NFD-paar blijft matchen (Unicode-normalisatie ongemoeid)');
  assert(matchByName(nfd, [{ id: 'c1', name: nfc }])?.id === 'c1', 'F6: matchByName matcht een NFD-naam tegen een NFC-pool-naam');

  assert(normalizeName('I') === 'i', 'F6: normalizeName gebruikt toLowerCase (machine-onafhankelijk), geen locale-specifieke casing');
}

{
  const repeated = { id: 'herhaald', name: 'Zelfde object' };
  const candidates = [
    { id: 'accent', name: 'Café' }, { id: 'kraan', name: 'Kraan1' },
    { id: 'ploeg', name: ' Ploeg\t A ' }, { id: 'leeg', name: '' },
    { id: 'onzichtbaar', name: '\u200b\u200c\u200d\ufeff\u00ad \t' },
    { id: 'ambigu-a', name: 'Timmerman' }, { id: 'ambigu-b', name: 'timmerman' },
    repeated, repeated,
    { id: 'dubbel', name: 'Dubbel id' }, { id: 'dubbel', name: 'Dubbel id' },
    { id: 'idgenoot', name: 'Idgenoot A' }, { id: 'idgenoot', name: 'Idgenoot B' },
    { id: 'prototype', name: '__proto__' }, { id: 'constructor', name: 'constructor' },
    { id: 'ascii-i', name: 'I' }, { id: 'unicode-i', name: 'İ' },
  ];
  const queries = [
    ...candidates.map(c => c.name), 'CAFE\u0301', ' \tPLOEG\u00a0 A ', 'TIMMERMAN',
    ...['\u200b', '\u200c', '\u200d', '\ufeff', '\u00ad'].map(c => `Kraan${c}1`),
    '', '\t \n', '\u200b\ufeff', 'Niet gevonden', 'Kraan 1', 'i', 'i\u0307', 'ı',
  ];
  for (const ordered of [candidates, [...candidates].reverse(), [], [{ id: 'enige', name: '' }]]) {
    const match = createNameMatcher(ordered);
    for (const query of queries) {
      assert(match(query) === matchByName(query, ordered),
        `naamindex: dezelfde objectidentiteit/null als scan voor ${JSON.stringify(query)} (${ordered.length} kandidaten)`);
    }
  }
  assert(createNameMatcher(candidates)('Zelfde object') === null, 'naamindex: hetzelfde object tweemaal blijft ambigu');
  assert(createNameMatcher(candidates)('Dubbel id') === null, 'naamindex: dezelfde id en naam tweemaal blijven ambigu');
  assert(createNameMatcher(candidates)('idgenoot b') === candidates[12], 'naamindex: gedeelde id met andere naam blijft uniek');

  const changed = [{ id: 'veranderlijk', name: 'Oud' }];
  const first = createNameMatcher(changed);
  assert(first('Oud') === changed[0], 'naamindex: oorspronkelijke poolnaam matcht');
  changed[0].name = 'Nieuw';
  const next = createNameMatcher(changed);
  assert(next('Oud') === null && next('Nieuw') === changed[0], 'naamindex: volgende index gebruikt gewijzigde naam, zonder blijvende cache');
}

for (const size of [1000, 5000]) {
  let reads = 0;
  const candidates = Array.from({ length: size }, (_, i) => ({
    id: `budget-${i}`,
    get name() { reads++; return `Équipe ${i}`; },
  }));
  const queries = candidates.map((_, i) => ` E\u0301QUIPE\t${i}\u200b `);
  const expected = queries.map(q => matchByName(q, candidates));
  reads = 0;
  const originalNormalize = String.prototype.normalize;
  let normalizations = 0;
  let actual: (typeof candidates[number] | null)[] = [];
  try {
    String.prototype.normalize = function (this: string, form?: string) {
      normalizations++;
      return originalNormalize.call(this, form);
    };
    const match = createNameMatcher(candidates);
    actual = queries.map(match);
  } finally {
    String.prototype.normalize = originalNormalize;
  }
  assert(actual.every((c, i) => c === expected[i]), `naamindex ${size}: alle kandidaatobjecten gelijk aan de scan`);
  assert(reads === size, `naamindex ${size}: poolnaam exact eenmaal gelezen (zag ${reads})`);
  assert(normalizations === size * 2, `naamindex ${size}: exact m+n normalisaties (zag ${normalizations})`);
}

{
  const p = pool();
  const src = p.calendars[0];
  const inSyncHash = computeCalendarHash(src);
  const inSync: WorkCalendar = { ...src, id: 'x', libraryOrigin: makeOrigin(p, src.id, inSyncHash) };
  assert(classifyCalendarOnOpen(inSync, p) === 'in-sync', 'classify: gelijk aan pool ⇒ in-sync');
  const bumped = bumpPool({ ...p, calendars: [{ ...src, workEndHour: 17 }] });
  const behind: WorkCalendar = { ...src, id: 'x', libraryOrigin: makeOrigin(p, src.id, inSyncHash) };
  assert(classifyCalendarOnOpen(behind, bumped) === 'behind', 'classify: file==hash, pool wijkt af ⇒ behind');
  const deviated: WorkCalendar = { ...src, id: 'x', workStartHour: 6, libraryOrigin: makeOrigin(p, src.id, inSyncHash) };
  assert(classifyCalendarOnOpen(deviated, bumped) === 'deviated', 'classify: file bewerkt na sync ⇒ deviated');
  const removed: WorkCalendar = { ...src, id: 'x', libraryOrigin: { companyId: p.companyId, libraryItemId: 'ghost', poolVersion: 1 } };
  assert(classifyCalendarOnOpen(removed, p) === 'removed', 'classify: poolitem weg ⇒ removed');
  const legacy: WorkCalendar = { ...src, id: 'x', libraryOrigin: { companyId: p.companyId, libraryItemId: src.id, poolVersion: 1 } };
  assert(classifyCalendarOnOpen(legacy, bumped) === 'deviated', 'classify: hash-loos + afwijkend ⇒ deviated (veilig)');
}

{
  const ROLE: Record<keyof WorkCalendar, 'identiteit' | 'inhoud' | 'herkomst'> = {
    id: 'identiteit',
    libraryOrigin: 'identiteit',
    name: 'inhoud',
    description: 'inhoud',
    workDays: 'inhoud',
    workStartHour: 'inhoud',
    workEndHour: 'inhoud',
    hoursPerDay: 'inhoud',
    simpleBreakStartMinute: 'inhoud',
    simpleBreakDurationMinutes: 'inhoud',
    holidays: 'inhoud',
    generation: 'inhoud',
    workTime: 'inhoud',
    shift: 'inhoud',
    workingExceptions: 'inhoud',
    ifcTimePeriods: 'herkomst',
    p6Source: 'herkomst',
    p6NonWorkPenaltyDates: 'herkomst',
    p6NonWorkPenaltyDatesState: 'herkomst',
  };
  const inhoud = (Object.keys(ROLE) as (keyof WorkCalendar)[]).filter((k) => ROLE[k] === 'inhoud').sort();
  assert(JSON.stringify([...CALENDAR_DIFF_FIELDS].sort()) === JSON.stringify(inhoud),
    `R2: CALENDAR_DIFF_FIELDS dekt precies alle inhoudsvelden (kreeg ${JSON.stringify([...CALENDAR_DIFF_FIELDS].sort())})`);

  const p = pool();
  const WE = [{ name: 'Inhaalzaterdag', startDate: '2026-06-06', endDate: '2026-06-06' }];
  const poolCal: WorkCalendar = { ...cal('pc1', 'Ploegkalender'), simpleBreakStartMinute: 750, simpleBreakDurationMinutes: 30, workingExceptions: WE };
  const copy: WorkCalendar = { ...cal('local-c', 'Ploegkalender'), simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60, libraryOrigin: makeOrigin(p, 'pc1') };
  const withPool: CompanyPool = { ...p, calendars: [poolCal] };
  const d = diffCalendarVsPool(copy, withPool);
  const changed = d.status === 'changed' ? d.fields.map((f) => f.field).sort() : [];
  assert(JSON.stringify(changed) === JSON.stringify(['simpleBreakDurationMinutes', 'simpleBreakStartMinute', 'workingExceptions']),
    `R2: diff ziet pauze en werkende uitzonderingen (kreeg ${JSON.stringify(changed)})`);
  const updated = applyCalendarUpdate(copy, withPool);
  assert(updated.simpleBreakStartMinute === 750 && updated.simpleBreakDurationMinutes === 30,
    'R2: applyCalendarUpdate neemt het pauzepatroon van de bibliotheek over');
  assert(JSON.stringify(updated.workingExceptions) === JSON.stringify(WE), 'R2: applyCalendarUpdate neemt de werkende uitzonderingen over');
  assert(diffCalendarVsPool(updated, withPool).status === 'up-to-date', 'R2: na verversen is de kopie up-to-date');
  assert(computeCalendarHash({ ...poolCal, simpleBreakStartMinute: 780 }) !== computeCalendarHash(poolCal),
    'R2: een verschoven pauze (zelfde duur) verandert de hash');
  assert(computeCalendarHash({ ...poolCal, workingExceptions: undefined }) !== computeCalendarHash(poolCal),
    'R2: werkende uitzonderingen tellen mee in de hash');
}

{
  const V1 = ['name', 'description', 'workDays', 'workStartHour', 'workEndHour', 'hoursPerDay',
    'holidays', 'generation', 'workTime', 'shift'] as const;
  const legacyHash = (c: WorkCalendar): string => JSON.stringify(V1.map((f) => diffKey(c[f])));

  const p = pool();
  const src = p.calendars[0];
  assert(computeCalendarHash(src) === legacyHash(src), 'R2-migratie: kalender zonder pauzevelden ⇒ hash byte-identiek aan de oude');
  assert(computeCalendarHash({ ...src, simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined }) === legacyHash(src),
    'R2-migratie: pauzesleutels met waarde undefined (zoals CalendarForm ze wist) tellen als afwezig');

  const oldCopy: WorkCalendar = { ...src, id: 'x', libraryOrigin: makeOrigin(p, src.id, legacyHash(src)) };
  const poolV1Change = bumpPool({ ...p, calendars: [{ ...src, workEndHour: 17, hoursPerDay: 9 }] });
  assert(classifyCalendarOnOpen(oldCopy, poolV1Change) === 'behind', 'R2-migratie: oude stempel, ongewijzigde kopie, poolwijziging (werkdag) ⇒ behind');
  const poolGetsBreak = bumpPool({ ...p, calendars: [{ ...src, simpleBreakStartMinute: 750, simpleBreakDurationMinutes: 30 }] });
  assert(classifyCalendarOnOpen(oldCopy, poolGetsBreak) === 'behind', 'R2-migratie: oude stempel, kopie zonder pauze, pool krijgt een pauze ⇒ behind');
  const refreshed = applyCalendarUpdate(oldCopy, poolGetsBreak);
  assert(refreshed.simpleBreakStartMinute === 750 && diffCalendarVsPool(refreshed, poolGetsBreak).status === 'up-to-date',
    'R2-migratie: het verversen brengt de pauze mee');
  assert(refreshed.libraryOrigin?.syncedHash === computeCalendarHash(refreshed), 'R2-migratie: na verversen draagt de kopie een stempel in de nieuwe vorm');

  const srcBrk: WorkCalendar = { ...src, simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60 };
  const pBrk: CompanyPool = { ...p, calendars: [srcBrk] };
  const oldBrkCopy: WorkCalendar = { ...srcBrk, id: 'x', libraryOrigin: makeOrigin(pBrk, src.id, legacyHash(srcBrk)) };
  assert(classifyCalendarOnOpen(oldBrkCopy, pBrk) === 'in-sync', 'R2-migratie: oude stempel, kopie met pauze gelijk aan de pool ⇒ in-sync');
  const pBrkV1Change = bumpPool({ ...pBrk, calendars: [{ ...srcBrk, name: 'Ploegkalender 2026' }] });
  assert(classifyCalendarOnOpen(oldBrkCopy, pBrkV1Change) === 'behind', 'R2-migratie: oude stempel, kopie met pauze gelijk aan de pool, poolwijziging (naam) ⇒ behind');
  assert(classifyCalendarOnOpen({ ...oldBrkCopy, workStartHour: 6 }, pBrkV1Change) === 'deviated',
    'R2-migratie: oude stempel, lokaal bewerkte werkdag ⇒ deviated');

  const pBrkMoved = bumpPool({ ...pBrk, calendars: [{ ...srcBrk, simpleBreakStartMinute: 750 }] });
  assert(classifyCalendarOnOpen(oldBrkCopy, pBrkMoved) === 'deviated', 'R2-migratie: oude stempel, pauze wijkt af van de pool ⇒ deviated (niet te bewijzen onbewerkt)');

  const newBrkCopy: WorkCalendar = { ...srcBrk, id: 'x', libraryOrigin: makeOrigin(pBrk, src.id, computeCalendarHash(srcBrk)) };
  assert(classifyCalendarOnOpen(newBrkCopy, pBrkMoved) === 'behind', 'R2: nieuwe stempel, pauze in de pool verschoven ⇒ behind');
  assert(classifyCalendarOnOpen({ ...newBrkCopy, simpleBreakDurationMinutes: 45 }, pBrkMoved) === 'deviated',
    'R2: nieuwe stempel, pauzeduur lokaal bewerkt ⇒ deviated');
}

{
  const p = pool();
  const srcRes = p.resources[1];
  const inSyncHash = computeResourceHash(srcRes);
  const inSync: Resource = { ...srcRes, id: 'x', libraryOrigin: makeOrigin(p, srcRes.id, inSyncHash) };
  assert(classifyResourceOnOpen(inSync, p) === 'in-sync', 'classify(resource): gelijk aan pool ⇒ in-sync');
  const bumped = bumpPool({ ...p, resources: [p.resources[0], { ...srcRes, costPerHour: 9 }] });
  const behind: Resource = { ...srcRes, id: 'x', libraryOrigin: makeOrigin(p, srcRes.id, inSyncHash) };
  assert(classifyResourceOnOpen(behind, bumped) === 'behind', 'classify(resource): file==hash, pool wijkt af ⇒ behind');
  const deviated: Resource = { ...srcRes, id: 'x', costPerHour: 3, libraryOrigin: makeOrigin(p, srcRes.id, inSyncHash) };
  assert(classifyResourceOnOpen(deviated, bumped) === 'deviated', 'classify(resource): file bewerkt na sync ⇒ deviated');
  const removed: Resource = { ...srcRes, id: 'x', libraryOrigin: { companyId: p.companyId, libraryItemId: 'ghost', poolVersion: 1 } };
  assert(classifyResourceOnOpen(removed, p) === 'removed', 'classify(resource): poolitem weg ⇒ removed');
  const legacy: Resource = { ...srcRes, id: 'x', libraryOrigin: { companyId: p.companyId, libraryItemId: srcRes.id, poolVersion: 1 } };
  assert(classifyResourceOnOpen(legacy, bumped) === 'deviated', 'classify(resource): hash-loos + afwijkend ⇒ deviated (veilig)');
}

{
  const p = pool();
  const srcRes = p.resources[0];
  const afterPromote = bumpPool({ ...p, resources: [srcRes, res('new-r', 'Nieuwe kraan')] });
  const poolItemAtPromote = afterPromote.resources.find((r) => r.id === 'new-r')!;
  const backStampHash = computeResourceHash(poolItemAtPromote);
  const afterPoolEdit = bumpPool({
    ...afterPromote,
    resources: afterPromote.resources.map((r) => (r.id === 'new-r' ? { ...r, costPerHour: 42 } : r)),
  });
  const promotedThenPoolMoved: Resource = {
    ...poolItemAtPromote,
    id: 'local-new-r',
    libraryOrigin: makeOrigin(afterPromote, 'new-r', backStampHash),
  };
  assert(
    classifyResourceOnOpen(promotedThenPoolMoved, afterPoolEdit) === 'behind',
    'classify: net-gepromoveerd item + latere pool-edit ⇒ behind (back-stamp = pool-hash bewijst de stille verversing)',
  );
  const promotedWithGarbageStamp: Resource = {
    ...poolItemAtPromote,
    id: 'local-new-r',
    libraryOrigin: { ...makeOrigin(afterPromote, 'new-r'), syncedHash: 'garbage-niet-de-pool-hash' },
  };
  assert(
    classifyResourceOnOpen(promotedWithGarbageStamp, afterPoolEdit) === 'deviated',
    'classify: zelfde scenario met foute stempel ⇒ deviated (contrast — bewijst dat de hash-waarde het verschil maakt)',
  );
  const promotedNoStamp: Resource = {
    ...poolItemAtPromote,
    id: 'local-new-r',
    libraryOrigin: makeOrigin(afterPromote, 'new-r'),
  };
  assert(
    classifyResourceOnOpen(promotedNoStamp, afterPoolEdit) === 'deviated',
    'classify: zelfde scenario zonder stempel ⇒ deviated (contrast — veilige kant zonder syncedHash)',
  );
}

{
  const p = pool();
  const own: Resource = res('own-r', 'Projecteigen resource');
  assert(classifyResourceOnOpen(own, p) === 'unbound', 'classify(resource): geen libraryOrigin ⇒ unbound, niet removed');
  assert(classifyResourceOnOpen(own, p) !== 'removed', 'classify(resource): unbound valt niet samen met removed');
  const ownCal: WorkCalendar = cal('own-c', 'Projecteigen kalender');
  assert(classifyCalendarOnOpen(ownCal, p) === 'unbound', 'classify(calendar): geen libraryOrigin ⇒ unbound, niet removed');
}

{
  assert(resolveUniqueCompanyName('Nieuw BV', ['Ander BV']) === 'Nieuw BV', 'resolveUniqueCompanyName: geen botsing ⇒ ongewijzigd');
  assert(resolveUniqueCompanyName('Enige BV', []) === 'Enige BV', 'resolveUniqueCompanyName: lege bestaande-lijst ⇒ ongewijzigd');

  assert(resolveUniqueCompanyName('Nieuw BV', ['Nieuw BV']) === 'Nieuw BV (2)', 'resolveUniqueCompanyName: één botsing ⇒ " (2)"');

  assert(resolveUniqueCompanyName('X', ['X', 'X (2)']) === 'X (3)', 'resolveUniqueCompanyName: kale naam + " (2)" bezet ⇒ " (3)"');
  assert(resolveUniqueCompanyName('X', ['X', 'X (2)', 'X (3)', 'X (4)']) === 'X (5)', 'resolveUniqueCompanyName: vier bezette varianten ⇒ telt door tot de eerste vrije');

  assert(resolveUniqueCompanyName('  nieuw bv  ', ['Nieuw BV']) === 'nieuw bv (2)', 'resolveUniqueCompanyName: case/witruimte-ongevoelige botsing ⇒ eigen schrijfwijze + " (2)"');

  assert(resolveUniqueCompanyName('', []) === 'Nieuwe resourcebibliotheek', 'resolveUniqueCompanyName: lege naam ⇒ standaardlabel');
  assert(resolveUniqueCompanyName('   ', []) === 'Nieuwe resourcebibliotheek', 'resolveUniqueCompanyName: pure ASCII-witruimte ⇒ standaardlabel');

  const zeroWidthOnly = '​​​';
  assert(resolveUniqueCompanyName(zeroWidthOnly, []) === 'Nieuwe resourcebibliotheek', 'resolveUniqueCompanyName [F4]: uitsluitend onzichtbare tekens ⇒ standaardlabel, niet een lege naam');
  assert(resolveUniqueCompanyName(zeroWidthOnly, ['Nieuwe resourcebibliotheek']) === 'Nieuwe resourcebibliotheek (2)', 'resolveUniqueCompanyName [F4]: standaardlabel zelf kan ook botsen ⇒ " (2)"');
}

{
  assert(isReservedCompanyId(DEFAULT_COMPANY_ID) === true, 'isReservedCompanyId: DEFAULT_COMPANY_ID is reserved');
  assert(isReservedCompanyId(DEMO_COMPANY_ID) === true, 'isReservedCompanyId: DEMO_COMPANY_ID is reserved');
  assert(isReservedCompanyId('company-abc123') === false, 'isReservedCompanyId: een gewoon gegenereerd id is NIET reserved');
  assert(isReservedCompanyId('') === false, 'isReservedCompanyId: lege string is niet reserved (geen valse positieve)');

  assert(isSafeFileCompanyId('shared-co-echo-9') === true, 'isSafeFileCompanyId: een normaal alfanumeriek-met-streepjes id is veilig');
  assert(isSafeFileCompanyId('__proto__') === false, 'isSafeFileCompanyId: "__proto__" is ONVEILIG (bestaat uitsluitend uit toegestane tekens, dus de regex alleen zou het doorlaten)');
  assert(isSafeFileCompanyId('constructor') === false, 'isSafeFileCompanyId: "constructor" is ONVEILIG');
  assert(isSafeFileCompanyId('prototype') === false, 'isSafeFileCompanyId: "prototype" is ONVEILIG');
  assert(isSafeFileCompanyId('') === false, 'isSafeFileCompanyId: lege string is ONVEILIG (regex vereist ≥1 teken)');
  assert(isSafeFileCompanyId(' ') === false, 'isSafeFileCompanyId: een enkele spatie is ONVEILIG (niet in de whitelist-tekenklasse)');
  assert(isSafeFileCompanyId('​') === false, 'isSafeFileCompanyId: een zero-width space is ONVEILIG (niet in de whitelist-tekenklasse)');
  assert(isSafeFileCompanyId('a'.repeat(64)) === true, 'isSafeFileCompanyId: 64 tekens is nog net toegestaan (bovengrens)');
  assert(isSafeFileCompanyId('a'.repeat(65)) === false, 'isSafeFileCompanyId: 65 tekens is te lang (negatieve controle op de bovengrens)');
}

{
  const localCompanies = [{ id: DEFAULT_COMPANY_ID }, { id: 'company-eigen-2' }];

  assert(
    JSON.stringify(resolvePoolImportPreselection('company-eigen-2', localCompanies)) === JSON.stringify({ action: 'replace', companyId: 'company-eigen-2' }),
    'resolvePoolImportPreselection: gewoon (niet-reserved) matchend id ⇒ "vervangen" met die bibliotheek',
  );
  assert(
    JSON.stringify(resolvePoolImportPreselection('company-onbekend-elders', localCompanies)) === JSON.stringify({ action: 'add' }),
    'resolvePoolImportPreselection: geen lokale match ⇒ "toevoegen"',
  );

  assert(
    resolvePoolImportPreselection(DEFAULT_COMPANY_ID, localCompanies).action === 'add',
    'resolvePoolImportPreselection [F1, DE FIX]: DEFAULT_COMPANY_ID selecteert ALTIJD "toevoegen" voor, ook al bestaat het lokaal',
  );
  assert(
    resolvePoolImportPreselection(DEMO_COMPANY_ID, [{ id: DEMO_COMPANY_ID }]).action === 'add',
    'resolvePoolImportPreselection [F1]: DEMO_COMPANY_ID selecteert ALTIJD "toevoegen" voor, ook al bestaat het lokaal',
  );

  assert(
    resolvePoolImportPreselection('__proto__', [{ id: '__proto__' }]).action === 'add',
    'resolvePoolImportPreselection [F2]: een onveilig bestand-id ("__proto__") matcht nooit, ook niet bij toevallige lokale gelijkenis',
  );

  const poolWithDefaultId: CompanyPool = {
    companyId: DEFAULT_COMPANY_ID, companyName: 'Mijn resourcebibliotheek',
    poolVersion: 2, modifiedAt: '2026-07-01T00:00:00.000Z', calendars: [], resources: [],
  };
  const roundtrippedPreselection = resolvePoolImportPreselection(poolWithDefaultId.companyId, localCompanies);
  assert(roundtrippedPreselection.action === 'add', 'resolvePoolImportPreselection [F1, reviewer-reproductie]: een export van andermans DEFAULT_COMPANY_ID-bibliotheek selecteert bij de ontvanger "toevoegen", NOOIT "vervangen" op zijn eigen bibliotheek');
}

{
  const localCompanies = [{ id: DEFAULT_COMPANY_ID }, { id: 'company-eigen-2' }];

  assert(
    classifyPoolImportIdentityHint('company-eigen-2', localCompanies) === 'collision',
    'classifyPoolImportIdentityHint: gewoon matchend id ⇒ "collision" (aantoonbaar al lokaal bekend)',
  );

  assert(
    classifyPoolImportIdentityHint('company-onbekend-elders', localCompanies) === 'none',
    'classifyPoolImportIdentityHint: geen match, niet reserved/onveilig ⇒ "none"',
  );

  assert(
    classifyPoolImportIdentityHint(DEFAULT_COMPANY_ID, localCompanies) === 'fresh-identity',
    'classifyPoolImportIdentityHint [DE FIX]: DEFAULT_COMPANY_ID ⇒ "fresh-identity", nooit "collision" — ook al bestaat het lokaal',
  );

  assert(
    !localCompanies.some((c) => c.id === DEMO_COMPANY_ID),
    'setup: de demo-bibliotheek bestaat in dit scenario lokaal nog niet',
  );
  assert(
    classifyPoolImportIdentityHint(DEMO_COMPANY_ID, localCompanies) === 'fresh-identity',
    'classifyPoolImportIdentityHint [DE FIX]: DEMO_COMPANY_ID zonder lokale demo-bibliotheek ⇒ "fresh-identity", NIET "collision" (die bewering zou onwaar zijn)',
  );

  assert(
    classifyPoolImportIdentityHint('__proto__', [{ id: '__proto__' }]) === 'fresh-identity',
    'classifyPoolImportIdentityHint: onveilig id ("__proto__") ⇒ "fresh-identity", nooit "collision"',
  );
}

console.log(`library-ops: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
