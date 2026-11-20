// Contract voor echt automatisch opslaan. Deze test gebruikt geen browser- of Tauri-I/O:
// de controller krijgt die randen geïnjecteerd, zodat timing, single-flight en de dirty-race
// deterministisch bewaakt blijven.
import { AutoSaveTargetUnavailableError, actualAutoSaveDelay, createActualAutoSaveController, type ActualAutoSaveCandidate } from '@/services/actualAutosave/actualAutoSave';
import { useAppStore } from '@/state/appStore';
import { freshPayload } from '@/state/documentContract';
import {
  claimProjectFileWrite, closeProjectFileWrites, isProjectFileWriteBusy, isProjectFileWriteHeld, runProjectFileWrite,
  runYieldingProjectFileWrite, whenProjectFilePlacementsSettled, whenProjectFileWritesIdle,
  YieldedToManualWrite,
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

const controller = createActualAutoSaveController({
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

// 21. Fixronde 2 van de review van #1033: een wijkende ronde vóór haar grens houdt de rij niet vast (een gewoon document
//     schrijft op zijn eigen tik, zoals main), na `pass()` wel; een IFC-export wacht op een ronde die al plaatst
//     (`whenProjectFilePlacementsSettled`), en een ronde die bij haar grens een claim ziet, wijkt (`pass()` geeft false).
{
  let toBoundary: (() => void) | null = null;
  let afterPass: (() => void) | null = null;
  let passed: boolean | null = null;
  const round = runYieldingProjectFileWrite(async turn => {
    await new Promise<void>(resolve => { toBoundary = resolve; });
    passed = turn.pass();
    await new Promise<void>(resolve => { afterPass = resolve; });
    return 'geschreven';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  eq('21a een rekenende ronde is bezig, maar houdt de rij niet vast', [isProjectFileWriteBusy(), isProjectFileWriteHeld(),
    whenProjectFilePlacementsSettled()], [true, false, null]);
  (toBoundary as (() => void) | null)?.();
  await Promise.resolve(); await Promise.resolve();
  const settled = whenProjectFilePlacementsSettled();
  eq('21b na de grens houdt zij de rij vast en plaatst zij', [passed, isProjectFileWriteHeld(), settled !== null],
    [true, true, true]);
  let placementsDone = false;
  void settled?.then(() => { placementsDone = true; });
  await Promise.resolve();
  truthy('21c het plaatsen is nog niet af', !placementsDone);
  (afterPass as (() => void) | null)?.();
  eq('21d de ronde schrijft en het plaatsen is daarna af', [await round, await settled?.then(() => placementsDone)],
    ['geschreven', true]);
  eq('21e en de rij is weer vrij', [isProjectFileWriteBusy(), isProjectFileWriteHeld(), whenProjectFilePlacementsSettled()],
    [false, false, null]);
  // Een claim (de export) vóór de grens: de ronde wijkt bij `pass()`.
  let reach: (() => void) | null = null;
  let passedAfterClaim: boolean | null = null;
  const claimed = runYieldingProjectFileWrite(async turn => {
    await new Promise<void>(resolve => { reach = resolve; });
    passedAfterClaim = turn.pass();
    return passedAfterClaim ? 'geschreven' : 'yielded';
  }, () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  const release = claimProjectFileWrite();
  (reach as (() => void) | null)?.();
  eq('21f een claim vóór de grens laat de ronde wijken', [await claimed, passedAfterClaim, whenProjectFilePlacementsSettled()],
    ['yielded', false, null]);
  release();
  // Een gewone schrijfactie houdt de rij vast zolang zij loopt of wacht.
  let finishPlain: (() => void) | null = null;
  const plain = runProjectFileWrite(async () => { await new Promise<void>(resolve => { finishPlain = resolve; }); return 'ok'; },
    () => 'dicht');
  await Promise.resolve(); await Promise.resolve();
  truthy('21g een gewone schrijfactie houdt de rij vast', isProjectFileWriteHeld());
  (finishPlain as (() => void) | null)?.();
  eq('21h en laat haar daarna los', [await plain, isProjectFileWriteHeld()], ['ok', false]);
}

if (diffs.length === 0) {
  console.log(`OK  actual-autosave-check: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  actual-autosave-check: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
