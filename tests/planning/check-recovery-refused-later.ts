import { spawnSync } from 'node:child_process';
import {
  clearRecovery, fullRecoverySave, holdRecoveryForLater, loadRecovery, saveRecovery,
  recoveryStorageUnavailable, RecoveryStorageUnavailableError,
} from '@/services/recovery/recoveryStore';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

const routes = ['read', 'save', 'both', 'overlap', 'fallback'] as const;
const route = process.argv[2];
if (!route) {
  for (const name of routes) {
    const child = spawnSync(process.execPath, [process.argv[1]!, name], { encoding: 'utf8', timeout: 20_000 });
    process.stdout.write(child.stdout ?? '');
    process.stderr.write(child.stderr ?? '');
    if (child.error || child.status !== 0 || !child.stdout?.includes(`OK  recovery-refused-later/${name}:`)) {
      console.error(`XX  recovery-refused-later: route ${name}`, child.error ?? child.status);
      process.exit(1);
    }
  }
  console.log('OK  recovery-refused-later: vijf geïsoleerde routes groen');
  process.exit(0);
}
if (!routes.some(name => name === route)) throw new Error(`Onbekende route: ${route}`);

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

let failTransaction: (() => Error) | null = null;
let failRead = route === 'fallback';
let transactions = 0;
installFakeRecoveryIndexedDb({
  onTransaction: () => { transactions++; if (failTransaction) throw failTransaction(); },
  onRead: () => { if (failRead) throw new Error('Tijdelijke leesfout, geen opslagweigering'); },
});
let releaseClaim: (() => void) | undefined;
let claims = 0;
const session = new Map<string, string>();
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => { session.set(k, v); },
  removeItem: (k: string) => { session.delete(k); },
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { locks: { request: (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
    claims++;
    if (route === 'overlap' && !releaseClaim) releaseClaim = () => { callback({ name }); };
    else callback({ name });
    return Promise.resolve();
  } } },
});
const infoLines: unknown[][] = [];
const originalInfo = console.info;
console.info = (...args: unknown[]) => { infoLines.push(args); };

const doc = { id: 'A', ifc: 'ISO-10303-21; /* A */', filePath: null, isDirty: true, datesAsRecorded: false };
const caught = async (run: () => Promise<unknown>): Promise<unknown> => run().then(() => null, (error: unknown) => error);
const security = () => new DOMException('Access is denied for this document.', 'SecurityError');
const isPlainSecurityError = (error: unknown) =>
  error instanceof DOMException && error.name === 'SecurityError' && !(error instanceof RecoveryStorageUnavailableError);

if (route === 'read' || route === 'both' || route === 'fallback') {
  eq('L1 opstartlezing levert leeg', (await loadRecovery()).docs.length, 0);
}
if (route === 'save' || route === 'both') {
  eq('L2 schrijfronde slaagt zonder aanvullende lezing', await caught(() => saveRecovery(fullRecoverySave('A', [doc]))), null);
}
if (route === 'both') eq('L2c opgeslagen document wordt teruggelezen', (await loadRecovery()).docs.map(d => d.id), ['A']);
if (route === 'overlap') {
  let loaded = false;
  let saved = false;
  const reading = loadRecovery().then(() => { loaded = true; });
  const writing = saveRecovery(fullRecoverySave('A', [doc])).then(() => { saved = true; });
  await new Promise<void>(resolve => { setImmediate(resolve); });
  eq('O1 beide acties wachten op de claim', [loaded, saved, typeof releaseClaim], [false, false, 'function']);
  eq('O1b lezen en opslaan delen precies één lockaanvraag', claims, 1);
  eq('O1c geen IndexedDB-transactie vóór de claim is vrijgegeven', transactions, 0);
  releaseClaim!();
  await Promise.all([reading, writing]);
  eq('O2 beide overlappende acties ronden af', [loaded, saved], [true, true]);
  eq('O2b na afronden nog steeds dezelfde ene claim', claims, 1);
}
eq('L2b vóór de weigering staat crashherstel niet uit', recoveryStorageUnavailable(), false);
failRead = false;
if (route === 'fallback') {
  failTransaction = security;
  const refused = await caught(() => saveRecovery(fullRecoverySave('A', [doc])));
  eq('F1 volgende SecurityError is nog een eerste weigering', refused instanceof RecoveryStorageUnavailableError, true);
  eq('F2 die eerste weigering zet de sessievlag', recoveryStorageUnavailable(), true);
  let notified = 0;
  eq('F3 stille afhandeling zonder gewone foutmelding', [notifyRecoveryError(refused, () => { notified++; }), notified], [true, 0]);
  eq('F4 precies één consoleregel', infoLines.length, 1);
} else {
  failTransaction = security;
  const later = await caught(() => saveRecovery(fullRecoverySave('A', [doc])));
  eq('L3 saveRecovery geeft de SecurityError zelf door', isPlainSecurityError(later), true);
  eq('L4 geen sessievlag', recoveryStorageUnavailable(), false);
  let notified = 0;
  eq('L5 notifyRecoveryError laat hem aan de gewone foutroute', [notifyRecoveryError(later, () => { notified++; }), notified], [false, 0]);
  eq('L6 clearRecovery geeft de fout door', isPlainSecurityError(await caught(() => clearRecovery())), true);
  eq('L7 holdRecoveryForLater geeft de fout door', isPlainSecurityError(await caught(() => holdRecoveryForLater())), true);
  eq('L8 nog steeds geen sessievlag', recoveryStorageUnavailable(), false);
  eq('L9 geen consoleregel over uitgezet crashherstel', infoLines.length, 0);

  failTransaction = null;
  eq('L10 na herstel slaagt de volgende schrijfronde', await caught(() => saveRecovery(fullRecoverySave('A', [doc]))), null);

}
console.info = originalInfo;

if (diffs.length) {
  console.log(`XX  recovery-refused-later/${route}: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  recovery-refused-later/${route}: ${checks} checks — opslagbewijs en foutclassificatie`);
