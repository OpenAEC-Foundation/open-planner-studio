// Layouts als weergavepresets (issue #144): een layout zet alleen de delen die hij draagt, en de
// losse opgeslagen filters van issue #85 gaan eenmalig op in de layouts. Deze check dekt de pure kern
// (`layoutPresets.ts`) én de opslagkant (validator + migratie in `settingsStore.ts`).
// Draait via run.sh. Exit 0 = alles groen.

import {
  applyLayoutParts, isBuiltinLayoutId, isFilterOnlyLayout, layoutMatchesView, layoutParts,
  dropBrokenLayouts, liveSessionLayouts, migrateSavedFilters, pickLayoutParts, switchLayoutOff, switchLayoutOn,
  type LayoutViewParts,
} from '@/engine/view/layoutPresets';
import { LayoutsNotSavedError, loadLayouts, saveLayouts, SettingsUnreadableError, updateLayouts } from '@/utils/settingsStore';
import { generateId } from '@/utils/id';
import type { FilterNode, Layout, LayoutOverlays, SavedFilter } from '@/types/view';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
    key: () => null,
    get length() { return storage.size; },
  } satisfies Storage,
  configurable: true,
});

let failures = 0;
function ok(condition: unknown, message: string): void {
  if (condition) console.log(`ok ${message}`);
  else { console.error(`XX ${message}`); failures++; }
}

const criticalFilter: FilterNode = {
  kind: 'group', op: 'AND', children: [
    { kind: 'rule', field: { src: 'builtin', key: 'isCritical' }, operator: 'eq', value: true },
  ],
};
const current: LayoutViewParts = {
  columns: [],
  filter: criticalFilter,
  group: [],
  sort: [{ field: { src: 'builtin', key: 'start' }, dir: 'asc' }],
  timeScale: 'week',
  showRelations: true,
  overlays: {
    baseline: false, progressLine: false, statusDateLine: true, resourceAccent: true, floatBand: true,
    barColors: { mode: 'critical' },
  },
};
const resourceDiagram: Layout = {
  id: 'builtin:resource-diagram', name: 'Resourcediagram',
  group: [{ field: { src: 'resource' }, dir: 'asc' }], sort: [], showRelations: false,
};

// --- Gedeeltelijk toepassen ---
const applied = applyLayoutParts(current, resourceDiagram);
ok(JSON.stringify(applied.group) === JSON.stringify(resourceDiagram.group), 'gedragen deel (groepering) wordt gezet');
ok(applied.sort.length === 0, 'gedragen LEEG deel (sortering) wist de sortering');
ok(applied.filter === current.filter, 'ongedragen filter blijft dezelfde referentie');
ok(applied.columns === current.columns, 'ongedragen kolommen blijven dezelfde referentie');
ok(applied.timeScale === 'week', 'ongedragen tijdschaal blijft staan');

const clearFilter: Layout = { id: 'l1', name: 'Geen filter', filter: null };
ok(applyLayoutParts(current, clearFilter).filter === null, 'filter: null wist het filter');
ok(applyLayoutParts(current, { id: 'l2', name: 'Leeg' }).filter === criticalFilter, 'ontbrekend filter wist NIET');

// --- Delen en match ---
ok(layoutParts(resourceDiagram).join(',') === 'group,sort,showRelations', 'layoutParts in vaste UI-volgorde');
ok(applied.showRelations === false, 'relatielijnen zijn een layoutdeel');
ok(layoutParts(clearFilter).join(',') === 'filter', 'filter: null telt als gedragen deel');
ok(isFilterOnlyLayout(clearFilter) && !isFilterOnlyLayout(resourceDiagram), 'filter-only wordt herkend');
ok(!layoutMatchesView(resourceDiagram, current), 'geen match zolang de groepering afwijkt');
ok(layoutMatchesView(resourceDiagram, applied), 'match direct na toepassen');
ok(layoutMatchesView(resourceDiagram, { ...applied, timeScale: 'day', filter: null }), 'ongedragen delen tellen niet mee voor de match');
ok(!layoutMatchesView({ id: 'l3', name: 'Leeg' }, current), 'een layout zonder delen matcht nooit');

const full: Layout = { id: 'l4', name: 'Vol', columns: [], filter: null, group: [], sort: [], timeScale: 'month', showRelations: true };
const picked = pickLayoutParts(full, ['filter', 'timeScale']);
ok(layoutParts(picked).join(',') === 'filter,timeScale' && picked.id === 'l4' && picked.name === 'Vol', 'pickLayoutParts houdt alleen de gevraagde delen');

ok(isBuiltinLayoutId('builtin:gantt-wbs') && !isBuiltinLayoutId(generateId('layout')), 'meegeleverde ids botsen nooit met gegenereerde ids');

// --- Schakelaar: aan, samen aan, vervangen, uit ---
/** Het scherm ná een schakelactie: de te schrijven delen over het huidige beeld gelegd. */
const screenAfter = (screen: LayoutViewParts, write: Layout): LayoutViewParts => applyLayoutParts(screen, write);

const onA = switchLayoutOn(undefined, current, resourceDiagram);
const screenA = screenAfter(current, onA.write);
ok(onA.session!.restore !== current && JSON.stringify(onA.session!.restore) === JSON.stringify(current), 'het herstelpunt is een KOPIE van het beeld vóór de klik');
ok(liveSessionLayouts(onA.session, screenA).map(l => l.id).join() === resourceDiagram.id, 'de knop staat aan zolang de layout op het scherm staat');
ok(liveSessionLayouts(onA.session, { ...screenA, group: [] }).length === 0, 'een handmatig gewijzigd gedragen deel zet de knop uit');

// Tijdens het resourcediagram zoomt de gebruiker zelf: dat deel is niet door een layout gezet.
const zoomed: LayoutViewParts = { ...screenA, timeScale: 'day' };
const offA = switchLayoutOff(onA.session!, zoomed, resourceDiagram.id);
const screenOffA = screenAfter(zoomed, offA.write);
ok(offA.session === undefined, 'de laatste knop uit = geen sessie meer');
ok(JSON.stringify(screenOffA.group) === '[]' && screenOffA.sort.length === 1 && screenOffA.showRelations === true, 'uitzetten herstelt de delen van de layout');
ok(screenOffA.timeScale === 'day', 'uitzetten laat een handmatige wijziging aan een ongedragen deel staan');

// Een filterknop draagt een ANDER deel: hij gaat erbij aan, het resourcediagram blijft aan.
const noFilter: Layout = { id: 'f-geen', name: 'Geen filter', filter: null };
const onF = switchLayoutOn(onA.session, screenA, noFilter);
const screenAF = screenAfter(screenA, onF.write);
ok(liveSessionLayouts(onF.session, screenAF).map(l => l.id).join() === `${resourceDiagram.id},f-geen`, 'knoppen met verschillende delen staan samen aan');
ok(onF.session!.restore === onA.session!.restore, 'het herstelpunt blijft dat van vóór de eerste knop');
const offF = switchLayoutOff(onF.session!, screenAF, 'f-geen');
const screenAagain = screenAfter(screenAF, offF.write);
ok(screenAagain.filter === onA.session!.restore.filter && JSON.stringify(screenAagain.group) === JSON.stringify(resourceDiagram.group), 'de filterknop uit herstelt alleen het filter; het resourcediagram blijft staan');
ok(liveSessionLayouts(offF.session, screenAagain).map(l => l.id).join() === resourceDiagram.id, 'de andere knop blijft aan');

// Een knop die een deel DEELT vervangt de andere; diens overige delen gaan terug naar het herstelpunt.
const byName: Layout = { id: 'l-naam', name: 'Op naam', sort: [{ field: { src: 'builtin', key: 'name' }, dir: 'asc' }] };
const onN = switchLayoutOn(onF.session, screenAF, byName);
const screenN = screenAfter(screenAF, onN.write);
ok(liveSessionLayouts(onN.session, screenN).map(l => l.id).join() === 'f-geen,l-naam', 'de overlappende knop gaat uit, de niet-overlappende blijft aan');
ok(JSON.stringify(screenN.group) === '[]' && screenN.showRelations === true, 'de overige delen van de vervangen knop keren terug naar het herstelpunt');
ok(screenN.sort[0]?.field.src === 'builtin' && screenN.filter === null, 'het gedeelde deel komt van de nieuwe knop, de filterknop blijft gelden');

// --- Overlay als layoutdeel (issue #173) ---
const presentation: Layout = {
  id: 'l-presentatie', name: 'Presentatie',
  overlays: { ...current.overlays, baseline: true, floatBand: false },
};
const withOverlays = applyLayoutParts(current, presentation);
ok(withOverlays.overlays.baseline && !withOverlays.overlays.floatBand, 'het overlaydeel zet de overlays');
ok(layoutParts(presentation).join(',') === 'overlays', 'overlays is een eigen deel, achteraan in de UI-volgorde');
// Zelfde waarden, andere sleutelvolgorde (bv. uit de opslag): de knop mag daar niet op uitvallen.
const reordered = Object.fromEntries(Object.entries(presentation.overlays!).reverse()) as unknown as LayoutOverlays;
ok(layoutMatchesView({ ...presentation, overlays: reordered }, withOverlays), 'de overlay-match hangt niet aan de sleutelvolgorde');
ok(!layoutMatchesView(presentation, { ...withOverlays, overlays: { ...withOverlays.overlays, progressLine: true } }), 'één overlay met de hand omgezet ⇒ geen match');

// --- Handmatige wijziging zet de knop uit én ruimt zijn overige delen op (issue #173) ---
// Manu's scenario: resourcediagram aan, dan met de hand de relatielijnen omzetten.
const relationsFlipped: LayoutViewParts = { ...screenA, showRelations: true };
const dropA = dropBrokenLayouts(onA.session, relationsFlipped);
ok(dropA !== null && dropA.session === undefined, 'de afgevallen knop verdwijnt uit de sessie');
const screenDropA = screenAfter(relationsFlipped, dropA!.write);
ok(JSON.stringify(screenDropA.group) === '[]' && screenDropA.sort.length === 1, 'groepering en sortering keren terug naar het herstelpunt');
ok(screenDropA.showRelations === true && dropA!.write.showRelations === undefined, 'het met de hand gewijzigde deel houdt de nieuwe waarde');
ok(dropBrokenLayouts(onA.session, { ...screenA, timeScale: 'day' }) === null, 'een wijziging aan een ongedragen deel laat de knop staan');
ok(dropBrokenLayouts(undefined, relationsFlipped) === null, 'zonder sessie valt er niets op te ruimen');
// Twee knoppen aan; alleen die waarvan een deel wijzigt valt af, de andere blijft staan.
const groupChanged: LayoutViewParts = { ...screenAF, group: [{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }] };
const dropAF = dropBrokenLayouts(onF.session, groupChanged);
ok(dropAF?.session?.layouts.map(l => l.id).join() === 'f-geen', 'de niet-geraakte knop blijft aan');
const screenDropAF = screenAfter(groupChanged, dropAF!.write);
ok(screenDropAF.group[0]?.field.src === 'builtin' && screenDropAF.showRelations === true && screenDropAF.sort.length === 1,
  'de nieuwe groepering blijft; sortering en relatielijnen van het resourcediagram keren terug');
ok(dropAF!.write.filter === undefined && screenDropAF.filter === null, 'het deel van de knop die aan blijft wordt niet aangeraakt');

// Een sessie die ELDERS verouderde (overlays zijn app-breed: omgezet in een ander document) wordt
// net zo opgeruimd — anders werd dat halve beeld bij de volgende klik het nieuwe herstelpunt.
const withOverlaysOn = switchLayoutOn(undefined, current, { ...presentation, group: resourceDiagram.group });
const screenOverlaysOn = screenAfter(current, withOverlaysOn.write);
const elsewhere: LayoutViewParts = { ...screenOverlaysOn, overlays: { ...screenOverlaysOn.overlays, baseline: false } };
const staleDrop = dropBrokenLayouts(withOverlaysOn.session, elsewhere);
ok(staleDrop?.session === undefined && JSON.stringify(screenAfter(elsewhere, staleDrop!.write).group) === '[]',
  'een elders verouderde layout: zijn groepering gaat terug, zijn sessie verdwijnt');
const retoggle = switchLayoutOn(staleDrop!.session, screenAfter(elsewhere, staleDrop!.write), withOverlaysOn.session!.layouts[0]!);
ok(JSON.stringify(retoggle.session!.restore.group) === '[]', 'na opruimen is het herstelpunt weer het beeld van vóór de layout');

// --- Migratie (puur) ---
const saved: SavedFilter[] = [
  { id: 'critical-only', name: 'Alleen kritiek', filter: criticalFilter },
  { id: 'l4', name: 'Botst op id', filter: criticalFilter },
];
const merged = migrateSavedFilters([full], saved);
ok(merged.length === 2, 'migratie voegt alleen onbekende ids toe');
ok(merged[0] === full, 'bestaande layouts blijven ongemoeid en vooraan');
ok(isFilterOnlyLayout(merged[1]!) && merged[1]!.name === 'Alleen kritiek', 'een opgeslagen filter wordt een layout met alleen het filter');
ok(merged[1]!.filter !== criticalFilter, 'de filterboom is gekloond, niet gedeeld');
ok(migrateSavedFilters(merged, saved).length === 2, 'migratie is idempotent');

// --- Opslag: validator + eenmalige migratie ---
const savedFiltersRaw = JSON.stringify([saved[0]]);
storage.set('ops-savedFilters', savedFiltersRaw);
const firstLoad = await loadLayouts();
ok(firstLoad.length === 1 && firstLoad[0]?.id === 'critical-only', 'eerste load neemt het opgeslagen filter op als layout');
ok(storage.get('ops-savedFilters') === savedFiltersRaw, 'de oude sleutel blijft byte-identiek staan (downgrade-vangnet)');

await saveLayouts([]);
ok((await loadLayouts()).length === 0, 'een verwijderde filter-layout komt bij de volgende load NIET terug');

await saveLayouts([{ ...resourceDiagram, icon: 'users' }, full, clearFilter]);
const roundTrip = await loadLayouts();
ok(roundTrip.length === 3, 'gedeeltelijke en volledige layouts overleven een round-trip');
ok(layoutParts(roundTrip[0]!).join(',') === 'group,sort,showRelations', 'een gedeeltelijke layout krijgt er bij het laden geen delen bij');
ok(roundTrip[0]?.icon === 'users' && roundTrip[0]?.showRelations === false, 'icoon en relatielijnen overleven de opslag');
ok(roundTrip[2]?.filter === null && layoutParts(roundTrip[2]!).join(',') === 'filter', 'filter: null overleeft de opslag als gedragen deel');

await saveLayouts([presentation]);
const overlayTrip = await loadLayouts();
ok(JSON.stringify(overlayTrip[0]?.overlays) === JSON.stringify(presentation.overlays), 'het overlaydeel overleeft de opslag');

const customLayout: Layout = { id: 'eigen-kleuren', name: 'Eigen kleuren', overlays: {
  ...current.overlays!, barColors: { mode: 'critical', colors: { critical: '#112233', nearCritical: '#445566', normal: '#778899' } },
} };
await saveLayouts([customLayout]);
const customTrip = await loadLayouts();
ok(JSON.stringify(customTrip[0]?.overlays) === JSON.stringify(customLayout.overlays), 'eigen balkkleuren overleven layoutopslag');
ok(JSON.stringify(applyLayoutParts(current, customTrip[0]!).overlays) === JSON.stringify(customLayout.overlays), 'layout toepassen herstelt eigen balkkleuren');

storage.set('ops-taskGridLayouts', JSON.stringify({ version: 1, layouts: [
  resourceDiagram,
  { id: 'kapot', name: 'Kapot', group: 'geen array' },
  { id: 'kapot2', name: 'Kapot 2', columns: [{ onzin: true }] },
  { id: 'kapot3', name: 'Kapot 3', overlays: { baseline: 'ja' } },
] }));
const guarded = await loadLayouts();
ok(guarded.length === 1 && guarded[0]?.id === 'builtin:resource-diagram', 'een aanwezig maar misvormd deel laat de hele layout vervallen');

// Een leesfout is geen lege lijst (knownbug 1362): wie de lijst na een mislukte lezing als leeg zou opslaan,
// wist de eigen layouts. `loadLayouts` gooit dan `SettingsUnreadableError` en schrijft niets (geen migratie,
// geen vlag), voor elke bron die het leest.
const unreadableCase = async (blocked: string, setup: () => void, label: string) => {
  storage.clear();
  setup();
  const before = JSON.stringify([...storage]);
  const getItem = localStorage.getItem;
  localStorage.getItem = (key: string) => {
    if (key === blocked) throw new Error('SecurityError');
    return storage.get(key) ?? null;
  };
  let error: unknown = null;
  try { await loadLayouts(); } catch (e) { error = e; }
  localStorage.getItem = getItem;
  ok(error instanceof SettingsUnreadableError, `${label}: loadLayouts gooit SettingsUnreadableError`);
  ok(JSON.stringify([...storage]) === before, `${label}: de opslag is ongewijzigd`);
};
const storedLayouts = () => storage.set('ops-taskGridLayouts', JSON.stringify({ version: 1, layouts: [resourceDiagram] }));
await unreadableCase('ops-taskGridLayouts', storedLayouts, 'layouts niet te lezen');
await unreadableCase('ops-layouts', () => {}, 'oude layoutsleutel niet te lezen');
await unreadableCase('ops-savedFiltersMigrated', storedLayouts, 'migratievlag niet te lezen');
await unreadableCase('ops-savedFilters', () => { storedLayouts(); }, 'opgeslagen filters niet te lezen');
storage.clear();
storedLayouts();
ok((await loadLayouts()).length === 1, 'na herstel laadt de lijst weer');

// `updateLayouts` past de wijziging toe op de vers gelezen lijst, nooit op een kopie (review Terra en Sol #905): een
// layout die intussen elders is opgeslagen, blijft staan. Is de opslag niet te lezen, dan schrijft het niets.
const storedElsewhere: Layout = { id: 'elders', name: 'Elders opgeslagen', group: [] };
storage.set('ops-taskGridLayouts', JSON.stringify({ version: 1, layouts: [resourceDiagram, storedElsewhere] }));
const added: Layout = { id: 'nieuw', name: 'Nieuw', group: [] };
const updated = await updateLayouts(current => [...current, added]);
ok(updated.map(l => l.id).join(',') === 'builtin:resource-diagram,elders,nieuw', 'updateLayouts: de nieuwe layout komt achter de vers gelezen lijst');
ok((await loadLayouts()).map(l => l.id).join(',') === 'builtin:resource-diagram,elders,nieuw', 'updateLayouts: de layout van elders staat ook in de opslag');
const beforeBlocked = storage.get('ops-taskGridLayouts');
const getItemOk = localStorage.getItem;
localStorage.getItem = (key: string) => { if (key === 'ops-taskGridLayouts') throw new Error('SecurityError'); return storage.get(key) ?? null; };
let updateError: unknown = null;
try { await updateLayouts(() => []); } catch (e) { updateError = e; }
localStorage.getItem = getItemOk;
ok(updateError instanceof SettingsUnreadableError, 'updateLayouts: een leesfout gooit SettingsUnreadableError');
ok(storage.get('ops-taskGridLayouts') === beforeBlocked, 'updateLayouts: bij een leesfout is er niets geschreven');
// Twee wijzigingen die tegelijk starten, lezen niet dezelfde lijst: de tweede bouwt op de eerste (review Terra #905).
storage.set('ops-taskGridLayouts', JSON.stringify({ version: 1, layouts: [resourceDiagram] }));
const first: Layout = { id: 'eerste', name: 'Eerste', group: [] };
const second: Layout = { id: 'tweede', name: 'Tweede', group: [] };
await Promise.all([updateLayouts(current => [...current, first]), updateLayouts(current => [...current, second])]);
ok((await loadLayouts()).map(l => l.id).join(',') === 'builtin:resource-diagram,eerste,tweede', 'updateLayouts: twee gelijktijdige wijzigingen blijven allebei staan');
// Een schrijffout telt niet als opgeslagen (review Terra #905, ronde 3): `writeLocal` slikt haar in, dus leest
// `updateLayouts` terug en gooit `LayoutsNotSavedError`.
const setItemBefore = localStorage.setItem;
localStorage.setItem = (key: string, value: string) => {
  if (key === 'ops-taskGridLayouts') throw new Error('QuotaExceededError');
  storage.set(key, value);
};
let writeError: unknown = null;
try { await updateLayouts(current => [...current, { id: 'vol', name: 'Vol', group: [] }]); } catch (e) { writeError = e; }
localStorage.setItem = setItemBefore;
ok(writeError instanceof LayoutsNotSavedError, 'updateLayouts: een schrijffout gooit LayoutsNotSavedError');
ok(!(await loadLayouts()).some(l => l.id === 'vol'), 'updateLayouts: na een schrijffout staat de layout niet in de opslag');

// De migratie van opgeslagen filters zet haar vlag pas als de samengevoegde lijst echt in de opslag staat (review Sol
// #905): kan de opslag niet schrijven (vol), dan probeert de volgende lezing het opnieuw en blijft het filter bereikbaar.
storage.clear();
storedLayouts();
storage.set('ops-savedFilters', savedFiltersRaw);
const setItemOk = localStorage.setItem;
localStorage.setItem = (key: string, value: string) => {
  if (key === 'ops-taskGridLayouts') throw new Error('QuotaExceededError');
  storage.set(key, value);
};
const duringFull = await loadLayouts();
localStorage.setItem = setItemOk;
ok(duringFull.some(l => l.id === 'critical-only'), 'migratie bij volle opslag: het filter staat in de geladen lijst');
ok(!storage.has('ops-savedFiltersMigrated'), 'migratie bij volle opslag: geen vlag');
const afterFull = await loadLayouts();
ok(afterFull.some(l => l.id === 'critical-only') && storage.get('ops-savedFiltersMigrated') === 'true', 'migratie na herstel: het filter is overgezet en de vlag staat');
ok((await loadLayouts()).some(l => l.id === 'critical-only'), 'migratie na herstel: het filter blijft bij de volgende lezing');

if (failures > 0) process.exit(1);
console.log('layout-presets: alles groen');
