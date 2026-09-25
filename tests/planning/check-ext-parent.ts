// Ouderwijziging via de extensie-API — `api.data.updateTask(id, { parentId })` en `addTask`.
//
// AANLEIDING. `fromExtTaskUpdates` mapte `parentId` rauw op de taak en de store-`updateTask` deed er
// een kale Object.assign mee. Gemeten gevolg: `kind.parentId = ouder` terwijl `ouder.childIds` leeg
// bleef — de boom was intern tegenstrijdig, en na `runCPM` werd de ouder daardoor GEEN
// samenvattingstaak (hij hield zijn eigen datums in plaats van die van het kind te omvatten). Een
// onbekende ouder werd gewoon aangenomen, net als een ouder onder zijn eigen kind (een kring).
//
// WAT HIER VASTLIGT. Een ouderwijziging vanuit een extensie is een VERPLAATSING via dezelfde
// store-actie als rij-slepen (`moveTaskTo`), dus met exact dezelfde uitkomst als de app zelf; een
// onbekende ouder of een kring gooit een fout naar de extensie vóór er iets gewijzigd is; `null`
// hangt de taak aan de wortel; en een `updateTask` zonder (gewijzigde) `parentId` werkt als
// voorheen — ook het terugschrijven van een ongewijzigd `getTasks()`-object mag de volgorde onder
// de ouder niet verschuiven.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import { capturePayload } from '@/state/documentContract';
import { createExtensionApi, type ExtensionHostBinding } from '@/extensions/extensionApi';
import type { ExtensionApi } from '@/extensions/types';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const EXT_ID = 'ouder-test';

function setup(): { ctx: AppStoreContext; api: ExtensionApi } {
  const ctx = createAppStoreContext();
  const host: ExtensionHostBinding = { app: ctx, showNotification: () => {} };
  return { ctx, api: createExtensionApi(EXT_ID, [], undefined, ctx, host) };
}

const taskOf = (ctx: AppStoreContext, id: string) => {
  const task = ctx.store.getState().tasks.find(t => t.id === id);
  if (!task) throw new Error(`taak ${id} ontbreekt`);
  return task;
};
/** De zichtbare taakrijen als [naam, diepte] — wat de gebruiker in het raster ziet. */
const taskRows = (ctx: AppStoreContext) => ctx.store.getState().viewRows
  .flatMap(row => row.kind === 'task' ? [[row.task.name, row.depth]] : []);
const appliedDepth = (ctx: AppStoreContext) => ctx.store.getState().historyEvents
  .filter(event => event.state === 'applied').length;

/** Ouder + kind op rootniveau; het kind krijgt eigen, duidelijk andere datums dan de ouder. */
function ouderEnKind(ctx: AppStoreContext): { ouder: string; kind: string } {
  const S = ctx.store.getState;
  const ouder = S().addTask({ name: 'Ouder' });
  const kind = S().addTask({ name: 'Kind' });
  S().updateTask(kind, { time: { ...taskOf(ctx, kind).time, scheduleStart: '2026-06-15', scheduleDuration: 10 } });
  return { ouder, kind };
}

/** Documentpayload ongewijzigd? Als boolean, zodat een faalregel geen volledige payload dumpt. */
const sameDocument = (ctx: AppStoreContext, voor: ReturnType<typeof capturePayload>) =>
  JSON.stringify(capturePayload(ctx.store.getState())) === JSON.stringify(voor);

/** Voert `fn` uit en geeft de foutboodschap terug, of `null` als er niets gegooid werd. */
function thrown(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// ── 1. updateTask({ parentId }) = dezelfde verplaatsing als de app zelf ─────────────────────────
{
  // Referentie: de store-route die rij-slepen gebruikt.
  const ref = setup();
  const r = ouderEnKind(ref.ctx);
  ref.ctx.store.getState().moveTaskTo(r.kind, { parentId: r.ouder, childIndex: 0 });
  ref.ctx.store.getState().runCPM();

  const { ctx, api } = setup();
  const { ouder, kind } = ouderEnKind(ctx);
  const depthVoor = appliedDepth(ctx);
  api.data.updateTask(kind, { parentId: ouder });
  eq('1a kind.parentId wijst naar de ouder', taskOf(ctx, kind).parentId, ouder);
  eq('1b ouder.childIds bevat het kind', taskOf(ctx, ouder).childIds, [kind]);
  eq('1c verplaatsing is precies één undo-stap', appliedDepth(ctx), depthVoor + 1);
  eq('1d planning is verouderd na de verplaatsing', ctx.store.getState().scheduleStale, true);
  ctx.store.getState().runCPM();
  const o = taskOf(ctx, ouder).time;
  const k = taskOf(ctx, kind).time;
  eq('1e na runCPM omvat de ouder de datums van het kind',
    [o.earlyStart, o.earlyFinish], [k.earlyStart, k.earlyFinish]);
  eq('1f zelfde ouderdatums als de store-route moveTaskTo',
    [o.earlyStart, o.earlyFinish],
    [taskOf(ref.ctx, r.ouder).time.earlyStart, taskOf(ref.ctx, r.ouder).time.earlyFinish]);
  eq('1g kind heeft zijn eigen startdatum gehouden', k.earlyStart, '2026-06-15');
  eq('1h zelfde zichtbare rijen (naam, diepte) als de store-route',
    taskRows(ctx), taskRows(ref.ctx));

  ctx.store.getState().undo();
  eq('1i undo zet het kind terug naar de wortel', taskOf(ctx, kind).parentId, null);
  eq('1j undo maakt de kindlijst van de ouder weer leeg', taskOf(ctx, ouder).childIds, []);
}

// ── 1k. Verplaatsing plus gewone velden in één aanroep: alles toegepast, één undo-stap ─────────
{
  const { ctx, api } = setup();
  const { ouder, kind } = ouderEnKind(ctx);
  const depthVoor = appliedDepth(ctx);
  api.data.updateTask(kind, { parentId: ouder, name: 'Kind hernoemd', priority: 700 });
  eq('1k verplaatst mét veldwijziging', taskOf(ctx, ouder).childIds, [kind]);
  eq('1l naam uit dezelfde aanroep is toegepast', taskOf(ctx, kind).name, 'Kind hernoemd');
  eq('1m prioriteit uit dezelfde aanroep is toegepast', taskOf(ctx, kind).priority, 700);
  eq('1n verplaatsing + velden vormen één undo-stap', appliedDepth(ctx), depthVoor + 1);
  ctx.store.getState().undo();
  eq('1o één undo draait beide terug',
    [taskOf(ctx, kind).name, taskOf(ctx, kind).parentId, taskOf(ctx, ouder).childIds],
    ['Kind', null, []]);
}

// ── 2. Onbekende ouder ⇒ fout, taak (en document) ongewijzigd ─────────────────────────────────
{
  const { ctx, api } = setup();
  const { kind } = ouderEnKind(ctx);
  const voor = capturePayload(ctx.store.getState());
  const depthVoor = appliedDepth(ctx);
  const fout = thrown(() => api.data.updateTask(kind, { parentId: 'bestaat-niet', name: 'Mag niet' }));
  eq('2a onbekende ouder wordt geweigerd met een fout',
    fout, `Extensie "${EXT_ID}": onbekende ouder 'bestaat-niet'`);
  eq('2b taak ongewijzigd, ook de andere velden uit dezelfde aanroep',
    [taskOf(ctx, kind).parentId, taskOf(ctx, kind).name], [null, 'Kind']);
  eq('2c document byte-inhoudelijk gelijk', sameDocument(ctx, voor), true);
  eq('2d geen undo-stap', appliedDepth(ctx), depthVoor);
}

// ── 3. Kring ⇒ fout (ouder onder eigen kind, en taak onder zichzelf) ─────────────────────────
{
  const { ctx, api } = setup();
  const { ouder, kind } = ouderEnKind(ctx);
  const klein = ctx.store.getState().addTask({ name: 'Kleinkind' });
  ctx.store.getState().moveTaskTo(kind, { parentId: ouder, childIndex: 0 });
  ctx.store.getState().moveTaskTo(klein, { parentId: kind, childIndex: 0 });
  const voor = capturePayload(ctx.store.getState());
  const depthVoor = appliedDepth(ctx);

  eq('3a ouder onder zijn eigen kind wordt geweigerd',
    thrown(() => api.data.updateTask(ouder, { parentId: kind })),
    `Extensie "${EXT_ID}": taak '${ouder}' kan niet onder zichzelf of een eigen afstammeling ('${kind}') worden geplaatst`);
  eq('3b ouder onder zijn eigen kleinkind wordt geweigerd',
    thrown(() => api.data.updateTask(ouder, { parentId: klein })) !== null, true);
  eq('3c taak onder zichzelf wordt geweigerd',
    thrown(() => api.data.updateTask(kind, { parentId: kind })) !== null, true);
  eq('3d boom byte-inhoudelijk gelijk na de weigeringen', sameDocument(ctx, voor), true);
  eq('3e geen enkele parentId gewijzigd',
    [ouder, kind, klein].map(id => taskOf(ctx, id).parentId), [null, ouder, kind]);
  eq('3f geen undo-stap', appliedDepth(ctx), depthVoor);
}

// ── 4. parentId: null ⇒ naar de wortel, oude ouder bijgewerkt ─────────────────────────────────
{
  const { ctx, api } = setup();
  const { ouder, kind } = ouderEnKind(ctx);
  const broer = ctx.store.getState().addTask({ name: 'Broer' });
  ctx.store.getState().moveTaskTo(kind, { parentId: ouder, childIndex: 0 });
  ctx.store.getState().moveTaskTo(broer, { parentId: ouder, childIndex: 1 });
  api.data.updateTask(kind, { parentId: null });
  eq('4a kind hangt aan de wortel', taskOf(ctx, kind).parentId, null);
  eq('4b oude ouder kent alleen de broer nog', taskOf(ctx, ouder).childIds, [broer]);
  eq('4c zichtbare rijen: kind op diepte 0, broer onder de ouder',
    taskRows(ctx), [['Ouder', 0], ['Broer', 1], ['Kind', 0]]);
}

// ── 5. updateTask zonder (gewijzigde) parentId werkt als voorheen ─────────────────────────────
{
  const { ctx, api } = setup();
  const { ouder, kind } = ouderEnKind(ctx);
  const broer = ctx.store.getState().addTask({ name: 'Broer' });
  ctx.store.getState().moveTaskTo(kind, { parentId: ouder, childIndex: 0 });
  ctx.store.getState().moveTaskTo(broer, { parentId: ouder, childIndex: 1 });

  const depthVoor = appliedDepth(ctx);
  api.data.updateTask(kind, { name: 'Alleen de naam' });
  eq('5a naam gewijzigd', taskOf(ctx, kind).name, 'Alleen de naam');
  eq('5b ouder en volgorde ongemoeid', taskOf(ctx, ouder).childIds, [kind, broer]);
  eq('5c één undo-stap, zoals voorheen', appliedDepth(ctx), depthVoor + 1);

  // Het gangbare extensiepatroon: getTasks() → object aanpassen → volledig terugschrijven. Dezelfde
  // ouder is géén verplaatsing; zou hij dat wel zijn, dan schoof het kind achter zijn broer.
  const ext = api.data.getTasks().find(task => task.id === kind)!;
  ext.name = 'Terug via getTasks';
  api.data.updateTask(kind, ext);
  eq('5d volledig object: naam gewijzigd', taskOf(ctx, kind).name, 'Terug via getTasks');
  eq('5e volledig object met dezelfde ouder verschuift de volgorde niet',
    taskOf(ctx, ouder).childIds, [kind, broer]);
  eq('5f onbekend taak-id blijft een stille no-op',
    thrown(() => api.data.updateTask('bestaat-niet', { parentId: ouder })), null);
}

// ── 6. addTask onder een ouder ────────────────────────────────────────────────────────────────
{
  const { ctx, api } = setup();
  const ouder = ctx.store.getState().addTask({ name: 'Ouder' });
  const nieuw = api.data.addTask({ name: 'Nieuw kind', parentId: ouder });
  eq('6a addTask met bestaande ouder hangt aan beide kanten op',
    [taskOf(ctx, nieuw).parentId, taskOf(ctx, ouder).childIds], [ouder, [nieuw]]);

  const aantalVoor = ctx.store.getState().tasks.length;
  eq('6b addTask met onbekende ouder wordt geweigerd',
    thrown(() => api.data.addTask({ name: 'Wees', parentId: 'bestaat-niet' })),
    `Extensie "${EXT_ID}": onbekende ouder 'bestaat-niet'`);
  eq('6c geweigerde addTask voegt niets toe', ctx.store.getState().tasks.length, aantalVoor);
  const root = api.data.addTask({ name: 'Wortel', parentId: null });
  eq('6d addTask met parentId null komt aan de wortel', taskOf(ctx, root).parentId, null);
}

// ── Uitslag ────────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK: extensie-ouderwijziging — ${checks} checks groen`);
} else {
  console.log(`XX extensie-ouderwijziging — ${diffs.length} van ${checks} checks rood:`);
  for (const d of diffs) console.log(`   XX ${d}`);
  process.exit(1);
}
