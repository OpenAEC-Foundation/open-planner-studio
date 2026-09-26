// Web-crashherstel "later" (audit 2026-09-26): kiest de gebruiker in het herstel-venster voor
// uitstellen, dan moeten de gevonden snapshots de volgende crashherstel-rondes overleven. Op het web
// deelt een herlaad dezelfde sessie-id; `saveWeb` overschreef daardoor het manifest en wiste elk
// documentrecord dat niet meer open was — precies de uitgestelde snapshots.
// Loopt door de publieke grens van `recoveryStore` tegen een minimale IndexedDB-/sessionStorage-dubbel.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { clearRecovery, fullRecoverySave, holdRecoveryForLater, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const idbRecords = new Map<string, unknown>();
const fakeDb = {
  objectStoreNames: { contains: () => true },
  createObjectStore: () => undefined,
  close: () => undefined,
  onversionchange: null as (() => void) | null,
  transaction: () => {
    const tx = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null,
      objectStore: () => ({
        getAll: () => {
          const request = { result: [] as unknown[], error: null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
          queueMicrotask(() => { request.result = [...idbRecords.values()]; request.onsuccess?.(); });
          return request;
        },
        put: (value: { id: string }) => { idbRecords.set(value.id, structuredClone(value)); queueMicrotask(() => tx.oncomplete?.()); },
        delete: (id: string) => { idbRecords.delete(id); queueMicrotask(() => tx.oncomplete?.()); },
      }),
    };
    return tx;
  },
};
(globalThis as unknown as { window: object }).window = {};
(globalThis as unknown as { indexedDB: unknown }).indexedDB = {
  open: () => {
    const request = { result: fakeDb, error: null, onupgradeneeded: null as (() => void) | null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  },
};
const session = new Map<string, string>();
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => { session.set(k, v); },
  removeItem: (k: string) => { session.delete(k); },
};

const doc = (id: string) => ({ id, ifc: `ISO-10303-21; /* ${id} */`, filePath: null, isDirty: true, datesAsRecorded: false });
const ids = async () => (await loadRecovery()).docs.map((d) => d.id).sort();

// Vorige sessie liet document A achter.
await saveRecovery(fullRecoverySave('A', [doc('A')]));
eq('voorwaarde: A staat klaar voor herstel', await ids(), ['A']);

// Gebruiker kiest "later"; daarna schrijft de crashherstel-ronde het nieuwe (lege) document B.
await holdRecoveryForLater();
await saveRecovery(fullRecoverySave('B', [doc('B')]));
eq('A overleeft de volgende crashherstel-ronde', await ids(), ['A', 'B']);

// Nog een ronde met een ander document: A blijft, B's generatie volgt het open-venster.
await saveRecovery(fullRecoverySave('C', [doc('C')]));
eq('A blijft vastgehouden, eigen generatie ruimt B op', await ids(), ['A', 'C']);

// Een tweede keer uitstellen stapelt, niet vervangen.
await holdRecoveryForLater();
await saveRecovery(fullRecoverySave('D', [doc('D')]));
eq('twee vastgehouden generaties + de eigen', await ids(), ['A', 'C', 'D']);

// Hetzelfde document in eigen én vastgehouden generatie: één keer, de eigen (nieuwste) wint.
await saveRecovery(fullRecoverySave('A', [doc('A'), doc('D')]));
eq('dubbele id wordt één keer aangeboden', await ids(), ['A', 'C', 'D']);

// "Niet herstellen" / schone exit wist alles, ook de vastgehouden generaties.
await clearRecovery();
eq('clearRecovery wist eigen + vastgehouden', await ids(), []);
eq('geen records meer over', idbRecords.size, 0);

if (diffs.length === 0) {
  console.log(`OK  recovery-web-hold: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recovery-web-hold: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
