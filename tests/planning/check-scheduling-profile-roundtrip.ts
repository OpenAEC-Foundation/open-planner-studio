// Rekenprofielen — IFC-round-trip van `OPS_SchedulingProfile`, de legacy-migratie na het lezen,
// vijandige pset-JSON, byte-identiteit zonder profiel, en de opslag van eigen profielen
// (`ops-schedulingProfiles`). Spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md.
//
// Sinds taak C2 (plan 2026-09-22) schrijft en leest writeIFC/readIFC het profiel zelf, en draagt het
// optieblok alleen nog projectopties (+ A22/A23 als true). Oude bestanden (legacy-blob met p6Source en
// conventiesleutels, geen profiel-pset) maakt `legacyIfc` hieronder na door de opties-JSON van een
// vers geschreven bestand te vervangen.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen; faalregels beginnen met "XX".
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC, readSchedulingProfile } from '@/services/ifc/ifcReader';
import type { ImportResult } from '@/services/importTypes';
import type { LegacySchedulingOptions, Project, ProjectSchedulingOptions, SchedulingOptions, SchedulingProfile } from '@/types/project';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { freshPayload } from '@/state/documentContract';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  builtInConventions, builtInProfile, resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { legacyOptionsToProfile } from '@/services/ifc/schedulingProfileMigration';
import {
  MAX_PROFILE_NAME_LENGTH, sanitizeSchedulingProfile,
} from '@/services/ifc/schedulingOptionsRead';
import {
  SCHEDULING_PROFILES_KEY, deleteCustomProfile, loadCustomProfiles, saveCustomProfiles,
  upsertCustomProfile, type ProfileStorage,
} from '@/services/schedulingProfiles/profileStore';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: verwacht ${w}, kreeg ${g}`);
};
const ok = (label: string, cond: boolean) => eq(label, cond, true);
const canon = (value: unknown): string => JSON.stringify(value, (_k, v: unknown) =>
  (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
    : v);
const same = (label: string, got: unknown, want: unknown) => eq(label, canon(got), canon(want));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── Fixture ─────────────────────────────────────────────────────────────────────────────────────
function mkTask(id: string, wbs: string): Task {
  return {
    id, name: id, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: createDefaultTaskTime('2026-06-01', 3), resourceIds: [],
  };
}
function fixture(projectExtra: Partial<Project> = {}): ImportResult {
  return {
    project: {
      id: 'p', name: 'Profieltest', description: '', startDate: '2026-06-01', endDate: '2026-06-30',
      calendarId: 'cal', createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-01-01T00:00:00.000Z',
      author: '', company: '', ...projectExtra,
    },
    calendar: {
      id: 'cal', name: 'Standaard', description: '',
      workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
    },
    tasks: [mkTask('a', '1'), mkTask('b', '2')],
    sequences: [{ id: 's', predecessorId: 'a', successorId: 'b', type: 'FINISH_START', lagDays: 0 }],
    resources: [], assignments: [],
  };
}
const PROFILE_LINE = /IFCPROPERTYSINGLEVALUE\('SchedulingProfile',\$,IFCTEXT\('[^']*'\),\$\)/;
const withProfileJson = (ifc: string, json: string) =>
  ifc.replace(PROFILE_LINE, `IFCPROPERTYSINGLEVALUE('SchedulingProfile',$,IFCTEXT('${json}'),$)`);
/** Sinds C2 schrijft writeIFC het profiel zelf (de naam blijft voor de leesbaarheid van de secties). */
const writeWithProfile = (input: ImportResult): string => writeIFC(input);
/** Het profiel na lezen via readIFC: pset wint, anders migratie van het gelezen optieblok. */
const readProfile = (ifc: string): SchedulingProfile | undefined => readIFC(ifc).project.schedulingProfile;
const OPTIONS_LINE = /IFCPROPERTYSINGLEVALUE\('SchedulingOptions',\$,IFCTEXT\('([^']*)'\),\$\)/;
/** Een bestand zoals een versie vóór de rekenprofielen het schreef: het OPS_SchedulingOptions-blok is
 *  letterlijk `blob` (incl. p6Source/conventies). Optioneel mét profiel-pset (voor "pset wint"). */
function legacyIfc(blob: LegacySchedulingOptions, profile?: SchedulingProfile): string {
  const ifc = writeIFC(fixture({ schedulingProfile: profile, schedulingOptions: { nearCriticalThreshold: 1 } }));
  if (!OPTIONS_LINE.test(ifc)) throw new Error('legacyIfc: geen optie-anker');
  return ifc.replace(OPTIONS_LINE, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('${JSON.stringify(blob)}'),$)`);
}
const CUSTOM: SchedulingProfile = {
  baseId: 'p6', id: 'eigen-1', name: 'Kopie van P6',
  overrides: { resumeFromActualElapsed: true, p6OpenLoeTargetSpan: false },
};

// ── 0) Sinds C2 gekoppeld aan writeIFC/readIFC ──────────────────────────────────────────────────
{
  const plain = writeIFC(fixture({ schedulingProfile: builtInProfile('p6') }));
  ok('00 writeIFC schrijft OPS_SchedulingProfile', plain.includes("'OPS_SchedulingProfile'"));
  same('00b de losse lezer ziet dezelfde pset', readSchedulingProfile(plain), builtInProfile('p6'));
  same('00c readIFC zet het profiel', readIFC(plain).project.schedulingProfile, builtInProfile('p6'));
  eq('00d readIFC op een legacy-p6-blok migreert naar p6',
    readIFC(legacyIfc({ p6Source: 'XER' })).project.schedulingProfile?.baseId, 'p6');
}

// ── 1) Round-trip: drie ingebouwde + één eigen profiel ──────────────────────────────────────────
{
  for (const id of ['p6', 'msproject'] as const) {
    const ifc = writeWithProfile(fixture({ schedulingProfile: builtInProfile(id) }));
    ok(`01 ${id}: pset geschreven`, ifc.includes("'OPS_SchedulingProfile'"));
    same(`02 ${id}: round-trip`, readProfile(ifc), builtInProfile(id));
    const match = ifc.match(/IFCTEXT\('(\{"id":"[^']*)'\)/);
    const json = (match ? JSON.parse(match[1]) : {}) as Record<string, unknown>;
    eq(`03 ${id}: geen naam voor ingebouwd profiel`, 'name' in json, false);
    same(`04 ${id}: alle zevenentwintig conventies opgelost weggeschreven`, json.conventions, builtInConventions(id));
  }
  const opsIfc = writeWithProfile(fixture({ schedulingProfile: builtInProfile('ops') }));
  ok('05 ops zonder afwijkingen: GEEN pset', !opsIfc.includes('OPS_SchedulingProfile'));
  eq('06 ops: na lezen afwezig (≡ ops)', readProfile(opsIfc), undefined);
  const opsOverride: SchedulingProfile = { ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: true } };
  same('07 ops mét afwijking: round-trip', readProfile(writeWithProfile(fixture({ schedulingProfile: opsOverride }))), opsOverride);
  const customIfc = writeWithProfile(fixture({ schedulingProfile: CUSTOM }));
  same('08 eigen profiel: round-trip (id, naam, basis, afwijkingen)', readProfile(customIfc), CUSTOM);
  const profileLine = (ifc: string) => ifc.match(PROFILE_LINE)?.[0];
  const reread = fixture({ schedulingProfile: readProfile(customIfc) });
  eq('09 eigen profiel: idempotent (tweede write, zelfde profielregel)', profileLine(writeWithProfile(reread)), profileLine(customIfc));
}

// ── 2) Byte-identiteit zonder profiel ───────────────────────────────────────────────────────────
{
  const bare = writeWithProfile(fixture());
  ok('10 geen profiel ⇒ geen pset', !bare.includes('OPS_SchedulingProfile'));
  eq('11 standaardprofiel schrijft byte-identiek aan geen profiel', writeWithProfile(fixture({ schedulingProfile: builtInProfile('ops') })), bare);
  // De gecommitte voorbeeldbestanden (gemaakt vóór de rekenprofielen): na lezen geen profiel.
  const dir = join(ROOT, 'public', 'examples');
  const files = readdirSync(dir).filter(f => f.endsWith('.ifc'));
  ok('12 er zijn voorbeeldbestanden om tegen te meten', files.length > 0);
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    ok(`13 ${f}: bevat nog geen OPS_SchedulingProfile`, !text.includes('OPS_SchedulingProfile'));
    eq(`14 ${f}: na lezen geen profiel (≡ ops)`, readProfile(text), undefined);
  }
}

// ── 3) De vier migratierijen (§3.4) na het lezen ────────────────────────────────────────────────
{
  eq('20 geen pset + geen opties ⇒ ops (afwezig)', readProfile(writeWithProfile(fixture())), undefined);
  const opts2: SchedulingOptions = { lagCalendar: 'successor', clampNegativeFreeFloat: true, p6UseTaskPlannedStartFloor: true };
  const ifc2 = legacyIfc(opts2);
  same('21 opties zonder p6Source ⇒ ops + niet-gepoorte afwijking; gepoorte vlag weg',
    readProfile(ifc2), { ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: true } });
  // C2: na lezen draagt het project alleen de projectopties (conventies en p6Source gestript).
  same('22 C2: schedulingOptions alleen projectopties', readIFC(ifc2).project.schedulingOptions, { lagCalendar: 'successor' });
  eq('23 alleen optie-sleutels ⇒ ops zonder afwijking (afwezig)',
    readProfile(legacyIfc({ nearCriticalThreshold: 2 })), undefined);
  same('24 beide mpp-vlaggen ⇒ msproject',
    readProfile(legacyIfc({ resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true })),
    builtInProfile('msproject'));
  const opts3: LegacySchedulingOptions = { p6Source: 'XER', totalFloatMode: 'finish', clampNegativeFreeFloat: false, preserveActualDatesInBackwardPass: true };
  const ifc3 = legacyIfc(opts3);
  // Spec v3: een A-conventie die de blob niet noemt, rekende vandaag als uit ⇒ afwijking van p6.
  // A17 staat sinds 2026-09-23 (§1d-7) ook in P6 uit, dus "ontbrekend ⇒ uit" is daar geen afwijking meer;
  // B3/B4 volgen hun P6-waarde (uit) en zijn evenmin een afwijking.
  same('25 p6Source ⇒ p6; genoemde én ontbrekende A-conventies volgen de blob, B-set op P6-waarde', readProfile(ifc3), {
    ...builtInProfile('p6'),
    overrides: {
      clampNegativeFreeFloat: false, p6ZeroDurationUsesPlannedBoundary: false, p6UseTaskPlannedStartFloor: false,
      p6PreserveActualInstants: false, p6PreserveZeroDurationConstraintInstants: false,
    },
  });
  same('26 C2: p6Source en conventies gestript uit schedulingOptions', readIFC(ifc3).project.schedulingOptions, { totalFloatMode: 'finish' });
  same('27 pset wint van de legacy-migratie', readProfile(legacyIfc(opts3, builtInProfile('msproject'))), builtInProfile('msproject'));
  // X12 brok 2, 3 en 4 (critreview must-fix 1): C1–C9, C11, C12 en C14 (C9: brok 6, C14: brok 10) via de echte IFC-leesroute. Een oud XER-IFC zonder
  // C-sleutels rekent C1–C9, C11, C12 en C14 op de P6-profielwaarde; een expliciete false in het blok blijft false.
  const C_KEYS = [
    'p6CompletedPredecessorAtDataDate', 'p6FreeFloatOnOwnCalendar', 'p6CompletedRemainingLag',
    'p6CompletedOutOfSequenceWindow', 'p6CompletedPhysicalAtDataDate', 'p6InProgressStartLagElapsed',
    'p6FinishFinishStartMilestoneLateFinish', 'p6StartedTaskIgnoresPlannedStartFloor',
    'p6LateFinishOnOwnCalendar', 'p6ProgressOverrideIgnoresStartedSuccessor', 'p6FinishNotBeforeFinishFinishBound',
    'p6AlapPositionedFromSuccessors',
  ] as const;
  const oldXer = resolveConventions(readProfile(legacyIfc({ p6Source: 'XER' })));
  for (const key of C_KEYS) eq(`28 oud XER-IFC zonder ${key} ⇒ P6-profielwaarde`, oldXer[key], builtInConventions('p6')[key]);
  const oldXerFalse = resolveConventions(readProfile(legacyIfc({
    p6Source: 'XER', p6CompletedPredecessorAtDataDate: false, p6FreeFloatOnOwnCalendar: false, p6CompletedRemainingLag: false,
    p6CompletedOutOfSequenceWindow: false, p6CompletedPhysicalAtDataDate: false, p6InProgressStartLagElapsed: false,
    p6FinishFinishStartMilestoneLateFinish: false, p6StartedTaskIgnoresPlannedStartFloor: false,
    p6LateFinishOnOwnCalendar: false, p6ProgressOverrideIgnoresStartedSuccessor: false, p6FinishNotBeforeFinishFinishBound: false,
    p6AlapPositionedFromSuccessors: false,
  })));
  for (const key of C_KEYS) eq(`28b oud XER-IFC met ${key}=false ⇒ blijft false`, oldXerFalse[key], false);
}

// ── 4) Vijandige pset-JSON: valt terug zonder throw ─────────────────────────────────────────────
{
  const LEGACY_BLOB: LegacySchedulingOptions = { p6Source: 'XER' };
  const base = legacyIfc(LEGACY_BLOB, CUSTOM);
  // Waar de pset onbruikbaar is valt de lezer terug op de migratie van het legacy-blok.
  const FALLBACK = legacyOptionsToProfile(LEGACY_BLOB).profile;
  ok('30b anker: de terugval is herkenbaar (p6-basis)', FALLBACK.baseId === 'p6');
  ok('30 anker: pset aanwezig', PROFILE_LINE.test(base));
  const readWith = (json: string) => readProfile(withProfileJson(base, json));
  // Onbekende baseId ⇒ ops; ontbrekende conventies ⇒ legacyValue (ops) ⇒ geen afwijkingen.
  same('31 onbekende baseId ⇒ ops', readWith('{"id":"x","baseId":"primavera","conventions":{}}'),
    { baseId: 'ops', id: 'x', name: '', overrides: {} });
  // Ongeldig getypeerd ⇒ legacyValue (uit), nooit de p6-basis (aan); onbekende sleutels genegeerd.
  const hostile = readWith('{"baseId":"p6","conventions":{"clampNegativeFreeFloat":"ja","p6OpenLoeTargetSpan":1,"onzin":true}}');
  eq('32 ongeldig getypeerd ⇒ legacyValue (clampNegativeFreeFloat uit)', hostile && resolveConventions(hostile).clampNegativeFreeFloat, false);
  same('32b ongeldig/ontbrekend ⇒ alle conventies op legacy (uit)', hostile, { ...builtInProfile('p6'), overrides: diffAgainstLegacyForP6() });
  same('33 conventions geen object ⇒ legacy-waarden', readWith('{"id":"p6","baseId":"p6","conventions":[1,2]}'),
    { ...builtInProfile('p6'), overrides: diffAgainstLegacyForP6() });
  // Ingebouwde id met een andere basis ⇒ de basis-id.
  eq('34 id "p6" op msproject-basis ⇒ id msproject', readWith('{"id":"p6","baseId":"msproject","conventions":{}}')?.id, 'msproject');
  // Naam: te lang ⇒ leeg (profiel blijft); geen string ⇒ leeg.
  const longName = 'x'.repeat(MAX_PROFILE_NAME_LENGTH + 1);
  eq('35 te lange naam ⇒ leeg', readWith(`{"id":"eigen","baseId":"ops","name":"${longName}","conventions":{}}`)?.name, '');
  eq('36 naam precies op de grens blijft', readWith(`{"id":"eigen","baseId":"ops","name":"${'y'.repeat(MAX_PROFILE_NAME_LENGTH)}","conventions":{}}`)?.name.length, MAX_PROFILE_NAME_LENGTH);
  eq('37 te lange id ⇒ basis-id', readWith(`{"id":"${'i'.repeat(65)}","baseId":"msproject","conventions":{}}`)?.id, 'msproject');
  // 10 MB naam: de rauwe JSON overschrijdt de bovengrens ⇒ pset genegeerd ⇒ legacy-migratie (p6Source ⇒ p6).
  const huge = `{"id":"eigen","baseId":"ops","name":"${'z'.repeat(10 * 1024 * 1024)}","conventions":{}}`;
  let hugeResult: SchedulingProfile | undefined;
  let threw = false;
  try { hugeResult = readWith(huge); } catch { threw = true; }
  eq('38 10 MB naam: geen throw', threw, false);
  same('39 10 MB naam: valt terug op de legacy-migratie', hugeResult, FALLBACK);
  const safeRead = (json: string): SchedulingProfile | undefined | 'THROW' => {
    try { return readWith(json); } catch { return 'THROW'; }
  };
  same('40 corrupte JSON ⇒ legacy-migratie (geen throw)', safeRead('{"id":'), FALLBACK);
  same('41 JSON-array ⇒ legacy-migratie', safeRead('[1,2,3]'), FALLBACK);
  eq('42 sanitize(null) ⇒ undefined', sanitizeSchedulingProfile(null), undefined);
}
/** Verwachte afwijkingen van p6 als alle conventies op hun legacyValue (uit) vallen. */
function diffAgainstLegacyForP6(): Partial<Record<string, boolean>> {
  const p6 = builtInConventions('p6');
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(p6)) {
    if (v !== false) out[k] = false;
  }
  return out;
}

// ── 5) Missende sleutel ⇒ legacyValue, niet de basiswaarde ──────────────────────────────────────
{
  const p6 = builtInConventions('p6');
  const partial = { ...p6 } as Record<string, boolean>;
  delete partial.p6OpenLoeTargetSpan; // een bestand van vóór deze conventie
  const read = sanitizeSchedulingProfile({ id: 'p6', baseId: 'p6', conventions: partial });
  same('50 ontbrekende conventie ⇒ legacyValue (uit), dus afwijking van p6', read?.overrides, { p6OpenLoeTargetSpan: false });
}

// ── 6) Opslag van eigen profielen ───────────────────────────────────────────────────────────────
{
  const memory = (initial?: string): ProfileStorage & { value: string | null } => {
    const s = {
      value: initial ?? null,
      getItem: (key: string) => (key === SCHEDULING_PROFILES_KEY ? s.value : null),
      setItem: (key: string, v: string) => { if (key === SCHEDULING_PROFILES_KEY) s.value = v; },
    };
    return s;
  };
  const warn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    eq('60 leeg ⇒ lege lijst', loadCustomProfiles(memory()), []);
    eq('61 geen opslag (Node) ⇒ lege lijst', loadCustomProfiles(undefined), []);
    const corrupt = memory('{niet json');
    eq('62 corrupte JSON ⇒ lege lijst', loadCustomProfiles(corrupt), []);
    eq('63 corrupte JSON ⇒ één waarschuwing', warnings.length, 1);
    eq('64 te grote opslag ⇒ lege lijst', loadCustomProfiles(memory(`["${'a'.repeat(300 * 1024)}"]`)), []);
    eq('65 geen array ⇒ lege lijst', loadCustomProfiles(memory('{"a":1}')), []);
    const mixed = memory(JSON.stringify([
      CUSTOM,
      { baseId: 'onbekend', id: 'x', name: 'x', overrides: {} },
      { baseId: 'ops', id: 'p6', name: 'ingebouwde id', overrides: {} },
      { baseId: 'ops', id: 'z', name: 'n'.repeat(MAX_PROFILE_NAME_LENGTH + 1), overrides: {} },
      { baseId: 'ops', id: 'w', name: 'Wel', overrides: { clampNegativeFreeFloat: false, onzin: true, preserveActualDatesInBackwardPass: 'ja' } },
      { ...CUSTOM, name: 'dubbele id' },
    ]));
    same('66 alleen geldige items, overrides geminimaliseerd, dubbele id weg', loadCustomProfiles(mixed), [
      CUSTOM, { baseId: 'ops', id: 'w', name: 'Wel', overrides: {} },
    ]);
    const store = memory();
    ok('67 upsert nieuw', upsertCustomProfile(CUSTOM, store));
    ok('68 upsert ingebouwde id geweigerd', !upsertCustomProfile({ ...CUSTOM, id: 'ops' }, store));
    ok('69 upsert vervangt op id', upsertCustomProfile({ ...CUSTOM, name: 'Hernoemd' }, store));
    same('70 na upserts', loadCustomProfiles(store), [{ ...CUSTOM, name: 'Hernoemd' }]);
    deleteCustomProfile('eigen-1', store);
    eq('71 na verwijderen leeg', loadCustomProfiles(store), []);
    saveCustomProfiles([CUSTOM, { ...CUSTOM, id: '' }], store);
    same('72 save filtert ongeldige items', loadCustomProfiles(store), [CUSTOM]);
    // Een opslag die gooit (QuotaExceededError bij schrijven, SecurityError bij lezen): nooit een throw.
    const quota: ProfileStorage = {
      getItem: () => JSON.stringify([CUSTOM]),
      setItem: () => { throw new DOMException('vol', 'QuotaExceededError'); },
    };
    let threw = false;
    let upserted: boolean | undefined;
    try { upserted = upsertCustomProfile({ ...CUSTOM, id: 'nieuw' }, quota); } catch { threw = true; }
    eq('73 upsert bij QuotaExceeded: geen throw', threw, false);
    eq('74 upsert bij QuotaExceeded: false', upserted, false);
    eq('75 save bij QuotaExceeded: false', saveCustomProfiles([CUSTOM], quota), false);
    eq('76 delete bij QuotaExceeded: false', deleteCustomProfile('eigen-1', quota), false);
    const blocked: ProfileStorage = {
      getItem: () => { throw new DOMException('geblokkeerd', 'SecurityError'); },
      setItem: () => { throw new DOMException('geblokkeerd', 'SecurityError'); },
    };
    let loadThrew = false;
    let loaded: SchedulingProfile[] | undefined;
    try { loaded = loadCustomProfiles(blocked); } catch { loadThrew = true; }
    eq('77 load bij gooiende getItem: geen throw', loadThrew, false);
    eq('78 load bij gooiende getItem: lege lijst', loaded, []);
    eq('79 save naar werkende opslag: true', saveCustomProfiles([CUSTOM], memory()), true);
  } finally {
    console.warn = warn;
  }
}

// ── C2: het optieblok in het eindmodel ──────────────────────────────────────────────────────────
// Verwachte JSON met de hand (spec v3.1 §3.3). Mutatiebewijs (plan C2 step 5): de strip in de lezer
// weglaten ⇒ 22, 26 en C2-04 rood (gemeten).
const optionsJsonOf = (ifc: string): string | undefined => OPTIONS_LINE.exec(ifc)?.[1];
function roundTripC2(profile: SchedulingProfile | undefined, options: ProjectSchedulingOptions | SchedulingOptions | undefined) {
  const base = freshPayload();
  const written = writeIFC(buildWriteIFCInput({ ...base, project: { ...base.project, schedulingProfile: profile, schedulingOptions: options } }));
  return { written, read: readIFC(written).project };
}
{
  const opts: ProjectSchedulingOptions = { totalFloatMode: 'finish', useProjectEndDateForFloat: true };
  const { written, read } = roundTripC2(builtInProfile('p6'), opts);
  eq('C2-01 P6: optieblok = alleen de projectopties', optionsJsonOf(written), JSON.stringify(opts));
  eq('C2-02 P6: opties lezen terug zonder conventies', read.schedulingOptions, opts);
}
{
  const { written, read } = roundTripC2(builtInProfile('msproject'), undefined);
  eq('C2-03 MS Project: A22/A23 gespiegeld, alleen als true (compat oude versies)',
    optionsJsonOf(written), '{"resumeFromActualElapsed":true,"unstartedIgnoresStatusDate":true}');
  eq('C2-04 gespiegelde conventies komen niet terug als optie', read.schedulingOptions, undefined);
  eq('C2-05 profiel wint van de spiegel', read.schedulingProfile, builtInProfile('msproject'));
}
{
  const { written, read } = roundTripC2(undefined, { lagCalendar: 'successor' });
  eq('C2-06 OPS: geen profiel-pset', written.includes('OPS_SchedulingProfile'), false);
  eq('C2-07 OPS: optieblok byte-identiek aan vóór de profielen', optionsJsonOf(written), '{"lagCalendar":"successor"}');
  eq('C2-08 OPS leest terug zonder profiel', [read.schedulingProfile, read.schedulingOptions], [undefined, { lagCalendar: 'successor' }]);
}
{
  // H5: de catch in extractSchedulingOptions (corrupte optie-JSON) — geen throw, opties en profiel
  // blijven op de default (ops).
  const corrupt = writeIFC(fixture({ schedulingOptions: { nearCriticalThreshold: 1 } }))
    .replace(OPTIONS_LINE, `IFCPROPERTYSINGLEVALUE('SchedulingOptions',$,IFCTEXT('{"lagCalendar":'),$)`);
  let corruptRead: Project | 'THROW';
  try { corruptRead = readIFC(corrupt).project; } catch { corruptRead = 'THROW'; }
  eq('C2-11 corrupte optie-JSON ⇒ geen throw, geen opties, geen profiel',
    corruptRead === 'THROW' ? 'THROW' : [corruptRead.schedulingOptions, corruptRead.schedulingProfile], [undefined, undefined]);
}
// ── C2-aanvulling: afwijkingen op een ingebouwd id overleven een opslag letterlijk ─────────────────
// Besluit 2026-09-22 (review baan D): P6{A13 uit} → OPS → opslaan → heropenen → P6 = het origineel.
// De pset draagt daarvoor naast `conventions` ook `overrides` letterlijk. Verwachtingen met de hand.
// Mutatiebewijs: `overrides` niet wegschrijven (schedulingProfileToJson) ⇒ C2b-01/03 rood; de
// letterlijke overlay in sanitizeSchedulingProfile weglaten ⇒ C2b-01 rood; carriesProfile terug naar
// isDefaultProfile ⇒ C2b-02 rood.
{
  const p6Adjusted: SchedulingProfile = { ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: false } };
  const underOps = switchProfile(p6Adjusted, 'ops');
  const written = writeIFC(fixture({ schedulingProfile: underOps }));
  const reread = readIFC(written).project.schedulingProfile;
  const back = switchProfile(reread, 'p6');
  eq('C2b-01 P6{A13 uit} → OPS → opslaan → heropenen → P6: A13 blijft uit', resolveConventions(back).clampNegativeFreeFloat, false);
  same('C2b-01b …en is exact het origineel', back, p6Adjusted);
  ok('C2b-02 OPS met alleen een basisgelijke letterlijke afwijking schrijft tóch een pset', written.includes("'OPS_SchedulingProfile'"));
  const json = JSON.parse(written.match(/IFCTEXT\('(\{"id":"[^']*)'\)/)?.[1] ?? '{}') as Record<string, unknown>;
  same('C2b-03 de pset draagt overrides letterlijk', json.overrides, { clampNegativeFreeFloat: false });
  // Vijandige letterlijke afwijkingen: onbekend/niet-boolean ⇒ genegeerd; in strijd met de opgeloste
  // conventions ⇒ genegeerd (de opgeloste set is waarmee het bestand rekende).
  const hostile = sanitizeSchedulingProfile({
    id: 'ops', baseId: 'ops', conventions: builtInConventions('ops'),
    overrides: { clampNegativeFreeFloat: false, preserveActualDatesInBackwardPass: true, onzin: true, p6OpenLoeTargetSpan: 'ja' },
  });
  same('C2b-04 vijandige overrides: alleen de consistente letterlijke afwijking blijft', hostile?.overrides, { clampNegativeFreeFloat: false });
  same('C2b-05 zonder overrides-veld (ouder bestand) ⇒ alleen het verschil met de basis',
    sanitizeSchedulingProfile({ id: 'ops', baseId: 'ops', conventions: builtInConventions('ops') }), builtInProfile('ops'));
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`XX  scheduling-profile-roundtrip: ${diffs.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  scheduling-profile-roundtrip: alle checks groen (${checks})`);
