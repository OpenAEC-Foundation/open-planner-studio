// Mechanische conventiegrens van de motor (rekenprofielen, spec v3.1 §4; plan taak D10).
// Draait de echte repositorypoort en bewijst met tijdelijke bronfixtures dat de poort (1) commentaar en
// gewone strings niet als lek ziet, (2) p6Source-lezingen, lezer-imports (statisch, relatief, dynamisch)
// weigert, (3) de datagate-telling alleen omlaag laat gaan, (4) een corrupte pin rood maakt, (5) nooit
// een baseline herschrijft zolang er iets rood is, en (6) de tijdelijke allowlist alleen bestaande
// bestanden toelaat en zichzelf dus opruimt zodra baan C de overgangslaag weghaalt.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const diffs: string[] = [];
let checks = 0;
const ok = (label: string, condition: boolean, detail = '') => {
  checks++;
  if (!condition) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts', 'verify-conventions.mjs');
const run = (checkRoot: string, extra: string[] = []) =>
  spawnSync(process.execPath, [script, '--root', checkRoot, ...extra], { cwd: root, encoding: 'utf8' });
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-conventions-'));
  for (const [rel, source] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, 'utf8');
  }
  return dir;
}
function withFixture(files: Record<string, string>, body: (dir: string) => void): void {
  const dir = fixture(files);
  try { body(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const PIN = 'scripts/verify-conventions.datagates.json';
const ALLOW = 'scripts/verify-conventions.allowlist.json';
/** De pin na een run; ontbrekend of onleesbaar ⇒ {} (de assertie faalt dan, de check crasht niet). */
function readPin(dir: string): Record<string, number> {
  try { return JSON.parse(readFileSync(join(dir, PIN), 'utf8')) as Record<string, number>; } catch { return {}; }
}
/** De markering die de poort in een allowlist-reden eist. Samengesteld, zodat de markeringssweep van
 *  taak I2 (die op de letterlijke markering grept) deze fixtures niet voor overgangscode aanziet. */
const MARK = ['TIJDE', 'LIJK(rekenprofielen): fixture'].join('');
const ENGINE = 'src/engine/scheduler/fixture.ts';
const CLEAN = [
  '// p6Source staat hier alleen in commentaar',
  'export function f(o: { schedulingOptions: { p6RelationFinishBoundary: boolean } }, task: { p6ProjectId?: string }): boolean {',
  "  const label = 'p6Source';",
  '  return o.schedulingOptions.p6RelationFinishBoundary && task.p6ProjectId !== undefined && label.length > 0;',
  '}',
].join('\n');
const LEAK = "export const leak = (o: { schedulingOptions: { p6Source?: string } }) => o.schedulingOptions.p6Source === 'XER';";

// 1. De echte repository (pin gezet na C3, zonder allowlist).
const real = run(root);
ok('01 actuele conventiegrens is groen', real.status === 0, `${real.stdout}${real.stderr}`.trim());
ok('01a geen tijdelijke allowlist meer', !real.stdout.includes('tijdelijke allowlist'), real.stdout.trim());

// 2. Commentaar en strings zijn geen lek; één datagate-lezing binnen de pin.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 1 }) }, dir => {
  const r = run(dir);
  ok('02 commentaar/string/gepinde datagate ⇒ groen', r.status === 0, `${r.stdout}${r.stderr}`.trim());
});

// 3. Een p6Source-lezing in de motor.
withFixture({ [ENGINE]: LEAK, [PIN]: '{}' }, dir => {
  const r = run(dir);
  const out = `${r.stdout}${r.stderr}`;
  ok('03 p6Source-lezing ⇒ rood', r.status !== 0, out.trim());
  ok('03a rapport noemt bestand en naam', out.includes('src/engine/scheduler/fixture.ts') && out.includes('p6Source'), out.trim());
});

// 3b. Ook als string-index.
withFixture({ [ENGINE]: "export const leak = (o: Record<string, unknown>) => o['readFormat'];", [PIN]: '{}' }, dir => {
  const r = run(dir);
  ok('03b readFormat via string-index ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('readFormat'), `${r.stdout}${r.stderr}`.trim());
});

// 4–6. Lezer-imports: alias, relatief, dynamisch.
for (const [label, source, needle] of [
  ['04 alias-import uit services/xer', "import { readXER } from '@/services/xer/xerReader';\nexport const x = readXER;", 'src/services/xer'],
  ['05 relatieve import uit services/mpp', "import '../../services/mpp/mppReader';", 'src/services/mpp'],
  ['06 dynamische import van formatRegistry', "export const load = () => import('@/services/formatRegistry');", 'formatRegistry'],
] as const) {
  withFixture({ [ENGINE]: source, [PIN]: '{}' }, dir => {
    const r = run(dir);
    const out = `${r.stdout}${r.stderr}`;
    ok(`${label} ⇒ rood`, r.status !== 0 && out.includes(needle), out.trim());
  });
}

// 7. Datagate stijgt boven de pin.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 0 }) }, dir => {
  const r = run(dir);
  const out = `${r.stdout}${r.stderr}`;
  ok('07 datagate boven de pin ⇒ rood', r.status !== 0 && out.includes('p6ProjectId'), out.trim());
});

// 8. Datagate daalt onder de pin: groen, met herpin-advies.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 2 }) }, dir => {
  const r = run(dir);
  ok('08 datagate onder de pin ⇒ groen + te herpinnen', r.status === 0 && r.stdout.includes('te herpinnen'), `${r.stdout}${r.stderr}`.trim());
});

// 9. Corrupte pin (rode-pad-fixture voor de try/catch rond de pin).
withFixture({ [ENGINE]: CLEAN, [PIN]: '{kapot' }, dir => {
  const r = run(dir);
  ok('09 corrupte pin ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('geen geldige JSON'), `${r.stdout}${r.stderr}`.trim());
});

// 10. --write-baseline weigert bij rood en laat de pin ongemoeid.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 0 }) }, dir => {
  const r = run(dir, ['--write-baseline']);
  ok('10 herpinnen geweigerd bij rood', r.status !== 0 && readFileSync(join(dir, PIN), 'utf8') === JSON.stringify({ p6ProjectId: 0 }),
    `${r.stdout}${r.stderr}`.trim());
});

// 11. --write-baseline schrijft de gemeten telling als alles groen is.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 2 }) }, dir => {
  const r = run(dir, ['--write-baseline']);
  const pinned = readPin(dir);
  ok('11 herpinnen schrijft de gemeten telling', r.status === 0 && pinned.p6ProjectId === 1, `${r.stdout}${r.stderr}`.trim());
});

// 12. Een ontbrekende pin is rood (en --write-baseline mag hem dan wel aanmaken).
withFixture({ [ENGINE]: CLEAN }, dir => {
  const r = run(dir);
  ok('12 ontbrekende pin ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('datagates.json ontbreekt'), `${r.stdout}${r.stderr}`.trim());
  const w = run(dir, ['--write-baseline']);
  const pinned = readPin(dir);
  ok('12a --write-baseline maakt een ontbrekende pin aan', w.status === 0 && pinned.p6ProjectId === 1, `${w.stdout}${w.stderr}`.trim());
});

// 13. De tijdelijke allowlist: een vermeld, BESTAAND bestand mag p6Source lezen (alleen de naamregel).
const ALLOWED = 'src/engine/scheduler/conventions/legacyP6Source.ts';
withFixture({
  [ALLOWED]: LEAK, [PIN]: '{}', [ALLOW]: JSON.stringify({ [ALLOWED]: MARK }),
}, dir => {
  const r = run(dir);
  ok('13 p6Source in een allowlist-bestand ⇒ groen', r.status === 0, `${r.stdout}${r.stderr}`.trim());
  ok('13a het rapport noemt de allowlist', r.stdout.includes('tijdelijke allowlist'), `${r.stdout}${r.stderr}`.trim());
});
// 13b. …maar een lezer-import in datzelfde bestand blijft verboden.
withFixture({
  [ALLOWED]: "import '@/services/xer/xerReader';", [PIN]: '{}', [ALLOW]: JSON.stringify({ [ALLOWED]: MARK }),
}, dir => {
  const r = run(dir);
  ok('13b lezer-import in een allowlist-bestand ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('src/services/xer'), `${r.stdout}${r.stderr}`.trim());
});

// 14. Een verouderde allowlist-regel (bestand bestaat niet meer) is rood: de lijst ruimt zichzelf op.
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 1 }), [ALLOW]: JSON.stringify({ [ALLOWED]: MARK }) }, dir => {
  const r = run(dir);
  ok('14 verouderde allowlist-regel ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('bestaat niet meer'), `${r.stdout}${r.stderr}`.trim());
});

// 15. Een allowlist-regel zonder TIJDELIJK-markering, of buiten src/engine/, is rood.
withFixture({ [ALLOWED]: LEAK, [PIN]: '{}', [ALLOW]: JSON.stringify({ [ALLOWED]: 'mag altijd' }) }, dir => {
  const r = run(dir);
  ok('15 allowlist-reden zonder TIJDELIJK ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('TIJDELIJK'), `${r.stdout}${r.stderr}`.trim());
});
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 1 }), [ALLOW]: JSON.stringify({ 'src/services/x.ts': MARK }) }, dir => {
  const r = run(dir);
  ok('15a allowlist-regel buiten src/engine ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('buiten src/engine'), `${r.stdout}${r.stderr}`.trim());
});

// 16. Corrupte allowlist (rode-pad-fixture voor de tweede try/catch).
withFixture({ [ENGINE]: CLEAN, [PIN]: JSON.stringify({ p6ProjectId: 1 }), [ALLOW]: '[kapot' }, dir => {
  const r = run(dir);
  ok('16 corrupte allowlist ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes('allowlist.json — geen geldige JSON'), `${r.stdout}${r.stderr}`.trim());
});

// ── Critreview D deel 1, punt 4: de gaten dichten ──────────────────────────────────────────────────
// 17–19. Datagate-lezingen buiten property-access tellen ook; gepind op 0 ⇒ elk rood op zijn eigen naam.
for (const [label, source, gate] of [
  ['17 destructuring telt als datagate', 'export const f = (t: { p6ProjectId?: string }) => { const { p6ProjectId } = t; return p6ProjectId; };', 'p6ProjectId'],
  ['17a hernoemde destructuring telt', 'export const f = (t: { p6ProjectId?: string }) => { const { p6ProjectId: pid } = t; return pid; };', 'p6ProjectId'],
  ["18 'naam' in x telt als datagate", "export const f = (t: object) => 'p6ActivityType' in t;", 'p6ActivityType'],
  ['19 B1-relatievlag staat op de datagate-lijst', 'export const f = (s: { p6StartAtPredecessorFinishBoundary?: boolean }) => s.p6StartAtPredecessorFinishBoundary;', 'p6StartAtPredecessorFinishBoundary'],
  ['19a levelingDelayElapsed staat op de datagate-lijst', 'export const f = (t: { levelingDelayElapsed?: boolean }) => t.levelingDelayElapsed;', 'levelingDelayElapsed'],
] as const) {
  withFixture({ [ENGINE]: source, [PIN]: JSON.stringify({ [gate]: 0 }) }, dir => {
    const r = run(dir);
    const out = `${r.stdout}${r.stderr}`;
    ok(`${label} ⇒ rood boven pin 0`, r.status !== 0 && out.includes(`datagate '${gate}'`), out.trim());
  });
}

// 20–22. XER-bronsignalen, het bronarchief en niet-letterlijke dynamische imports zijn verboden.
for (const [label, source, needle] of [
  ['20 xerSourceProjectId', 'export const f = (p: { xerSourceProjectId?: string }) => p.xerSourceProjectId;', 'xerSourceProjectId'],
  ['20a xerSourceArchive via destructuring', 'export const f = (p: { xerSourceArchive?: string }) => { const { xerSourceArchive } = p; return xerSourceArchive; };', 'xerSourceArchive'],
  ["20b xerImportMetadata via 'in'", "export const f = (p: object) => 'xerImportMetadata' in p;", 'xerImportMetadata'],
  ["20c p6Source via 'in'", "export const f = (o: object) => 'p6Source' in o;", 'p6Source'],
  ['21 import van services/xerSourceArchive', "import '@/services/xerSourceArchive';", 'src/services/xerSourceArchive'],
  ['22 niet-letterlijke dynamische import', "export const load = (n: string) => import('@/services/' + n);", 'niet-letterlijke'],
  ['22a template-import met substitutie', 'export const load = (n: string) => import(`@/services/${n}`);', 'niet-letterlijke'],
  ['22b require met variabele', 'declare const require: (s: string) => unknown;\nexport const load = (n: string) => require(n);', 'niet-letterlijke'],
] as const) {
  withFixture({ [ENGINE]: source, [PIN]: '{}' }, dir => {
    const r = run(dir);
    const out = `${r.stdout}${r.stderr}`;
    ok(`${label} ⇒ rood`, r.status !== 0 && out.includes(needle), out.trim());
  });
}

// 23. De motorhelper buiten src/engine/ wordt meegescand.
withFixture({ 'src/utils/p6SuspendResume.ts': LEAK, [PIN]: '{}' }, dir => {
  const r = run(dir);
  const out = `${r.stdout}${r.stderr}`;
  ok('23 p6Source in src/utils/p6SuspendResume.ts ⇒ rood', r.status !== 0 && out.includes('src/utils/p6SuspendResume.ts'), out.trim());
});
withFixture({ 'src/utils/andere.ts': LEAK, [PIN]: '{}' }, dir => {
  const r = run(dir);
  ok('23a een gewone utils-module valt buiten de poort', r.status === 0, `${r.stdout}${r.stderr}`.trim());
});

// ── Fable-critreview PR #169, bevinding 4: sleutels uit het register, geen namenlijst ─────────────
// 24–26. Zonder register in de fixture leent de poort de sleutels van deze repository.
for (const [label, source, needle] of [
  ['24 onbekende sleutel op schedulingOptions', 'export const f = (o: { schedulingOptions: { p6Bogus?: boolean } }) => o.schedulingOptions.p6Bogus;', "'p6Bogus'"],
  ['24a onbekende sleutel via een getypte parameter', "import type { EffectiveSchedulingOptions } from '@/types/project';\nexport const f = (so: EffectiveSchedulingOptions | undefined) => (so as unknown as Record<string, boolean>).bogusKey;", "'bogusKey'"],
  ['24b onbekende sleutel via een alias-variabele', 'export const f = (o: { schedulingOptions?: object }) => { const opts = o.schedulingOptions ?? {}; return (opts as { typo?: boolean }).typo; };', "'typo'"],
  ['25 sleutel via een variabele', 'export const f = (o: { schedulingOptions: Record<string, boolean> }, k: string) => o.schedulingOptions[k];', 'niet-letterlijke sleutel'],
  ['25a berekende destructuring', "import type { SchedulingOptions } from '@/types/project';\nexport const f = (so: SchedulingOptions, k: 'lagCalendar') => { const { [k]: v } = so; return v; };", 'berekende destructuring'],
  ["25b onbekende sleutel via 'in'", "export const f = (o: { schedulingOptions: object }) => 'p6Nope' in o.schedulingOptions;", "'p6Nope'"],
  ['26 ongepind herkomstveld (kalender)', 'export const f = (cal: { p6NonWorkPenaltyDates?: string[] }) => cal.p6NonWorkPenaltyDates?.length ?? 0;', "herkomstveld 'p6NonWorkPenaltyDates'"],
  ['26a ongepind herkomstveld via string-index', "export const f = (t: Record<string, unknown>) => t['xerCalendarBlob'];", "herkomstveld 'xerCalendarBlob'"],
] as const) {
  withFixture({ [ENGINE]: source, [PIN]: '{}' }, dir => {
    const r = run(dir);
    const out = `${r.stdout}${r.stderr}`;
    ok(`${label} ⇒ rood`, r.status !== 0 && out.includes(needle), out.trim());
  });
}
// 26b. Een door de motor zelf gedeclareerde p6-naam (methode) en een registersleutel zijn geen lek.
withFixture({
  [ENGINE]: [
    "import type { EffectiveSchedulingOptions } from '@/types/project';",
    'export class S {',
    '  constructor(private readonly so: EffectiveSchedulingOptions) {}',
    '  private p6Helper(): boolean { return this.so.p6RelationFinishBoundary && this.so.lagCalendar !== undefined; }',
    '  run(): boolean { return this.p6Helper(); }',
    '}',
  ].join('\n'),
  [PIN]: '{}',
}, dir => {
  const r = run(dir);
  ok('26b eigen p6-methode + registersleutel ⇒ groen', r.status === 0, `${r.stdout}${r.stderr}`.trim());
});

// 27. Met een register in de fixture: een registerconventie zonder lezing in de motor is rood.
const REGISTRY = 'src/engine/scheduler/conventions/registry.ts';
const TYPES = 'src/types/project.ts';
const miniRegistry = [
  'declare function convention(id: string, ...rest: unknown[]): unknown;',
  "export const CONVENTIONS = [convention('aConv', 'A'), convention('bConv', 'A')];",
].join('\n');
const miniTypes = 'export interface SchedulingOptions { aConv?: boolean; bConv?: boolean; optX?: number }';
/** Regel 5 telt alleen lezingen in bestanden die vanuit solveProject.ts bereikbaar zijn. */
const SOLVER = 'src/engine/scheduler/solveProject.ts';
withFixture({
  [REGISTRY]: miniRegistry, [TYPES]: miniTypes, [PIN]: '{}',
  [SOLVER]: 'export const f = (o: { schedulingOptions: { aConv?: boolean; optX?: number } }) => o.schedulingOptions.aConv === true && o.schedulingOptions.optX === 1;',
}, dir => {
  const r = run(dir);
  const out = `${r.stdout}${r.stderr}`;
  ok('27 ongelezen registerconventie ⇒ rood', r.status !== 0 && out.includes("registerconventie 'bConv'"), out.trim());
  ok('27a de gelezen conventie en de projectoptie zijn geen treffer', !out.includes("'aConv'") && !out.includes("'optX'"), out.trim());
});
withFixture({
  [REGISTRY]: miniRegistry, [TYPES]: miniTypes, [PIN]: '{}',
  [SOLVER]: 'export const f = (o: { schedulingOptions: { aConv?: boolean; bConv?: boolean } }) => o.schedulingOptions.aConv === o.schedulingOptions.bConv;',
}, dir => {
  const r = run(dir);
  ok('27b elke registerconventie gelezen ⇒ groen', r.status === 0, `${r.stdout}${r.stderr}`.trim());
});
// 27c. Een registersleutel van déze repository die niet in het fixtureregister staat, is onbekend.
withFixture({
  [REGISTRY]: miniRegistry, [TYPES]: miniTypes, [PIN]: '{}',
  [SOLVER]: 'export const f = (o: { schedulingOptions: { aConv?: boolean; bConv?: boolean; p6RelationFinishBoundary?: boolean } }) => o.schedulingOptions.aConv === o.schedulingOptions.bConv && o.schedulingOptions.p6RelationFinishBoundary;',
}, dir => {
  const r = run(dir);
  const out = `${r.stdout}${r.stderr}`;
  ok('27c de sleutels komen uit het register onder --root', r.status !== 0 && out.includes("'p6RelationFinishBoundary'"), out.trim());
});


// ── Critreview 2e ronde ───────────────────────────────────────────────────────────────────────────
// 28. Regel 6: een gelijknamige variabele/functie elders stelt een herkomstnaam NIET vrij (review-mutant).
for (const [label, source, needle] of [
  ['28 gelijknamige variabele maakt een herkomstlezing niet vrij',
    'const p6NonWorkPenaltyDates = 1;\nexport const f = (t: { p6NonWorkPenaltyDates?: number }) => (t.p6NonWorkPenaltyDates ?? 0) + p6NonWorkPenaltyDates;',
    "herkomstveld 'p6NonWorkPenaltyDates'"],
  ['28a klassemethode maakt dezelfde naam op een ander object niet vrij',
    'export class S { p6Helper(): number { return 1; } }\nexport const f = (t: { p6Helper?: number }) => t.p6Helper;', "herkomstveld 'p6Helper'"],
  ['28b object-literal-eigenschap geldt alleen voor dát object',
    'const own = { p6Local: 1 };\nexport const f = (t: { p6Local?: number }) => own.p6Local + (t.p6Local ?? 0);', "herkomstveld 'p6Local'"],
] as const) {
  withFixture({ [ENGINE]: source, [PIN]: '{}' }, dir => {
    const r = run(dir);
    const out = `${r.stdout}${r.stderr}`;
    ok(`${label} ⇒ rood`, r.status !== 0 && out.includes(needle), out.trim());
  });
}
withFixture({
  [ENGINE]: [
    'const own = { p6Local: 1 };',
    'export class S { private p6Field = 2; get p6Get(): number { return this.p6Field; } }',
    'const s = new S();',
    'export const f = () => own.p6Local + s.p6Get;',
  ].join('\n'),
  [PIN]: '{}',
}, dir => {
  const r = run(dir);
  ok('28c eigen literal / this / new EigenKlasse in hetzelfde bestand ⇒ groen', r.status === 0, `${r.stdout}${r.stderr}`.trim());
});

// 29. Generieke lezingen en verkapte opties-typen.
for (const [label, source, needle] of [
  ['29 Reflect.get met onbekende sleutel', "export const f = (o: { schedulingOptions: object }) => Reflect.get(o.schedulingOptions, 'p6Nope');", "'p6Nope'"],
  ['29a Reflect.get met variabele sleutel', 'export const f = (o: { schedulingOptions: object }, k: string) => Reflect.get(o.schedulingOptions, k);', 'via Reflect.get'],
  ['29b Object.entries op een opties-object', 'export const f = (o: { schedulingOptions: object }) => Object.entries(o.schedulingOptions).length;', 'via Object.entries'],
  ['29c Object.keys op een opties-object', 'export const f = (o: { schedulingOptions: object }) => Object.keys(o.schedulingOptions);', 'via Object.keys'],
  ['29d hernoemde import-typering + as any',
    "import type { SchedulingOptions as SO_ } from '@/types/project';\nexport const f = (so: SO_) => (so as any).bogusKey;", "'bogusKey'"],
  ['29e import(…)-typering',
    "export const f = (so: import('@/types/project').SchedulingOptions) => (so as any).bogusKey;", "'bogusKey'"],
  ['29f lokale type-alias',
    "import type { EffectiveSchedulingOptions } from '@/types/project';\ntype Opts = EffectiveSchedulingOptions | undefined;\nexport const f = (so: Opts) => (so as any)?.bogusKey;", "'bogusKey'"],
] as const) {
  withFixture({ [ENGINE]: source, [PIN]: '{}' }, dir => {
    const r = run(dir);
    const out = `${r.stdout}${r.stderr}`;
    ok(`${label} ⇒ rood`, r.status !== 0 && out.includes(needle), out.trim());
  });
}

// 30. Regel 5: een lezing telt alleen in een vanuit de solver bereikbaar bestand (geen `import type`).
const DIAG = 'src/engine/scheduler/diag.ts';
const diagSource = 'export const g = (o: { schedulingOptions: { bConv?: boolean } }) => o.schedulingOptions.bConv === true;';
const solverReadsA = 'export const f = (o: { schedulingOptions: { aConv?: boolean } }) => o.schedulingOptions.aConv === true;';
withFixture({ [REGISTRY]: miniRegistry, [TYPES]: miniTypes, [PIN]: '{}', [SOLVER]: solverReadsA, [DIAG]: diagSource }, dir => {
  const r = run(dir);
  ok('30 conventie alleen gelezen in een onbereikbaar diagnosebestand ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes("registerconventie 'bConv'"), `${r.stdout}${r.stderr}`.trim());
});
withFixture({ [REGISTRY]: miniRegistry, [TYPES]: miniTypes, [PIN]: '{}', [SOLVER]: `import type { g } from './diag';\nexport type G = typeof g;\n${solverReadsA}`, [DIAG]: diagSource }, dir => {
  const r = run(dir);
  ok('30a alleen via import type bereikbaar ⇒ rood', r.status !== 0 && `${r.stdout}${r.stderr}`.includes("registerconventie 'bConv'"), `${r.stdout}${r.stderr}`.trim());
});
withFixture({ [REGISTRY]: miniRegistry, [TYPES]: miniTypes, [PIN]: '{}', [SOLVER]: `import { g } from './diag';\nexport const h = g;\n${solverReadsA}`, [DIAG]: diagSource }, dir => {
  const r = run(dir);
  ok('30b via een echte import bereikbaar ⇒ groen', r.status === 0, `${r.stdout}${r.stderr}`.trim());
});

if (diffs.length === 0) console.log(`OK: conventiegrens — ${checks} checks groen`);
else { console.log(`XX conventiegrens — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
