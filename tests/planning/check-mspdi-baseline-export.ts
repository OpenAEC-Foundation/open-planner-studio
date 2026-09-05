// MSPDI-baseline-export-regressie — bewijst dat een opgeslagen baseline de MS-Project-XML-export
// OVERLEEFT, via de ECHTE productieroute (`useAppStore.getState().exportAs('mspdi')`).
//
// Achtergrond (de bug die deze check vangt): `writeMSPDI` heeft `baselines` en `activeBaselineId`
// als 8e/9e parameter met defaults `[]` / `null`. De export-actie in `fileSlice.exportAs` gaf maar
// zeven argumenten mee, dus viel de writer stil terug op die defaults: geen enkel `<Baseline>`-blok
// in de XML, terwijl `readMSPDI` baselines wél inleest. Resultaat: baseline weg bij export, zonder
// waarschuwing.
//
// Daarom draait deze check bewust NIET `writeMSPDI(...)` met alle negen argumenten — dat zou de bug
// juist maskeren. Hij gaat door `exportAs`, precies zoals de ribbon-/backstage-exportknoppen dat
// doen, en onderschept het geschreven bestand aan de onderkant van `fileAccess` (de web-download-
// fallback) met minimale browser-stubs. Daarna leest `readMSPDI` het resultaat terug.
//
// Draait via run.sh. Exit 0 = alles groen.
import { installDOMParser } from './xmldom-shim';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import {
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveReadModel,
  createXerSourceArchive,
} from '@/services/xerSourceArchive';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

// ── Headless browser-stubs ───────────────────────────────────────────────────────────────────
// `fileAccess/index.ts` kiest Tauri↔web op `isTauri()` (= `'__TAURI_INTERNALS__' in window`), dus er
// moet een `window` zijn — zonder `showOpenFilePicker`, waardoor de web-backend de download-fallback
// pakt (`new Blob([content])` + een `<a>`-klik). Die Blob-constructor is ons afluisterpunt.
let captured: string | null = null;
const g = globalThis as any;
g.window = g.window ?? {};
g.Blob = class {
  constructor(parts: unknown[]) { captured = parts.join(''); }
};
g.URL = g.URL ?? {};
g.URL.createObjectURL = () => 'blob:test';
g.URL.revokeObjectURL = () => { /* no-op */ };
g.document = {
  createElement: () => ({ href: '', download: '', click() { /* no-op */ } }),
};

installDOMParser();

// De store pas ná de stubs importeren is niet nodig (ESM hoist), maar de stubs staan wel vóór de
// eerste aanroep — dat is wat telt.
const { useAppStore } = await import('@/state/appStore');
const S = () => useAppStore.getState();

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

// ── Opzet: klein project met twee gekoppelde leaf-taken + een mijlpaal ───────────────────────
S().newProject();
S().setProject({ name: 'Baseline-export', startDate: '2026-08-03' });

const idA = S().addTask({ name: 'Fundering', time: createDefaultTaskTime('2026-08-03', 5) });
const idB = S().addTask({ name: 'Wanden', time: createDefaultTaskTime('2026-08-10', 3) });
const idM = S().addTask({ name: 'Oplevering', isMilestone: true, time: createDefaultTaskTime('2026-08-13', 0) });
S().addSequence({ predecessorId: idA, successorId: idB, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: idB, successorId: idM, type: 'FINISH_START', lagDays: 0 });
S().runCPM();

const baselineId = S().saveBaseline('Nulmeting');
eq('01 setup: één baseline in de store', S().baselines.length, 1);
eq('02 setup: baseline is actief', S().activeBaselineId, baselineId);
const savedBaseline = S().baselines[0];
useAppStore.setState({
  baselines: [{
    ...savedBaseline,
    sourceProjectId: 'P6-SOURCE-BASELINE',
    name: 'Contractuele nulmeting',
    createdAt: '2025-12-31T12:34:56.000Z',
    projectEnd: '2035-12-31',
    projectDuration: 987,
    tasks: savedBaseline.tasks.map((task, index) => ({
      ...task,
      sourceTaskId: `P6-TASK-${index + 1}`,
      sourceTaskCode: `SRC-${index + 1}`,
    })),
  }],
  xerSourceArchive: createXerSourceArchive(new Uint8Array(), {
    encoding: 'utf-8', bom: 'none', newline: 'none',
    diagnostics: createEmptyXerArchiveDiagnostics(),
    readModel: createEmptyXerArchiveReadModel(),
  }),
  xerSourceProjectId: 'P6-PROJECT',
  scheduleStale: false,
});
const before = S().baselines[0];
eq('03 setup: baseline dekt de drie leaf-taken', before.tasks.length, 3);

// Namen zijn de stabiele brug over de export heen (de reader kent onze interne task-ids niet).
const nameOf = new Map(S().tasks.map(t => [t.id, t.name]));
const wantByName = new Map(
  before.tasks.map(bt => [nameOf.get(bt.taskId)!, bt]),
);

// ── De productieroute: exportAs('mspdi'), exact zoals ribbon/backstage hem aanroepen ─────────
const exportResult = await S().exportAs('mspdi');
eq('03a MSPDI meldt ondanks slot-0-projectie het resterende baselineobjectverlies',
  exportResult.ok ? exportResult.warnings[0]?.categories : [], ['baselines']);

// `captured` wordt vanuit de Blob-stub gezet; TS' controlestroom ziet die schrijfactie niet en
// versmalt de variabele anders tot `never`. Via een losse lezing blijft het type intact.
const capturedXml = captured as string | null;
truthy('04 export heeft een bestand geschreven', typeof capturedXml === 'string' && capturedXml.length > 0);
const xml = capturedXml ?? '';
// Directe regressie-assert op de XML: zonder de doorgegeven baselines schrijft de writer géén
// enkel <Baseline>-blok (de writer-defaults [] / null slikken alles).
truthy('05 export bevat <Baseline>-blokken', xml.includes('<Baseline>'));
eq('06 export bevat één Baseline-blok per leaf-taak', (xml.match(/<Baseline>/g) ?? []).length, 3);
truthy('07 export gebruikt baseline-slot 0', xml.includes('<Number>0</Number>'));

// ── Terug inlezen en veld-voor-veld vergelijken ──────────────────────────────────────────────
const back = readMSPDI(xml);
const backBaselines = back.baselines ?? [];
eq('08 import: precies één baseline terug', backBaselines.length, 1);
truthy('09 import: baseline is actief', !!back.activeBaselineId && back.activeBaselineId === backBaselines[0]?.id);

const backBaseline = backBaselines[0];
eq('10 import: baseline dekt evenveel taken', backBaseline?.tasks.length, before.tasks.length);
eq('10a round-trip bewijst dat OPS-baseline-identiteit en metadata niet terugkomen', {
  sameId: backBaseline?.id === before.id,
  sourceProjectId: backBaseline?.sourceProjectId,
  sameName: backBaseline?.name === before.name,
  sameCreatedAt: backBaseline?.createdAt === before.createdAt,
  sameProjectEnd: backBaseline?.projectEnd === before.projectEnd,
  sameProjectDuration: backBaseline?.projectDuration === before.projectDuration,
  sourceTaskIdentityCount: backBaseline?.tasks.filter(task =>
    task.sourceTaskId !== undefined || task.sourceTaskCode !== undefined).length,
}, {
  sameId: false,
  sourceProjectId: undefined,
  sameName: false,
  sameCreatedAt: false,
  sameProjectEnd: false,
  sameProjectDuration: false,
  sourceTaskIdentityCount: 0,
});

const backNameOf = new Map(back.tasks.map(t => [t.id, t.name]));
for (const bt of backBaseline?.tasks ?? []) {
  const name = backNameOf.get(bt.taskId);
  const want = name ? wantByName.get(name) : undefined;
  if (!want) {
    checks++;
    diffs.push(`11 import: onbekende baseline-taak "${name ?? bt.taskId}" (geen tegenhanger in de bron)`);
    continue;
  }
  eq(`12 [${name}] baseline-start`, bt.start.slice(0, 10), want.start.slice(0, 10));
  eq(`13 [${name}] baseline-finish`, bt.finish.slice(0, 10), want.finish.slice(0, 10));
  eq(`14 [${name}] baseline-duur (werkdagen)`, bt.duration, want.duration);
  eq(`15 [${name}] baseline-mijlpaalvlag`, bt.isMilestone, want.isMilestone);
}

// Elke bron-taak moet ook echt zijn teruggekomen (geen stille halve export).
for (const [name] of wantByName) {
  truthy(
    `16 [${name}] komt terug in de geïmporteerde baseline`,
    (backBaseline?.tasks ?? []).some(bt => backNameOf.get(bt.taskId) === name),
  );
}

// ── Uitslag ──────────────────────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  mspdi-baseline-export-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  mspdi-baseline-export-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
