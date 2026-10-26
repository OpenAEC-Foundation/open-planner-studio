// Geweigerde webopslag voor crashherstel, deel 2 (issue #582): `indexedDB.open` slaagt, maar de eerste
// transactie gooit een `SecurityError`. Ook dan gaat crashherstel stil uit voor deze sessie.
// Andere delen, elk in een eigen proces want de sessievlag blijft de sessie lang staan:
// `check-recovery-refused.ts` (weigering bij openen), `-missing.ts` (`indexedDB` ontbreekt),
// `-getter.ts` (lezen van `indexedDB` gooit) en `-later.ts` (uitval ná werkende opslag blijft zichtbaar).
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

// Transactie 1 en 2 horen bij het openen: de versionchange-transactie van de dubbel en de indexcontrole
// in `openDbStores`. Die slagen. Elke volgende transactie, dus de eerste echte lezing van
// crashherstel, wordt geweigerd.
let transactions = 0;
installFakeRecoveryIndexedDb({ onTransaction: () => {
  transactions++;
  if (transactions > 2) throw new DOMException('Access is denied for this document.', 'SecurityError');
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

const doc = { id: 'A', ifc: 'ISO-10303-21; /* A */', filePath: null, isDirty: true, datesAsRecorded: false };
const caught = async (run: () => Promise<unknown>): Promise<unknown> => run().then(() => null, (error: unknown) => error);

// Opstarten: de eerste transactie wordt geweigerd.
const loaded = await loadRecovery();
eq('T1 loadRecovery geeft een lege herstelset', [loaded.activeDocumentId, loaded.docs.length, loaded.archives.size], [null, 0, 0]);
eq('T2 de geweigerde eerste transactie zet de sessievlag', recoveryStorageUnavailable(), true);
eq('T3 het openen slaagde; de eerste echte transactie werd geweigerd', transactions, 3);

const refused = await caught(() => saveRecovery(fullRecoverySave('A', [doc])));
eq('T4 saveRecovery gooit RecoveryStorageUnavailableError', refused instanceof RecoveryStorageUnavailableError, true);
let notified = 0;
eq('T5 de weigering is afgehandeld zonder melding', [notifyRecoveryError(refused, () => { notified++; }), notified], [true, 0]);
eq('T6 clearRecovery is een stille no-op', await caught(() => clearRecovery()), null);
eq('T7 holdRecoveryForLater is een stille no-op', await caught(() => holdRecoveryForLater()), null);
eq('T8 na de weigering opent geen actie nog een transactie', transactions, 3);
eq('T9 precies één consoleregel voor de hele sessie', infoLines.length, 1);

console.info = originalInfo;

if (diffs.length) {
  console.log(`XX  recovery-refused-transaction: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  recovery-refused-transaction: ${checks} checks — geweigerde eerste transactie zet crashherstel stil uit`);
