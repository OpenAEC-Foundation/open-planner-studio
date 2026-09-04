// Pure-ops-batterij voor de bedrijfsbibliotheek (spec B1, §2/§3/§4). Draait headless op Node; de
// exitcode is de poort (XX-regels tonen afwijkingen). Geen store, geen I/O — alleen libraryOps.
import {
  bumpPool, isPoolNewer, makeOrigin, findCopyByOrigin,
  copyCalendarToProject, copyResourceToProject,
  diffCalendarVsPool, diffResourceVsPool, applyResourceUpdate, applyCalendarUpdate,
  computeCalendarHash, computeResourceHash,
  normalizeName, matchByName,
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

// counter-gebaseerde genId voor deterministische ids in de test
let n = 0;
const genId = (prefix: string) => `${prefix}-gen-${++n}`;

// 1. bumpPool
{
  const p = pool();
  const b = bumpPool(p);
  assert(b.poolVersion === 4, 'bumpPool verhoogt poolVersion');
  assert(b.modifiedAt !== p.modifiedAt, 'bumpPool verse modifiedAt');
  assert(p.poolVersion === 3, 'bumpPool muteert het origineel niet');
}

// 2. isPoolNewer
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

// 2b. isPoolNewer — spec-"óf" (critreview taak 10, fix 2): versie EN tijd tellen onafhankelijk mee,
// geen precedentie-ladder. Ook: robuuste tijdvergelijking via Date.parse i.p.v. string-lexicografie
// (dekt offset-notaties die lexicografisch verkeerd sorteren).
{
  // Lokaal lagere versie (3 < 5) maar latere modifiedAt ⇒ toch "nieuwer" (OR, niet AND/precedentie).
  const local = { ...pool(), poolVersion: 3, modifiedAt: '2026-07-20T15:00:00.000Z' };
  const imported = { ...pool(), poolVersion: 5, modifiedAt: '2026-07-20T09:00:00.000Z' };
  assert(isPoolNewer(local, imported) === true, 'isPoolNewer: lokaal lagere versie maar latere tijd ⇒ toch nieuwer (spec-óf)');

  // Gelijke versie + gelijke tijd ⇒ niet nieuwer.
  const same = pool();
  assert(isPoolNewer(same, { ...same }) === false, 'isPoolNewer: gelijke versie/tijd ⇒ niet nieuwer');

  // Offset-notatie die lexicografisch verkeerd sorteert: 20e 23:00-05:00 = 21e 04:00 UTC, dus ÉCHT
  // later dan 21e 00:30Z — maar als string is '...T20...' < '...T21...' (lexicografisch "ouder").
  // Gelijke poolVersion, dus alleen de tijdvergelijking beslist.
  const localOffset = { ...pool(), poolVersion: 7, modifiedAt: '2026-07-20T23:00:00-05:00' };
  const importedLaterString = { ...pool(), poolVersion: 7, modifiedAt: '2026-07-21T00:30:00.000Z' };
  assert(
    isPoolNewer(localOffset, importedLaterString) === true,
    'isPoolNewer: offset-notatie vergelijkt op echte tijd (Date.parse), niet op string-lexicografie',
  );

  // Onparseerbare modifiedAt valt terug op epoch 0 (parseTime-fallback) — geen NaN-vergelijking,
  // geen crash; twee onparseerbare tijden zijn "gelijk" (0 === 0, dus niet nieuwer bij gelijke versie).
  const localBad = { ...pool(), poolVersion: 9, modifiedAt: 'niet-een-datum' };
  const importedBad = { ...pool(), poolVersion: 9, modifiedAt: 'ook-geen-datum' };
  assert(isPoolNewer(localBad, importedBad) === false, 'isPoolNewer: onparseerbare tijden aan beide kanten ⇒ gelijk (fallback 0), niet nieuwer');
}

// 3. makeOrigin + dedup
{
  const p = pool();
  const o = makeOrigin(p, 'pr1');
  assert(o.companyId === 'c1' && o.libraryItemId === 'pr1' && o.poolVersion === 3, 'makeOrigin stempelt correct');
  const list: Resource[] = [{ ...res('x', 'x'), libraryOrigin: o }];
  assert(findCopyByOrigin(list, 'c1', 'pr1')?.id === 'x', 'findCopyByOrigin vindt bestaande kopie');
  assert(findCopyByOrigin(list, 'c1', 'pr2') === undefined, 'findCopyByOrigin: geen match');
  assert(findCopyByOrigin(list, 'c2', 'pr1') === undefined, 'findCopyByOrigin: cross-bedrijf-dedupgrens (companyId c2 vindt geen kopie gestempeld met c1)');
}

// 4. copyCalendarToProject — nieuw + dedup
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

// 5. copyResourceToProject — meereizende kalender + herschreven calendarId
{
  const p = pool();
  const r = copyResourceToProject(p, 'pr1', [], [], genId)!;
  assert(r.reused === false, 'copyResource: verse kopie');
  assert(!!r.travelingCalendar && r.travelingCalendar.reused === false, 'copyResource: kalender reist mee');
  assert(r.resource.calendarId === r.travelingCalendar!.calendar.id, 'copyResource: calendarId → project-lokale kalender');
  assert(r.resource.libraryOrigin?.libraryItemId === 'pr1', 'copyResource: stempel');
  // Resource zonder eigen pool-kalender (pr2): geen meereizende kalender, calendarId undefined
  const r2 = copyResourceToProject(p, 'pr2', [], [], genId)!;
  assert(r2.travelingCalendar === undefined && r2.resource.calendarId === undefined, 'copyResource: geen kalender ⇒ geen meereizende kopie');
}

// 6. copyResourceToProject — dedup van meereizende kalender (bestaande kalenderkopie hergebruikt)
{
  const p = pool();
  const existingCal = copyCalendarToProject(p, 'pc1', [], genId)!.calendar;
  const r = copyResourceToProject(p, 'pr1', [], [existingCal], genId)!;
  assert(r.travelingCalendar?.reused === true, 'copyResource: bestaande kalenderkopie wordt hergebruikt');
  assert(r.resource.calendarId === existingCal.id, 'copyResource: calendarId → hergebruikte kalender');
}

// 7. diff — up-to-date / changed / removed
{
  const p = pool();
  const copy = copyResourceToProject(p, 'pr2', [], [], genId)!.resource;
  assert(diffResourceVsPool(copy, p).status === 'up-to-date', 'diff: verse kopie is up-to-date');
  // F1 (critreview op 352bb94, issue #19): costPerHour is een bibliotheekafspraak, blijft dus gevolgd.
  const changed = { ...copy, costPerHour: 999 };
  const d = diffResourceVsPool(changed, p);
  assert(d.status === 'changed' && d.fields.some(f => f.field === 'costPerHour'), 'diff: gewijzigd veld gedetecteerd');
  // F1 (verplichte assert): maxUnits/availabilitySteps zijn projectinzet — een wijziging daarop mag
  // GEEN afwijking meer opleveren. Draai de negatieve controle door ze terug in
  // RESOURCE_DIFF_FIELDS te zetten: dit blok kleurt dan rood.
  const maxUnitsChanged = { ...copy, maxUnits: copy.maxUnits + 5, availabilitySteps: [{ from: '2030-01-01', maxUnits: 99 }] };
  assert(diffResourceVsPool(maxUnitsChanged, p).status === 'up-to-date', 'F1: maxUnits/availabilitySteps-wijziging levert GEEN afwijking meer op (projectinzet, geen bibliotheekafspraak)');
  // #21: color is PUUR presentatie — mag nooit een afwijkingsstatus of hash-wijziging triggeren
  // (een andere kleur is geen "wijkt af", anders zou de afwijkingsdialoog de rapportkleuren gaan
  // "herstellen"). Draai de negatieve controle: color in RESOURCE_DIFF_FIELDS zetten kleurt rood.
  const colorChanged = { ...copy, color: '#0EA5E9' };
  assert(diffResourceVsPool(colorChanged, p).status === 'up-to-date', '#21: kleurwijziging levert GEEN afwijking op (presentatie, geen bibliotheekafspraak)');
  assert(computeResourceHash(colorChanged) === computeResourceHash(copy), '#21: kleur zit niet in computeResourceHash');
  const removedPool: CompanyPool = { ...p, resources: [] };
  assert(diffResourceVsPool(copy, removedPool).status === 'removed', 'diff: verwijderd origineel ⇒ removed');
  const c = copyCalendarToProject(p, 'pc1', [], genId)!.calendar;
  assert(diffCalendarVsPool(c, p).status === 'up-to-date', 'diff: kalenderkopie up-to-date');
}

// 8. applyResourceUpdate behoudt id + project-lokale calendarId, verse poolVersion, EN (F1,
// critreview issue #19) laat PROJECTINZET-velden (maxUnits/availabilitySteps) ONGEMOEID — alleen
// RESOURCE_DIFF_FIELDS (identiteit/bibliotheekafspraak) volgt de pool. Vóór de fix deed
// `applyResourceUpdate` `{...structuredClone(source), id, calendarId, parentId, libraryOrigin}`, wat
// het VOLLEDIGE poolitem overschreef — gemeten in de showcases: Schilders-maxUnits 8→4, en de
// torenkraan verloor zijn availabilitySteps.
{
  const p = bumpPool(pool()); // poolVersion 4
  const copy = {
    ...res('local-r', 'Oude naam', 'local-cal'),
    maxUnits: 8,
    availabilitySteps: [{ from: '2027-08-30', maxUnits: 2 }],
    libraryOrigin: makeOrigin({ ...p, poolVersion: 3 }, 'pr2'),
  };
  const poolSource = { ...res('pr2', 'Nieuwe naam'), maxUnits: 4, costPerHour: 55 };
  const updated = applyResourceUpdate(copy, { ...p, resources: [poolSource] });
  assert(updated.id === 'local-r', 'applyUpdate: behoudt project-id');
  assert(updated.name === 'Nieuwe naam', 'applyUpdate: neemt pool-naam over (identiteitsveld)');
  assert(updated.costPerHour === 55, 'applyUpdate: neemt pool-costPerHour over (bibliotheekafspraak, RESOURCE_DIFF_FIELDS)');
  assert(updated.calendarId === 'local-cal', 'applyUpdate: behoudt project-lokale calendarId');
  assert(updated.libraryOrigin?.poolVersion === 4, 'applyUpdate: verse poolVersion in stempel');
  // F1 (verplichte assert, issue #19): maxUnits/availabilitySteps zijn PROJECTINZET, geen
  // bibliotheekafspraak — "bijwerken" mag ze niet overschrijven/wissen, ook al wijkt de pool af
  // (poolSource.maxUnits=4 vs project 8, poolSource heeft GEEN availabilitySteps).
  assert(updated.maxUnits === 8, 'F1: applyResourceUpdate laat maxUnits van het projectitem ongemoeid (was 8, pool zegt 4)');
  assert(
    JSON.stringify(updated.availabilitySteps) === JSON.stringify([{ from: '2027-08-30', maxUnits: 2 }]),
    'F1: applyResourceUpdate laat availabilitySteps van het projectitem ongemoeid (torenkraan-casus — pool heeft geen availabilitySteps)',
  );
}

// 8b. F1 negatieve controle: een ECHT bibliotheekafspraak-veld (costPerHour, in RESOURCE_DIFF_FIELDS)
// volgt de pool WEL — bewijst dat de F1-fix niet per ongeluk ALLE velden bevriest (alleen de
// projectinzet-velden buiten RESOURCE_DIFF_FIELDS blijven staan).
{
  const p = pool();
  const copy = { ...res('local-r2', 'Oude naam'), costPerHour: 10, libraryOrigin: makeOrigin(p, 'pr2') };
  const updated = applyResourceUpdate(copy, { ...p, resources: [{ ...res('pr2', 'Oude naam'), costPerHour: 999 }] });
  assert(updated.costPerHour === 999, 'F1 negatieve controle: costPerHour (bibliotheekafspraak, RESOURCE_DIFF_FIELDS) volgt de pool WEL');
}

// 8c. applyCalendarUpdate: CALENDAR_DIFF_FIELDS dekt bewust ALLE inhoudelijke WorkCalendar-velden (er
// is geen "projectinzet"-veld zoals bij Resource) — dus alle content-velden volgen de pool, alleen id
// blijft van het project. `workTime`/`generation`/`shift` (optionele 2.8-velden) zitten hier expliciet
// in scope om te bewijzen dat de refactor (applyDiffFields) niets stil laat liggen.
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

// --- syncedHash spiegelt de diff-normalisatie exact (plan-eis 8) ---
{
  const p = pool();
  // GO-NA-FIX 1 (critreview 9f9f0aa): de fixture-kalender/-resource hebben lege/afwezige
  // multiset-velden (`holidays: []`, geen `availabilitySteps`) — daarmee zou een reversed-equal
  // check triviaal waar blijven, ook zonder de `.sort()` in `diffKey`. Bouw daarom hier lokaal een
  // kalender met ≥2 verschillende holidays en een resource met ≥2 verschillende availabilitySteps,
  // zodat de reversed-equal-assert écht multiset-gedrag bewijst (en niet leeg-array-gedrag).
  const c: WorkCalendar = {
    ...p.calendars[0],
    holidays: [
      { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-26' },
      { name: 'Nieuwjaar', startDate: '2026-01-01', endDate: '2026-01-01' },
    ],
  };
  // Materialisatie-hash == hash van de pool-bron.
  const h1 = computeCalendarHash(c);
  // Array-VOLGORDE mag de hash NIET veranderen (multiset, zoals diffKey): feestdagen omdraaien.
  const c2: WorkCalendar = { ...c, holidays: [...c.holidays].reverse() };
  assert(computeCalendarHash(c2) === h1, 'computeCalendarHash: array-volgorde telt niet mee (multiset)');
  // Een echte inhoudswijziging vervangt niet, maar wijzigt één element inhoudelijk (zelfde lengte,
  // andere data) — dit MOET de hash veranderen ondanks de multiset-normalisatie.
  const c4: WorkCalendar = { ...c, holidays: [c.holidays[0], { ...c.holidays[1], endDate: '2026-01-02' }] };
  assert(computeCalendarHash(c4) !== h1, 'computeCalendarHash: inhoudswijziging in een array-element verandert de hash');
  // Een echte inhoudswijziging op een scalair veld verandert de hash WEL.
  const c3: WorkCalendar = { ...c, workEndHour: 17 };
  assert(computeCalendarHash(c3) !== h1, 'computeCalendarHash: inhoudswijziging verandert de hash');
  // Consistentie met de diff: gelijk aan pool ⇒ hash-gelijk; diff up-to-date.
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
  // F1 (critreview op 352bb94, issue #19): maxUnits/availabilitySteps zijn UIT RESOURCE_DIFF_FIELDS
  // gehaald — ze zijn projectinzet (hoeveel/wanneer dit ene project inzet), geen bibliotheekafspraak,
  // en mogen de hash dus NIET meer raken, in geen enkele vorm (scalair, array-volgorde, array-inhoud,
  // of volledige afwezigheid). Dit is de kern-assert achter het hele fix-rond: zet de velden terug in
  // RESOURCE_DIFF_FIELDS en dit blok kleurt rood (negatieve controle).
  assert(computeResourceHash({ ...r, maxUnits: 999 }) === hr, 'F1: computeResourceHash negeert maxUnits volledig');
  assert(computeResourceHash({ ...r, availabilitySteps: [...r.availabilitySteps!].reverse() }) === hr, 'F1: computeResourceHash negeert availabilitySteps-volgorde');
  assert(computeResourceHash({ ...r, availabilitySteps: [{ from: '2027-01-01', maxUnits: 50 }] }) === hr, 'F1: computeResourceHash negeert availabilitySteps-inhoud');
  assert(computeResourceHash({ ...r, availabilitySteps: undefined }) === hr, 'F1: computeResourceHash negeert het ONTBREKEN van availabilitySteps');
  // Overige gevolgde velden (identiteit/bibliotheekafspraken) blijven wél gehasht — anders zou de
  // hele diff-/syncedHash-machinerie zinloos worden.
  assert(computeResourceHash({ ...r, name: 'Andere naam' }) !== hr, 'computeResourceHash: naam blijft gehasht');
  assert(computeResourceHash({ ...r, costPerHour: 999 }) !== hr, 'computeResourceHash: tarief/uur blijft gehasht');
  assert(computeResourceHash({ ...r, unitOfMeasure: 'stuks' }) !== hr, 'computeResourceHash: eenheid blijft gehasht');
}

// --- Naam-matcher (spec §5.1): exact na normalisatie, uniek anders geen voorstel ---
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

// --- F6 (vloot-fixpakket, issue #19): matcher-hardening — onzichtbare formatting-tekens, lege
// genormaliseerde target, locale-onafhankelijk (toLowerCase i.p.v. toLocaleLowerCase) ---
{
  // Onzichtbare tekens (ZWSP/ZWNJ/ZWJ/BOM/soft-hyphen) strippen: "Kraan​1" matcht "Kraan1".
  const ZWSP = '​'; const ZWNJ = '‌'; const ZWJ = '‍'; const BOM = '﻿'; const SHY = '­';
  assert(normalizeName(`Kraan${ZWSP}1`) === normalizeName('Kraan1'), 'F6: ZWSP wordt gestript vóór matching');
  assert(normalizeName(`Kraan${ZWNJ}1`) === normalizeName('Kraan1'), 'F6: ZWNJ wordt gestript vóór matching');
  assert(normalizeName(`Kraan${ZWJ}1`) === normalizeName('Kraan1'), 'F6: ZWJ wordt gestript vóór matching');
  // BOM MIDDEN in de string (niet aan het begin/eind — `.trim()` strippt een RAND-BOM toch al via de
  // ECMAScript WhiteSpace-productie, dus een rand-positie zou de fix niet echt bewijzen).
  assert(normalizeName(`Kraan${BOM}1`) === normalizeName('Kraan1'), 'F6: BOM (midden in de string) wordt gestript vóór matching');
  assert(normalizeName(`Kraan${SHY}1`) === normalizeName('Kraan1'), 'F6: soft-hyphen wordt gestript vóór matching');
  const cranes = [{ id: 'k1', name: 'Kraan1' }];
  assert(matchByName(`Kraan${ZWSP}1`, cranes)?.id === 'k1', 'F6: matchByName matcht een naam met onzichtbaar ZWSP-teken tegen de zichtbaar identieke pool-naam');
  // Negatieve controle: een ander zichtbaar teken (geen invisible) blijft WEL een echt verschil.
  assert(matchByName('Kraan 2', cranes) === null, 'F6: negatieve controle — een écht ander zichtbaar teken matcht niet');

  // Lege/pure-witruimte namen matchen NOOIT (ook niet onderling met een andere lege naam).
  assert(matchByName('', [{ id: 'e1', name: '' }, { id: 'e2', name: '   ' }]) === null, 'F6: lege target ⇒ null, ook al is er een unieke "lege" kandidaat');
  assert(matchByName('   ', [{ id: 'e1', name: 'Iets' }]) === null, 'F6: pure-witruimte target ⇒ null');

  // NFC/NFD-paar (samengesteld vs. ontleed diakritisch teken) blijft matchen (bestaand NFC-gedrag,
  // niet geraakt door de F6-wijziging — regressiebewijs).
  const nfc = 'café'; // é als één codepoint (U+00E9)
  const nfd = 'café'; // e + combining acute accent (U+0301)
  assert(normalizeName(nfc) === normalizeName(nfd), 'F6: NFC/NFD-paar blijft matchen (Unicode-normalisatie ongemoeid)');
  assert(matchByName(nfd, [{ id: 'c1', name: nfc }])?.id === 'c1', 'F6: matchByName matcht een NFD-naam tegen een NFC-pool-naam');

  // Locale-onafhankelijk: toLowerCase i.p.v. toLocaleLowerCase — de Turkse dotless-İ-nuance
  // ("İ".toLocaleLowerCase('tr') === "i" met puntloze variant-subtiliteiten) wordt NIET toegepast;
  // een simpele ASCII "I" → "i" blijft de machine-onafhankelijke uitkomst.
  assert(normalizeName('I') === 'i', 'F6: normalizeName gebruikt toLowerCase (machine-onafhankelijk), geen locale-specifieke casing');
}

// --- Afwijkingsclassificatie bij openen (spec §3) ---
{
  const p = pool();
  const src = p.calendars[0];
  const inSyncHash = computeCalendarHash(src);
  // in-sync: file == pool, hash == file.
  const inSync: WorkCalendar = { ...src, id: 'x', libraryOrigin: makeOrigin(p, src.id, inSyncHash) };
  assert(classifyCalendarOnOpen(inSync, p) === 'in-sync', 'classify: gelijk aan pool ⇒ in-sync');
  // behind: pool bewoog (file oud), maar file == syncedHash (niet extern bewerkt).
  const bumped = bumpPool({ ...p, calendars: [{ ...src, workEndHour: 17 }] });
  const behind: WorkCalendar = { ...src, id: 'x', libraryOrigin: makeOrigin(p, src.id, inSyncHash) };
  assert(classifyCalendarOnOpen(behind, bumped) === 'behind', 'classify: file==hash, pool wijkt af ⇒ behind');
  // deviated: file lokaal bewerkt (file != syncedHash) en pool wijkt af.
  const deviated: WorkCalendar = { ...src, id: 'x', workStartHour: 6, libraryOrigin: makeOrigin(p, src.id, inSyncHash) };
  assert(classifyCalendarOnOpen(deviated, bumped) === 'deviated', 'classify: file bewerkt na sync ⇒ deviated');
  // removed: poolitem weg.
  const removed: WorkCalendar = { ...src, id: 'x', libraryOrigin: { companyId: p.companyId, libraryItemId: 'ghost', poolVersion: 1 } };
  assert(classifyCalendarOnOpen(removed, p) === 'removed', 'classify: poolitem weg ⇒ removed');
  // hash-loos (B1-bestand) met afwijkende pool ⇒ veilige kant (deviated).
  const legacy: WorkCalendar = { ...src, id: 'x', libraryOrigin: { companyId: p.companyId, libraryItemId: src.id, poolVersion: 1 } };
  assert(classifyCalendarOnOpen(legacy, bumped) === 'deviated', 'classify: hash-loos + afwijkend ⇒ deviated (veilig)');
}

// --- Afwijkingsclassificatie bij openen — resource-wrapper-spiegel (spec §3, GO-NA-FIX 3) ---
// Zelfde vier uitkomsten als hierboven, nu via classifyResourceOnOpen (computeResourceHash +
// diffResourceVsPool), zodat de resource-bedrading net zo goed geraakt wordt als de kalender-bedrading.
{
  const p = pool();
  const srcRes = p.resources[1]; // 'Kraan' — geen calendarId, houdt de fixture eenvoudig
  const inSyncHash = computeResourceHash(srcRes);
  const inSync: Resource = { ...srcRes, id: 'x', libraryOrigin: makeOrigin(p, srcRes.id, inSyncHash) };
  assert(classifyResourceOnOpen(inSync, p) === 'in-sync', 'classify(resource): gelijk aan pool ⇒ in-sync');
  // F1 (critreview op 352bb94, issue #19): maxUnits is uit RESOURCE_DIFF_FIELDS — de "pool bewoog"/
  // "lokaal bewerkt"-simulaties hieronder gebruiken daarom costPerHour (nog wél gevolgd) i.p.v. maxUnits.
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

// --- Afwijkingsclassificatie: net-gepromoveerd item ⇒ in-sync (NB critreview taak 1, herbouwd na
// GO-NA-FIX 1: de eerdere versie was vacuüm — het promoted-item was veld-identiek aan het poolitem,
// dus diffStatus === 'up-to-date' kortsloot naar 'in-sync' vóórdat syncedHash gelezen werd; de assert
// slaagde met ELKE stempel, ook garbage. Deze versie bewijst de hash-keuze écht: na promote wijzigt
// de pool (zoals een latere pool-edit dat doet) — met de POOL-hash als back-stamp is dat een stille
// verversing ('behind'); met een foute of ontbrekende stempel wordt hetzelfde scenario 'deviated'. ---
{
  const p = pool();
  const srcRes = p.resources[0];
  // Simuleer de promote-back-stamp: de pool bevat nu het item, en het project-object is herstempeld
  // met de HASH VAN HET POOL-ITEM (zoals promoteResourceToPool doet), niet van het project-object zelf.
  const afterPromote = bumpPool({ ...p, resources: [srcRes, res('new-r', 'Nieuwe kraan')] });
  const poolItemAtPromote = afterPromote.resources.find((r) => r.id === 'new-r')!;
  const backStampHash = computeResourceHash(poolItemAtPromote);
  // Vervolgens beweegt de pool (een latere pool-edit — bv. een bijgewerkt tarief/uur; F1: maxUnits is
  // uit RESOURCE_DIFF_FIELDS, dus costPerHour i.p.v. maxUnits om ditzelfde scenario te simuleren),
  // zonder dat het project-object zelf wijzigt.
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
  // Contrast: zelfde scenario, maar met een FOUTE stempel (garbage) ⇒ deviated, niet behind — bewijst
  // dat de vorige assert écht op de hash-waarde steunt en niet toevallig altijd 'behind' oplevert.
  const promotedWithGarbageStamp: Resource = {
    ...poolItemAtPromote,
    id: 'local-new-r',
    libraryOrigin: { ...makeOrigin(afterPromote, 'new-r'), syncedHash: 'garbage-niet-de-pool-hash' },
  };
  assert(
    classifyResourceOnOpen(promotedWithGarbageStamp, afterPoolEdit) === 'deviated',
    'classify: zelfde scenario met foute stempel ⇒ deviated (contrast — bewijst dat de hash-waarde het verschil maakt)',
  );
  // Contrast: zelfde scenario met een ONTBREKENDE stempel (geen syncedHash) ⇒ ook deviated (veilige kant).
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

// --- 'unbound': item zonder libraryOrigin mag niet samenvallen met 'removed' (GO-NA-FIX 2) ---
// Een puur project-eigen resource (nooit uit een pool gekopieerd) heeft geen libraryOrigin. Die mag
// classifyResourceOnOpen niet als 'removed' labelen (dat zou een leugen zijn: "niet meer in het
// bedrijf" impliceert dat het item er ooit wél was) — vandaar de aparte 'unbound'-uitkomst.
{
  const p = pool();
  const own: Resource = res('own-r', 'Projecteigen resource'); // geen libraryOrigin
  assert(classifyResourceOnOpen(own, p) === 'unbound', 'classify(resource): geen libraryOrigin ⇒ unbound, niet removed');
  assert(classifyResourceOnOpen(own, p) !== 'removed', 'classify(resource): unbound valt niet samen met removed');
  const ownCal: WorkCalendar = cal('own-c', 'Projecteigen kalender'); // geen libraryOrigin
  assert(classifyCalendarOnOpen(ownCal, p) === 'unbound', 'classify(calendar): geen libraryOrigin ⇒ unbound, niet removed');
}

// --- resolveUniqueCompanyName (issue #19, critreview F4/F6): naamsbotsing-dedup voor
// importPoolAsNewCompany + de dialoog-preview. ---
{
  // Geen botsing: naam blijft ongewijzigd.
  assert(resolveUniqueCompanyName('Nieuw BV', ['Ander BV']) === 'Nieuw BV', 'resolveUniqueCompanyName: geen botsing ⇒ ongewijzigd');
  assert(resolveUniqueCompanyName('Enige BV', []) === 'Enige BV', 'resolveUniqueCompanyName: lege bestaande-lijst ⇒ ongewijzigd');

  // Eén botsing ⇒ " (2)".
  assert(resolveUniqueCompanyName('Nieuw BV', ['Nieuw BV']) === 'Nieuw BV (2)', 'resolveUniqueCompanyName: één botsing ⇒ " (2)"');

  // Meervoudige botsing: zowel de kale naam als " (2)" al bezet ⇒ telt door naar " (3)".
  assert(resolveUniqueCompanyName('X', ['X', 'X (2)']) === 'X (3)', 'resolveUniqueCompanyName: kale naam + " (2)" bezet ⇒ " (3)"');
  assert(resolveUniqueCompanyName('X', ['X', 'X (2)', 'X (3)', 'X (4)']) === 'X (5)', 'resolveUniqueCompanyName: vier bezette varianten ⇒ telt door tot de eerste vrije');

  // Case/witruimte-ongevoelige botsing (spiegelt matchByName/normalizeName) — de OUTPUT behoudt de
  // eigen (getrimde) schrijfwijze uit het bestand, niet die van het botsende bestaande item.
  assert(resolveUniqueCompanyName('  nieuw bv  ', ['Nieuw BV']) === 'nieuw bv (2)', 'resolveUniqueCompanyName: case/witruimte-ongevoelige botsing ⇒ eigen schrijfwijze + " (2)"');

  // Lege/pure-witruimte naam ⇒ standaardlabel.
  assert(resolveUniqueCompanyName('', []) === 'Nieuwe resourcebibliotheek', 'resolveUniqueCompanyName: lege naam ⇒ standaardlabel');
  assert(resolveUniqueCompanyName('   ', []) === 'Nieuwe resourcebibliotheek', 'resolveUniqueCompanyName: pure ASCII-witruimte ⇒ standaardlabel');

  // Critreview F4: een naam die UITSLUITEND uit onzichtbare tekens bestaat (zero-width spaces) is
  // met `.trim()` alleen NIET leeg (ASCII-trim raakt U+200B niet) — de fix gebruikt `normalizeName`
  // voor de leeg-check, die onzichtbare formatting-tekens WEL strript. Zonder de fix zou dit een
  // bibliotheek met een ogenschijnlijk lege naam opleveren i.p.v. het standaardlabel.
  const zeroWidthOnly = '​​​';
  assert(resolveUniqueCompanyName(zeroWidthOnly, []) === 'Nieuwe resourcebibliotheek', 'resolveUniqueCompanyName [F4]: uitsluitend onzichtbare tekens ⇒ standaardlabel, niet een lege naam');
  // Het standaardlabel zelf kan ook botsen (bv. een tweede onzichtbare-naam-import) ⇒ ook dan " (2)".
  assert(resolveUniqueCompanyName(zeroWidthOnly, ['Nieuwe resourcebibliotheek']) === 'Nieuwe resourcebibliotheek (2)', 'resolveUniqueCompanyName [F4]: standaardlabel zelf kan ook botsen ⇒ " (2)"');
}

// --- isReservedCompanyId / isSafeFileCompanyId (issue #19, critreview F1/F2) ---
{
  // F1: DEFAULT_COMPANY_ID/DEMO_COMPANY_ID zijn reserved (géén identiteitsbewijs); een willekeurig
  // gegenereerd of eigen id is dat niet.
  assert(isReservedCompanyId(DEFAULT_COMPANY_ID) === true, 'isReservedCompanyId: DEFAULT_COMPANY_ID is reserved');
  assert(isReservedCompanyId(DEMO_COMPANY_ID) === true, 'isReservedCompanyId: DEMO_COMPANY_ID is reserved');
  assert(isReservedCompanyId('company-abc123') === false, 'isReservedCompanyId: een gewoon gegenereerd id is NIET reserved');
  assert(isReservedCompanyId('') === false, 'isReservedCompanyId: lege string is niet reserved (geen valse positieve)');

  // F2: veilige vs onveilige bestand-ids.
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

// --- resolvePoolImportPreselection (issue #19, critreview F1 [BLOKKEREND]): dit is de PURE kern van
// de dialoog-voorselectie — direct testbaar zonder een gemount dialoog. De reviewer toonde de bug
// aan met een echte writePoolIFC→readPoolIFC→pick()-proef: een bestand met DEFAULT_COMPANY_ID (of
// DEMO_COMPANY_ID) matcht bijna elke lokale installatie, en zonder de reserved-uitsluiting zou de
// dialoog dan "vervangen" op de EIGEN bibliotheek van de ontvanger voorstellen. ---
{
  const localCompanies = [{ id: DEFAULT_COMPANY_ID }, { id: 'company-eigen-2' }];

  // Gewone (niet-reserved) match: aantoonbaar dezelfde bibliotheek ⇒ "vervangen" met die bibliotheek.
  assert(
    JSON.stringify(resolvePoolImportPreselection('company-eigen-2', localCompanies)) === JSON.stringify({ action: 'replace', companyId: 'company-eigen-2' }),
    'resolvePoolImportPreselection: gewoon (niet-reserved) matchend id ⇒ "vervangen" met die bibliotheek',
  );
  // Geen match ⇒ "toevoegen".
  assert(
    JSON.stringify(resolvePoolImportPreselection('company-onbekend-elders', localCompanies)) === JSON.stringify({ action: 'add' }),
    'resolvePoolImportPreselection: geen lokale match ⇒ "toevoegen"',
  );

  // [DE BLOKKERENDE BEVINDING] DEFAULT_COMPANY_ID bestaat hier lokaal (typisch voor bijna elke
  // installatie) — ZONDER de F1-fix zou dit "vervangen" op de eigen bibliotheek voorstellen.
  assert(
    resolvePoolImportPreselection(DEFAULT_COMPANY_ID, localCompanies).action === 'add',
    'resolvePoolImportPreselection [F1, DE FIX]: DEFAULT_COMPANY_ID selecteert ALTIJD "toevoegen" voor, ook al bestaat het lokaal',
  );
  assert(
    resolvePoolImportPreselection(DEMO_COMPANY_ID, [{ id: DEMO_COMPANY_ID }]).action === 'add',
    'resolvePoolImportPreselection [F1]: DEMO_COMPANY_ID selecteert ALTIJD "toevoegen" voor, ook al bestaat het lokaal',
  );

  // F2: een vijandig bestand-id telt nooit als match, ook al zou (in theorie) een lokaal bedrijf
  // toevallig hetzelfde (onveilige) id dragen.
  assert(
    resolvePoolImportPreselection('__proto__', [{ id: '__proto__' }]).action === 'add',
    'resolvePoolImportPreselection [F2]: een onveilig bestand-id ("__proto__") matcht nooit, ook niet bij toevallige lokale gelijkenis',
  );

  // Reproductie van de reviewer zijn eigen proef: writePoolIFC → readPoolIFC → preselectie, met een
  // pool die (zoals bijna elke installatie) DEFAULT_COMPANY_ID draagt.
  const poolWithDefaultId: CompanyPool = {
    companyId: DEFAULT_COMPANY_ID, companyName: 'Mijn resourcebibliotheek',
    poolVersion: 2, modifiedAt: '2026-07-01T00:00:00.000Z', calendars: [], resources: [],
  };
  const roundtrippedPreselection = resolvePoolImportPreselection(poolWithDefaultId.companyId, localCompanies);
  assert(roundtrippedPreselection.action === 'add', 'resolvePoolImportPreselection [F1, reviewer-reproductie]: een export van andermans DEFAULT_COMPANY_ID-bibliotheek selecteert bij de ontvanger "toevoegen", NOOIT "vervangen" op zijn eigen bibliotheek');
}

// --- classifyPoolImportIdentityHint (issue #19, critreview-herkeuring): onderscheidt de TWEE
// redenen waarom "toevoegen" een vers id mint, elk met hun eigen feitelijk kloppende hint. De vorige,
// ene `idCollision`-conditie overkoepelde beide gevallen en beweerde bij het tweede geval ("reserved
// id") iets dat niet klopt: "deze bibliotheek is al lokaal bekend" — terwijl een reserved id (bv. het
// demo-id vóórdat de demo-bibliotheek ooit geseed is) juist NIET lokaal bekend hoeft te zijn. ---
{
  const localCompanies = [{ id: DEFAULT_COMPANY_ID }, { id: 'company-eigen-2' }];

  // 'collision': een gewoon (niet-reserved, veilig) id dat lokaal AL bestaat.
  assert(
    classifyPoolImportIdentityHint('company-eigen-2', localCompanies) === 'collision',
    'classifyPoolImportIdentityHint: gewoon matchend id ⇒ "collision" (aantoonbaar al lokaal bekend)',
  );

  // 'none': een gewoon, nog onbekend id ⇒ geen hint nodig.
  assert(
    classifyPoolImportIdentityHint('company-onbekend-elders', localCompanies) === 'none',
    'classifyPoolImportIdentityHint: geen match, niet reserved/onveilig ⇒ "none"',
  );

  // [DE HERKEURING] DEFAULT_COMPANY_ID bestaat hier lokaal, MAAR is reserved ⇒ 'fresh-identity', NIET
  // 'collision' — de reserved-check wint altijd van de toevallige lokale botsing (spiegelt de
  // voorrangsorde in resolvePoolImportPreselection/importPoolAsNewCompany).
  assert(
    classifyPoolImportIdentityHint(DEFAULT_COMPANY_ID, localCompanies) === 'fresh-identity',
    'classifyPoolImportIdentityHint [DE FIX]: DEFAULT_COMPANY_ID ⇒ "fresh-identity", nooit "collision" — ook al bestaat het lokaal',
  );

  // [HET SCENARIO DAT DE OUDE TEKST ONWAAR MAAKTE] DEMO_COMPANY_ID bestaat hier lokaal NOG NIET (de
  // demo-bibliotheek is nooit geseed) — "collision" zou hier een ronduit foute bewering zijn ("al
  // lokaal bekend" terwijl dat niet zo is). "fresh-identity" is de enige feitelijk juiste hint.
  assert(
    !localCompanies.some((c) => c.id === DEMO_COMPANY_ID),
    'setup: de demo-bibliotheek bestaat in dit scenario lokaal nog niet',
  );
  assert(
    classifyPoolImportIdentityHint(DEMO_COMPANY_ID, localCompanies) === 'fresh-identity',
    'classifyPoolImportIdentityHint [DE FIX]: DEMO_COMPANY_ID zonder lokale demo-bibliotheek ⇒ "fresh-identity", NIET "collision" (die bewering zou onwaar zijn)',
  );

  // Onveilig id ⇒ 'fresh-identity', ook al zou een lokaal bedrijf toevallig hetzelfde (onveilige) id
  // dragen (theoretisch — onveilige ids kunnen normaal niet lokaal bestaan, maar de voorrangsorde
  // moet dit hoe dan ook nooit als 'collision' classificeren).
  assert(
    classifyPoolImportIdentityHint('__proto__', [{ id: '__proto__' }]) === 'fresh-identity',
    'classifyPoolImportIdentityHint: onveilig id ("__proto__") ⇒ "fresh-identity", nooit "collision"',
  );
}

console.log(`library-ops: ${checks - fails}/${checks} groen`);
process.exit(fails > 0 ? 1 : 0);
