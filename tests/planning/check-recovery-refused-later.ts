// Geweigerde webopslag voor crashherstel, deel "later" (issue #582, review PR #644): werkte de opslag
// in deze sessie al, dan zet een latere `SecurityError` crashherstel NIET stil uit. Die fout houdt de
// bestaande zichtbare foutroute: geen sessievlag, de fout zelf, `notifyRecoveryError` geeft `false`
// (dus de gewone melding `autoSaveFailed` in `useAutoSave`). Zie ook `check-recovery-refused*.ts`.
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
installFakeRecoveryIndexedDb({ onTransaction: () => { if (failTransaction) throw failTransaction(); } });
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
const security = () => new DOMException('Access is denied for this document.', 'SecurityError');
const isPlainSecurityError = (error: unknown) =>
  error instanceof DOMException && error.name === 'SecurityError' && !(error instanceof RecoveryStorageUnavailableError);

// De opstartcontrole slaagt: de opslag is bewezen.
eq('L1 voorwaarde: de opstartlezing slaagt', (await loadRecovery()).docs.length, 0);
await saveRecovery(fullRecoverySave('A', [doc]));
eq('L2 voorwaarde: een schrijfronde slaagt', (await loadRecovery()).docs.map(d => d.id), ['A']);

// Daarna weigert de browser alsnog: dat is een gewone, zichtbare fout.
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

// Herstelt de opslag zich, dan schrijft crashherstel gewoon weer.
failTransaction = null;
eq('L10 na herstel slaagt de volgende schrijfronde', await caught(() => saveRecovery(fullRecoverySave('A', [doc]))), null);

console.info = originalInfo;

if (diffs.length) {
  console.log(`XX  recovery-refused-later: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  recovery-refused-later: ${checks} checks — uitval ná werkende opslag blijft zichtbaar`);
