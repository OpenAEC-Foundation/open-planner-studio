// Contract voor echt automatisch opslaan. Deze test gebruikt geen browser- of Tauri-I/O:
// de controller krijgt die randen geïnjecteerd, zodat timing, single-flight en de dirty-race
// deterministisch bewaakt blijven.
import { actualAutoSaveDelay, createActualAutoSaveController, type ActualAutoSaveCandidate } from '@/services/actualAutosave/actualAutoSave';
import { useAppStore } from '@/state/appStore';
import { freshPayload } from '@/state/documentContract';
import { isProjectFileWriteBusy, runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';

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
  serialize: candidate => `ifc-${(candidate.source as unknown as { project: { version: number } }).project.version}`,
  canWrite: async () => true,
  write: async (candidate, content) => {
    writes.push(`${candidate.id}:${content}`);
    if (blockWrites) await new Promise<void>(resolve => { releaseWrite = resolve; });
    return true;
  },
  markSavedIfUnchanged: (candidate) => { marked.push(candidate.id); },
  onFailure: (candidate, error) => { failures.push(`${candidate.id}:${String(error)}`); },
});

eq('0a throttle laat de eerste write direct toe', actualAutoSaveDelay(0, 25_000), 0);
eq('0b throttle wacht alleen de resterende tijd', actualAutoSaveDelay(20_000, 25_000), 5_000);

// Recovery is een andere laag: alleen kandidaten met enabled + bestaand schrijfdoel worden hier
// aangeraakt. Een naamloos document blijft dus wel recovery krijgen, maar geen echte overschrijving.
candidates = [
  { id: 'naamloos', enabled: true, dirty: true, ref: null, source: source(1) },
  { id: 'uit', enabled: false, dirty: true, ref: { kind: 'path', path: '/uit.ifc' }, source: source(1) },
  { id: 'aan', enabled: true, dirty: true, ref: { kind: 'path', path: '/aan.ifc' }, source: source(2) },
];
await controller.flush();
eq('1 echte autosave slaat alleen enabled bestaand bestand op', writes, ['aan:ifc-2']);
eq('2 alleen de werkelijk geschreven versie wordt schoon gemarkeerd', marked, ['aan']);

// Een schrijfbeurt mag nooit parallel lopen. Een tweede aanvraag tijdens de eerste onthoudt de
// nieuwste run; pas ná de write volgt precies één vervolgrun.
writes = []; marked = []; blockWrites = true;
candidates = [{ id: 'race', enabled: true, dirty: true, ref: { kind: 'path', path: '/race.ifc' }, source: source(1) }];
const first = controller.flush();
for (let i = 0; i < 4 && !releaseWrite; i++) await Promise.resolve();
const second = controller.flush();
for (let i = 0; i < 4 && writes.length === 0; i++) await Promise.resolve();
eq('3 single-flight: tweede run start niet parallel', writes, ['race:ifc-1']);
candidates = [{ id: 'race', enabled: true, dirty: true, ref: { kind: 'path', path: '/race.ifc' }, source: source(2) }];
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
    { id: 'kapot', enabled: true, dirty: true, ref: { kind: 'path', path: '/kapot.ifc' }, source: source(1) },
    { id: 'goed', enabled: true, dirty: true, ref: { kind: 'path', path: '/goed.ifc' }, source: source(1) },
  ],
  serialize: () => 'ifc', canWrite: async () => true,
  write: async candidate => { if (candidate.id === 'kapot') throw new Error('EACCES'); return true; },
  markSavedIfUnchanged: c => { marked.push(c.id); },
  onFailure: (c, e) => { failures.push(`${c.id}:${(e as Error).message}`); },
});
await failing.flush();
eq('6 fout wordt gemeld via de controller', failures, ['kapot:EACCES']);
eq('7 een fout blokkeert andere documenten niet', marked, ['goed']);
truthy('8 controller houdt geen stille, onafgehandelde write vast', !controller.isSaving());

failures = [];
const unavailable = createActualAutoSaveController({
  listCandidates: () => [{ id: 'weg', enabled: true, dirty: true, ref: { kind: 'path', path: '/weg.ifc' }, source: source(1) }],
  serialize: () => 'ifc', canWrite: async () => true, write: async () => false,
  markSavedIfUnchanged: () => { throw new Error('mag niet schoon worden'); },
  onFailure: (c, e) => { failures.push(`${c.id}:${(e as Error).message}`); },
});
await unavailable.flush();
eq('9 een niet-schrijfbaar bestaand doel blijft niet stil', failures, ['weg:Het bestaande projectbestand is niet schrijfbaar.']);

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
});
await Promise.resolve();
const automatic = runProjectFileWrite(async () => { writeOrder.push('auto'); });
eq('14 een lopende handmatige write blokkeert de timer', isProjectFileWriteBusy(), true);
eq('15 file-writes lopen niet parallel', writeOrder, ['manual-start']);
const releaseManualWrite = releaseManual as (() => void) | null;
if (releaseManualWrite) releaseManualWrite();
await manual;
await automatic;
eq('16 de timer loopt pas na de handmatige write', writeOrder, ['manual-start', 'manual-eind', 'auto']);
eq('17 de coordinator geeft de write-poort daarna weer vrij', isProjectFileWriteBusy(), false);

if (diffs.length === 0) {
  console.log(`OK  actual-autosave-check: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  actual-autosave-check: ${diffs.length} afwijking(en) van ${checks}`);
for (const diff of diffs) console.log(`   - ${diff}`);
process.exit(1);
