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
//   2. HIËRARCHIE (bevinding 3). Een bestaande relatie kan door verhangen (inspringen, rij slepen,
//      ouder kiezen in "Taak bewerken", MCP move_task) een relatie tussen een taak en zijn eigen
//      (voor)ouder worden. Die telt dan niet meer mee — bewust bewaard, zoals bij een import — maar
//      dat gebeurde stil, en daarna weigerde het taakraster ELKE relatiebewerking in het document
//      (ook tussen ongerelateerde taken) met de tekst "eigen samenvattende taak". Nu meldt het
//      verhangen hoeveel relaties niet meer meetellen, en telt het raster alleen de fouten die de
//      bewerking zelf toevoegt.
//   3. KRING DOOR VERHANGEN (rapport S4). Een relatie op een fase geldt voor elke taak in die fase.
//      Hang je een taak onder een fase, dan kunnen haar relaties via die taak rondlopen (en bij
//      uitspringen kan een relatie die niet meetelde weer gaan tellen). Elke verhangroute weigert
//      zo'n NIEUWE kring nu vooraf — melding met de kring, geen wijziging, geen undo-stap — en
//      meerdere taken tegelijk als geheel. Een al bestaande kring houdt niets tegen.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { runGridMutation } from '@/state/gridTransaction';
import { createRelationDraftWithFeedback, createRelationWithFeedback } from '@/state/relationActions';
import type { RelationSetIntent } from '@/types/taskGrid';

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

// ── Hulpjes voor de rastercellen ─────────────────────────────────────────────────────────────
const wbs = (id: string) => S().tasks.find(t => t.id === id)!.wbsCode;
/** Zet de voorgangerscel van `taskId` via de echte gridtransactie; 'ok' of de foutcodes. */
function gridPredecessors(taskId: string, tokens: readonly { id: string; lag?: string }[]): string {
  const intent: RelationSetIntent = {
    kind: 'relation-set', taskId, direction: 'predecessor',
    value: tokens.map((token, index) => ({
      kind: 'internal', wbsCode: wbs(token.id), relType: 'FS', lagText: token.lag ?? '',
      source: { index, start: index * 10, end: index * 10 + 5, text: `${wbs(token.id)} FS${token.lag ?? ''}` },
    })),
  };
  const result = S().runGridMutation([intent]);
  return result.ok ? 'ok' : result.errors.map(error => error.code).join(',');
}
const hierarchyNotes = () => notes().filter(n => n.key === 'notifications.relationsExcludedByHierarchy');

// ── 4. Inspringen onder de eigen voorganger (rapport S2): melding + raster blijft bruikbaar ────
{
  fresh();
  const a = S().addTask({ name: 'Grondwerk' });
  const b = S().addTask({ name: 'Fundering' });
  const x = S().addTask({ name: 'Steigerbouw' });
  const y = S().addTask({ name: 'Dakwerk' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  clearNotes();
  S().indentTasks([b]);
  eq('4.1 opzet: Fundering hangt onder Grondwerk', S().tasks.find(t => t.id === b)!.parentId, a);
  eq('4.2 de relatie blijft bewaard (niet stil weggegooid)', pairs(), ['Grondwerk→Fundering']);
  eq('4.3 inspringen meldt dat één relatie niet meer meetelt', hierarchyNotes(), [{
    key: 'notifications.relationsExcludedByHierarchy', params: { count: 1 },
  }]);

  // Het raster: een voorganger tussen twee taken die er niets mee te maken hebben.
  eq('4.4 raster: Steigerbouw als voorganger van Dakwerk mag', gridPredecessors(y, [{ id: x }]), 'ok');
  eq('4.5 en staat er', pairs().includes('Steigerbouw→Dakwerk'), true);
  // De cel van Fundering zelf: de bestaande voorouder-relatie blijft staan terwijl er een bij komt,
  // en haar lag is nog te wijzigen (zoals MCP update_dependencies dat al toestond).
  eq('4.6 raster: cel met de bestaande voorouder-relatie plus een nieuwe', gridPredecessors(b, [{ id: a }, { id: x }]), 'ok');
  eq('4.7 raster: lag van de bestaande voorouder-relatie wijzigen', gridPredecessors(b, [{ id: a, lag: '+2d' }, { id: x }]), 'ok');
  eq('4.8 de voorouder-relatie is dezelfde relatie gebleven, nu met lag', S().sequences
    .filter(q => q.predecessorId === a && q.successorId === b).map(q => q.lagDays), [2]);
  // Een NIEUWE voorouder-relatie blijft geweigerd.
  const c = S().addTask({ name: 'Uitzetten', parentId: a });
  eq('4.9 raster: nieuwe relatie naar de eigen fase blijft geweigerd', gridPredecessors(c, [{ id: a }]), 'ancestor');
}

// ── 5. Een al bestaande kring blokkeert het raster niet meer; een nieuwe wel ──────────────────
{
  fresh();
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  const c = S().addTask({ name: 'C' });
  const d = S().addTask({ name: 'D' });
  useAppStore.setState(state => {
    state.sequences.push(
      { id: 'imp-xy', predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 },
      { id: 'imp-yx', predecessorId: y, successorId: x, type: 'FINISH_START', lagDays: 0 },
    );
  });
  eq('5.1 raster: C als voorganger van D (los van de kring) mag', gridPredecessors(d, [{ id: c }]), 'ok');
  eq('5.2 raster: D als voorganger van C sluit een nieuwe kring', gridPredecessors(c, [{ id: d }]), 'cycle');
  eq('5.3 raster: de bestaande kring herstellen (cel leegmaken) mag', gridPredecessors(x, []), 'ok');
  eq('5.4 daarna geen kring meer', pairs().sort(), ['C→D', 'X→Y']);
}

// ── 6. Ook rij slepen en "Taak bewerken" (moveTask) melden het; een gewone verhanging niet ─────
{
  fresh();
  const a = S().addTask({ name: 'A' });
  const b = S().addTask({ name: 'B' });
  const los = S().addTask({ name: 'Los' });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
  clearNotes();
  S().indentTasks([los]); // Los onder B: raakt geen relatie
  eq('6.1 verhangen zonder gevolgen voor relaties meldt niets', hierarchyNotes(), []);
  S().outdentTasks([los]);

  S().moveTaskTo(b, { parentId: a, childIndex: 0 });
  eq('6.2 rij slepen (moveTaskTo) meldt het', hierarchyNotes().map(n => n.params), [{ count: 1 }]);
  S().undo();
  clearNotes();
  S().moveTasksTo([b], { parentId: a, childIndex: 0 });
  eq('6.3 selectie slepen (moveTasksTo) meldt het', hierarchyNotes().map(n => n.params), [{ count: 1 }]);
  S().undo();
  clearNotes();
  S().moveTask(a, b); // "Bovenliggende taak" in Taak bewerken / MCP move_task: A onder B
  eq('6.4 ouder kiezen (moveTask) meldt het, ook als de voorganger onder de opvolger gaat', hierarchyNotes().map(n => n.params), [{ count: 1 }]);
  clearNotes();
  S().moveTask(los, b); // B was al samenvatting van A; de relatie telde al niet mee
  eq('6.5 een relatie die al niet meetelde, wordt niet opnieuw gemeld', hierarchyNotes(), []);
}

// ── 7. Verhangen dat via een fase een KRING maakt, wordt vooraf geweigerd (rapport S4) ────────
// A, B, C met A→C en C→B. Hang B onder A en A wordt een fase: de relatie A→C geldt dan voor elke
// taak in A, dus ook als B→C — samen met C→B een kring. Voorheen voerde elke verhangroute dat stil
// uit en liep pas F5 vast ("Circular dependency"), waarna de hele planning bevroren was.
const cycleNotes = () => notes().filter(n => n.key === 'notifications.hierarchyCycle');
const parentName = (id: string) => {
  const parentId = S().tasks.find(t => t.id === id)!.parentId;
  return parentId ? S().tasks.find(t => t.id === parentId)!.name : null;
};
/** Het S4-uitgangspunt, doorgerekend en schoon (geen meldingen, niet gewijzigd). */
function s4(extra: readonly string[] = []): Record<string, string> {
  fresh();
  const ids: Record<string, string> = {};
  for (const name of ['Grondwerk', 'Fundering', ...extra, 'Keuring']) ids[name] = S().addTask({ name });
  S().addSequence({ predecessorId: ids.Grondwerk, successorId: ids.Keuring, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: ids.Keuring, successorId: ids.Fundering, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  eq('7.0 opzet: het uitgangspunt rekent', S().cpmResult?.error, undefined);
  useAppStore.setState(state => { state.ui.notifications = []; state.isDirty = false; });
  return ids;
}
/** Na een geweigerde verhanging: niets gewijzigd, geen undo-stap, één melding die de kring noemt. */
function expectRefused(label: string, depth: number, cycle: string, parents: Record<string, string | null>): void {
  for (const [name, parent] of Object.entries(parents)) {
    const id = S().tasks.find(t => t.name === name)!.id;
    eq(`${label}: ${name} hangt nog onder ${parent ?? 'de wortel'}`, parentName(id), parent);
  }
  eq(`${label}: geen undo-stap`, undoDepth(), depth);
  eq(`${label}: document niet gewijzigd`, S().isDirty, false);
  eq(`${label}: planning niet verouderd`, S().scheduleStale, false);
  eq(`${label}: melding noemt de kring`, cycleNotes(), [{ key: 'notifications.hierarchyCycle', params: { cycle } }]);
  eq(`${label}: geen "telt niet mee"-melding over een verhanging die niet doorging`, hierarchyNotes(), []);
  S().runCPM();
  eq(`${label}: F5 blijft rekenen`, S().cpmResult?.error, undefined);
}
{
  // Inspringen: Alt+Shift+→, de lintknop en het contextmenu komen allemaal in `indentTasks`.
  let ids = s4();
  let depth = undoDepth();
  S().indentTasks([ids.Fundering]);
  expectRefused('7.1 inspringen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  // Rij slepen (ook de balk-naar-rij-sleep in de Gantt): één taak via `moveTaskTo`.
  ids = s4();
  depth = undoDepth();
  S().moveTaskTo(ids.Fundering, { parentId: ids.Grondwerk, childIndex: 0 });
  expectRefused('7.2 rij slepen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  // Selectie slepen: `moveTasksTo`.
  ids = s4();
  depth = undoDepth();
  S().moveTasksTo([ids.Fundering], { parentId: ids.Grondwerk, childIndex: 0 });
  expectRefused('7.3 selectie slepen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  // "Bovenliggende taak" in Taak bewerken (en MCP move_task): `moveTask`.
  ids = s4();
  depth = undoDepth();
  S().moveTask(ids.Fundering, ids.Grondwerk);
  expectRefused('7.4 ouder kiezen', depth, 'Fundering → Keuring → Fundering', { Fundering: null });

  // Tegenproef: dezelfde verhanging zonder de relatie C→B maakt geen kring en gaat gewoon door.
  ids = s4();
  S().removeSequence(S().sequences.find(q => q.predecessorId === ids.Keuring)!.id);
  S().indentTasks([ids.Fundering]);
  eq('7.5 zonder kring gaat inspringen gewoon door', parentName(ids.Fundering), 'Grondwerk');
  eq('7.6 zonder melding over een kring', cycleNotes(), []);
}

// ── 8. Meerdere taken tegelijk: de hele handeling wordt geweigerd, niet de helft ──────────────
// Volgorde Grondwerk, Fundering, Steiger, Dak, Keuring. Inspringen van {Fundering, Dak}: Dak onder
// Steiger is onschuldig, Fundering onder Grondwerk maakt de S4-kring. Half inspringen zou de
// structuur onverwacht anders achterlaten dan de gebruiker vroeg: dus niets.
{
  let ids = s4(['Steiger', 'Dak']);
  let depth = undoDepth();
  S().indentTasks([ids.Fundering, ids.Dak]);
  expectRefused('8.1 inspringen van twee taken', depth, 'Fundering → Keuring → Fundering', { Fundering: null, Dak: null });
  S().indentTasks([ids.Dak]);
  eq('8.2 tegenproef: Dak alleen inspringen gaat door', parentName(ids.Dak), 'Steiger');

  ids = s4(['Steiger', 'Dak']);
  depth = undoDepth();
  S().moveTasksTo([ids.Dak, ids.Fundering], { parentId: ids.Grondwerk, childIndex: 0 });
  expectRefused('8.3 blok slepen', depth, 'Fundering → Keuring → Fundering', { Fundering: null, Dak: null });
}

// ── 9. Uitspringen kan óók een kring maken (gemeten) ─────────────────────────────────────────
// Een relatie tussen een taak en haar eigen fase telt niet mee (ingesprongen, of geïmporteerd). Spring
// je die taak weer uit, dan telt de relatie weer: Kozijnen → Casco geldt dan voor Metselwerk in Casco,
// en met Metselwerk → Kozijnen erbij is dat een kring.
{
  fresh();
  const casco = S().addTask({ name: 'Casco' });
  const kozijnen = S().addTask({ name: 'Kozijnen' });
  S().addSequence({ predecessorId: kozijnen, successorId: casco, type: 'FINISH_START', lagDays: 0 });
  S().indentTasks([kozijnen]); // Kozijnen → Casco telt vanaf nu niet meer mee (melding, #207)
  const metselwerk = S().addTask({ name: 'Metselwerk', parentId: casco });
  ok('9.0 opzet: Metselwerk → Kozijnen binnen dezelfde fase mag', S().addSequence({
    predecessorId: metselwerk, successorId: kozijnen, type: 'FINISH_START', lagDays: 0,
  }) !== null);
  S().runCPM();
  eq('9.0 opzet: rekent', S().cpmResult?.error, undefined);
  useAppStore.setState(state => { state.ui.notifications = []; state.isDirty = false; });
  const depth = undoDepth();
  S().outdentTasks([kozijnen]);
  expectRefused('9.1 uitspringen', depth, 'Kozijnen → Metselwerk → Kozijnen', { Kozijnen: 'Casco' });
}

// ── 10. Een kring die er al was (bv. geïmporteerd) houdt een onschuldige verhanging niet tegen ──
{
  fresh();
  const x = S().addTask({ name: 'X' });
  const y = S().addTask({ name: 'Y' });
  const fase = S().addTask({ name: 'Fase' });
  const taak = S().addTask({ name: 'Taak' });
  useAppStore.setState(state => {
    state.sequences.push(
      { id: 'imp-xy', predecessorId: x, successorId: y, type: 'FINISH_START', lagDays: 0 },
      { id: 'imp-yx', predecessorId: y, successorId: x, type: 'FINISH_START', lagDays: 0 },
    );
    state.ui.notifications = [];
  });
  S().indentTasks([taak]);
  eq('10.1 inspringen los van de bestaande kring gaat door', parentName(taak), 'Fase');
  eq('10.2 zonder kringmelding', cycleNotes(), []);
  ok('10.3 (fase bestaat)', fase.length > 0);
}

// Sanity: de rasterroute is dezelfde als de publieke `runGridMutation`-export.
ok('runGridMutation-export bestaat', typeof runGridMutation === 'function');

if (diffs.length > 0) {
  console.log(`XX  relation-routes: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   - ${diff}`);
  process.exit(1);
}
console.log(`OK  relation-routes: alle checks groen (${checks})`);
