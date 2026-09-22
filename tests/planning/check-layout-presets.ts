// Layouts als weergavepresets (issue #144): een layout zet alleen de delen die hij draagt, en de
// losse opgeslagen filters van issue #85 gaan eenmalig op in de layouts. Deze check dekt de pure kern
// (`layoutPresets.ts`) én de opslagkant (validator + migratie in `settingsStore.ts`).
// Draait via run.sh. Exit 0 = alles groen.

import {
  applyLayoutParts, isBuiltinLayoutId, isFilterOnlyLayout, layoutMatchesView, layoutParts,
  liveSessionLayouts, migrateSavedFilters, pickLayoutParts, switchLayoutOff, switchLayoutOn,
  type LayoutViewParts,
} from '@/engine/view/layoutPresets';
import { loadLayouts, saveLayouts } from '@/utils/settingsStore';
import { generateId } from '@/utils/id';
import type { FilterNode, Layout, SavedFilter } from '@/types/view';

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

storage.set('ops-taskGridLayouts', JSON.stringify({ version: 1, layouts: [
  resourceDiagram,
  { id: 'kapot', name: 'Kapot', group: 'geen array' },
  { id: 'kapot2', name: 'Kapot 2', columns: [{ onzin: true }] },
] }));
const guarded = await loadLayouts();
ok(guarded.length === 1 && guarded[0]?.id === 'builtin:resource-diagram', 'een aanwezig maar misvormd deel laat de hele layout vervallen');

if (failures > 0) process.exit(1);
console.log('layout-presets: alles groen');
