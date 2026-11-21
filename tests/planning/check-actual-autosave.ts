// Contract voor echt automatisch opslaan. Deze test gebruikt geen browser- of Tauri-I/O:
// de controller krijgt die randen geïnjecteerd, zodat timing, single-flight en de dirty-race
// deterministisch bewaakt blijven.
import { AutoSaveTargetUnavailableError, actualAutoSaveDelay, createActualAutoSaveController, type ActualAutoSaveCandidate, type ActualAutoSaveWrite } from '@/services/actualAutosave/actualAutoSave';
import { useAppStore } from '@/state/appStore';
import { freshPayload } from '@/state/documentContract';
import {
  claimProjectFileWrite, closeProjectFileWrites, isProjectFileWriteBusy, runAutoSaveRound, runAutoSaveTickWrite,
  runProjectFileWrite, runYieldingProjectFileWrite, whenProjectFileWritesIdle, YieldedToManualWrite,
} from '@/services/fileAccess/writeCoordinator';
import {
  createModelAutoSaveRhythm, MODEL_AUTOSAVE_DUTY_FACTOR, MODEL_AUTOSAVE_MAX_DELAY_MS, MODEL_AUTOSAVE_REST_MS,
} from '@/services/actualAutosave/modelAutoSaveRhythm';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const truthy = (label: string, got: boolean) => { checks++; if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`); };

const source = (version: number) => ({ project: { version } }) as never;
let candidates: ActualAutoSaveCandidate[] = [];
let writes: string[] = [];
let marked: string[] = [];
let failures: string[] = [];
let releaseWrite: (() => void) | null = null;
let blockWrites = false;

/** De unitproeven van de controller zonder schrijfcoördinatie: elke doorgang loopt meteen. */
const passThrough = (pass: () => Promise<void>) => pass();
const controller = createActualAutoSaveController({
  round: passThrough,
  listCandidates: () => candidates,
  canWrite: async () => true,
  // #804 stap 6: `write` is de hele ronde (voorbereiden, schrijven, vastleggen); de inhoud volgt uit de bron.
  write: async candidate => {
    writes.push(`${candidate.id}:ifc-${(candidate.source as unknown as { project: { version: number } }).project.version}`);
    if (blockWrites) await new Promise<void>(resolve => { releaseWrite = resolve; });
    marked.push(candidate.id);
    return true;
  },
  onFailure: (candidate, error) => { failures.push(`${candidate.id}:${String(error)}`); },
});

eq('0a throttle laat de eerste write direct toe', actualAutoSaveDelay(0, 25_000), 0);
eq('0b throttle wacht alleen de resterende tijd', actualAutoSaveDelay(20_000, 25_000), 5_000);

// Recovery is een andere laag: alleen kandidaten met enabled + bestaand schrijfdoel worden hier
// aangeraakt. Een naamloos document blijft dus wel recovery krijgen, maar geen echte overschrijving.
candidates = [
  { id: 'naamloos', content: 0, enabled: true, dirty: true, ref: null, source: source(1) },
  { id: 'uit', content: 0, enabled: false, dirty: true, ref: { kind: 'path', path: '/uit.ifc' }, source: source(1) },
  { id: 'aan', content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: '/aan.ifc' }, source: source(2) },
];
await controller.flush();
eq('1 echte autosave slaat alleen enabled bestaand bestand op', writes, ['aan:ifc-2']);
eq('2 alleen de werkelijk geschreven versie wordt schoon gemarkeerd', marked, ['aan']);

// Een schrijfbeurt mag nooit parallel lopen. Een tweede aanvraag tijdens de eerste onthoudt de
// nieuwste run; pas ná de write volgt precies één vervolgrun.
writes = []; marked = []; blockWrites = true;
candidates = [{ id: 'race', content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: '/race.ifc' }, source: source(1) }];
const first = controller.flush();
for (let i = 0; i < 4 && !releaseWrite; i++) await Promise.resolve();
const second = controller.flush();
for (let i = 0; i < 4 && writes.length === 0; i++) await Promise.resolve();
eq('3 single-flight: tweede run start niet parallel', writes, ['race:ifc-1']);
candidates = [{ id: 'race', content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: '/race.ifc' }, source: source(2) }];
blockWrites = false;
const release = releaseWrite as (() => void) | null;
if (release) release();
await first;
await second;
eq('4 pending run schrijft de nieuwste versie na de lopende write', writes, ['race:ifc-1', 'race:ifc-2']);
eq('5 dirty-race laat de nieuwe versie pas na zijn eigen write schoon markeren', marked, ['race', 'race']);

// Een fout gaat via de ene aanroeper terug; een volgende kandidaat mag niet stil worden overgeslagen.
writes = []; marked = []; failures = [];
const failing = createActualAutoSaveController({
  round: passThrough,
  listCandidates: () => [
    { id: 'kapot', content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: '/kapot.ifc' }, source: source(1) },
    { id: 'goed', content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: '/goed.ifc' }, source: source(1) },
  ],
  canWrite: async () => true,
  write: async candidate => { if (candidate.id === 'kapot') throw new Error('EACCES'); marked.push(candidate.id); return true; },
  onFailure: (c, e) => { failures.push(`${c.id}:${(e as Error).message}`); },
});
await failing.flush();
eq('6 fout wordt gemeld via de controller', failures, ['kapot:EACCES']);
eq('7 een fout blokkeert andere documenten niet', marked, ['goed']);
truthy('8 controller houdt geen stille, onafgehandelde write vast', !controller.isSaving());

failures = [];
const unavailable = createActualAutoSaveController({
  round: passThrough,
  listCandidates: () => [{ id: 'weg', content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: '/weg.ifc' }, source: source(1) }],
  canWrite: async () => true, write: async () => false,
  onFailure: (c, e) => {
    truthy('9a niet-schrijfbaar heeft een herkenbaar fouttype voor vertaling', e instanceof AutoSaveTargetUnavailableError);
    failures.push(`${c.id}:${(e as Error).message}`);
  },
});
await unavailable.flush();
eq('9 een niet-schrijfbaar bestaand doel blijft niet stil', failures, ['weg:The existing project file is not writable.']);

// De keuze is per geopend document, maar geen IFC- of recoveryveld. Een tabwissel mag hem dus
// niet laten lekken en een verse/herstelde payload begint veilig uit.
const S = () => useAppStore.getState();
S().newProject();
S().setFilePath('/tmp/a.ifc');
S().setAutoSaveToFile(true);
const docA = S().activeDocumentId;
const docB = S().newDocument();
eq('10 nieuw document erft AutoSave niet van het vorige tabblad', S().autoSaveToFile, false);
S().switchDocument(docA);
eq('11 terugwisselen herstelt de keuze van document A', S().autoSaveToFile, true);
S().switchDocument(docB);
eq('12 document B blijft eigen veilige default houden', S().autoSaveToFile, false);
eq('13 verse/recovery-onafhankelijke payload zet AutoSave uit', freshPayload().autoSaveToFile, false);

// Handmatige Opslaan en de timer delen één file-write-rij. Hiermee kan een timer nooit tijdens
// een open dialoog of lopende bestandswrite tegelijk naar hetzelfde project schrijven.
const writeOrder: string[] = [];
let releaseManual: (() => void) | null = null;
const manual = runProjectFileWrite(async () => {
  writeOrder.push('manual-start');
  await new Promise<void>(resolve => { releaseManual = resolve; });
  writeOrder.push('manual-eind');
}, () => undefined);
await Promise.resolve();
const automatic = runProjectFileWrite(async () => { writeOrder.push('auto'); }, () => undefined);
eq('14 een lopende handmatige write blokkeert de timer', isProjectFileWriteBusy(), true);
eq('15 file-writes lopen niet parallel', writeOrder, ['manual-start']);
const releaseManualWrite = releaseManual as (() => void) | null;
if (releaseManualWrite) releaseManualWrite();
await manual;
await automatic;
eq('16 de timer loopt pas na de handmatige write', writeOrder, ['manual-start', 'manual-eind', 'auto']);
eq('17 de coordinator geeft de write-poort daarna weer vrij', isProjectFileWriteBusy(), false);

// 18. (audit 2026-09-26) Inhoud gewijzigd tijdens het wachten ⇒ geen valse "niet schrijfbaar",
//     maar een tweede ronde met de actuele inhoud. Blijft hij stale, dan begrensd (geen lus).
{
  let version = 1;
  const staleWrites: string[] = [];
  const staleFailures: string[] = [];
  const staleMarked: string[] = [];
  let staleAnswers = 1;
  const staleController = createActualAutoSaveController({
    round: passThrough,
    listCandidates: () => [{ id: 'd', content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: '/d.ifc' }, source: source(version) }],
    canWrite: async () => true,
    write: async candidate => {
      staleWrites.push(`ifc-${(candidate.source as unknown as { project: { version: number } }).project.version}`);
      if (staleAnswers > 0) { staleAnswers--; version++; return 'stale'; }
      staleMarked.push(candidate.id);
      return true;
    },
    onFailure: (candidate, error) => { staleFailures.push(`${candidate.id}:${String(error)}`); },
  });
  await staleController.flush();
  eq('18a stale ⇒ geen foutmelding', staleFailures, []);
  eq('18b stale ⇒ tweede ronde schrijft de nieuwe inhoud', staleWrites, ['ifc-1', 'ifc-2']);
  eq('18c daarna schoon gemarkeerd', staleMarked, ['d']);
  staleWrites.length = 0; staleAnswers = 99;
  await staleController.flush();
  eq('18d aanhoudend stale is begrensd (1 + 3 rondes), geen eindeloze lus', staleWrites.length, 4);
  eq('18e ook dan geen valse foutmelding', staleFailures, []);
}

// 19. #804 stap 8: het ritme van een document met een gebouwmodel (besluit eigenaar 17 november 2026), met een nagebootste
//     klok: 30 s rust, uiterlijk 5 minuten na de eerste niet-opgeslagen wijziging, en een ondergrens van tien keer de duur
//     van de vorige ronde. Per document.
{
  eq('19a de rust is 30 s, de bovengrens 5 min, de ondergrens tien keer de rondeduur',
    [MODEL_AUTOSAVE_REST_MS, MODEL_AUTOSAVE_MAX_DELAY_MS, MODEL_AUTOSAVE_DUTY_FACTOR], [30_000, 300_000, 10]);
  let clock = 1_000_000;
  const rhythm = createModelAutoSaveRhythm(() => clock);
  const at = (ms: number) => { clock = 1_000_000 + ms; };
  // Elke wijziging is een nieuwe bron (andere takenlijst); `sameIFCSource` vergelijkt per veld op identiteit.
  const edit = () => ({ ...(source(1) as object), tasks: [] }) as never;
  rhythm.observe('m', edit(), true);
  eq('19b na één wijziging: aan de beurt na 30 s rust', rhythm.dueAt('m'), 1_000_000 + 30_000);
  at(29_999);
  eq('19c niet vóór de rust voorbij is', rhythm.isDue('m'), false);
  at(30_000);
  eq('19d na 30 s rust wel', rhythm.isDue('m'), true);
  // Onafgebroken doorwerken: elke 10 s een wijziging, dus nooit 30 s rust. Uiterlijk 5 minuten na de eerste.
  const busy = createModelAutoSaveRhythm(() => clock);
  at(0);
  busy.observe('m', edit(), true);
  let firstDue = -1;
  for (let t = 10_000; t <= 400_000; t += 10_000) {
    at(t);
    if (firstDue < 0 && busy.isDue('m')) firstDue = t;
    busy.observe('m', edit(), true);
  }
  eq('19e onafgebroken werk: precies na 5 minuten aan de beurt, niet eerder', firstDue, 300_000);
  // Dezelfde stand opnieuw gezien (een tabbladwissel, een UI-wijziging) is geen wijziging: de rust loopt door.
  const same = createModelAutoSaveRhythm(() => clock), stand = edit();
  at(0); same.observe('m', stand, true);
  at(20_000); same.observe('m', stand, true);
  eq('19f een herhaalde stand zonder wijziging verschuift de rust niet', same.dueAt('m'), 1_000_000 + 30_000);
  // De ondergrens: een ronde van 18 s; de volgende begint niet vóór 180 s na haar begin, ook al is er dan 30 s rust.
  const duty = createModelAutoSaveRhythm(() => clock);
  at(0); duty.observe('m', edit(), true);
  at(30_000); duty.roundStarted('m');
  at(40_000); duty.observe('m', edit(), true); // getypt tijdens de ronde
  at(48_000); duty.roundEnded('m', 'written');
  duty.observe('m', edit(), true); // nog gewijzigd: het latere werk staat er niet in
  eq('19g ondergrens: tien keer 18 s na het begin van de ronde', duty.dueAt('m'), 1_000_000 + 30_000 + 180_000);
  at(209_999);
  eq('19h niet vóór de ondergrens, ook niet na 30 s rust', duty.isDue('m'), false);
  at(210_000);
  eq('19i op de ondergrens wel', duty.isDue('m'), true);
  // Na een geslaagde ronde zonder latere wijziging: het document is schoon, dus niet aan de beurt.
  const clean = createModelAutoSaveRhythm(() => clock);
  at(0); clean.observe('m', edit(), true);
  at(30_000); clean.roundStarted('m'); at(31_000); clean.roundEnded('m', 'written');
  clean.observe('m', edit(), false);
  eq('19j schoon na de ronde: geen ronde gepland', [clean.dueAt('m'), clean.nextDueAt()], [null, null]);
  // Geweken voor een handmatige actie: opnieuw na de volgende rustperiode, ook als de bovengrens al voorbij is.
  const yielded = createModelAutoSaveRhythm(() => clock);
  at(0); yielded.observe('m', edit(), true);
  at(300_000); yielded.roundStarted('m'); at(301_000); yielded.roundEnded('m', 'yielded');
  eq('19k na wijken: niet vóór 30 s rust na het wijken', yielded.dueAt('m'), 1_000_000 + 331_000);
  // Per document: twee documenten met een eigen ritme; `nextDueAt` is het vroegste.
  const two = createModelAutoSaveRhythm(() => clock);
  at(0); two.observe('a', edit(), true);
  at(20_000); two.observe('b', edit(), true);
  eq('19l per document een eigen rust', [two.dueAt('a'), two.dueAt('b'), two.nextDueAt()],
    [1_030_000, 1_050_000, 1_030_000]);
  two.forget('a');
  eq('19m een gesloten document valt weg', [two.dueAt('a'), two.nextDueAt()], [null, 1_050_000]);
  // Fixronde 1 van de review van #1033: typen in een cel (nog niet vastgelegd) begint de rust opnieuw, maar is geen
  // wijziging: de bovengrens van 5 minuten telt door vanaf de eerste vastgelegde wijziging.
  const typing = createModelAutoSaveRhythm(() => clock);
  at(0); typing.observe('m', edit(), true);
  at(28_000); typing.touch('m');
  eq('19n typen na 28 s: op 30 s nog niet aan de beurt, wel 30 s na de laatste toets', [typing.isDue('m'), typing.dueAt('m')],
    [false, 1_058_000]);
  for (let t = 50_000; t <= 320_000; t += 20_000) { at(t); typing.touch('m'); }
  eq('19o onafgebroken typen: na 5 minuten toch aan de beurt', typing.dueAt('m'), 1_000_000 + 300_000);
  const cleanTyping = createModelAutoSaveRhythm(() => clock);
  at(0); cleanTyping.observe('m', edit(), false); cleanTyping.touch('m');
  eq('19p typen in een schoon document plant niets', cleanTyping.dueAt('m'), null);
  // De wekker telt alleen de documenten die meedoen (knownbug 1925).
  eq('19q nextDueAt met een filter', [two.nextDueAt(id => id !== 'b'), two.nextDueAt(id => id === 'b')], [null, 1_050_000]);
}

// 20. #804 stap 8: voorrang. Een wijkende ronde (Automatisch opslaan met een gebouwmodel) breekt af zodra een handmatige
//     schrijfactie om de rij vraagt of iemand op de rij wacht (een tabblad sluiten, de laatste fase van afsluiten of de
//     updater); de handmatige actie wacht dan alleen tot de ronde haar eigen afbraak afhandelt.
{
  const order: string[] = [];
  let reason: unknown;
  const round = runYieldingProjectFileWrite(async ({ yielded }) => {
    order.push('ronde-start');
    await new Promise<void>(resolve => yielded.addEventListener('abort', () => resolve(), { once: true }));
    reason = yielded.reason;
    order.push('ronde-geweken');
    return 'yielded';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  const manual = runProjectFileWrite(async () => { order.push('handmatig'); return 'ok'; }, () => 'dicht');
  eq('20a Ctrl+S breekt de rekenende ronde af en loopt meteen daarna', [await round, await manual, order],
    ['yielded', 'ok', ['ronde-start', 'ronde-geweken', 'handmatig']]);
  truthy('20b de reden is een wijking, geen fout', reason instanceof YieldedToManualWrite);
  // Wachten op de rij (sluiten van een tabblad) laat de ronde ook wijken.
  let waited = false;
  const closing = runYieldingProjectFileWrite(async ({ yielded }) => {
    await new Promise<void>(resolve => yielded.addEventListener('abort', () => resolve(), { once: true }));
    return 'geweken';
  }, () => 'dicht');
  await Promise.resolve();
  await whenProjectFileWritesIdle()?.then(() => { waited = true; });
  eq('20c een tabblad sluiten laat de ronde wijken', [await closing, waited], ['geweken', true]);
  // De laatste fase van afsluiten of de updater.
  const quitting = runYieldingProjectFileWrite(async ({ yielded }) => {
    await new Promise<void>(resolve => yielded.addEventListener('abort', () => resolve(), { once: true }));
    return 'geweken';
  }, () => 'dicht');
  await Promise.resolve();
  const reopen = await closeProjectFileWrites();
  eq('20d de laatste fase van afsluiten laat de ronde wijken', await quitting, 'geweken');
  reopen();
  // Een ronde die al plaatst, kijkt niet meer naar het signaal: de handmatige actie wacht op haar.
  const placing: string[] = [];
  let finishPlacing: (() => void) | null = null;
  const placeRound = runYieldingProjectFileWrite(async () => {
    placing.push('plaatsen');
    await new Promise<void>(resolve => { finishPlacing = resolve; });
    placing.push('geplaatst');
    return 'geschreven';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  const afterPlace = runProjectFileWrite(async () => { placing.push('handmatig'); return 'ok'; }, () => 'dicht');
  await Promise.resolve();
  eq('20e tijdens het plaatsen wacht de handmatige actie', placing, ['plaatsen']);
  (finishPlacing as (() => void) | null)?.();
  eq('20f daarna eerst de ronde, dan de handmatige actie', [await placeRound, await afterPlace, placing],
    ['geschreven', 'ok', ['plaatsen', 'geplaatst', 'handmatig']]);
  // Een gewone schrijfactie wijkt nooit: zij krijgt geen signaal en twee gewone acties wachten op elkaar (punt 14–16).
  truthy('20g de rij is daarna weer vrij', !isProjectFileWriteBusy());
}

/** Laat de coördinator nu een doorgang van Automatisch opslaan toe, dus maakt ze haar lijst (knownbug 1939)? De toelating
 *  is voor de gewone doorgang en de modeldoorgang dezelfde; een modeldoorgang wacht niet op een plek in de rij. */
const admitted = async () => {
  let listed = false;
  await runAutoSaveRound('model', async () => { listed = true; });
  return listed;
};
/** Een gewone tik zoals in productie: zijn write binnen een gewone doorgang (`runAutoSaveRound`). `listed` loopt waar de
 *  doorgang haar lijst maakt. Geeft de uitkomst van de write. */
const plainTick = async <T>(work: () => Promise<T>, closed: () => T, listed?: () => void): Promise<T | undefined> => {
  let result: T | undefined;
  await runAutoSaveRound('tick', async () => { listed?.(); result = await runAutoSaveTickWrite(work, closed); });
  return result;
};

// 21. De ene plek die de schrijfbeurten toewijst (fixronde 3 van de review van #1033): een gewone tik wacht achter een
//     modelronde en laat haar niet wijken; een handmatige actie wel. Na `pass()` plaatst de ronde en wacht een IFC-export
//     op haar (de plaatsing in zijn claim, `claimProjectFileWrite().placement`); een claim vóór de grens laat de ronde
//     wijken (`pass()` geeft false).
{
  const order: string[] = [];
  let toBoundary: (() => void) | null = null;
  let afterPass: (() => void) | null = null;
  let passed: boolean | null = null;
  let aborted = false;
  const round = runYieldingProjectFileWrite(async turn => {
    turn.yielded.addEventListener('abort', () => { aborted = true; }, { once: true });
    order.push('model-start');
    await new Promise<void>(resolve => { toBoundary = resolve; });
    passed = turn.pass();
    await new Promise<void>(resolve => { afterPass = resolve; });
    order.push('model-klaar');
    return 'geschreven';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  eq('21a een rekenende modelronde: de rij is bezet, Automatisch opslaan maakt zijn lijst',
    [isProjectFileWriteBusy(), await admitted()], [true, true]);
  const tick = plainTick(async () => { order.push('tik'); return 'ok'; }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  eq('21b een gewone tik laat de modelronde niet wijken en wacht', [aborted, order, await admitted()],
    [false, ['model-start'], true]);
  (toBoundary as (() => void) | null)?.();
  await Promise.resolve(); await Promise.resolve();
  // Een claim na de grens laat de ronde niet meer wijken; hij krijgt haar plaatsing mee.
  const exportClaim = claimProjectFileWrite();
  const settled = exportClaim.placement;
  eq('21c na de grens plaatst de ronde; de claim krijgt die plaatsing', [passed, settled instanceof Promise, aborted], [true, true, false]);
  let placementDone = false;
  void settled?.then(() => { placementDone = true; });
  await Promise.resolve();
  truthy('21d het plaatsen is nog niet af', !placementDone);
  (afterPass as (() => void) | null)?.();
  eq('21e de ronde schrijft, daarna direct de tik', [await round, await tick, order, await settled?.then(() => placementDone)],
    ['geschreven', 'ok', ['model-start', 'model-klaar', 'tik'], true]);
  exportClaim.release();
  const later = claimProjectFileWrite();
  later.release();
  eq('21f en de rij is weer vrij, zonder plaatsing', [isProjectFileWriteBusy(), later.placement === null], [false, true]);
  // Een claim (de export) vóór de grens: de ronde wijkt bij `pass()`.
  let reach: (() => void) | null = null;
  let passedAfterClaim: boolean | null = null;
  const claimed = runYieldingProjectFileWrite(async turn => {
    await new Promise<void>(resolve => { reach = resolve; });
    passedAfterClaim = turn.pass();
    return passedAfterClaim ? 'geschreven' : 'yielded';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  const claim = claimProjectFileWrite();
  (reach as (() => void) | null)?.();
  eq('21g een claim vóór de grens laat de ronde wijken; geen plaatsing', [await claimed, passedAfterClaim, claim.placement === null],
    ['yielded', false, true]);
  claim.release();
  // Een handmatige actie in de rij: Automatisch opslaan kiest deze keer geen kandidaten.
  let finishManual: (() => void) | null = null;
  const manualWrite = runProjectFileWrite(async () => { await new Promise<void>(resolve => { finishManual = resolve; }); return 'ok'; },
    () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  eq('21h een handmatige actie in de rij: Automatisch opslaan maakt geen lijst', await admitted(), false);
  (finishManual as (() => void) | null)?.();
  eq('21i daarna weer wel', [await manualWrite, await admitted()], ['ok', true]);
}

// 22. Knownbug 1939 en fixronde 2 van de review van #1093: de coördinator beslist over volgorde en toelating van
//     timerwerk. Eén rij op aankomst, zoals main: wie eerder om de rij vroeg, gaat eerder, ook een gewone doorgang die op
//     haar plek wacht (knownbug 1937 blijft daarom open); een begonnen beurt loopt af.
{
  const order: string[] = [];
  let finishModel: (() => void) | null = null;
  const model = runYieldingProjectFileWrite(async turn => {
    // Na de grens: de ronde plaatst en wijkt niet meer.
    turn.pass();
    await new Promise<void>(resolve => { finishModel = resolve; });
    order.push('model');
    return 'geschreven';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  const tick = plainTick(async () => { order.push('tik'); return 'ok'; }, () => 'dicht', () => order.push('lijst'));
  await Promise.resolve();
  const manualAfter = runProjectFileWrite(async () => { order.push('handmatig'); return 'ok'; }, () => 'dicht');
  await Promise.resolve();
  (finishModel as (() => void) | null)?.();
  // Twee meetpunten: de lijst en de write van de doorgang komen allebei vóór de handmatige actie die later kwam.
  eq('22a de doorgang die op haar plek wacht, maakt haar lijst en schrijft vóór een latere handmatige actie',
    [await model, await manualAfter, await tick, order], ['geschreven', 'ok', 'ok', ['model', 'lijst', 'tik', 'handmatig']]);
  // Een tik die al loopt, wordt niet onderbroken: de handmatige actie wacht erop (zoals main, knownbug 1904).
  const started: string[] = [];
  let finishTick: (() => void) | null = null;
  const running = plainTick(async () => {
    started.push('tik-start');
    await new Promise<void>(resolve => { finishTick = resolve; });
    started.push('tik-eind');
    return 'ok';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  const waiting = runProjectFileWrite(async () => { started.push('handmatig'); return 'ok'; }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  eq('22b een begonnen tik loopt af; de handmatige actie wacht', started, ['tik-start']);
  (finishTick as (() => void) | null)?.();
  eq('22b daarna de handmatige actie', [await running, await waiting, started], ['ok', 'ok', ['tik-start', 'tik-eind', 'handmatig']]);
  truthy('22b de rij is daarna weer vrij', !isProjectFileWriteBusy());
}

// 22c–22i. Knownbug 1938/1939: elke doorgang van de controller (één lijst plus haar writes) loopt via de coördinator
//     (`runAutoSaveRound`). Een gewone doorgang krijgt een plek in de rij, op volgorde van aankomst, maakt haar lijst pas
//     als die plek aan de beurt is, en houdt zolang ze loopt modelbeurten tegen; een handmatige actie mag ertussen, op
//     volgorde van aankomst met haar writes. De toelating geldt per doorgang, ook bij een herhaalronde.
{
  const turns = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); };
  const candidate = (id: string, version = 1): ActualAutoSaveCandidate =>
    ({ id, content: 0, enabled: true, dirty: true, ref: { kind: 'path', path: `/${id}.ifc` }, source: source(version) });
  const tickRound = (pass: () => Promise<void>) => runAutoSaveRound('tick', pass);
  const versionOf = (c: ActualAutoSaveCandidate) => (c.source as unknown as { project: { version: number } }).project.version;

  // 22c. De doorgang is open: haar eerste write is klaar, haar schrijftoestemming voor de tweede kandidaat wacht nog, en er
  //      wacht een modelbeurt. De tweede write komt vóór het model.
  const order: string[] = [];
  let allowSecond: (() => void) | null = null;
  const open = createActualAutoSaveController({
    round: tickRound,
    listCandidates: () => [candidate('a'), candidate('b')],
    canWrite: async ref => {
      if (ref.kind === 'path' && ref.path === '/b.ifc') await new Promise<void>(resolve => { allowSecond = resolve; });
      return true;
    },
    write: c => runAutoSaveTickWrite<ActualAutoSaveWrite>(async () => { order.push(c.id); return true; }, () => 'refused'),
    onFailure: () => {},
  });
  const openFlush = open.flush();
  await turns();
  const model = runYieldingProjectFileWrite(async () => { order.push('model'); return 'ok'; }, () => 'dicht');
  await turns();
  eq('22c terwijl de doorgang op haar tweede toestemming wacht, begint het model niet', order, ['a']);
  (allowSecond as (() => void) | null)?.();
  await openFlush;
  eq('22c de tweede write komt vóór het model', [await model, order], ['ok', ['a', 'b', 'model']]);

  // 22d. Een doorgang die achter een modelronde wacht, maakt haar lijst pas als ze aan de beurt is: de planner typte
  //      intussen, dus ze schrijft de actuele versie, niet die van het moment van aanvragen.
  let version = 1;
  const written: string[] = [];
  let finishModel: (() => void) | null = null;
  const placing = runYieldingProjectFileWrite(async turn => {
    turn.pass();
    await new Promise<void>(resolve => { finishModel = resolve; });
    return 'ok';
  }, () => 'dicht');
  await turns();
  const waiting = createActualAutoSaveController({
    round: tickRound,
    listCandidates: () => [candidate('d', version)],
    canWrite: async () => true,
    write: c => runAutoSaveTickWrite<ActualAutoSaveWrite>(async () => { written.push(`ifc-${versionOf(c)}`); return true; }, () => 'refused'),
    onFailure: () => {},
  });
  const waitingFlush = waiting.flush();
  await turns();
  version = 2;
  (finishModel as (() => void) | null)?.();
  await placing;
  await waitingFlush;
  eq('22d de doorgang maakt haar lijst bij haar beurt', written, ['ifc-2']);

  // 22e. Toelating per herhaalronde: terwijl een doorgang schrijft, komt een tik (die zet `pending`) en daarna een
  //      handmatige actie in de rij. De herhaalronde maakt dan geen lijst, zoals vóór stap 8 met een bezette rij.
  let lists = 0;
  let finishWrite: (() => void) | null = null;
  let finishManual: (() => void) | null = null;
  const repeat = createActualAutoSaveController({
    round: tickRound,
    listCandidates: () => { lists++; return [candidate('e')]; },
    canWrite: async () => true,
    write: () => runAutoSaveTickWrite<ActualAutoSaveWrite>(async () => {
      if (lists === 1) await new Promise<void>(resolve => { finishWrite = resolve; });
      return true;
    }, () => 'refused'),
    onFailure: () => {},
  });
  const firstFlush = repeat.flush();
  await turns();
  const secondFlush = repeat.flush();
  const manualWrite = runProjectFileWrite(async () => {
    await new Promise<void>(resolve => { finishManual = resolve; });
    return 'ok';
  }, () => 'dicht');
  await turns();
  (finishWrite as (() => void) | null)?.();
  await turns();
  eq('22e de herhaalronde maakt geen lijst terwijl een handmatige actie in de rij staat', lists, 1);
  (finishManual as (() => void) | null)?.();
  await manualWrite; await firstFlush; await secondFlush;
  eq('22e ook niet later in dezelfde run', [lists, isProjectFileWriteBusy()], [1, false]);

  // 22f. Knownbug 1813: een schrijftoestemming die blijft hangen binnen een open gewone doorgang houdt modelbeurten tegen,
  //      maar geen handmatige actie en niet het afsluiten (de doorgang kreeg haar plek meteen en houdt niets vast): een
  //      handmatige actie laat de modelronde wijken, en een geweken modelronde maakt haar beurt af zonder te schrijven,
  //      op haar plek in de rij (ze stond er eerder dan de handmatige actie).
  let releaseHang: (() => void) | null = null;
  const events: string[] = [];
  const hanging = createActualAutoSaveController({
    round: tickRound,
    listCandidates: () => [candidate('h')],
    canWrite: () => new Promise<boolean>(resolve => { releaseHang = () => resolve(true); }),
    write: c => runAutoSaveTickWrite<ActualAutoSaveWrite>(async () => { events.push(`tik ${c.id}`); return true; }, () => 'refused'),
    onFailure: () => {},
  });
  const hangingFlush = hanging.flush();
  await turns();
  const modelRound = () => runYieldingProjectFileWrite(async ({ yielded }) => {
    events.push(yielded.aborted ? 'model geweken' : 'model schrijft');
    return yielded.aborted ? 'yielded' : 'ok';
  }, () => 'dicht');
  const blocked = modelRound();
  await turns();
  eq('22f de modelronde wacht op de open doorgang', events, []);
  eq('22f een handmatige actie loopt ondanks de hangende vraag',
    await runProjectFileWrite(async () => { events.push('handmatig'); return 'ok'; }, () => 'dicht'), 'ok');
  eq('22f de modelronde week en maakte haar beurt af, vóór de handmatige actie die later kwam', [await blocked, events],
    ['yielded', ['model geweken', 'handmatig']]);
  const blockedAgain = modelRound();
  await turns();
  const reopen = await closeProjectFileWrites();
  eq('22f de laatste fase van afsluiten wacht niet op de hangende vraag', [await blockedAgain, events.at(-1)],
    ['yielded', 'model geweken']);
  (releaseHang as (() => void) | null)?.();
  await hangingFlush;
  reopen();
  eq('22f na het begin van de laatste fase schrijft de doorgang niets', [events.includes('tik h'), isProjectFileWriteBusy()],
    [false, false]);

  // 22g. Fixronde 1 van de review van #1093: een write die al om het slot vroeg, houdt zijn plek. Handmatige acties en de
  //      writes van de open gewone doorgang delen één rij, op volgorde van aankomst: een handmatige actie die er al stond,
  //      gaat vóór een write die later komt, en een write die al wacht, gaat vóór een handmatige actie die later komt.
  const arrival: string[] = [];
  let finishFirst: (() => void) | null = null;
  let finishEarlier: (() => void) | null = null;
  let secondAsked = false;
  const pass = runAutoSaveRound('tick', async () => {
    await runAutoSaveTickWrite(async () => {
      arrival.push('write 1');
      await new Promise<void>(resolve => { finishFirst = resolve; });
      return 'ok';
    }, () => 'dicht');
    secondAsked = true;
    await runAutoSaveTickWrite(async () => { arrival.push('write 2'); return 'ok'; }, () => 'dicht');
  });
  await turns();
  const manualFirst = runProjectFileWrite(async () => {
    arrival.push('handmatig 1');
    await new Promise<void>(resolve => { finishEarlier = resolve; });
    return 'ok';
  }, () => 'dicht');
  (finishFirst as (() => void) | null)?.();
  await turns();
  eq('22g de handmatige actie die er al stond, gaat vóór de write die later komt', [arrival, secondAsked],
    [['write 1', 'handmatig 1'], true]);
  const manualLater = runProjectFileWrite(async () => { arrival.push('handmatig 2'); return 'ok'; }, () => 'dicht');
  (finishEarlier as (() => void) | null)?.();
  await Promise.all([pass, manualFirst, manualLater]);
  eq('22g de write die al wachtte, gaat vóór de handmatige actie die later komt', [arrival, isProjectFileWriteBusy()],
    [['write 1', 'handmatig 1', 'write 2', 'handmatig 2'], false]);

  // 22h. Fixronde 2 van de review van #1093: de toelating zoals main. Een doorgang die al op haar plek wachtte toen een
  //      handmatige actie kwam, loopt (op main stond die tik al in de rij); een doorgang die pas om de rij vraagt terwijl
  //      een handmatige actie in de rij staat, maakt geen lijst.
  const admission: string[] = [];
  let finishPlacing: (() => void) | null = null;
  const placingModel = runYieldingProjectFileWrite(async turn => {
    turn.pass();
    await new Promise<void>(resolve => { finishPlacing = resolve; });
    admission.push('model');
    return 'ok';
  }, () => 'dicht');
  await turns();
  const waitingPass = runAutoSaveRound('tick', async () => { admission.push('lijst die wachtte'); });
  await turns();
  const queuedManual = runProjectFileWrite(async () => { admission.push('handmatig'); return 'ok'; }, () => 'dicht');
  await runAutoSaveRound('tick', async () => { admission.push('lijst die later vroeg'); });
  eq('22h een doorgang die pas vraagt terwijl een handmatige actie in de rij staat, maakt geen lijst', admission, []);
  (finishPlacing as (() => void) | null)?.();
  await Promise.all([placingModel, waitingPass, queuedManual]);
  eq('22h de doorgang die al op haar plek wachtte, maakt haar lijst, vóór de handmatige actie', admission,
    ['model', 'lijst die wachtte', 'handmatig']);

  // 22i. Een doorgang die op haar plek moest wachten, houdt bij haar beurt het slot vast tot haar eerste write: wat na haar
  //      om de rij vroeg, komt na die write. Blijft haar schrijftoestemming hangen, dan wacht de laatste fase van afsluiten
  //      daar niet op (knownbug 1813): de plek valt weg, de al toegelaten handmatige actie loopt af en de doorgang schrijft
  //      niets.
  const held: string[] = [];
  let finishHeldModel: (() => void) | null = null;
  let releaseHeld: (() => void) | null = null;
  const heldModel = runYieldingProjectFileWrite(async turn => {
    turn.pass();
    await new Promise<void>(resolve => { finishHeldModel = resolve; });
    return 'ok';
  }, () => 'dicht');
  await turns();
  const holding = createActualAutoSaveController({
    round: tickRound,
    listCandidates: () => [candidate('v')],
    canWrite: () => new Promise<boolean>(resolve => { releaseHeld = () => resolve(true); }),
    write: c => runAutoSaveTickWrite<ActualAutoSaveWrite>(async () => { held.push(`tik ${c.id}`); return true; }, () => 'refused'),
    onFailure: () => {},
  });
  const holdingFlush = holding.flush();
  await turns();
  const heldManual = runProjectFileWrite(async () => { held.push('handmatig'); return 'ok'; }, () => 'dicht');
  (finishHeldModel as (() => void) | null)?.();
  await heldModel;
  await turns();
  eq('22i de handmatige actie wacht op de eerste write van de doorgang die haar plek kreeg', [held, isProjectFileWriteBusy()],
    [[], true]);
  const closingReopen = await closeProjectFileWrites();
  eq('22i de laatste fase van afsluiten wacht niet op de hangende vraag; de toegelaten handmatige actie liep af',
    [await heldManual, held], ['ok', ['handmatig']]);
  (releaseHeld as (() => void) | null)?.();
  await holdingFlush;
  closingReopen();
  eq('22i de doorgang schreef niets', [held, isProjectFileWriteBusy()], [['handmatig'], false]);
}

if (diffs.length === 0) {
  console.log(`OK  actual-autosave-check: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  actual-autosave-check: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
