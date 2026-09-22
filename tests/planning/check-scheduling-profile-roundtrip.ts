// Rekenprofielen — IFC-round-trip van `OPS_SchedulingProfile`, de legacy-migratie in de lezer,
// vijandige pset-JSON, byte-identiteit zonder profiel, en de opslag van eigen profielen
// (`ops-schedulingProfiles`). Spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen; faalregels beginnen met "XX".
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import type { ImportResult } from '@/services/importTypes';
import type { Project, SchedulingOptions, SchedulingProfile } from '@/types/project';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { builtInConventions, builtInProfile } from '@/engine/scheduler/conventions/registry';
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
const CUSTOM: SchedulingProfile = {
  baseId: 'p6', id: 'eigen-1', name: 'Kopie van P6',
  overrides: { resumeFromActualElapsed: true, p6OpenLoeTargetSpan: false },
};

// ── 1) Round-trip: drie ingebouwde + één eigen profiel ──────────────────────────────────────────
{
  for (const id of ['p6', 'msproject'] as const) {
    const ifc = writeIFC(fixture({ schedulingProfile: builtInProfile(id) }));
    ok(`01 ${id}: pset geschreven`, ifc.includes("'OPS_SchedulingProfile'"));
    same(`02 ${id}: round-trip`, readIFC(ifc).project.schedulingProfile, builtInProfile(id));
    const json = JSON.parse(ifc.match(/IFCTEXT\('(\{"id":"[^']*)'\)/)![1]) as Record<string, unknown>;
    eq(`03 ${id}: geen naam voor ingebouwd profiel`, 'name' in json, false);
    same(`04 ${id}: alle veertien conventies opgelost weggeschreven`, json.conventions, builtInConventions(id));
  }
  const opsIfc = writeIFC(fixture({ schedulingProfile: builtInProfile('ops') }));
  ok('05 ops zonder afwijkingen: GEEN pset', !opsIfc.includes('OPS_SchedulingProfile'));
  eq('06 ops: na lezen afwezig (≡ ops)', readIFC(opsIfc).project.schedulingProfile, undefined);
  const opsOverride: SchedulingProfile = { ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: true } };
  same('07 ops mét afwijking: round-trip', readIFC(writeIFC(fixture({ schedulingProfile: opsOverride }))).project.schedulingProfile, opsOverride);
  const customIfc = writeIFC(fixture({ schedulingProfile: CUSTOM }));
  same('08 eigen profiel: round-trip (id, naam, basis, afwijkingen)', readIFC(customIfc).project.schedulingProfile, CUSTOM);
  const profileLine = (ifc: string) => ifc.match(PROFILE_LINE)?.[0];
  eq('09 eigen profiel: idempotent (tweede write, zelfde profielregel)', profileLine(writeIFC(readIFC(customIfc))), profileLine(customIfc));
}

// ── 2) Byte-identiteit zonder profiel ───────────────────────────────────────────────────────────
{
  const bare = writeIFC(fixture());
  ok('10 geen profiel ⇒ geen pset', !bare.includes('OPS_SchedulingProfile'));
  eq('11 standaardprofiel schrijft byte-identiek aan geen profiel', writeIFC(fixture({ schedulingProfile: builtInProfile('ops') })), bare);
  // De gecommitte voorbeeldbestanden (gemaakt vóór de rekenprofielen): na lezen geen profiel, en
  // opnieuw schrijven levert geen OPS_SchedulingProfile op.
  const dir = join(ROOT, 'public', 'examples');
  const files = readdirSync(dir).filter(f => f.endsWith('.ifc'));
  ok('12 er zijn voorbeeldbestanden om tegen te meten', files.length > 0);
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    ok(`13 ${f}: bevat nog geen OPS_SchedulingProfile`, !text.includes('OPS_SchedulingProfile'));
    const read = readIFC(text);
    eq(`14 ${f}: na lezen geen profiel (≡ ops)`, read.project.schedulingProfile, undefined);
    ok(`15 ${f}: opnieuw schrijven zonder profiel-pset`, !writeIFC(read).includes('OPS_SchedulingProfile'));
  }
}

// ── 3) De vier migratierijen (§3.4) in de lezer ─────────────────────────────────────────────────
{
  // (1) geen pset, geen opties ⇒ ops (afwezig).
  eq('20 geen pset + geen opties ⇒ ops (afwezig)', readIFC(writeIFC(fixture())).project.schedulingProfile, undefined);
  // (2) alleen OPS_SchedulingOptions zonder p6Source ⇒ ops + niet-gepoorte conventies als afwijking.
  const opts2: SchedulingOptions = { lagCalendar: 'successor', clampNegativeFreeFloat: true, p6UseTaskPlannedStartFloor: true };
  const r2 = readIFC(writeIFC(fixture({ schedulingOptions: opts2 })));
  same('21 opties zonder p6Source ⇒ ops + niet-gepoorte afwijking; gepoorte vlag weg',
    r2.project.schedulingProfile, { ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: true } });
  // INTEGRATIE(rekenprofielen): in de overgang blijft het optieblok ongewijzigd staan.
  same('22 overgang: schedulingOptions ongewijzigd', r2.project.schedulingOptions, opts2);
  const onlyOpts = readIFC(writeIFC(fixture({ schedulingOptions: { nearCriticalThreshold: 2 } })));
  eq('23 alleen optie-sleutels ⇒ ops zonder afwijking (afwezig)', onlyOpts.project.schedulingProfile, undefined);
  const mpp = readIFC(writeIFC(fixture({ schedulingOptions: { resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true } })));
  same('24 beide mpp-vlaggen ⇒ msproject', mpp.project.schedulingProfile, builtInProfile('msproject'));
  // (3) met p6Source ⇒ p6 + overige afwijkingen (p6Source zelf niet in de afwijkingen).
  const opts3: SchedulingOptions = { p6Source: 'XER', totalFloatMode: 'finish', clampNegativeFreeFloat: false, preserveActualDatesInBackwardPass: true };
  const r3 = readIFC(writeIFC(fixture({ schedulingOptions: opts3 })));
  same('25 p6Source ⇒ p6 + afwijkende conventie', r3.project.schedulingProfile, { ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: false } });
  same('26 overgang: p6Source blijft in schedulingOptions', r3.project.schedulingOptions, opts3);
  // (4) nieuwe pset ⇒ zoals gelezen, ook als het legacy-blok iets anders zou migreren.
  const r4 = readIFC(writeIFC(fixture({ schedulingOptions: opts3, schedulingProfile: builtInProfile('msproject') })));
  same('27 pset wint van de legacy-migratie', r4.project.schedulingProfile, builtInProfile('msproject'));
}

// ── 4) Vijandige pset-JSON: valt terug zonder throw ─────────────────────────────────────────────
{
  const base = writeIFC(fixture({ schedulingProfile: CUSTOM, schedulingOptions: { p6Source: 'XER' } }));
  ok('30 anker: pset aanwezig', PROFILE_LINE.test(base));
  const readWith = (json: string) => readIFC(withProfileJson(base, json)).project.schedulingProfile;
  // Onbekende baseId ⇒ ops; ontbrekende conventies ⇒ legacyValue (ops) ⇒ geen afwijkingen.
  same('31 onbekende baseId ⇒ ops', readWith('{"id":"x","baseId":"primavera","conventions":{}}'),
    { baseId: 'ops', id: 'x', name: '', overrides: {} });
  // Onzin in conventions: niet-booleans ⇒ basiswaarde, onbekende sleutels genegeerd.
  same('32 onzin in conventions ⇒ basiswaarden',
    readWith('{"id":"p6","baseId":"p6","conventions":{"clampNegativeFreeFloat":"ja","p6OpenLoeTargetSpan":1,"onzin":true}}'),
    { ...builtInProfile('p6'), overrides: diffAgainstLegacyForP6(['clampNegativeFreeFloat', 'p6OpenLoeTargetSpan']) });
  same('33 conventions geen object ⇒ legacy-waarden', readWith('{"id":"p6","baseId":"p6","conventions":[1,2]}'),
    { ...builtInProfile('p6'), overrides: diffAgainstLegacyForP6([]) });
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
  same('39 10 MB naam: valt terug op de legacy-migratie', hugeResult, builtInProfile('p6'));
  // Corrupte JSON en geen object ⇒ legacy-migratie.
  same('40 corrupte JSON ⇒ legacy-migratie', readWith('{"id":'), builtInProfile('p6'));
  same('41 JSON-array ⇒ legacy-migratie', readWith('[1,2,3]'), builtInProfile('p6'));
  eq('42 sanitize(null) ⇒ undefined', sanitizeSchedulingProfile(null), undefined);
}
/** Verwachte afwijkingen van p6 als alle conventies op hun legacyValue (uit) vallen, behalve de
 *  `invalidTyped`: die waren aanwezig maar ongeldig getypeerd en vallen daarom op de p6-basis. */
function diffAgainstLegacyForP6(invalidTyped: readonly string[]): Partial<Record<string, boolean>> {
  const p6 = builtInConventions('p6');
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(p6)) {
    if (invalidTyped.includes(k)) continue;
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
  } finally {
    console.warn = warn;
  }
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`XX  scheduling-profile-roundtrip: ${diffs.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  scheduling-profile-roundtrip: alle checks groen (${checks})`);
