// Geweigerde webopslag voor crashherstel (issue #582). In de SuperCloud-werkplek draait de webbuild in
// een sandbox-iframe zonder `allow-same-origin`: de origin is opaque en `indexedDB.open` gooit een
// `SecurityError`. Crashherstel moet dan stil uitgaan voor deze sessie: geen melding, één consoleregel.
//
// Deel 1: de weigering bij het openen. Deel 2 (eigen proces, want de sessievlag blijft staan):
// `check-recovery-refused-transaction.ts`, de weigering bij de eerste transactie.
// Loopt door de publieke grens van `recoveryStore` en `notifyRecoveryError`.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import {
  clearOwnRecovery, clearRecovery, fullRecoverySave, holdRecoveryForLater, loadRecovery, saveRecovery,
  recoveryStorageUnavailable, RecoveryStorageUnavailableError,
} from '@/services/recovery/recoveryStore';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';
import { IndexedDbUpgradeBlockedError } from '@/utils/idb';
import type { NotifyInput } from '@/state/slices/types';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

// ── Omgeving: een opaque origin. IndexedDB, sessionStorage en Web Locks weigeren allemaal ──────────
const g = globalThis as unknown as Record<string, unknown>;
g.window = g.window ?? {};
let opens = 0;
g.indexedDB = {
  open: () => { opens++; throw new DOMException('Access is denied for this document.', 'SecurityError'); },
};
g.sessionStorage = {
  getItem: () => { throw new DOMException('sessionStorage geweigerd', 'SecurityError'); },
  setItem: () => { throw new DOMException('sessionStorage geweigerd', 'SecurityError'); },
  removeItem: () => { throw new DOMException('sessionStorage geweigerd', 'SecurityError'); },
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { locks: { request: () => Promise.reject(new DOMException('locks geweigerd', 'SecurityError')) } },
});
const infoLines: unknown[][] = [];
const errorLines: unknown[][] = [];
const originalInfo = console.info;
const originalError = console.error;
console.info = (...args: unknown[]) => { infoLines.push(args); };
console.error = (...args: unknown[]) => { errorLines.push(args); };

const doc = { id: 'A', ifc: 'ISO-10303-21; /* A */', filePath: null, isDirty: true, datesAsRecorded: false };

eq('R1 vóór de eerste poging is de opslag nog niet als geweigerd gemarkeerd', recoveryStorageUnavailable(), false);

// Opstarten: de herstelcontrole vindt niets en gooit niet.
const loadOutcome = await loadRecovery().then(
  (value) => ({ value, error: null as unknown }), (error: unknown) => ({ value: null, error }));
const loaded = loadOutcome.value;
eq('R2 loadRecovery gooit niet bij een geweigerde opslag', loadOutcome.error, null);
eq('R3 loadRecovery geeft een lege herstelset',
  loaded && { activeDocumentId: loaded.activeDocumentId, docs: loaded.docs.length, archives: loaded.archives.size },
  { activeDocumentId: null, docs: 0, archives: 0 });
eq('R4 de weigering zet de sessievlag', recoveryStorageUnavailable(), true);

// Schrijfronde: de aanroeper hoort dat er niets bewaard is.
const saveError: unknown = await saveRecovery(fullRecoverySave('A', [doc])).then(() => null, (error: unknown) => error);
eq('R5 saveRecovery gooit RecoveryStorageUnavailableError', saveError instanceof RecoveryStorageUnavailableError, true);

// Wissen, uitstellen en de schone desktopexit zijn stil een no-op.
const settled = async (run: () => Promise<void>) => run().then(() => 'ok', (error: unknown) => `fout: ${String(error)}`);
eq('R6 clearRecovery is een stille no-op', await settled(() => clearRecovery()), 'ok');
eq('R7 holdRecoveryForLater is een stille no-op', await settled(() => holdRecoveryForLater()), 'ok');
eq('R8 holdRecoveryForLater met ids is ook een stille no-op', await settled(() => holdRecoveryForLater(['A'])), 'ok');
eq('R9 clearOwnRecovery is een stille no-op', await settled(() => clearOwnRecovery()), 'ok');
eq('R10 een tweede start leest ook stil leeg', (await loadRecovery()).docs.length, 0);

eq('R11 na de weigering opent geen enkele actie IndexedDB opnieuw', opens, 1);
eq('R12 precies één consoleregel voor de hele sessie', infoLines.length, 1);
eq('R13 geen console.error', errorLines.length, 0);

// ── Meldingenkanaal: de weigering is afgehandeld zonder melding; de upgradeblokkade meldt nog ───────
const notices: NotifyInput[] = [];
const notify = (notice: NotifyInput) => { notices.push(notice); };
eq('N1 RecoveryStorageUnavailableError is afgehandeld', notifyRecoveryError(saveError, notify), true);
eq('N2 zonder melding', notices.length, 0);
eq('N3 ook een herhaalde ronde geeft geen melding', [notifyRecoveryError(new RecoveryStorageUnavailableError(), notify), notices.length], [true, 0]);
eq('N4 een gewone fout blijft bij zijn bestaande foutafhandeling', notifyRecoveryError(new Error('quota'), notify), false);
eq('N5 IndexedDbUpgradeBlockedError meldt nog wel',
  [notifyRecoveryError(new IndexedDbUpgradeBlockedError('ops-recovery', 3), notify), notices.map(n => n.messageKey)],
  [true, ['notifications.recoveryStorageBlocked']]);

console.info = originalInfo;
console.error = originalError;

if (diffs.length) {
  console.log(`XX  recovery-refused: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  recovery-refused: ${checks} checks — geweigerde IndexedDB zet crashherstel stil uit`);
