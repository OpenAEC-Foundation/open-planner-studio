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

const docRecord = (ifc: string, addedAt: number) => ({
  id: `${sid}::doc::A`, kind: 'doc', sessionId: sid, docId: 'A', ifc, addedAt,
});
idb.store('records').set(`${sid}::doc::A`, docRecord('ISO-10303-21; /* v1 */', 1));
idb.store('records').set(`${sid}::manifest`, {
  id: `${sid}::manifest`, kind: 'manifest', sessionId: sid, version: RECOVERY_MANIFEST_VERSION,
  activeDocumentId: 'A', addedAt: 1,
  documents: [{ id: 'A', ifc: `${sid}::doc::A`, filePath: null, isDirty: true, datesAsRecorded: false }],
});

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
