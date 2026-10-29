// Web-crashherstel leest de herstelset pas NA de sessieclaims (review PR #644, ronde 2). Scenario: tab B
// is een duplicaat van A en erft het sessie-id. B wacht op de sessielock (één retry van 150 ms). Intussen
// schrijft A een nieuwere snapshot en sluit. B krijgt de lock en moet die nieuwere snapshot herstellen;
// een read vóór de claim gaf de oude, en het latere `clearRecovery()` wiste dan ook de nieuwe.
// Eigen proces: de sessie-id wordt per module één keer uitgerekend.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { loadRecovery, RECOVERY_MANIFEST_VERSION } from '@/services/recovery/recoveryStore';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const idb = installFakeRecoveryIndexedDb();
const sid = 'sessie-a';
const session = new Map<string, string>([['ops-recovery-session', sid]]);
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => { session.set(k, v); },
  removeItem: (k: string) => { session.delete(k); },
};

// Tab A liet v1 achter (geërfd sessie-id).
const docRecord = (ifc: string, addedAt: number) => ({
  id: `${sid}::doc::A`, kind: 'doc', sessionId: sid, docId: 'A', ifc, addedAt,
});
idb.store('records').set(`${sid}::doc::A`, docRecord('ISO-10303-21; /* v1 */', 1));
idb.store('records').set(`${sid}::manifest`, {
  id: `${sid}::manifest`, kind: 'manifest', sessionId: sid, version: RECOVERY_MANIFEST_VERSION,
  activeDocumentId: 'A', addedAt: 1,
  documents: [{ id: 'A', ifc: `${sid}::doc::A`, filePath: null, isDirty: true, datesAsRecorded: false }],
});

// De eerste claim is nog bezet door A. Tijdens die wachttijd schrijft A v2 en sluit; de retry slaagt.
let claims = 0;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { locks: { request: (name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
    claims++;
    if (claims === 1) {
      idb.store('records').set(`${sid}::doc::A`, docRecord('ISO-10303-21; /* v2 */', 2));
      callback(null);
    } else callback({ name });
    return Promise.resolve();
  } } },
});

const loaded = await loadRecovery();
eq('C1 het tabblad houdt het geërfde sessie-id na de geslaagde retry', session.get('ops-recovery-session'), sid);
eq('C2 loadRecovery geeft de snapshot die er na de verkregen lock staat', loaded.docs.map(d => d.ifc), ['ISO-10303-21; /* v2 */']);

if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);

if (diffs.length) {
  console.log(`XX  recovery-web-claim-order: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  recovery-web-claim-order: ${checks} checks — herstelread pas na de sessieclaim`);
