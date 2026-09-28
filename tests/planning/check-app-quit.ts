// App sluiten (audit 2026-09-26): `createAppQuitController` loopt de documenten met niet-opgeslagen
// wijzigingen langs de bestaande sluit-bevestiging en ruimt pas bij een schone exit de
// herstelsnapshots op. Headless: alle randen (store, recovery, venster) zijn fakes.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { createAppQuitController, type AppQuitDocument } from '@/services/appQuit/appQuitController';

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
  };
  const controller = createAppQuitController({
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

if (diffs.length === 0) {
  console.log(`OK  app-quit: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  app-quit: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
