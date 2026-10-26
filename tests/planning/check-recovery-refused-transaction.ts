// Geweigerde webopslag voor crashherstel, deel 2 (issue #582): `indexedDB.open` slaagt, maar de eerste
// transactie gooit een `SecurityError`. Ook dan gaat crashherstel stil uit voor deze sessie. Een
// gewone transactiefout (bijv. quota) houdt haar bestaande route. Deel 1, de weigering bij het openen,
// staat in `check-recovery-refused.ts`; een eigen proces, want de sessievlag blijft de sessie lang staan.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import {
  clearRecovery, fullRecoverySave, holdRecoveryForLater, loadRecovery, saveRecovery,
  recoveryStorageUnavailable, RecoveryStorageUnavailableError,
} from '@/services/recovery/recoveryStore';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

let failTransaction: (() => Error) | null = null;
let transactions = 0;
installFakeRecoveryIndexedDb({ onTransaction: () => {
  transactions++;
  if (failTransaction) throw failTransaction();
} });
const session = new Map<string, string>();
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => { session.set(k, v); },
  removeItem: (k: string) => { session.delete(k); },
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { locks: { request: (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
    callback({ name });
    return Promise.resolve();
  } } },
});
const infoLines: unknown[][] = [];
const originalInfo = console.info;
console.info = (...args: unknown[]) => { infoLines.push(args); };

const doc = (id: string) => ({ id, ifc: `ISO-10303-21; /* ${id} */`, filePath: null, isDirty: true, datesAsRecorded: false });
const caught = async (run: () => Promise<unknown>): Promise<unknown> => run().then(() => null, (error: unknown) => error);

// Een gezonde start: de opslag werkt.
await saveRecovery(fullRecoverySave('A', [doc('A')]));
eq('T1 voorwaarde: een gezonde schrijfronde slaagt', (await loadRecovery()).docs.map(d => d.id), ['A']);

// Een gewone transactiefout houdt de bestaande route: de fout zelf, geen sessievlag.
failTransaction = () => new Error('Gesimuleerde quotafout');
const quota = await caught(() => saveRecovery(fullRecoverySave('A', [doc('A')])));
eq('T2 een gewone fout blijft dezelfde fout', quota instanceof Error && !(quota instanceof RecoveryStorageUnavailableError) && quota.message, 'Gesimuleerde quotafout');
eq('T3 een gewone fout zet de sessievlag niet', recoveryStorageUnavailable(), false);
eq('T4 en blijft bij de bestaande meldingsroute', notifyRecoveryError(quota, () => undefined), false);

// De eerste transactie wordt geweigerd: crashherstel gaat stil uit.
failTransaction = () => new DOMException('Access is denied for this document.', 'SecurityError');
const refused = await caught(() => saveRecovery(fullRecoverySave('A', [doc('A')])));
eq('T5 saveRecovery gooit RecoveryStorageUnavailableError', refused instanceof RecoveryStorageUnavailableError, true);
eq('T6 de weigering zet de sessievlag', recoveryStorageUnavailable(), true);
let notified = 0;
eq('T7 de weigering is afgehandeld zonder melding', [notifyRecoveryError(refused, () => { notified++; }), notified], [true, 0]);

const before = transactions;
eq('T8 loadRecovery geeft een lege herstelset', (await loadRecovery()).docs.length, 0);
eq('T9 clearRecovery is een stille no-op', await caught(() => clearRecovery()), null);
eq('T10 holdRecoveryForLater is een stille no-op', await caught(() => holdRecoveryForLater()), null);
eq('T11 een volgende schrijfronde gooit dezelfde stille fout',
  (await caught(() => saveRecovery(fullRecoverySave('A', [doc('A')])))) instanceof RecoveryStorageUnavailableError, true);
eq('T12 na de weigering opent geen actie nog een transactie', transactions, before);
eq('T13 precies één consoleregel voor de hele sessie', infoLines.length, 1);

console.info = originalInfo;

if (diffs.length) {
  console.log(`XX  recovery-refused-transaction: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  recovery-refused-transaction: ${checks} checks — geweigerde eerste transactie zet crashherstel stil uit`);
