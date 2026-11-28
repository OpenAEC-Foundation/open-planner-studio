import { useAppStore } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { encodeBandKey } from '@/engine/view/visibleRows';

const S = () => useAppStore.getState();
let fails = 0;
const check = (ok: boolean, label: string, extra = '') => {
  if (ok) console.log(`ok  ${label}`);
  else { console.log(`XX  ${label}${extra ? ` — ${extra}` : ''}`); fails++; }
};
const eqSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

S().newProject();
const faseId = S().addActivityCodeType('Fase');
const ruwbouw = S().addActivityCodeValue(faseId, { code: 'Ruwbouw' });
const afbouw = S().addActivityCodeValue(faseId, { code: 'Afbouw' });
const zoneId = S().addActivityCodeType('Zone');
const noord = S().addActivityCodeValue(zoneId, { code: 'Noord' });
const zuid = S().addActivityCodeValue(zoneId, { code: 'Zuid' });

for (const [naam, fase, zone] of [
  ['Heien', ruwbouw, noord], ['Wapening', ruwbouw, zuid],
  ['Stucwerk', afbouw, noord], ['Schilderen', afbouw, zuid],
] as const) {
  const id = S().addTask({
    name: naam, isMilestone: false, parentId: null,
    time: createDefaultTaskTime('2026-06-01', 1),
  });
  S().setTaskActivityCode(id, faseId, fase);
  S().setTaskActivityCode(id, zoneId, zone);
}

S().setGroup([
  { field: { src: 'activityCode', typeId: faseId }, dir: 'asc' },
  { field: { src: 'activityCode', typeId: zoneId }, dir: 'asc' },
]);

const ALLE_BANDEN = [
  encodeBandKey([ruwbouw]), encodeBandKey([ruwbouw, noord]), encodeBandKey([ruwbouw, zuid]),
  encodeBandKey([afbouw]), encodeBandKey([afbouw, noord]), encodeBandKey([afbouw, zuid]),
];

const bandRijen = () => S().viewRows.filter(r => r.kind === 'group').map(r => (r as { key: string }).key);

check(eqSet(bandRijen(), ALLE_BANDEN), 'uitgangspunt: alle 6 banden staan open in viewRows',
  `kreeg ${bandRijen().length}`);

S().setCollapsedGroupKey(encodeBandKey([ruwbouw]), true);
const naief = bandRijen();
check(!naief.includes(encodeBandKey([ruwbouw, noord])) && !naief.includes(encodeBandKey([ruwbouw, zuid])),
  'viewRows-route is incompleet: subbanden van de ingeklapte band ontbreken',
  `viewRows-banden: ${naief.length}/6`);

S().collapseAllGroups();
check(eqSet(S().view.collapsedGroupKeys, ALLE_BANDEN),
  'collapseAllGroups pakt ALLE banden, ook de geneste onder een reeds ingeklapte band',
  `kreeg ${S().view.collapsedGroupKeys.length}: ${JSON.stringify(S().view.collapsedGroupKeys)}`);

S().expandAllGroups();
check(S().view.collapsedGroupKeys.length === 0, 'expandAllGroups leegt de collapse-set');
check(eqSet(bandRijen(), ALLE_BANDEN), 'na uitklappen zijn alle 6 banden weer zichtbaar',
  `kreeg ${bandRijen().length}`);

S().collapseAll();
check(eqSet(S().view.collapsedGroupKeys, ALLE_BANDEN),
  'collapseAll() routeert in gegroepeerde weergave naar de banden');
S().expandAll();
check(S().view.collapsedGroupKeys.length === 0, 'expandAll() routeert in gegroepeerde weergave naar de banden');

S().setGroup([]);
S().collapseAll();
check(S().view.collapsedGroupKeys.length === 0 && S().ui.collapsedTaskIds.length === 0,
  'boommodus: collapseAll() raakt de banden niet (en deze vlakke set heeft geen summary-taken)');
S().collapseAllGroups();
check(S().view.collapsedGroupKeys.length === 0, 'collapseAllGroups zonder groepering is een no-op');

console.log(fails === 0 ? 'BAND-COLLAPSE: alles groen' : `BAND-COLLAPSE: ${fails} fout(en)`);
process.exit(fails === 0 ? 0 : 1);
