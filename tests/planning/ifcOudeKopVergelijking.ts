// Eén tabel voor de echte app-route, vers gebundeld tegen main én tegen de branch.
// De referentie bevat hashes van de volledige payload en opslagbytes, geen nagebouwde parseruitkomsten.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
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
      "O'Hara DATA; FILE_NAME( Noord )", "O'Hara DATA; FILE_NAME( 'Noord' )", "A' , 'extra", "A' ) extra", "A( 'extra", "A, 'extra", "A'\t, 'extra", "A(\t'extra", "A,\u00a0'extra",
      "X' ); FILE_POPULATION( 'extern' ); FILE_NAME( 'tail",
    ].map((n, i) => [`naam-${i}`, [n, 'Aannemer', 'Bouwbedrijf Van Dijk BV']] as [string, Fields]),
  ];
  const injected = [
    "X';ENDSEC;DATA;#999999=IFCWALL( '0abcdefghijkmnopqrstuv' ,$,'Wand' ,$,$,$,$,$,$);ENDSEC;/*",
    "X;ENDSEC;DATA;#999999=IFCWALL( '0abcdefghijkmnopqrstuv' ,$,'Wand' ,$,$,$,$,$,$);ENDSEC;/*",
    "X';ENDSEC;DATA;#999999=IFCWALL($);ENDSEC;/*",
    "X';ENDSEC;DATA;#999999=IFCWALL($);ENDSEC;",
    "X';ENDSEC;DATA;#999999\t=IFCWALL($);ENDSEC;",
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
    createWritable: async () => { let next = ''; return { write: async (chunk: unknown) => { next += typeof chunk === 'string' ? chunk : chunk instanceof Blob ? await chunk.text() : dec.decode(chunk as Uint8Array); },
      close: async () => { text = next; writes.push(next); } }; },
  };
  return { handle: handle as unknown as FileSystemFileHandle, writes, text: () => text };
}
export interface OldHeaderRoute {
  flag: boolean; opened: boolean; tasks: number; payload: string; notices: unknown;
  target: string; writes: string[]; intact: boolean; reopen: { opened: boolean; tasks: number; payload: string } | null;
  // saveAsWrites gaat over dit geopende document; targetWrites over een andere planning naar dit bestaande doel.
  saveAsWrites: string[]; saveAsSourceIntact: boolean;
  foreign: boolean; sourceBytesEqual: boolean; hasForeignBytes: boolean; foreignRetained: boolean;
  targetWrites: string[]; targetIntact: boolean;
}
export interface OldHeaderRow { name: string; input: string; routes: OldHeaderRoute[]; }
export async function oldHeaderTable(root: string): Promise<OldHeaderRow[]> {
  // generateId heeft een modulelokale teller. Eén verse, seriële worker per geval voorkomt dat een gerepareerde
  // lezing de ids van een later geval verschuift; er draait steeds maar één worker onder het slot van de check.
  if (isMainThread) {
    // De opgeslagen main-referentie is, zoals de bestaande pariteitsproef, in deze tijdzone gemeten.
    const zone = process.env.TZ; process.env.TZ = 'Europe/Amsterdam';
    try {
    const rows: OldHeaderRow[] = [];
    for (const c of oldHeaderCases(root)) rows.push(await new Promise<OldHeaderRow>((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: { oldHeaderCase: { root, name: c.name } } });
      let row: OldHeaderRow | undefined;
      worker.once('message', (result: OldHeaderRow) => { row = result; });
      worker.once('error', reject);
      worker.once('exit', code => code === 0 && row ? resolve(row) : reject(new Error(`oude kop ${c.name}: worker exit ${code}`)));
    }));
    return rows;
    } finally { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; }
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = { window: globals.window, local: globals.localStorage, session: globals.sessionStorage, date: Date, random: Math.random };
  installBrowserStubs(); const reseed = installDeterminism();
  try {
  const win = window as unknown as Record<string, unknown>;
  const baseline = readFileSync(join(root, 'tests/planning/fixtures/oude-tags/v2026.7.12-ohara-showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
  // Bron/vingerafdruk/handle horen bij de concrete invoerbytes, niet bij de planning onder de controlekop.
  // Opslagblokkade en volledige bronintegriteit worden hieronder apart via writes en intact vergeleken.
  const payload = (store: ReturnType<typeof createAppStoreContext>['store']) => {
    const { ifcSource: _source, foreignSourceMark: _mark, fileHandle: _handle, ...rest } = capturePayload(store.getState());
    return sha(JSON.stringify(stable({ ...rest, assignments: rest.assignments.map(({ id: _id, ...a }) => a) })));
  };
  const open = async (text: string, flag: boolean, file: ReturnType<typeof memoryFile>) => {
    reseed(804); const store = createAppStoreContext().store;
    store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
    const error = console.error; console.error = () => {};
    try { await store.getState().openOpenedFile({ name: 'proef.ifc', content: flag ? '' : text, ...(flag ? { bytes: enc.encode(text) } : {}), ref: { kind: 'handle', handle: file.handle } }); } finally { console.error = error; }
    return store;
  };
  const rows: OldHeaderRow[] = [];
  for (const c of oldHeaderCases(root).filter(c => c.name === workerData.oldHeaderCase.name)) {
    const routes: OldHeaderRoute[] = [];
    for (const flag of [false, true]) {
      const file = memoryFile(c.text);
      const store = await open(c.text, flag, file);
      const state = store.getState();
      const opened = state.fileHandle === file.handle;
      const before = { opened, tasks: state.tasks.length, payload: opened ? payload(store) : '',
        notices: stable(state.ui.notifications.map(({ id: _id, ...n }) => n)) };
      const foreign = state.ifcSource?.foreign === true;
      const sourceBytesEqual = state.ifcSource !== null && sha(state.ifcSource.bytes) === sha(c.text);
      const foreignParts = [oudeWand, "#99001=IFCPROPERTYSINGLEVALUE('ExternVeld',$,IFCTEXT('bewaren'),$);",
        "#99002=IFCPROPERTYSET('0abcdefghijkmnopqrstuv',$,'ExternPset',$,(#99001));"].filter(part => c.text.includes(part));
      if (opened) await state.saveFile();
      const saveWrites = file.writes.map(sha);
      const intact = file.text() === c.text;
      const foreignRetained = foreignParts.every(part => file.text().includes(part));
      // Ook Opslaan als vanuit het geopende document moet nul writes geven bij een vreemd deel.
      // Een nieuw, leeg doel voorkomt dat de bestaande-doelcontrole deze bronblokkade onbedoeld bewijst.
      const saveAs = memoryFile('');
      win.showOpenFilePicker = async () => [];
      win.showSaveFilePicker = async () => saveAs.handle;
      try { if (opened) await store.getState().saveFileAs(); } finally { delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
      const saveAsSourceIntact = file.text() === c.text;
      const reopened = opened ? await open(file.text(), flag, file) : null;
      const reopen = reopened ? { opened: reopened.getState().fileHandle === file.handle, tasks: reopened.getState().tasks.length, payload: payload(reopened) } : null;
      // De bestaande doelen van Sol: echte Opslaan als vanuit een andere, veilige planning.
      const safe = await open(baseline, flag, memoryFile(baseline));
      const target = memoryFile(c.text);
      win.showOpenFilePicker = async () => [];
      win.showSaveFilePicker = async () => target.handle;
      try { await safe.getState().saveFileAs(); } finally { delete win.showOpenFilePicker; delete win.showSaveFilePicker; }
      routes.push({ flag, ...before, target: scanTargetBytes(enc.encode(c.text)), writes: saveWrites, intact, saveAsWrites: saveAs.writes.map(sha), saveAsSourceIntact,
        foreign, sourceBytesEqual, hasForeignBytes: foreignParts.length > 0, foreignRetained, reopen, targetWrites: target.writes.map(sha), targetIntact: target.text() === c.text });
    }
    rows.push({ name: c.name, input: sha(c.text), routes });
  }
  return rows;
  } finally {
    globals.window = previous.window; globals.localStorage = previous.local; globals.sessionStorage = previous.session;
    globalThis.Date = previous.date; Math.random = previous.random;
  }
}

// Dezelfde gebundelde check wordt als worker geladen; stop vóór de overige check-/generatorcode draait.
if (!isMainThread && workerData?.oldHeaderCase) {
  parentPort!.postMessage((await oldHeaderTable(workerData.oldHeaderCase.root))[0]);
  process.exit(0);
}

/** Per geval alleen (a) main, (b) een leeg main-project gerepareerd, of (c) aantoonbaar veiliger.
 * Bij (c) moeten alle taken én alle bronbytes aanwezig zijn en moeten beide opslagacties nul writes hebben.
 */
export function compareOldHeaderTable(main: OldHeaderRow[], current: OldHeaderRow[]) {
  const problems: string[] = [];
  const evidence: string[] = [];
  let same = 0, repaired = 0, safer = 0;
  const equal = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  // Een nieuw geregistreerde eigen bron zonder vreemd deel verandert de open-/opslaguitkomst niet.
  // Bij een vreemd deel blijft de bytegelijkheid juist onderdeel van de vergelijking.
  const observable = ({ sourceBytesEqual, ...route }: OldHeaderRoute) => ({ ...route, ...(route.foreign ? { sourceBytesEqual } : {}) });
  const controls = [main.find(r => r.name === 'naam-4')!, main.find(r => r.name === 'controle-wand')!];
  if (main.length !== current.length) problems.push(`aantal: ${current.length} != ${main.length}`);
  for (const row of current) {
    const previous = main.find(r => r.name === row.name);
    if (!previous || previous.input !== row.input) { problems.push(`${row.name}: invoer wijkt af`); continue; }
    let allowed = row.routes.length === previous.routes.length, repair = false, safe = false;
    const routeCategories: string[] = [];
    for (let i = 0; i < row.routes.length; i++) {
      const got = row.routes[i], before = previous.routes[i];
      if (!before || before.flag !== got.flag) { allowed = false; problems.push(`${row.name}: instelling/route wijkt af`); continue; }
      if (equal(observable(got), observable(before))) { routeCategories[i] = 'a'; continue; }
      const control = controls[row.name.startsWith('Terra-wand-') ? 1 : 0]?.routes[i];
      const fullPlanning = controls[0]?.routes[i];
      const emptyRepaired = before.opened && before.tasks === 0 && control && equal(observable(got), observable(control));
      // Het vreemde deel moet concreet in de invoer staan; main moet opening weigeren óf die bytes wegschrijven.
      // Alle beschermingen zijn EN-voorwaarden, ook nul writes bij beide onafhankelijke opslagacties.
      const saferRoute = got.hasForeignBytes && got.foreign && got.sourceBytesEqual && got.opened
        && got.tasks === fullPlanning?.tasks && got.payload === fullPlanning?.payload
        && got.writes.length === 0 && got.saveAsWrites.length === 0
        && got.intact && got.saveAsSourceIntact && got.foreignRetained
        && (!before.opened || (before.writes.length > 0 && !before.foreignRetained));
      // Een aanvullende weigering van het bestaande doel is veilig bij nul writes en bytebehoud;
      // een eerder geweigerd doel nieuw vrijgeven mag nooit.
      const targetSafe = !((before.target === 'model' || before.target === 'unreadable') && got.target === 'no-model')
        && ((equal(got.targetWrites, before.targetWrites) && got.targetIntact === before.targetIntact)
          || (got.targetWrites.length === 0 && got.targetIntact));
      if (emptyRepaired && targetSafe) { repair = true; routeCategories[i] = 'b'; }
      else if (saferRoute && targetSafe) { safe = true; routeCategories[i] = 'c'; }
      else {
        allowed = false; routeCategories[i] = 'ROOD';
        const keys = Object.keys(got) as (keyof OldHeaderRoute)[];
        const changed = keys.filter(k => !equal(got[k], before[k])).join(', ');
        problems.push(`${row.name} flag=${got.flag}: buiten (a)/(b)/(c) (${changed}); taken ${before.tasks}->${got.tasks}; doel ${before.target}->${got.target}; writes ${got.writes.length}/${got.saveAsWrites.length}; bron gelijk ${got.intact && got.saveAsSourceIntact}`);
      }
    }
    const category = !allowed ? 'ROOD' : safe ? 'c' : repair ? 'b' : 'a';
    if (allowed) { if (safe) safer++; else if (repair) repaired++; else same++; }
    evidence.push(`${row.name}: (${category}) ` + row.routes.map((r, i) => `flag=${r.flag} (${routeCategories[i]}) taken=${r.tasks} (main ${previous.routes[i]?.tasks}), writes Opslaan=${r.writes.length}, Opslaan als=${r.saveAsWrites.length}, bronbytes gelijk=${r.intact && r.saveAsSourceIntact}, vreemd=${r.foreign}, bronregistratie gelijk=${r.sourceBytesEqual}`).join(' | '));
  }
  return { cases: current.length, same, repaired, safer, other: current.length - same - repaired - safer, problems, evidence };
}
