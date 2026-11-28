import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConventionKey, EffectiveSchedulingOptions, LegacySchedulingOptions, ProjectSchedulingOptions, SchedulingOptions, SchedulingProfile } from '@/types/project';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_KEYS, CONVENTION_THEMES, isOffInEveryBuiltIn, builtInConventions, builtInProfile, defaultOptionsFor, diffAgainstBase, effectiveSchedulingOptions, isConventionKey, isDefaultProfile, legacyConventions, resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { optionKeysOnly, legacyOptionsToProfile, legacyOptionsBlobFor, LEGACY_XER_ALWAYS_ON, LEGACY_XER_ALSO_ON_X12, legacyXerDefault } from '@/services/ifc/schedulingProfileMigration';
import { XER_SCHEDULING_DEFAULTS } from '@/services/xer/xerScheduleOptions';
import { sanitizeProjectOptions, sanitizeSchedulingOptions } from '@/services/ifc/schedulingOptionsRead';
import { LOCALES as I18N_LOCALES } from '../../scripts/i18n-tools';

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
const OPS_ON: ReadonlySet<ConventionKey> = new Set<ConventionKey>(['milestoneWithoutPredecessorAtDayEnd', 'workdayDurationMeasure']);

{
  const ids = CONVENTIONS.map(d => d.id);
  eq('01 negenentwintig conventies', ids.length, 29);
  eq('02 unieke id\'s', new Set(ids).size, ids.length);
  same('03 register-lijst == CONVENTION_KEYS (compile-time Record)', [...ids].sort(), [...CONVENTION_KEYS].sort());
  for (const d of CONVENTIONS) {
    for (const p of BUILT_IN_PROFILE_IDS) {
      const v = d.builtIn[p];
      ok(`04 ${d.id}.${p} binnen het domein`, d.kind === 'boolean' && typeof v === 'boolean');
    }
    ok(`05 ${d.id}: legacyValue binnen het domein`, typeof d.legacyValue === 'boolean');
    eq(`06 ${d.id}: legacyValue == OPS-waarde`, d.legacyValue, d.builtIn.ops);
    ok(`07 ${d.id}: labelKey onder conventions.`, d.labelKey === `conventions.${d.id}`);
    ok(`08 ${d.id}: since is een ISO-datum`, /^\d{4}-\d{2}-\d{2}$/.test(d.since));
    ok(`08b ${d.id}: thema bekend`, (CONVENTION_THEMES as readonly string[]).includes(d.theme));
  }
  same('08c thema msproject == de MS Project-conventies', CONVENTIONS.filter(d => d.theme === 'msproject').map(d => d.id),
    CONVENTIONS.filter(d => d.builtIn.msproject).map(d => d.id));
  same('08d alleen-eigen-profielen afgeleid', CONVENTIONS.filter(isOffInEveryBuiltIn).map(d => d.id),
    CONVENTIONS.filter(d => BUILT_IN_PROFILE_IDS.every(id => !d.builtIn[id])).map(d => d.id));
  same('08f alleen-eigen-profielen gepind', CONVENTIONS.filter(isOffInEveryBuiltIn).map(d => d.id).sort(), [
    'p6CompletedPredecessorAtDataDate', 'p6CompletedOutOfSequenceWindow',
    'p6FinishMilestoneBoundaryWindow', 'p6CompletedDataDateWindow', 'p6CompletedLoeActualFinish',
  ].sort());
  ok('08e A19 niet bij alleen-eigen-profielen (aan in P6)', !isOffInEveryBuiltIn(CONVENTIONS.find(d => d.id === 'p6UseRemainingStartForProgress')!));
  const P6 = builtInConventions('p6');
  const MSP = builtInConventions('msproject');
  const OPS = builtInConventions('ops');
  const P6_OFF_GROUP_C: ReadonlySet<ConventionKey> = new Set<ConventionKey>([
    'p6CompletedPredecessorAtDataDate', 'p6CompletedOutOfSequenceWindow', 'milestoneWithoutPredecessorAtDayEnd',
    'workdayDurationMeasure',
    'p6FinishMilestoneBoundaryWindow', 'p6CompletedDataDateWindow', 'p6CompletedLoeActualFinish',
  ]);
  for (const key of CONVENTION_KEYS) {
    const mspOnly = key === 'resumeFromActualElapsed' || key === 'unstartedIgnoresStatusDate';
    eq(`09 p6.${key}`, P6[key], !mspOnly && !P6_OFF_GROUP_C.has(key));
    eq(`10 msproject.${key}`, MSP[key], mspOnly);
    eq(`11 ops.${key}`, OPS[key], OPS_ON.has(key));
  }
  same('12 legacyConventions == ops', legacyConventions(), OPS);
}

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
  for (const b of BUILT_IN_PROFILE_IDS) {
    for (const key of CONVENTION_KEYS) {
      const overrides = { [key]: !builtInConventions(b)[key] };
      same(`26 diff∘resolve ${b}/${key}`, diffAgainstBase(b, resolveConventions({ ...builtInProfile(b), overrides })), overrides);
    }
  }
  same('27 resolve∘diff', resolveConventions({ ...builtInProfile('msproject'), overrides: diffAgainstBase('msproject', r) }), r);
  same('28 diff laat basisgelijke waarden weg', diffAgainstBase('ops', { clampNegativeFreeFloat: false }), {});
  const hostile = { clampNegativeFreeFloat: 'ja', onzin: true } as unknown as SchedulingProfile['overrides'];
  same('29 resolve negeert niet-booleans en onbekende sleutels',
    resolveConventions({ ...builtInProfile('ops'), overrides: hostile }), builtInConventions('ops'));
  ok('30 isDefaultProfile(undefined)', isDefaultProfile(undefined));
  ok('31 isDefaultProfile(ops)', isDefaultProfile(builtInProfile('ops')));
  ok('32 ops met override is niet default', !isDefaultProfile({ ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: true } }));
  ok('33 eigen profiel op ops-basis zonder override is niet default',
    !isDefaultProfile({ baseId: 'ops', id: 'x', name: 'x', overrides: {} }));
  ok('34 msproject is niet default', !isDefaultProfile(builtInProfile('msproject')));
  ok('34a ops met afwijking gelijk aan de basis is niet default',
    !isDefaultProfile({ ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: false } }));
  ok('34b onbekende/niet-boolean sleutels tellen niet als afwijking',
    isDefaultProfile({ ...builtInProfile('ops'), overrides: { onzin: true, clampNegativeFreeFloat: 'ja' } as never }));
  ok('34c geen per-bestand-conventies meer', CONVENTIONS.every(d => !('perFile' in d)));
  eq('34d A19 in de ingebouwde profielen: P6 aan, MS Project en OPS uit',
    (['p6', 'msproject', 'ops'] as const).map(id => builtInConventions(id).p6UseRemainingStartForProgress), [true, false, false]);
}

{
  const mixed: LegacySchedulingOptions = {
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
  eq('44 defaultOptionsFor(msproject) — leeg (speling automatisch, zoals MSP)', defaultOptionsFor('msproject'), {});
  eq('45 defaultOptionsFor(ops) — leeg (afwezig ≡ huidig gedrag)', defaultOptionsFor('ops'), {});
  const eff = effectiveSchedulingOptions({ schedulingProfile: builtInProfile('msproject'), schedulingOptions: { lagCalendar: '24hour' } });
  eq('46 effective: conventie uit profiel', eff.resumeFromActualElapsed, true);
  eq('47 effective: optie uit project', eff.lagCalendar, '24hour');
  eq('48 effective: alle negenentwintig conventies aanwezig', CONVENTION_KEYS.every(k => typeof eff[k] === 'boolean'), true);
  const effWins = effectiveSchedulingOptions({ schedulingProfile: builtInProfile('ops'), schedulingOptions: { clampNegativeFreeFloat: true } as unknown as ProjectSchedulingOptions });
  eq('49 effective: profiel wint van conventiesleutel in het blok', effWins.clampNegativeFreeFloat, false);
  const bare: SchedulingOptions = { lagCalendar: 'successor' };
  // @ts-expect-error — een kaal optieblok mag het profiel niet omzeilen
  const notEffective: EffectiveSchedulingOptions = bare;
  void notEffective;
}

{
  const none = legacyOptionsToProfile(undefined);
  same('50 geen blob ⇒ ops zonder overrides', none.profile, builtInProfile('ops'));
  eq('51 geen blob ⇒ geen opties', none.options, undefined);

  const partial = legacyOptionsToProfile({ p6Source: 'XER', p6UseTaskPlannedStartFloor: true });
  eq('52 rij 2: basis p6', partial.profile.baseId, 'p6');
  const r = resolveConventions(partial.profile);
  const on = CONVENTION_KEYS.filter(k => r[k]).sort();
  same('53 rij 2: gedeeltelijke blob ⇒ alleen A16, A19 + B1, B2, B5 + C2, C3, C5–C9, C11, C12 en C14 aan', on, [
    'p6AlapPositionedFromSuccessors', 'p6BackwardLagFinishBoundary',
    'p6CompletedPhysicalAtDataDate', 'p6CompletedRemainingLag',
    'p6FinishFinishStartMilestoneLateFinish', 'p6FinishNotBeforeFinishFinishBound', 'p6FreeFloatOnOwnCalendar',
    'p6InProgressStartLagElapsed', 'p6LateFinishOnOwnCalendar', 'p6OpenLoeTargetSpan', 'p6ProgressOverrideIgnoresStartedSuccessor',
    'p6RelationFinishBoundary', 'p6StartedTaskIgnoresPlannedStartFloor', 'p6UseRemainingStartForProgress', 'p6UseTaskPlannedStartFloor',
  ]);
  eq('54 rij 2: opties zonder p6Source/conventies', partial.options, undefined);
  const a = legacyOptionsToProfile({ p6Source: 'XER', lagCalendar: 'successor', p6UseRemainingStartForProgress: false });
  eq('55 rij 2: A19 false uit het bestand wordt afwijking', a.profile.overrides.p6UseRemainingStartForProgress, false);
  eq('55b rij 2: A19 true uit het bestand = de P6-basis, geen afwijking',
    legacyOptionsToProfile({ p6Source: 'XER', p6UseRemainingStartForProgress: true }).profile.overrides.p6UseRemainingStartForProgress, undefined);
  eq('56 rij 2: projectopties blijven', a.options, { lagCalendar: 'successor' });

  const risk1 = legacyOptionsToProfile({
    p6ZeroDurationUsesPlannedBoundary: true, p6UseTaskPlannedStartFloor: true,
    p6FinishMilestoneBoundaryWindow: true, p6PreserveActualInstants: true,
    p6UseRemainingStartForProgress: true, p6PreserveZeroDurationConstraintInstants: true,
    p6OpenLoeTargetSpan: true, p6RelationFinishBoundary: true,
  });
  same('57 rij 4: vijandige blob met p6-vlaggen incl. A19 zonder p6Source ⇒ ops zonder overrides', risk1.profile, builtInProfile('ops'));
  const b = legacyOptionsToProfile({ clampNegativeFreeFloat: true, preserveActualDatesInBackwardPass: true, totalFloatMode: 'start' });
  eq('58 rij 4: basis ops', b.profile.baseId, 'ops');
  same('59 rij 4: A12/A13 worden afwijkingen', b.profile.overrides, { preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true });
  eq('60 projectopties gaan naar options', b.options, { totalFloatMode: 'start' });
  const half = legacyOptionsToProfile({ resumeFromActualElapsed: true });
  eq('61 rij 4: één mpp-vlag ⇒ ops', half.profile.baseId, 'ops');
  same('62 rij 4: die ene vlag wordt afwijking', half.profile.overrides, { resumeFromActualElapsed: true });

  const m = legacyOptionsToProfile({ resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true, clampNegativeFreeFloat: true });
  eq('63 rij 3: beide mpp-vlaggen ⇒ msproject', m.profile.baseId, 'msproject');
  same('64 rij 3: alleen de extra vlag is afwijking', m.profile.overrides, { clampNegativeFreeFloat: true });
  eq('65 rij 3: geen opties', m.options, undefined);
  const onlyOptions = legacyOptionsToProfile({ nearCriticalThreshold: 2 });
  same('66 alleen opties ⇒ ops zonder overrides', onlyOptions.profile, builtInProfile('ops'));
  eq('67 alleen opties ⇒ opties behouden', onlyOptions.options, { nearCriticalThreshold: 2 });
}

{
  same('70 XER-defaults: opties == defaultOptionsFor(p6) + de twee bronsignalen uit p6OptionDefaults',
    XER_SCHEDULING_DEFAULTS.schedulingOptions,
    { ...defaultOptionsFor('p6'), useExpectedFinishDates: true, p6CompletedLateFromRemainingWindow: true });
  eq('70a defaultOptionsFor(p6) zonder bronsignalen', ['useExpectedFinishDates', 'p6CompletedLateFromRemainingWindow']
    .filter(k => k in defaultOptionsFor('p6')), []);
  ok('71 XER-defaults: geen conventiesleutels en geen bronmarkering',
    Object.keys(XER_SCHEDULING_DEFAULTS.schedulingOptions).every(k => !(CONVENTION_KEYS as readonly string[]).includes(k) && k !== 'p6Source'));
  same('72 een blob mét bronmarkering en de XER-defaults ⇒ P6-profiel zonder afwijkingen',
    legacyOptionsToProfile({ p6Source: 'XER', ...XER_SCHEDULING_DEFAULTS.schedulingOptions,
      preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true, p6ZeroDurationUsesPlannedBoundary: true,
      p6UseTaskPlannedStartFloor: true, p6FinishMilestoneBoundaryWindow: false, p6PreserveActualInstants: true,
      p6PreserveZeroDurationConstraintInstants: true }).profile, builtInProfile('p6'));
}

{
  eq('80 ops zonder opties ⇒ geen blob (geen pset)', legacyOptionsBlobFor({}), undefined);
  eq('81 ops met opties ⇒ alleen de opties', legacyOptionsBlobFor({ schedulingOptions: { lagCalendar: 'successor' } }),
    { lagCalendar: 'successor' });
  eq('82 msproject ⇒ A22/A23 true gespiegeld', legacyOptionsBlobFor({ schedulingProfile: builtInProfile('msproject') }),
    { resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true });
  eq('83 p6 ⇒ A12/A13 NIET gespiegeld, geen p6Source', legacyOptionsBlobFor({ schedulingProfile: builtInProfile('p6') }), undefined);
  eq('84 conventies en p6Source uit het blok worden gestript',
    legacyOptionsBlobFor({ schedulingOptions: { p6Source: 'XER', clampNegativeFreeFloat: true, totalFloatMode: 'finish' } as unknown as ProjectSchedulingOptions }),
    { totalFloatMode: 'finish' });
}

{
  const roundTrip = (p: SchedulingProfile) => switchProfile(switchProfile(p, 'msproject'), 'p6');
  const fromFile: SchedulingProfile = { ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: true } };
  const toMsp = switchProfile(fromFile, 'msproject');
  eq('90 wissel naar msproject: basis', toMsp.baseId, 'msproject');
  eq('91 wissel naar msproject: de letterlijke A19-afwijking blijft', resolveConventions(toMsp).p6UseRemainingStartForProgress, true);
  eq('92 wissel naar msproject: niet-overschreven conventies volgen msproject', resolveConventions(toMsp).resumeFromActualElapsed, true);
  same('93 P6 → msproject → P6 = origineel (opgelost)', resolveConventions(roundTrip(fromFile)), resolveConventions(fromFile));
  const migrated = legacyOptionsToProfile({ p6Source: 'XER', p6UseTaskPlannedStartFloor: true }).profile;
  same('94 gemigreerd {p6Source, A16} → P6 → msproject → P6 = origineel (opgelost)',
    resolveConventions(roundTrip(switchProfile(migrated, 'p6'))), resolveConventions(migrated));
  const adjusted: SchedulingProfile = { ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: false } };
  same('95 P6 (aangepast) → msproject → P6 = origineel (opgelost)', resolveConventions(roundTrip(adjusted)), resolveConventions(adjusted));
  same('96 op een ingebouwd id blijft ook een niet-bestandsafwijking staan', switchProfile(adjusted, 'msproject').overrides, { clampNegativeFreeFloat: false });
  same('97 wissel vanaf afwezig profiel', switchProfile(undefined, 'msproject'), builtInProfile('msproject'));
  const custom: SchedulingProfile = { baseId: 'p6', id: 'eigen', name: 'Eigen', overrides: { clampNegativeFreeFloat: false } };
  same('98 vanaf een EIGEN profiel ⇒ de kale ingebouwde basis', switchProfile(custom, 'msproject'), builtInProfile('msproject'));
}

{
  same('99 gepinde lijst = A19 en B1–B5', [...LEGACY_XER_ALWAYS_ON].sort(), [
    'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow', 'p6CompletedLoeActualFinish',
    'p6OpenLoeTargetSpan', 'p6RelationFinishBoundary', 'p6UseRemainingStartForProgress',
  ]);
  const hypothetical = { ...CONVENTIONS.find(d => d.group === 'B')!, id: 'p6HypothetischeZesde' as never, since: '2027-01-01' };
  eq('99a een hypothetische zesde groep-B-conventie gaat NIET stil aan', legacyXerDefault(hypothetical), false);
  eq('99b een bestaande groep-B-conventie wel', legacyXerDefault(CONVENTIONS.find(d => d.id === 'p6OpenLoeTargetSpan')!), true);
  for (const key of LEGACY_XER_ALWAYS_ON) {
    const d = CONVENTIONS.find(c => c.id === key)!;
    eq(`99n ${key} volgt de P6-profielwaarde`, legacyXerDefault(d), d.builtIn.p6);
    eq(`99n ${key} P6-waarde volgens §1d-7`, d.builtIn.p6,
      key !== 'p6CompletedDataDateWindow' && key !== 'p6CompletedLoeActualFinish');
  }
  {
    const explicitOn = legacyOptionsToProfile({ p6Source: 'XER', p6CompletedDataDateWindow: true, p6CompletedLoeActualFinish: true }).profile;
    eq('99o B3/B4 expliciet true in oud XER-blok ⇒ aan, als afwijking',
      [resolveConventions(explicitOn).p6CompletedDataDateWindow, explicitOn.overrides?.p6CompletedDataDateWindow,
        resolveConventions(explicitOn).p6CompletedLoeActualFinish, explicitOn.overrides?.p6CompletedLoeActualFinish],
      [true, true, true, true]);
  }
  eq('99c een A-conventie niet', legacyXerDefault(CONVENTIONS.find(d => d.id === 'p6UseTaskPlannedStartFloor')!), false);
  const P6_OFF_GROUP_C_99: ReadonlySet<ConventionKey> = new Set<ConventionKey>([
    'p6CompletedPredecessorAtDataDate', 'p6CompletedOutOfSequenceWindow',
  ]);
  same('99e gepinde X12-lijst = C1–C9, C11, C12 en C14', [...LEGACY_XER_ALSO_ON_X12].sort(), [
    'p6AlapPositionedFromSuccessors', 'p6CompletedOutOfSequenceWindow', 'p6CompletedPhysicalAtDataDate', 'p6CompletedPredecessorAtDataDate',
    'p6CompletedRemainingLag', 'p6FinishFinishStartMilestoneLateFinish', 'p6FinishNotBeforeFinishFinishBound',
    'p6FreeFloatOnOwnCalendar', 'p6InProgressStartLagElapsed', 'p6LateFinishOnOwnCalendar',
    'p6ProgressOverrideIgnoresStartedSuccessor', 'p6StartedTaskIgnoresPlannedStartFloor',
  ]);
  for (const key of LEGACY_XER_ALSO_ON_X12) {
    const d = CONVENTIONS.find(c => c.id === key)!;
    eq(`99f ${key} volgt de P6-profielwaarde`, legacyXerDefault(d), d.builtIn.p6);
    eq(`99f ${key} P6-waarde volgens het besluit van 2026-09-23`, d.builtIn.p6, !P6_OFF_GROUP_C_99.has(key));
  }
  {
    const absent = legacyOptionsToProfile({ p6Source: 'XER' }).profile;
    const resolvedAbsent = resolveConventions(absent);
    for (const key of LEGACY_XER_ALSO_ON_X12) {
      eq(`99h ${key} afwezig in oud XER-blok ⇒ P6-profielwaarde`, resolvedAbsent[key], builtInConventions('p6')[key]);
      eq(`99h ${key} afwezig ⇒ geen afwijking`, absent.overrides?.[key], undefined);
    }
    const explicitFalse = legacyOptionsToProfile({
      p6Source: 'XER', p6CompletedPredecessorAtDataDate: false, p6FreeFloatOnOwnCalendar: false, p6CompletedRemainingLag: false,
      p6CompletedOutOfSequenceWindow: false, p6CompletedPhysicalAtDataDate: false, p6InProgressStartLagElapsed: false,
      p6FinishFinishStartMilestoneLateFinish: false, p6StartedTaskIgnoresPlannedStartFloor: false,
      p6LateFinishOnOwnCalendar: false, p6ProgressOverrideIgnoresStartedSuccessor: false, p6FinishNotBeforeFinishFinishBound: false,
      p6AlapPositionedFromSuccessors: false,
    }).profile;
    const resolvedFalse = resolveConventions(explicitFalse);
    for (const key of LEGACY_XER_ALSO_ON_X12) {
      eq(`99i ${key} expliciet false ⇒ blijft false`, resolvedFalse[key], false);
      eq(`99i ${key} expliciet false ⇒ afwijking van p6 alleen waar p6 aan staat`, explicitFalse.overrides?.[key],
        P6_OFF_GROUP_C_99.has(key) ? undefined : false);
    }
    const explicitTrue = legacyOptionsToProfile({
      p6Source: 'XER', p6CompletedPredecessorAtDataDate: true, p6CompletedOutOfSequenceWindow: true,
    }).profile;
    for (const key of P6_OFF_GROUP_C_99) {
      eq(`99j ${key} expliciet true in oud XER-blok ⇒ aan, als afwijking`,
        [resolveConventions(explicitTrue)[key], explicitTrue.overrides?.[key]], [true, true]);
    }
  }
  const hypotheticalC = { ...CONVENTIONS.find(d => d.group === 'C')!, id: 'p6HypothetischeZevendeC' as never, since: '2027-01-01' };
  eq('99g een hypothetische zevende groep-C-conventie gaat NIET stil aan', legacyXerDefault(hypotheticalC), false);
  for (const key of CONVENTION_KEYS) {
    eq(`99d sanitizer kent ${key}`, sanitizeSchedulingOptions({ [key]: true })?.[key], OPS_ON.has(key) ? undefined : true);
  }
  eq('99k sanitizer: startToStartLagFrom actualStart/earlyStart blijven, onzin valt weg', [
    sanitizeSchedulingOptions({ startToStartLagFrom: 'actualStart' })?.startToStartLagFrom,
    sanitizeSchedulingOptions({ startToStartLagFrom: 'earlyStart' })?.startToStartLagFrom,
    sanitizeSchedulingOptions({ startToStartLagFrom: 'dataDate' }),
    sanitizeSchedulingOptions({ startToStartLagFrom: true }),
  ], ['actualStart', 'earlyStart', undefined, undefined]);
  eq('99l startToStartLagFrom is een projectoptie, geen conventie', isConventionKey('startToStartLagFrom'), false);
  eq('99m P6-standaardopties: Early Start; MS Project/OPS zonder (inert zonder C6)', [
    defaultOptionsFor('p6').startToStartLagFrom, defaultOptionsFor('msproject').startToStartLagFrom,
    defaultOptionsFor('ops').startToStartLagFrom,
  ], ['earlyStart', undefined, undefined]);
}

{
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const LOCALES = I18N_LOCALES;
  for (const locale of LOCALES) {
    const common = JSON.parse(readFileSync(join(ROOT, `src/i18n/locales/${locale}/common.json`), 'utf8')) as {
      conventions?: Record<string, { label?: unknown; help?: unknown }>;
      profiles?: { builtIn?: Record<string, unknown>; modified?: unknown; copyOf?: unknown };
      notifications?: { schedulingProfileApplied?: unknown; schedulingProfileShifted_other?: unknown; actions?: { openProjectInfo?: unknown } };
      schedulingProfile?: { title?: unknown; themes?: Record<string, unknown>; requires?: Record<string, unknown> };
    };
    const optional = locale !== 'nl' && locale !== 'en';
    const isText = (label: string, v: unknown) => { if (v === undefined && optional) return; eq(label, typeof v, 'string'); };
    for (const c of CONVENTIONS) {
      isText(`i18n ${locale} ${c.labelKey}.label`, common.conventions?.[c.id]?.label);
      isText(`i18n ${locale} ${c.labelKey}.help`, common.conventions?.[c.id]?.help);
    }
    for (const theme of [...CONVENTION_THEMES, 'ownProfilesOnly']) {
      isText(`i18n ${locale} schedulingProfile.themes.${theme}`, common.schedulingProfile?.themes?.[theme]);
    }
    for (const id of BUILT_IN_PROFILE_IDS) isText(`i18n ${locale} profiles.builtIn.${id}`, common.profiles?.builtIn?.[id]);
    for (const gate of ['hourPlanning', 'xerOrigin']) {
      isText(`i18n ${locale} schedulingProfile.requires.${gate}`, common.schedulingProfile?.requires?.[gate]);
    }
    isText(`i18n ${locale} profiles.modified`, common.profiles?.modified);
    isText(`i18n ${locale} profiles.copyOf`, common.profiles?.copyOf);
    isText(`i18n ${locale} notifications.schedulingProfileApplied`, common.notifications?.schedulingProfileApplied);
    isText(`i18n ${locale} notifications.schedulingProfileShifted_other`, common.notifications?.schedulingProfileShifted_other);
    isText(`i18n ${locale} notifications.actions.openProjectInfo`, common.notifications?.actions?.openProjectInfo);
    const applied = common.notifications?.schedulingProfileApplied;
    const title = common.schedulingProfile?.title;
    if (!optional || (applied !== undefined && title !== undefined)) {
      ok(`i18n ${locale} melding noemt de bloknaam`, typeof title === 'string'
        && typeof applied === 'string' && applied.includes(title));
    }
    const brands: Record<string, string> = { p6: 'Primavera P6', msproject: 'Microsoft Project', ops: 'Open Planner Studio' };
    if (optional) {
      for (const [id, name] of Object.entries(common.profiles?.builtIn ?? {})) eq(`i18n ${locale} merknaam ${id}`, name, brands[id]);
    } else {
      eq(`i18n ${locale} merknamen`, common.profiles?.builtIn, brands);
    }
    const conventionKeys = Object.keys(common.conventions ?? {}).sort();
    if (optional) {
      same(`i18n ${locale} conventions ⊆ register`, conventionKeys.filter(k => !(CONVENTION_KEYS as readonly string[]).includes(k)), []);
    } else {
      same(`i18n ${locale} conventions == register`, conventionKeys, [...CONVENTION_KEYS].sort());
    }
  }
}

for (const d of CONVENTIONS) {
  same(`9 ${d.id}: requires kent alleen hourPlanning/xerOrigin`, Object.keys(d.requires ?? {}).filter(k => k !== 'hourPlanning' && k !== 'xerOrigin'), []);
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`XX  conventions-registry: ${diffs.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  conventions-registry: alle checks groen (${checks})`);
