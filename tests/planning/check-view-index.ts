// Resource-join-index op de ViewContext (K-item 36).
//
// WAAROM. `resourceNames` deed twee volledige scans PER TAAK — `assignments.filter(...)` plus een
// `resources.find(...)` per treffer — terwijl `visibleRows` hem voor élke taak aanroept. Dat is
// O(taken × toewijzingen × resources) op het pad dat na iedere mutatie opnieuw loopt
// (`recomputeViewRows`). Gemeten op 800 taken × 60 resources, 20× herberekenen: 532 ms vóór,
// 31 ms ná.
//
// De optimalisatie introduceert een CACHE, en daarmee een nieuwe faalmodus die er eerst niet was:
// een verouderde index. Die is hier het eigenlijke onderwerp. De cache hangt aan de
// context-INSTANTIE (WeakMap), en dat is alleen correct zolang elke bouwplek een vers object maakt
// bij gewijzigde data. Deze batterij pint dat vast — inclusief het geval dat de cache stil fout
// zou maken: dezelfde arrays, nieuwe inhoud.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { resourceNames, resourceCellValue, type ViewContext } from '@/engine/view/filterEval';
import { useAppStore } from '@/state/appStore';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const task = (id: string): Task => ({ id } as unknown as Task);
const res = (id: string, name: string): Resource =>
  ({ id, name, type: 'LABOR', description: '', maxUnits: 1 });
const asg = (taskId: string, resourceId: string): ResourceAssignment =>
  ({ taskId, resourceId } as unknown as ResourceAssignment);

const ctxWith = (resources: Resource[], assignments: ResourceAssignment[]): ViewContext => ({
  activityCodeTypes: [], customFieldDefs: [], resources, assignments, noneLabel: '(geen)',
});

// ── Het ORAKEL: de implementatie van vóór de index, verbatim. Zolang deze twee gelijk blijven is
//    de optimalisatie aantoonbaar gedragsbehoudend. ─────────────────────────────────────────────
function oldResourceNames(t: Task, ctx: ViewContext): string[] {
  return ctx.assignments
    .filter(a => a.taskId === t.id)
    .map(a => ctx.resources.find(r => r.id === a.resourceId)?.name)
    .filter((n): n is string => !!n);
}

const resources = [res('r1', 'Timmerman'), res('r2', 'Kraan'), res('r3', 'Metselaar')];
const assignments = [
  asg('t1', 'r2'), // volgorde bewust NIET alfabetisch: de uitkomst volgt de assignments-volgorde
  asg('t1', 'r1'),
  asg('t2', 'r3'),
  asg('t3', 'weg'), // toewijzing naar een verdwenen resource
  asg('t1', 'r1'),  // dubbele toewijzing: mag NIET ontdubbeld worden (dat deed het oude pad ook niet)
];
const ctx = ctxWith(resources, assignments);

for (const id of ['t1', 't2', 't3', 't4']) {
  eq(`01.${id} identiek aan de implementatie van vóór de index`,
    resourceNames(task(id), ctx), oldResourceNames(task(id), ctx));
}
eq('02 volgorde volgt de assignments, niet de resources', resourceNames(task('t1'), ctx), ['Kraan', 'Timmerman', 'Timmerman']);
eq('03 verdwenen resource valt weg, geen lege string', resourceNames(task('t3'), ctx), []);
eq('04 taak zonder toewijzingen', resourceNames(task('t4'), ctx), []);
eq('05 de cel-weergave hangt op dezelfde join', resourceCellValue(task('t1'), ctx), 'Kraan, Timmerman, Timmerman');

// ── De nieuwe faalmodus: een verouderde index. ──────────────────────────────
// De cache hangt aan de context-INSTANTIE. Een NIEUWE context met andere data moet dus andere
// uitkomsten geven; zou de cache op iets anders hangen (een module-globale, of de taak-id), dan
// bleef hier de oude uitslag staan.
{
  const ctx2 = ctxWith(resources, [asg('t1', 'r3')]);
  eq('06 een nieuwe context ziet de nieuwe toewijzingen', resourceNames(task('t1'), ctx2), ['Metselaar']);
  eq('07 en de oude context is ongemoeid', resourceNames(task('t1'), ctx), ['Kraan', 'Timmerman', 'Timmerman']);
}
{
  // Hernoemde resource, zelfde ids: een index op naam i.p.v. id zou hier blijven hangen.
  const ctx3 = ctxWith([res('r1', 'Timmerman-NIEUW'), res('r2', 'Kraan'), res('r3', 'Metselaar')], assignments);
  eq('08 een nieuwe context ziet een hernoemde resource',
    resourceNames(task('t1'), ctx3), ['Kraan', 'Timmerman-NIEUW', 'Timmerman-NIEUW']);
}
{
  // Herhaald aanroepen op DEZELFDE context moet stabiel zijn (de index mag niet per aanroep
  // opnieuw gevuld worden met bijwerkingen, en al helemaal niet accumuleren).
  const ctx4 = ctxWith(resources, assignments);
  const eerste = resourceNames(task('t1'), ctx4);
  for (let i = 0; i < 5; i++) resourceNames(task('t1'), ctx4);
  eq('09 herhaald aanroepen op dezelfde context geeft hetzelfde', resourceNames(task('t1'), ctx4), eerste);
}

// ── Integratie: de echte store-route, inclusief groeperen op resource. ──────
// Dit is het pad waar de kosten zaten: `recomputeViewRows` roept `resourceNames` voor élke taak
// aan zodra er op resource gegroepeerd wordt.
{
  const S = () => useAppStore.getState();
  S().newProject();
  const rA = S().addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 4 });
  const rB = S().addResource({ name: 'Ploeg B', type: 'CREW', description: '', maxUnits: 4 });
  const t1 = S().addTask({ name: 'Fundering' });
  const t2 = S().addTask({ name: 'Ruwbouw' });
  S().assignResource(t1, rA, 1);
  S().assignResource(t2, rB, 1);
  S().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
  S().recomputeViewRows();
  const banden = S().viewRows.filter(r => r.kind === 'group').map(r => (r as { label: string }).label);
  eq('10 store: de resource-groepsrijen komen uit de geïndexeerde join', banden.sort(), ['Ploeg A', 'Ploeg B']);

  // En na een MUTATIE moet de nieuwe toewijzing meteen zichtbaar zijn — dat is de echte
  // stale-cache-test, want hier bouwt de store een nieuwe context.
  S().assignResource(t1, rB, 1);
  S().recomputeViewRows();
  const na = S().viewRows.filter(r => r.kind === 'group').map(r => (r as { label: string }).label).sort();
  eq('11 store: een nieuwe toewijzing is meteen zichtbaar (geen verouderde index)', na, ['Ploeg A', 'Ploeg B']);
  const rowsA = S().viewRows.filter(r => r.kind === 'task').length;
  checks++;
  if (rowsA < 3) diffs.push(`12 store: taak met twee resources hoort in béíde groepen te staan (kreeg ${rowsA} taakrijen)`);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  view-index: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  view-index: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
