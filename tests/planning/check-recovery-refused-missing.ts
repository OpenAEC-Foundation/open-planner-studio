// Geweigerde webopslag voor crashherstel, deel "ontbreekt" (issue #582): `indexedDB` bestaat niet in
// deze browser of omgeving. Dat telt als weigering bij de start: crashherstel gaat stil uit.
// Eigen proces, want de sessievlag blijft de sessie lang staan; zie `check-recovery-refused.ts`.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import {
  clearRecovery, fullRecoverySave, holdRecoveryForLater, loadRecovery, saveRecovery,
  recoveryStorageUnavailable, RecoveryStorageUnavailableError,
} from '@/services/recovery/recoveryStore';
import { notifyRecoveryError } from '@/state/recoveryManifestNotice';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = g.window ?? {};
// Node kent geen `indexedDB`: niets installeren is precies deze variant.
eq('V0 voorwaarde: indexedDB ontbreekt', typeof (globalThis as { indexedDB?: unknown }).indexedDB, 'undefined');
const infoLines: unknown[][] = [];
const originalInfo = console.info;
console.info = (...args: unknown[]) => { infoLines.push(args); };

const doc = { id: 'A', ifc: 'ISO-10303-21; /* A */', filePath: null, isDirty: true, datesAsRecorded: false };
const caught = async (run: () => Promise<unknown>): Promise<unknown> => run().then(() => null, (error: unknown) => error);

const loaded = await loadRecovery();
eq('V1 loadRecovery geeft een lege herstelset', [loaded.activeDocumentId, loaded.docs.length, loaded.archives.size], [null, 0, 0]);
eq('V2 de weigering zet de sessievlag', recoveryStorageUnavailable(), true);
const refused = await caught(() => saveRecovery(fullRecoverySave('A', [doc])));
eq('V3 saveRecovery gooit RecoveryStorageUnavailableError', refused instanceof RecoveryStorageUnavailableError, true);
let notified = 0;
eq('V4 afgehandeld zonder melding', [notifyRecoveryError(refused, () => { notified++; }), notified], [true, 0]);
eq('V5 clearRecovery en holdRecoveryForLater zijn stil', [await caught(() => clearRecovery()), await caught(() => holdRecoveryForLater())], [null, null]);
eq('V6 precies één consoleregel', infoLines.length, 1);

console.info = originalInfo;

if (diffs.length) {
  console.log(`XX  recovery-refused-missing: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  recovery-refused-missing: ${checks} checks — ontbrekende indexedDB zet crashherstel stil uit`);
