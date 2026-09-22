// Rekenprofielen — het conventieregister (spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md,
// tweelagenmodel). Bewaakt: register ⇔ ConventionKey, drie ingebouwde waarden per conventie binnen
// het domein, resolve/diff, de legacy-migratie per tak (spec v3), de XER-defaults-pin, de
// neerwaartse optieblob, de profielwissel en de typegrens van EffectiveSchedulingOptions.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen; faalregels beginnen met "XX".
import type { EffectiveSchedulingOptions, SchedulingOptions, SchedulingProfile } from '@/types/project';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_KEYS, builtInConventions, builtInProfile, defaultOptionsFor, diffAgainstBase, effectiveSchedulingOptions, isDefaultProfile, legacyConventions, resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { optionKeysOnly, legacyOptionsToProfile, legacyOptionsBlobFor } from '@/services/ifc/schedulingProfileMigration';
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
  eq('01 vijftien conventies', ids.length, 15);
  eq('02 unieke id\'s', new Set(ids).size, ids.length);
  same('03 register-lijst == CONVENTION_KEYS (compile-time Record)', [...ids].sort(), [...CONVENTION_KEYS].sort());
  for (const d of CONVENTIONS) {
    for (const p of BUILT_IN_PROFILE_IDS) {
      const v = d.builtIn[p];
      ok(`04 ${d.id}.${p} binnen het domein`, d.kind === 'boolean' && typeof v === 'boolean');
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
    // A19 is per bestand: de P6-basis is uit, de XER-lezer zet hem als afwijking.
    eq(`09 p6.${key}`, P6[key], !mspOnly && key !== 'p6UseRemainingStartForProgress');
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
  eq('45 defaultOptionsFor(ops) — leeg (afwezig ≡ huidig gedrag)', defaultOptionsFor('ops'), {});
  const eff = effectiveSchedulingOptions({ schedulingProfile: builtInProfile('msproject'), schedulingOptions: { lagCalendar: '24hour' } });
  eq('46 effective: conventie uit profiel', eff.resumeFromActualElapsed, true);
  eq('47 effective: optie uit project', eff.lagCalendar, '24hour');
  eq('48 effective: alle vijftien conventies aanwezig', CONVENTION_KEYS.every(k => typeof eff[k] === 'boolean'), true);
  // Conventies worden als LAATSTE gespreid: een conventiesleutel die in de overgang nog in het
  // projectblok staat, verliest van het profiel.
  const effWins = effectiveSchedulingOptions({ schedulingProfile: builtInProfile('ops'), schedulingOptions: { clampNegativeFreeFloat: true } });
  eq('49 effective: profiel wint van conventiesleutel in het blok', effWins.clampNegativeFreeFloat, false);
  // Typegrens: een kale SchedulingOptions is geen EffectiveSchedulingOptions (conventies verplicht).
  const bare: SchedulingOptions = { lagCalendar: 'successor' };
  // @ts-expect-error — een kaal optieblok mag het profiel niet omzeilen
  const notEffective: EffectiveSchedulingOptions = bare;
  void notEffective;
}

// ── 4) Legacy-migratie per tak (spec v3 §3.4) ───────────────────────────────────────────────────
{
  const none = legacyOptionsToProfile(undefined);
  same('50 geen blob ⇒ ops zonder overrides', none.profile, builtInProfile('ops'));
  eq('51 geen blob ⇒ geen opties', none.options, undefined);

  // Rij 2 (p6Source): A-conventie aanwezig ⇒ die waarde, afwezig ⇒ UIT; B1–B5 ⇒ AAN.
  const partial = legacyOptionsToProfile({ p6Source: 'XER', p6UseTaskPlannedStartFloor: true });
  eq('52 rij 2: basis p6', partial.profile.baseId, 'p6');
  const r = resolveConventions(partial.profile);
  const on = CONVENTION_KEYS.filter(k => r[k]).sort();
  same('53 rij 2: gedeeltelijke blob ⇒ alleen A16 + B1–B5 aan', on, [
    'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow', 'p6CompletedLoeActualFinish',
    'p6OpenLoeTargetSpan', 'p6RelationFinishBoundary', 'p6UseTaskPlannedStartFloor',
  ]);
  eq('54 rij 2: opties zonder p6Source/conventies', partial.options, undefined);
  const a = legacyOptionsToProfile({ p6Source: 'XER', lagCalendar: 'successor', p6UseRemainingStartForProgress: true });
  eq('55 rij 2: A19 uit het bestand wordt afwijking', a.profile.overrides.p6UseRemainingStartForProgress, true);
  eq('56 rij 2: projectopties blijven', a.options, { lagCalendar: 'successor' });

  // Rij 4 (geen p6Source): gepoorte A15–A20 (incl. A19) weg (risico 1), A12/A13/A22/A23 afwijkingen.
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

  // Rij 3 (geen p6Source, beide mpp-vlaggen) ⇒ msproject.
  const m = legacyOptionsToProfile({ resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true, clampNegativeFreeFloat: true });
  eq('63 rij 3: beide mpp-vlaggen ⇒ msproject', m.profile.baseId, 'msproject');
  same('64 rij 3: alleen de extra vlag is afwijking', m.profile.overrides, { clampNegativeFreeFloat: true });
  eq('65 rij 3: geen opties', m.options, undefined);
  const onlyOptions = legacyOptionsToProfile({ nearCriticalThreshold: 2 });
  same('66 alleen opties ⇒ ops zonder overrides', onlyOptions.profile, builtInProfile('ops'));
  eq('67 alleen opties ⇒ opties behouden', onlyOptions.options, { nearCriticalThreshold: 2 });
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

// ── 6) Neerwaartse optieblob (spec v3.1 punt 1) ─────────────────────────────────────────────────
{
  eq('80 ops zonder opties ⇒ geen blob (geen pset)', legacyOptionsBlobFor({}), undefined);
  eq('81 ops met opties ⇒ alleen de opties', legacyOptionsBlobFor({ schedulingOptions: { lagCalendar: 'successor' } }),
    { lagCalendar: 'successor' });
  eq('82 msproject ⇒ A22/A23 true gespiegeld', legacyOptionsBlobFor({ schedulingProfile: builtInProfile('msproject') }),
    { resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true });
  eq('83 p6 ⇒ A12/A13 NIET gespiegeld, geen p6Source', legacyOptionsBlobFor({ schedulingProfile: builtInProfile('p6') }), undefined);
  eq('84 conventies en p6Source uit het blok worden gestript',
    legacyOptionsBlobFor({ schedulingOptions: { p6Source: 'XER', clampNegativeFreeFloat: true, totalFloatMode: 'finish' } }),
    { totalFloatMode: 'finish' });
}

// ── 7) Profielwissel: op een ingebouwd id blijven alle afwijkingen letterlijk staan ─────────────
{
  const roundTrip = (p: SchedulingProfile) => switchProfile(switchProfile(p, 'msproject'), 'p6');
  const fromFile: SchedulingProfile = { ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: true } };
  const toMsp = switchProfile(fromFile, 'msproject');
  eq('90 wissel naar msproject: basis', toMsp.baseId, 'msproject');
  eq('91 wissel naar msproject: A19 uit het bestand blijft', resolveConventions(toMsp).p6UseRemainingStartForProgress, true);
  eq('92 wissel naar msproject: niet-overschreven conventies volgen msproject', resolveConventions(toMsp).resumeFromActualElapsed, true);
  same('93 P6 → msproject → P6 = origineel (opgelost)', resolveConventions(roundTrip(fromFile)), resolveConventions(fromFile));
  // Reviewer-proef 1: een gemigreerd legacy-profiel.
  const migrated = legacyOptionsToProfile({ p6Source: 'XER', p6UseTaskPlannedStartFloor: true }).profile;
  same('94 gemigreerd {p6Source, A16} → P6 → msproject → P6 = origineel (opgelost)',
    resolveConventions(roundTrip(switchProfile(migrated, 'p6'))), resolveConventions(migrated));
  // Reviewer-proef 2: "P6 (aangepast)" met clampNegativeFreeFloat:false uit de pset.
  const adjusted: SchedulingProfile = { ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: false } };
  same('95 P6 (aangepast) → msproject → P6 = origineel (opgelost)', resolveConventions(roundTrip(adjusted)), resolveConventions(adjusted));
  same('96 op een ingebouwd id blijft ook een niet-bestandsafwijking staan', switchProfile(adjusted, 'msproject').overrides, { clampNegativeFreeFloat: false });
  same('97 wissel vanaf afwezig profiel', switchProfile(undefined, 'msproject'), builtInProfile('msproject'));
  const custom: SchedulingProfile = { baseId: 'p6', id: 'eigen', name: 'Eigen', overrides: { clampNegativeFreeFloat: false } };
  same('98 vanaf een EIGEN profiel ⇒ de kale ingebouwde basis', switchProfile(custom, 'msproject'), builtInProfile('msproject'));
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`XX  conventions-registry: ${diffs.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  conventions-registry: alle checks groen (${checks})`);
