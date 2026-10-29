// App sluiten (audit 2026-09-26): `createAppQuitController` loopt de documenten met niet-opgeslagen
// wijzigingen langs de bestaande sluit-bevestiging en ruimt pas bij een schone exit de
// herstelsnapshots op. Headless: alle randen (store, recovery, venster) zijn fakes.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import './domStub';
import { createAppQuitController, type AppQuitDocument } from '@/services/appQuit/appQuitController';
import { appQuitDependencies } from '@/services/appQuit/appQuitDependencies';
import { appStoreContext, createAppStoreContext } from '@/state/appStore';
import { createPendingTextEdits, mountedPendingTextEdits } from '@/state/pendingTextEdits';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

function harness(initial: AppQuitDocument[]) {
  const log: string[] = [];
  const world = {
    docs: initial.map((d) => ({ ...d })),
    pending: null as string | null,
    quitPending: false,
    recoveryOn: true,
    inputFinished: 0,
  };
  const controller = createAppQuitController({
    finishPendingInput: () => { world.inputFinished++; },
    listDocuments: () => world.docs.map((d) => ({ ...d })),
    getPendingCloseDocId: () => world.pending,
    setPendingCloseDocId: (id) => { world.pending = id; log.push(`vraag:${id}`); },
    setQuitPending: (p) => { world.quitPending = p; },
    stopRecovery: () => { world.recoveryOn = false; log.push('herstel-uit'); },
    clearRecovery: async () => { log.push('herstel-gewist'); },
    destroyWindow: async () => { log.push('venster-dicht'); },
  });
  // De sluit-bevestiging, zoals CloseDocumentDialog hem afhandelt.
  const answer = (choice: 'opslaan' | 'niet-opslaan' | 'annuleren' | 'opslaan-mislukt') => {
    const id = world.pending!;
    if (choice === 'opslaan' || choice === 'niet-opslaan') world.docs = world.docs.filter((d) => d.id !== id);
    world.pending = null;
    controller.step();
  };
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { controller, world, log, answer, settle };
}

// 1. Niets ongeopgeslagen: meteen herstel uit, gewist, venster dicht — zonder vraag.
{
  const h = harness([{ id: 'a', isDirty: false }, { id: 'b', isDirty: false }]);
  eq('1 CloseRequested wordt overgenomen', h.controller.requestQuit(), true);
  await h.settle();
  eq('1 schone exit: volgorde', h.log, ['herstel-uit', 'herstel-gewist', 'venster-dicht']);
}

// 2. Twee gewijzigde documenten: per document de vraag; opslaan + niet opslaan ⇒ dicht.
{
  const h = harness([{ id: 'a', isDirty: true }, { id: 'b', isDirty: false }, { id: 'c', isDirty: true }]);
  h.controller.requestQuit();
  eq('2 eerst de vraag voor a', h.log, ['vraag:a']);
  eq('2 afsluiten loopt', h.world.quitPending, true);
  h.answer('opslaan');
  eq('2 daarna de vraag voor c', h.log, ['vraag:a', 'vraag:c']);
  h.answer('niet-opslaan');
  await h.settle();
  eq('2 daarna schone exit', h.log.slice(2), ['herstel-uit', 'herstel-gewist', 'venster-dicht']);
}

// 3. Annuleren breekt het afsluiten af: herstel blijft aan, venster blijft open, vlag weer uit.
{
  const h = harness([{ id: 'a', isDirty: true }, { id: 'b', isDirty: true }]);
  h.controller.requestQuit();
  h.answer('annuleren');
  await h.settle();
  eq('3 geen tweede vraag, geen exit', h.log, ['vraag:a']);
  eq('3 herstel blijft aan', h.world.recoveryOn, true);
  eq('3 vlag uit, controller inactief', [h.world.quitPending, h.controller.active], [false, false]);
  // Een nieuwe sluitpoging begint opnieuw bij het eerste gewijzigde document.
  h.controller.requestQuit();
  eq('3 nieuwe poging vraagt opnieuw', h.log, ['vraag:a', 'vraag:a']);
}

// 4. Een mislukte opslag (document blijft dirty) breekt eveneens af.
{
  const h = harness([{ id: 'a', isDirty: true }]);
  h.controller.requestQuit();
  h.answer('opslaan-mislukt');
  await h.settle();
  eq('4 mislukte opslag: geen exit', h.log, ['vraag:a']);
}

// 5. Store-wijzigingen terwijl de vraag openstaat doen niets.
{
  const h = harness([{ id: 'a', isDirty: true }]);
  h.controller.requestQuit();
  h.controller.step();
  h.controller.step();
  eq('5 geen dubbele vraag', h.log, ['vraag:a']);
}

// 6. Review #401: open veldinvoer zonder blur (inzet 1 → 3 getypt, focus nog in het veld). Echte
//    store en de echte randen van `appQuitDependencies`; alleen het Tauri-venster is nagebootst.
//    Afsluiten rondt de invoer eerst af: de inzet staat in de store, het document is gewijzigd, en
//    de controller vraagt om bevestiging in plaats van herstel te wissen en het venster te sluiten.
{
  const reg = createPendingTextEdits();
  const ctx = createAppStoreContext({ pendingTextEdits: reg });
  const s = () => ctx.store.getState();
  s().newProject();
  const taskId = s().addTask({ name: 'Metselwerk' });
  const resourceId = s().addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 4 });
  s().assignResource(taskId, resourceId, 1);
  const asg = s().assignments[0]!.id;
  ctx.store.setState((st) => { st.isDirty = false; });
  // Zoals `UnitsInput` (commit van de draft) en `useTextEntryAutoCalcHold` (eigen blokkade) zich aanmelden.
  let released = 0;
  reg.register({ commit: () => s().updateAssignment(asg, { unitsPerDay: 3 }) });
  reg.register({ release: () => { released++; } });
  const log: string[] = [];
  const controller = createAppQuitController(appQuitDependencies(ctx, {
    stopRecovery: () => { log.push('herstel-uit'); },
    clearRecovery: async () => { log.push('herstel-gewist'); },
    destroyWindow: async () => { log.push('venster-dicht'); },
  }));
  controller.requestQuit();
  await new Promise((r) => setTimeout(r, 0));
  eq('6 geen exit zonder vraag', log, []);
  eq('6 sluitvraag voor het actieve document', s().ui.pendingCloseDocId, s().activeDocumentId);
  eq('6 de getypte inzet staat in de store', s().assignments[0]!.unitsPerDay, 3);
  eq('6 eigen rekenblokkade vrijgegeven', released, 1);
}

// 7. Review #401 (vervolg 3): het register hoort bij één storecontext. Een documentactie in een
//    andere context rondt de invoer van de zichtbare app niet af; in de gemounte context wel.
{
  let commits = 0;
  const off = mountedPendingTextEdits.register({ commit: () => { commits++; } });
  createAppStoreContext().store.getState().newDocument();
  eq('7 andere context raakt de zichtbare invoer niet', commits, 0);
  appStoreContext.store.getState().newDocument();
  eq('7 de gemounte context rondt hem af', commits, 1);
  off();
}

if (diffs.length === 0) {
  console.log(`OK  app-quit: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  app-quit: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
