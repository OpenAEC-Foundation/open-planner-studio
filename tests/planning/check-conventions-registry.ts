// Rekenprofielen — het conventieregister (spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md,
// tweelagenmodel). Bewaakt: register ⇔ ConventionKey, drie ingebouwde waarden per conventie binnen
// het domein, resolve/diff, de legacy-migratie per tak, de XER-defaults-pin, en dat
// totalFloatMode 'auto' in de solver exact rekent als afwezig.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen; faalregels beginnen met "XX".
import { CPMSolver, type CPMResult, type CPMOptions } from '@/engine/scheduler/CPMSolver';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { SchedulingOptions, SchedulingProfile } from '@/types/project';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_KEYS, builtInConventions, builtInProfile,
  defaultOptionsFor, diffAgainstBase, effectiveSchedulingOptions, isDefaultProfile,
  legacyConventions, legacyOptionsToProfile, optionKeysOnly, resolveConventions,
} from '@/engine/scheduler/conventions/registry';
import { XER_SCHEDULING_DEFAULTS } from '@/services/xer/xerScheduleOptions';
import { sanitizeProjectOptions } from '@/services/ifc/schedulingOptionsRead';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: verwacht ${w}, kreeg ${g}`);
};
const ok = (label: string, cond: boolean) => eq(label, cond, true);
/** Sleutelvolgorde-ongevoelige vergelijking voor objecten waar de volgorde geen contract is. */
const canon = (value: unknown): string => JSON.stringify(value, (_k, v: unknown) =>
  (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
    : v);
const same = (label: string, got: unknown, want: unknown) => eq(label, canon(got), canon(want));

// ── 1) Register ⇔ ConventionKey, unieke id's, domein van de ingebouwde waarden ─────────────────
{
  const ids = CONVENTIONS.map(d => d.id);
  eq('01 veertien conventies', ids.length, 14);
  eq('02 unieke id\'s', new Set(ids).size, ids.length);
  same('03 register-lijst == CONVENTION_KEYS (compile-time Record)', [...ids].sort(), [...CONVENTION_KEYS].sort());
  for (const d of CONVENTIONS) {
    for (const p of BUILT_IN_PROFILE_IDS) {
      const v = d.builtIn[p];
      const inDomain = d.kind === 'boolean' ? typeof v === 'boolean'
        : d.kind === 'choice' ? d.values?.includes(v as unknown as string) === true
          : typeof v === 'number' && !!d.range && v >= d.range.min && v <= d.range.max;
      ok(`04 ${d.id}.${p} binnen het domein`, inDomain);
    }
    ok(`05 ${d.id}: legacyValue binnen het domein`, typeof d.legacyValue === 'boolean');
    // Alle huidige conventies zijn van ná de legacy-bestanden: legacy = het OPS-gedrag van toen.
    eq(`06 ${d.id}: legacyValue == OPS-waarde`, d.legacyValue, d.builtIn.ops);
    ok(`07 ${d.id}: labelKey onder conventions.`, d.labelKey === `conventions.${d.id}`);
    ok(`08 ${d.id}: since is een ISO-datum`, /^\d{4}-\d{2}-\d{2}$/.test(d.since));
  }
  // De ingebouwde waarden zoals besloten (modelwijziging punt 1).
  const P6 = builtInConventions('p6');
  const MSP = builtInConventions('msproject');
  const OPS = builtInConventions('ops');
  for (const key of CONVENTION_KEYS) {
    const mspOnly = key === 'resumeFromActualElapsed' || key === 'unstartedIgnoresStatusDate';
    eq(`09 p6.${key}`, P6[key], !mspOnly);
    eq(`10 msproject.${key}`, MSP[key], mspOnly);
    eq(`11 ops.${key}`, OPS[key], false);
  }
  same('12 legacyConventions == ops', legacyConventions(), OPS);
}

// ── 2) resolve / diff ────────────────────────────────────────────────────────────────────────────
{
  for (const b of BUILT_IN_PROFILE_IDS) {
    same(`20 resolve(${b} zonder overrides) == basis`, resolveConventions(builtInProfile(b)), builtInConventions(b));
    same(`21 diff(${b}, basis) == {}`, diffAgainstBase(b, builtInConventions(b)), {});
  }
  same('22 afwezig profiel ≡ ops', resolveConventions(undefined), builtInConventions('ops'));
  const custom: SchedulingProfile = {
    baseId: 'p6', id: 'eigen', name: 'Eigen',
    overrides: { resumeFromActualElapsed: true, p6OpenLoeTargetSpan: false },
  };
  const r = resolveConventions(custom);
  eq('23 override aan', r.resumeFromActualElapsed, true);
  eq('24 override uit', r.p6OpenLoeTargetSpan, false);
  eq('25 niet-overschreven sleutel volgt de basis', r.p6RelationFinishBoundary, true);
  // diff ∘ resolve = identiteit op minimale overrides, voor elke basis en elke enkele afwijking.
  for (const b of BUILT_IN_PROFILE_IDS) {
    for (const key of CONVENTION_KEYS) {
      const overrides = { [key]: !builtInConventions(b)[key] };
      same(`26 diff∘resolve ${b}/${key}`, diffAgainstBase(b, resolveConventions({ ...builtInProfile(b), overrides })), overrides);
    }
  }
  // resolve ∘ diff = identiteit op volledige sets.
  same('27 resolve∘diff', resolveConventions({ ...builtInProfile('msproject'), overrides: diffAgainstBase('msproject', r) }), r);
  // Een niet-minimale override (gelijk aan de basis) wordt door diff weggelaten.
  same('28 diff laat basisgelijke waarden weg', diffAgainstBase('ops', { clampNegativeFreeFloat: false }), {});
  // Vijandige overrides: niet-booleans en onbekende sleutels worden door resolve genegeerd.
  const hostile = { clampNegativeFreeFloat: 'ja', onzin: true } as unknown as SchedulingProfile['overrides'];
  same('29 resolve negeert niet-booleans en onbekende sleutels',
    resolveConventions({ ...builtInProfile('ops'), overrides: hostile }), builtInConventions('ops'));
  ok('30 isDefaultProfile(undefined)', isDefaultProfile(undefined));
  ok('31 isDefaultProfile(ops)', isDefaultProfile(builtInProfile('ops')));
  ok('32 ops met override is niet default', !isDefaultProfile({ ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: true } }));
  ok('33 eigen profiel op ops-basis zonder override is niet default',
    !isDefaultProfile({ baseId: 'ops', id: 'x', name: 'x', overrides: {} }));
  ok('34 msproject is niet default', !isDefaultProfile(builtInProfile('msproject')));
}

// ── 3) Opties ⊥ conventies ──────────────────────────────────────────────────────────────────────
{
  const mixed: SchedulingOptions = {
    p6Source: 'XER', lagCalendar: 'successor', clampNegativeFreeFloat: true, totalFloatMode: 'finish',
    p6OpenLoeTargetSpan: true, useExpectedFinishDates: true,
  };
  eq('40 optionKeysOnly stript conventies en p6Source, volgorde behouden', optionKeysOnly(mixed),
    { lagCalendar: 'successor', totalFloatMode: 'finish', useExpectedFinishDates: true });
  eq('41 optionKeysOnly van alleen conventies ⇒ undefined', optionKeysOnly({ clampNegativeFreeFloat: true }), undefined);
  eq('42 sanitizeProjectOptions stript conventies', sanitizeProjectOptions(mixed),
    { lagCalendar: 'successor', totalFloatMode: 'finish', useExpectedFinishDates: true });
  for (const b of BUILT_IN_PROFILE_IDS) {
    const opts = defaultOptionsFor(b);
    ok(`43 defaultOptionsFor(${b}) bevat geen conventies`, Object.keys(opts).every(k => !(CONVENTION_KEYS as readonly string[]).includes(k)));
  }
  eq('44 defaultOptionsFor(msproject)', defaultOptionsFor('msproject'), { totalFloatMode: 'smallest' });
  eq('45 defaultOptionsFor(ops) — geen auto wegschrijven', defaultOptionsFor('ops'), {});
  const eff = effectiveSchedulingOptions({ schedulingProfile: builtInProfile('msproject'), schedulingOptions: { lagCalendar: '24hour' } });
  eq('46 effective: conventie uit profiel', eff.resumeFromActualElapsed, true);
  eq('47 effective: optie uit project', eff.lagCalendar, '24hour');
  eq('48 effective: geen p6Source uit het profiel', 'p6Source' in eff, false);
}

// ── 4) Legacy-migratie per tak (§3.4, modelwijziging punt 4) ─────────────────────────────────────
{
  const none = legacyOptionsToProfile(undefined);
  same('50 geen blob ⇒ ops zonder overrides', none.profile, builtInProfile('ops'));
  eq('51 geen blob ⇒ geen opties', none.options, undefined);

  // (a) p6Source ⇒ p6; overrides = afwijkende conventies; ontbrekende B-vlaggen waren onder p6Source al aan.
  const a = legacyOptionsToProfile({ p6Source: 'XER', lagCalendar: 'successor', clampNegativeFreeFloat: false, preserveActualDatesInBackwardPass: true });
  eq('52 (a) basis p6', a.profile.baseId, 'p6');
  same('53 (a) alleen de afwijkende conventie wordt override', a.profile.overrides, { clampNegativeFreeFloat: false });
  eq('54 (a) opties zonder p6Source/conventies', a.options, { lagCalendar: 'successor' });

  // (b) geen p6Source: gepoorte vlaggen weg (risico 1), niet-gepoorte worden overrides, basis ops.
  const risk1 = legacyOptionsToProfile({
    p6ZeroDurationUsesPlannedBoundary: true, p6UseTaskPlannedStartFloor: true,
    p6FinishMilestoneBoundaryWindow: true, p6PreserveActualInstants: true,
    p6PreserveZeroDurationConstraintInstants: true, p6OpenLoeTargetSpan: true,
  });
  same('55 (b) risico 1: gepoorte p6-vlaggen zonder p6Source ⇒ ops zonder overrides', risk1.profile, builtInProfile('ops'));
  const b = legacyOptionsToProfile({ clampNegativeFreeFloat: true, preserveActualDatesInBackwardPass: true, totalFloatMode: 'start' });
  eq('56 (b) basis ops', b.profile.baseId, 'ops');
  same('57 (b) niet-gepoorte vlaggen worden overrides', b.profile.overrides, { preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true });
  eq('58 (c) optie-sleutels gaan naar options', b.options, { totalFloatMode: 'start' });

  // (b) msproject-basis: beide mpp-vlaggen true.
  const m = legacyOptionsToProfile({ resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true, clampNegativeFreeFloat: true });
  eq('59 (b) beide mpp-vlaggen ⇒ msproject', m.profile.baseId, 'msproject');
  same('60 (b) msproject-overrides alleen de extra vlag', m.profile.overrides, { clampNegativeFreeFloat: true });
  eq('61 (b) msproject: geen opties', m.options, undefined);
  const half = legacyOptionsToProfile({ resumeFromActualElapsed: true });
  eq('62 (b) één mpp-vlag ⇒ ops', half.profile.baseId, 'ops');
  same('63 (b) die ene vlag wordt override', half.profile.overrides, { resumeFromActualElapsed: true });
  const onlyOptions = legacyOptionsToProfile({ nearCriticalThreshold: 2 });
  same('64 alleen opties ⇒ ops zonder overrides', onlyOptions.profile, builtInProfile('ops'));
  eq('65 alleen opties ⇒ opties behouden', onlyOptions.options, { nearCriticalThreshold: 2 });
}

// ── 5) Pin: de XER-lezer wijkt nooit stil af van de P6-basis ─────────────────────────────────────
{
  const migrated = legacyOptionsToProfile(XER_SCHEDULING_DEFAULTS.schedulingOptions);
  same('70 XER-defaults ⇒ P6-profiel zonder afwijkingen', migrated.profile, builtInProfile('p6'));
  eq('71 XER-defaults: opties == defaultOptionsFor(p6) (incl. volgorde)', migrated.options, defaultOptionsFor('p6'));
  // Elke conventie die de XER-lezer zelf zaait heeft exact de P6-basiswaarde.
  const p6 = builtInConventions('p6');
  for (const [key, value] of Object.entries(XER_SCHEDULING_DEFAULTS.schedulingOptions)) {
    if ((CONVENTION_KEYS as readonly string[]).includes(key)) {
      eq(`72 XER-default ${key} == p6-basis`, value, p6[key as keyof typeof p6]);
    }
  }
}

// ── 6) totalFloatMode 'auto' rekent exact als afwezig ────────────────────────────────────────────
// De hybride regel (afwezig) kiest finish-float voor een GESTARTE taak MÉT statusdatum, en anders
// min(start, finish). P is gestart op 2026-06-01 en voor 90% af: zijn ES ligt dus ver vóór zijn
// restwerk, waardoor start- en eindspeling uiteenlopen (gemeten 17 vs 19 werkdagen). Scenario A (met
// statusdatum) onderscheidt 'auto' van 'smallest' en 'start'; scenario B (zonder statusdatum)
// onderscheidt 'auto' van 'finish'. Samen vangt dit elke verkeerde afbeelding van 'auto'.
{
  const CAL: WorkCalendar = {
    id: 'c', name: 'c', description: 'c',
    workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const mk = (id: string, dur: number): Task => ({
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: createDefaultTaskTime('2026-06-01', dur), resourceIds: [],
  });
  const fs = (id: string, pred: string, succ: string): Sequence =>
    ({ id, predecessorId: pred, successorId: succ, type: 'FINISH_START', lagDays: 0 });
  const net = (): Task[] => {
    const p = mk('P', 10);
    p.time.actualStart = '2026-06-01';
    p.time.completion = 0.9;
    return [p, mk('U', 3), mk('L', 20), mk('END', 1)];
  };
  const seqs = [fs('s1', 'P', 'END'), fs('s2', 'U', 'END'), fs('s3', 'L', 'END')];
  const digest = (r: CPMResult) => JSON.stringify([...r.tasks.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([id, t]) => [id, t.earlyStart, t.earlyFinish, t.lateStart, t.lateFinish, t.totalFloat, t.freeFloat, t.isCritical]));
  const run = (dataDate: string | undefined, so?: SchedulingOptions) => {
    const opts: CPMOptions = { ...(dataDate ? { dataDate } : {}), ...(so ? { schedulingOptions: so } : {}) };
    return digest(new CPMSolver(net(), seqs, CAL, [], opts).solve());
  };
  const absentA = run('2026-06-10');
  const absentB = run(undefined);
  eq('80 A: auto ≡ afwezig (met statusdatum)', run('2026-06-10', { totalFloatMode: 'auto' }), absentA);
  eq('81 B: auto ≡ afwezig (zonder statusdatum)', run(undefined, { totalFloatMode: 'auto' }), absentB);
  // De meetlat onderscheidt: anders bewijzen 80/81 niets.
  ok('82 meetlat A: smallest wijkt af van afwezig', run('2026-06-10', { totalFloatMode: 'smallest' }) !== absentA);
  ok('83 meetlat A: start wijkt af van afwezig', run('2026-06-10', { totalFloatMode: 'start' }) !== absentA);
  ok('84 meetlat B: finish wijkt af van afwezig', run(undefined, { totalFloatMode: 'finish' }) !== absentB);
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`XX  conventions-registry: ${diffs.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  conventions-registry: alle checks groen (${checks})`);
