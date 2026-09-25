import './domStub';
// Relaties over de routes heen (audit taakmutaties) — headless tegen de ECHTE Zustand-store.
//
// Dezelfde relatiehandeling kan via de Gantt (Shift-sleep + popover), de lintknop "Geselecteerde
// taken koppelen", het relatiepaneel, de extensie-API (`api.data.addSequence`), het taakraster en MCP.
// Deze batterij bewaakt dat die routes dezelfde grens trekken:
//
//   1. KRING (bevinding 2). Raster en MCP weigerden een relatie die een kring sluit al vooraf; de
//      store-route (`addSequence`, waar Gantt, lint, paneel en extensie samenkomen) meldde "Relatie
//      aangemaakt" en pas F5 liep vast op "Circular dependency". Nu toetst de store-route dezelfde
//      kring vooraf, over de geëxpandeerde bladgraaf (een samenvattingseindpunt telt mee), en ALLEEN
//      voor de kring die de nieuwe relatie zelf sluit: een al bestaande kring elders (bv. uit een
//      import) blokkeert geen onschuldige relatie.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { createRelationDraftWithFeedback, createRelationWithFeedback } from '@/state/relationActions';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

const undoDepth = () => S().historyEvents.filter(event => event.state === 'applied').length;
const notes = () => S().ui.notifications.map(n => ({ key: n.messageKey, params: n.params }));
const pairs = () => S().sequences.map(q => {
  const name = (id: string) => S().tasks.find(t => t.id === id)?.name ?? '?';
  return `${name(q.predecessorId)}→${name(q.successorId)}`;
});

/** Vers project zonder meldingen/history, zodat elk blok alleen zijn eigen effect ziet. */
function fresh(): void {
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  useAppStore.setState(state => {
    state.historyEvents = [];
    state.nextHistorySequence = 1;
    state.ui.notifications = [];
    state.isDirty = false;
  });
}
function clearNotes(): void {
  useAppStore.setState(state => { state.ui.notifications = []; });
}

// ── 1. Kring via de store-route wordt vooraf geweigerd ───────────────────────────────────────
{
  fresh();
  const a = S().addTask({ name: 'Grondwerk' });
  const b = S().addTask({ name: 'Fundering' });
  S().addTask({ name: 'Los' });
  ok('1.0 A→B via de lintroute wordt aangemaakt', createRelationWithFeedback(a, b) !== null);
  S().runCPM();
  clearNotes();
  const depth = undoDepth();

  // Lintknop "Geselecteerde taken koppelen" (selectie B, A) — createRelationWithFeedback.
  eq('1.1 B→A sluit de kring: geen id', createRelationWithFeedback(b, a), null);
  eq('1.2 en geen tweede relatie', pairs(), ['Grondwerk→Fundering']);
  eq('1.3 geen loze undo-stap', undoDepth(), depth);
  eq('1.4 de melding noemt de kring, geen "Relatie aangemaakt"', notes(), [{
    key: 'notifications.relationCycle', params: { cycle: 'Fundering → Grondwerk → Fundering' },
  }]);

  // Gantt Shift-sleep-popover en relatiepaneel — createRelationDraftWithFeedback, ook met ander
  // type en lag: de kring zit in de volgorde, niet in het type.
  clearNotes();
  eq('1.5 conceptroute (SS + lag) weigert dezelfde kring', createRelationDraftWithFeedback({
    predecessorId: b, successorId: a, type: 'START_START', lagDays: 2,
  }), null);
  eq('1.6 melding via hetzelfde kanaal', notes().map(n => n.key), ['notifications.relationCycle']);

  // Extensie-API: `api.data.addSequence` roept rechtstreeks de store-actie aan (extensionApi.ts).
  eq('1.7 store-actie addSequence weigert de kring zelf', S().addSequence({
    predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0,
  }), null);
  eq('1.8 nog steeds één relatie', S().sequences.length, 1);

  S().runCPM();
  eq('1.9 F5 blijft rekenen (geen "Circular dependency")', S().cpmResult?.error, undefined);

  // Geen valse treffer: een tweede type tussen hetzelfde paar in DEZELFDE richting is geen kring.
  ok('1.10 A→B SS naast A→B FS mag gewoon', S().addSequence({
    predecessorId: a, successorId: b, type: 'START_START', lagDays: 0,
  }) !== null);
}

// ── 2. Samenvattingseindpunt: de kring zit pas in de geëxpandeerde graaf (rapport S5) ─────────
{
  fresh();
  const p = S().addTask({ name: 'Fase' });
  S().addTask({ name: 'Wapening', parentId: p });
  const p1 = S().tasks.find(t => t.name === 'Wapening')!.id;
  const q = S().addTask({ name: 'Storten' });
  ok('2.0 Wapening→Storten', S().addSequence({ predecessorId: p1, successorId: q, type: 'FINISH_START', lagDays: 0 }) !== null);
  S().runCPM();
  clearNotes();
  eq('2.1 Storten→Fase sluit via de fase een kring: geweigerd', createRelationWithFeedback(q, p), null);
  eq('2.2 de melding noemt de bladtaken van de kring', notes(), [{
    key: 'notifications.relationCycle', params: { cycle: 'Storten → Wapening → Storten' },
  }]);
  S().runCPM();
  eq('2.3 F5 blijft rekenen', S().cpmResult?.error, undefined);
}

// ── 3. Een al bestaande kring (bv. geïmporteerd) blokkeert geen onschuldige relatie ───────────
{
  fresh();
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  // Buiten de aanmaakroutes om, zoals een importer rechtstreeks naar `sequences` schrijft.
  useAppStore.setState(state => {
    state.sequences.push(
      { id: 'imp-xy', predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 },
      { id: 'imp-yx', predecessorId: y, successorId: x, type: 'FINISH_START', lagDays: 0 },
    );
  });
  clearNotes();
  ok('3.1 C→D (los van de bestaande kring) mag', createRelationWithFeedback(c, d) !== null);
  ok('3.2 X→C (hangt aan de kring, sluit zelf niets) mag', createRelationWithFeedback(x, c) !== null);
  eq('3.3 D→X sluit wél een NIEUWE kring (D → X → C → D): geweigerd', createRelationWithFeedback(d, x), null);
  eq('3.4 met de nieuwe kring in de melding, niet de oude', notes().at(-1), {
    key: 'notifications.relationCycle', params: { cycle: 'D → X → C → D' },
  });
}

if (diffs.length > 0) {
  console.log(`XX  relation-routes: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   - ${diff}`);
  process.exit(1);
}
console.log(`OK  relation-routes: alle checks groen (${checks})`);
