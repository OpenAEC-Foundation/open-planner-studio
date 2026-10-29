// Knownbug 373: een synchrone Web Locks-fout is geen bewijs dat IndexedDB geweigerd is.
// Elk scenario heeft een eigen proces omdat de sessieclaim module-lokaal wordt onthouden.
import { spawnSync } from 'node:child_process';
import { fullRecoverySave, loadRecovery, recoveryStorageUnavailable, saveRecovery } from '@/services/recovery/recoveryStore';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

const routes = ['getter', 'request', 'reject', 'occupied', 'missing', 'granted'] as const;
const route = process.argv[2];
if (!route) {
  let failed = false;
  for (const name of routes) {
    const child = spawnSync(process.execPath, [process.argv[1]!, name], { encoding: 'utf8', timeout: 20_000 });
    process.stdout.write(child.stdout ?? '');
    process.stderr.write(child.stderr ?? '');
    if (child.error || child.status !== 0 || !child.stdout?.includes(`OK  recovery-lock-refusal/${name}:`)) {
      console.error(`XX  recovery-lock-refusal: route ${name}`, child.error ?? child.status);
      failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}
if (!routes.some(name => name === route)) throw new Error(`Onbekende route: ${route}`);
let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
let transactions = 0;
installFakeRecoveryIndexedDb({ onTransaction: () => { transactions++; } });
const oldId = 'gekopieerde-sessie';
const session = new Map([['ops-recovery-session', oldId]]);
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => { session.set(key, value); },
  removeItem: (key: string) => { session.delete(key); },
} });
const security = () => new DOMException('Web Locks geweigerd', 'SecurityError');
let claims = 0;
const locks = { request: (_name: string, _options: unknown, callback: (lock: object | null) => unknown) => {
  claims++;
  if (route === 'request') throw security();
  if (route === 'reject') return Promise.reject(security());
  callback(route === 'occupied' ? null : {});
  return Promise.resolve();
} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  get locks() {
    if (route === 'getter') { claims++; throw security(); }
    return route === 'missing' ? undefined : locks;
  },
} });
const messages: unknown[][] = [];
const info = console.info;
console.info = (...args: unknown[]) => { messages.push(args); };
const loaded = await loadRecovery();
const rotated = route !== 'missing' && route !== 'granted';
eq('opstarten geeft lege herstelset', loaded.docs.length, 0);
eq('IndexedDB werd werkelijk benaderd', transactions > 0, true);
eq('crashherstel blijft beschikbaar', recoveryStorageUnavailable(), false);
eq('bij onzekere claim wordt het geërfde id niet hergebruikt', session.get('ops-recovery-session') !== oldId, rotated);
eq('claim heeft bestaande retry en nieuwe-id-poging', claims, route === 'missing' ? 0 : rotated ? 3 : 1);
const doc = { id: 'A', ifc: 'ISO-10303-21; /* lock test */', filePath: null, isDirty: true, datesAsRecorded: false };
let saveError: unknown = null;
try { await saveRecovery(fullRecoverySave('A', [doc])); } catch (error) { saveError = error; }
eq('opslaan blijft mogelijk', saveError, null);
eq('opgeslagen hersteldata komt terug', (await loadRecovery()).docs.map(d => d.ifc), [doc.ifc]);
eq('geen melding dat IndexedDB is uitgezet', messages.length, 0);
console.info = info;
if (diffs.length) {
  console.log(`XX  recovery-lock-refusal/${route}: ${diffs.length} van ${checks} checks FOUT`);
  for (const diff of diffs) console.log(`    - ${diff}`);
  process.exit(1);
}
console.log(`OK  recovery-lock-refusal/${route}: ${checks} checks`);
