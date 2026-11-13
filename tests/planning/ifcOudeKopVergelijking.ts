// Eén tabel voor de echte app-route, vers gebundeld tegen main én tegen de branch.
// De referentie bevat hashes van de volledige payload en opslagbytes, geen nagebouwde parseruitkomsten.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { oudeKop, oudeKopVelden, oudeWand } from './ifcOudeKop';
import { scanTargetBytes } from '@/services/ifc/foreign/targetModelScan';
import { capturePayload } from '@/state/documentContract';
import { createAppStoreContext } from '@/state/appStoreFactory';

type Fields = [string, string, string];
export interface OldHeaderCase { name: string; text: string; }
export function oldHeaderCases(root: string): OldHeaderCase[] {
  const original = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  const body = original.slice(original.indexOf('\nDATA;\n') + 7);
  const pset = "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('bewaren'),$);\n"
    + "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));\n";
  const fields: Array<[string, Fields]> = [
    ...oudeKopVelden.map((f, i) => [`Terra-${i}`, f] as [string, Fields]),
    ...["O'Hara", "'Naam", "Naam'", "O''Hara's", 'Gewone naam', "Één O'Hara", "O'Hara; Noord",
      "O'Hara DATA; ENDSEC; Fase 1", "O'Hara DATA; END-ISO-10303-21; Fase 1", "O'Hara DATA; ((Noord))",
      "O'Hara DATA; /* commentaar */ Noord", "O'Hara DATA; /*", "O'Hara DATA; */", "O'Hara DATA; -- commentaar",
      "O'Hara DATA; FILE_NAME( Noord )", "O'Hara DATA; FILE_NAME( 'Noord' )", "A' , 'extra", "A' ) extra", "A( 'extra", "A, 'extra",
      "X' ); FILE_POPULATION( 'extern' ); FILE_NAME( 'tail",
    ].map((n, i) => [`naam-${i}`, [n, 'Aannemer', 'Bouwbedrijf Van Dijk BV']] as [string, Fields]),
  ];
  const injected = [
    "X';ENDSEC;DATA;#999999=IFCWALL( '0abcdefghijkmnopqrstuv' ,$,'Wand' ,$,$,$,$,$,$);ENDSEC;/*",
    "X;ENDSEC;DATA;#999999=IFCWALL( '0abcdefghijkmnopqrstuv' ,$,'Wand' ,$,$,$,$,$,$);ENDSEC;/*",
    "X';ENDSEC;DATA;#999999=IFCWALL($);ENDSEC;/*",
    "X';ENDSEC;DATA;#naam_9 = ifcwall( $ );ENDSEC;/*",
    "X';ENDSEC;DATA;# 999999 = IFCWALL( $ );ENDSEC;/*",
    "X';ENDSEC;DATA;#999999 = IFCWALL( $ );ENDSEC;/*",
    "X';ENDSEC;DATA;#999/* commentaar */999=IFCWALL( $ );ENDSEC;/*",
    "X';ENDSEC;DATA;#999999=IFCPROPERTYSINGLEVALUE( 'ExternVeld' ,$,IFCTEXT( 'bewaren' ),$);ENDSEC;/*",
    "X';ENDSEC;DATA;#999999=IFCPROPERTYSET( '0abcdefghijkmnopqrstuv' ,$,'ExternPset' ,$,());ENDSEC;/*",
  ];
  injected.forEach((value, i) => {
    for (const field of [0, 1, 2]) {
      const f: Fields = ['Eigen planning', 'Aannemer', 'Bouwbedrijf Van Dijk BV']; f[field] = value;
      fields.push([`Sol-entiteit-${i}-veld-${field}`, f]);
    }
  });
  const cases: OldHeaderCase[] = fields.map(([name, f]) => ({ name, text: oudeKop(...f) + body }));
  // Alle gewone Terra-velden ook met een echte wand: dezelfde reparatie, zonder stil modelverlies.
  oudeKopVelden.forEach((f, i) => cases.push({ name: `Terra-wand-${i}`, text: oudeKop(...f) + body.replace('\nENDSEC;\nEND-ISO', '\n' + oudeWand + 'ENDSEC;\nEND-ISO') }));
  const long = "O'Hara " + 'x'.repeat(70 << 10);
  for (const [kind, extra] of [['wand', oudeWand], ['wand-tweede-sectie', 'ENDSEC;\nDATA;\n' + oudeWand], ['vreemde-property', pset]]) {
    cases.push({ name: `Sol-lange-auteur-${kind}`, text: oudeKop('Eigen planning', long) + body.replace('\nENDSEC;\nEND-ISO', '\n' + extra + 'ENDSEC;\nEND-ISO') });
  }
  // Meet exact dezelfde byteprefix als main, inclusief multibyte-tekst vlak rond de grens.
  for (const unicode of [false, true]) for (const delta of [-1, 0, 1]) {
    const author = unicode ? "Één O'Hara " : "O'Hara ";
    const h = oudeKop('Eigen planning', author);
    const size = new TextEncoder().encode(h.slice(0, h.indexOf('\nFILE_SCHEMA') + 1)).length;
    const bounded = oudeKop('Eigen planning', author + 'x'.repeat((64 << 10) + delta - size));
    for (const [kind, extra] of [['wand', oudeWand], ['wand-tweede-sectie', 'ENDSEC;\nDATA;\n' + oudeWand], ['vreemde-property', pset]]) {
      cases.push({ name: `grens-${unicode}-${delta}-${kind}`, text: bounded + body.replace('\nENDSEC;\nEND-ISO', '\n' + extra + 'ENDSEC;\nEND-ISO') });
    }
  }
  cases.push({ name: 'controle-wand', text: oudeKop('Gewone naam') + body.replace('\nENDSEC;\nEND-ISO', '\n' + oudeWand + 'ENDSEC;\nEND-ISO') });
  return cases;
}
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function stable(value: unknown): unknown {
  if (value === undefined) return '<undefined>';
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Map) return [...value.entries()].map(([k, v]) => [k, stable(v)]).sort();
  if (value instanceof Set) return [...value].map(stable).sort();
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
}
const enc = new TextEncoder();
const dec = new TextDecoder();
function memoryFile(initial: string) {
  let text = initial;
  const writes: string[] = [];
  const handle = {
    kind: 'file' as const, name: 'proef.ifc', isSameEntry: async (other: unknown) => other === handle,
    getFile: async () => new File([text], 'proef.ifc'), queryPermission: async () => 'granted' as const, requestPermission: async () => 'granted' as const,
    createWritable: async () => { let next = ''; return { write: async (chunk: unknown) => { next += typeof chunk === 'string' ? chunk : dec.decode(chunk as Uint8Array); },
      close: async () => { text = next; writes.push(next); } }; },
  };
  return { handle: handle as unknown as FileSystemFileHandle, writes, text: () => text };
}
export interface OldHeaderRoute {
  flag: boolean; opened: boolean; tasks: number; payload: string; notices: unknown;
  target: string; writes: string[]; intact: boolean; reopen: { opened: boolean; tasks: number; payload: string } | null;
  targetWrites: string[]; targetIntact: boolean;
}
export interface OldHeaderRow { name: string; input: string; routes: OldHeaderRoute[]; }
export async function oldHeaderTable(root: string): Promise<OldHeaderRow[]> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = { window: globals.window, local: globals.localStorage, session: globals.sessionStorage, date: Date, random: Math.random };
  installBrowserStubs(); const reseed = installDeterminism();
  try {
  const win = window as unknown as Record<string, unknown>;
  const baseline = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  const payload = (store: ReturnType<typeof createAppStoreContext>['store']) => {
    const { ifcSource: _source, fileHandle: _handle, ...rest } = capturePayload(store.getState());
    return sha(JSON.stringify(stable(rest)));
  };
  const open = async (text: string, flag: boolean, file: ReturnType<typeof memoryFile>) => {
    reseed(804); const store = createAppStoreContext().store;
    store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
    const error = console.error; console.error = () => {};
    try { await store.getState().openOpenedFile({ name: 'proef.ifc', content: flag ? '' : text, ...(flag ? { bytes: enc.encode(text) } : {}), ref: { kind: 'handle', handle: file.handle } }); } finally { console.error = error; }
    return store;
  };
  const rows: OldHeaderRow[] = [];
  for (const c of oldHeaderCases(root)) {
    const routes: OldHeaderRoute[] = [];
    for (const flag of [false, true]) {
      const file = memoryFile(c.text);
      const store = await open(c.text, flag, file);
      const state = store.getState();
      const opened = state.fileHandle === file.handle;
      const before = { opened, tasks: state.tasks.length, payload: payload(store),
        notices: stable(state.ui.notifications.map(({ id: _id, ...n }) => n)) };
      if (opened) await state.saveFile();
      const reopened = opened ? await open(file.text(), flag, file) : null;
      const reopen = reopened ? { opened: reopened.getState().fileHandle === file.handle, tasks: reopened.getState().tasks.length, payload: payload(reopened) } : null;
      // De bestaande doelen van Sol: echte Opslaan als vanuit een andere, veilige planning.
      const safe = await open(baseline, flag, memoryFile(baseline));
      const target = memoryFile(c.text);
      win.showOpenFilePicker = async () => [];
      win.showSaveFilePicker = async () => target.handle;
      try { await safe.getState().saveFileAs(); } finally { delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
      routes.push({ flag, ...before, target: scanTargetBytes(enc.encode(c.text)), writes: file.writes.map(sha), intact: file.text() === c.text,
        reopen, targetWrites: target.writes.map(sha), targetIntact: target.text() === c.text });
    }
    rows.push({ name: c.name, input: sha(c.text), routes });
  }
  return rows;
  } finally {
    globals.window = previous.window; globals.localStorage = previous.local; globals.sessionStorage = previous.session;
    globalThis.Date = previous.date; Math.random = previous.random;
  }
}

/** Alleen exact main, of het lege main-project hersteld tot de gewone volledige planning (met modelweigering
 * zonder instelling). Ook de volledige payload en uitvoerbytes moeten aan de veilige controlevorm gelijk zijn.
 */
export function compareOldHeaderTable(main: OldHeaderRow[], current: OldHeaderRow[]) {
  const problems: string[] = [];
  let same = 0, repaired = 0;
  const equal = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  const controls = [main.find(r => r.name === 'naam-4')!, main.find(r => r.name === 'controle-wand')!];
  if (main.length !== current.length) problems.push(`aantal: ${current.length} != ${main.length}`);
  for (const row of current) {
    const previous = main.find(r => r.name === row.name);
    if (!previous || previous.input !== row.input) { problems.push(`${row.name}: invoer wijkt af`); continue; }
    if (equal(row, previous)) { same++; continue; }
    let allowed = true;
    for (let i = 0; i < row.routes.length; i++) {
      const got = row.routes[i], before = previous.routes[i];
      if (equal(got, before)) continue;
      const control = controls[row.name.startsWith('Terra-wand-') ? 1 : 0]?.routes[i];
      if (!before.opened || before.tasks !== 0 || !control || !equal(got, control)) {
        allowed = false;
        const keys = Object.keys(got) as (keyof OldHeaderRoute)[];
        const changed = keys.filter(k => !equal(got[k], before[k])).join(', ');
        problems.push(`${row.name} flag=${got.flag}: niet main of lege-projectreparatie (${changed}); taken ${before.tasks}->${got.tasks}; doel ${before.target}->${got.target}`);
      }
      // Een reparatie mag een door main geweigerd bestaand doel nooit nieuw vrijgeven.
      if ((before.target === 'model' || before.target === 'unreadable') && got.target === 'no-model') {
        allowed = false; problems.push(`${row.name}: nieuw vrijgegeven doel`);
      }
    }
    if (allowed) repaired++;
  }
  return { cases: current.length, same, repaired, other: problems.length, problems };
}
