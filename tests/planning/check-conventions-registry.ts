// Rekenprofielen — het conventieregister (spec docs/superpowers/specs/2026-09-22-rekenprofielen-design.md,
// tweelagenmodel). Bewaakt: register ⇔ ConventionKey, drie ingebouwde waarden per conventie binnen
// het domein, resolve/diff, de legacy-migratie per tak (spec v3), de XER-defaults-pin, de
// neerwaartse optieblob, de profielwissel en de typegrens van EffectiveSchedulingOptions.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen; faalregels beginnen met "XX".
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EffectiveSchedulingOptions, LegacySchedulingOptions, ProjectSchedulingOptions, SchedulingOptions, SchedulingProfile } from '@/types/project';
import {
  BUILT_IN_PROFILE_IDS, CONVENTIONS, CONVENTION_KEYS, builtInConventions, builtInProfile, defaultOptionsFor, diffAgainstBase, effectiveSchedulingOptions, isDefaultProfile, legacyConventions, resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { optionKeysOnly, legacyOptionsToProfile, legacyOptionsBlobFor, LEGACY_XER_ALWAYS_ON, LEGACY_XER_ALSO_ON_X12, legacyXerDefault } from '@/services/ifc/schedulingProfileMigration';
import { XER_SCHEDULING_DEFAULTS } from '@/services/xer/xerScheduleOptions';
import { sanitizeProjectOptions, sanitizeSchedulingOptions } from '@/services/ifc/schedulingOptionsRead';

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
  eq('01 achttien conventies', ids.length, 18);
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
  // Besluit orkestrator (critreview D deel 1): letterlijk. Een afwijking gelijk aan de ops-basis
  // (P6 {A13: uit} → OPS) is géén standaardprofiel, anders gaat hij bij P6 → OPS → P6 verloren.
  ok('34a ops met afwijking gelijk aan de basis is niet default',
    !isDefaultProfile({ ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: false } }));
  ok('34b onbekende/niet-boolean sleutels tellen niet als afwijking',
    isDefaultProfile({ ...builtInProfile('ops'), overrides: { onzin: true, clampNegativeFreeFloat: 'ja' } as never }));
  // perFile is beschrijvend en het register is de bron; volgens spec v3.1 §3.1 komt alleen A19 per bestand.
  same('34c per-bestand-conventies volgens de spec', CONVENTIONS.filter(d => d.perFile).map(d => d.id), ['p6UseRemainingStartForProgress']);
}

// ── 3) Opties ⊥ conventies ──────────────────────────────────────────────────────────────────────
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
  eq('44 defaultOptionsFor(msproject)', defaultOptionsFor('msproject'), { totalFloatMode: 'smallest' });
  eq('45 defaultOptionsFor(ops) — leeg (afwezig ≡ huidig gedrag)', defaultOptionsFor('ops'), {});
  const eff = effectiveSchedulingOptions({ schedulingProfile: builtInProfile('msproject'), schedulingOptions: { lagCalendar: '24hour' } });
  eq('46 effective: conventie uit profiel', eff.resumeFromActualElapsed, true);
  eq('47 effective: optie uit project', eff.lagCalendar, '24hour');
  eq('48 effective: alle achttien conventies aanwezig', CONVENTION_KEYS.every(k => typeof eff[k] === 'boolean'), true);
  // Conventies worden als LAATSTE gespreid: een conventiesleutel die in de overgang nog in het
  // projectblok staat, verliest van het profiel.
  const effWins = effectiveSchedulingOptions({ schedulingProfile: builtInProfile('ops'), schedulingOptions: { clampNegativeFreeFloat: true } as unknown as ProjectSchedulingOptions });
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

  // Rij 2 (p6Source): A-conventie aanwezig ⇒ die waarde, afwezig ⇒ UIT; B1–B5 en C1–C3 ⇒ AAN.
  const partial = legacyOptionsToProfile({ p6Source: 'XER', p6UseTaskPlannedStartFloor: true });
  eq('52 rij 2: basis p6', partial.profile.baseId, 'p6');
  const r = resolveConventions(partial.profile);
  const on = CONVENTION_KEYS.filter(k => r[k]).sort();
  same('53 rij 2: gedeeltelijke blob ⇒ alleen A16 + B1–B5 + C1–C3 aan', on, [
    'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow', 'p6CompletedLoeActualFinish',
    'p6CompletedPredecessorAtDataDate', 'p6CompletedRemainingLag', 'p6FreeFloatOnOwnCalendar',
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
// Sinds C3 draagt XER_SCHEDULING_DEFAULTS alleen projectopties; de conventies komen uit het profiel
// dat de lezer zet (check-import-profile.ts bewijst dat een gelezen XER builtInProfile('p6') draagt).
{
  eq('70 XER-defaults: opties == defaultOptionsFor(p6) (incl. volgorde)', XER_SCHEDULING_DEFAULTS.schedulingOptions, defaultOptionsFor('p6'));
  ok('71 XER-defaults: geen conventiesleutels en geen bronmarkering',
    Object.keys(XER_SCHEDULING_DEFAULTS.schedulingOptions).every(k => !(CONVENTION_KEYS as readonly string[]).includes(k) && k !== 'p6Source'));
  same('72 een blob mét bronmarkering en de XER-defaults ⇒ P6-profiel zonder afwijkingen',
    legacyOptionsToProfile({ p6Source: 'XER', ...XER_SCHEDULING_DEFAULTS.schedulingOptions,
      preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true, p6ZeroDurationUsesPlannedBoundary: true,
      p6UseTaskPlannedStartFloor: true, p6FinishMilestoneBoundaryWindow: true, p6PreserveActualInstants: true,
      p6PreserveZeroDurationConstraintInstants: true }).profile, builtInProfile('p6'));
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
    legacyOptionsBlobFor({ schedulingOptions: { p6Source: 'XER', clampNegativeFreeFloat: true, totalFloatMode: 'finish' } as unknown as ProjectSchedulingOptions }),
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

// ── 7b) Migratie oude XER-IFC's: alleen de vijf BESTAANDE groep-B-conventies gaan vanzelf aan ─────
// Eindreview I4 (b): "elke groep-B-conventie aan" zou een LATER toegevoegde groep-B-conventie stil
// aanzetten op elk oud XER-project. De lijst is gepind op B1–B5 (spec bijlage A, met de hand).
{
  same('99 gepinde lijst = B1–B5', [...LEGACY_XER_ALWAYS_ON].sort(), [
    'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow', 'p6CompletedLoeActualFinish',
    'p6OpenLoeTargetSpan', 'p6RelationFinishBoundary',
  ]);
  const hypothetical = { ...CONVENTIONS.find(d => d.group === 'B')!, id: 'p6HypothetischeZesde' as never, since: '2027-01-01' };
  eq('99a een hypothetische zesde groep-B-conventie gaat NIET stil aan', legacyXerDefault(hypothetical), false);
  eq('99b een bestaande groep-B-conventie wel', legacyXerDefault(CONVENTIONS.find(d => d.id === 'p6OpenLoeTargetSpan')!), true);
  eq('99c een A-conventie niet', legacyXerDefault(CONVENTIONS.find(d => d.id === 'p6UseTaskPlannedStartFloor')!), false);
  // X12 brok 2: C1–C3 gepind in een eigen set (orkestratorbesluit: oude XER-IFC's rekenen als herimport).
  same('99e gepinde X12-lijst = C1–C3', [...LEGACY_XER_ALSO_ON_X12].sort(), [
    'p6CompletedPredecessorAtDataDate', 'p6CompletedRemainingLag', 'p6FreeFloatOnOwnCalendar',
  ]);
  for (const key of LEGACY_XER_ALSO_ON_X12) {
    const d = CONVENTIONS.find(c => c.id === key)!;
    // Id-gepind op de P6-profielwaarde (niet een hardgecodeerde true): gelijk aan builtIn.p6, en die is aan.
    eq(`99f ${key} volgt de P6-profielwaarde`, legacyXerDefault(d), d.builtIn.p6);
    eq(`99f ${key} P6-waarde is aan`, d.builtIn.p6, true);
  }
  // 99h/99i: de volle migratie (legacyOptionsToProfile), niet alleen de default-helper. Een oud
  // XER-blok zonder C-sleutels krijgt het P6-profiel voor C1–C3 (geen afwijking); een expliciete
  // false blijft false (een gezette vlag wint altijd) en wordt dus een afwijking van p6.
  {
    const absent = legacyOptionsToProfile({ p6Source: 'XER' }).profile;
    const resolvedAbsent = resolveConventions(absent);
    for (const key of LEGACY_XER_ALSO_ON_X12) {
      eq(`99h ${key} afwezig in oud XER-blok ⇒ P6-profielwaarde`, resolvedAbsent[key], builtInConventions('p6')[key]);
      eq(`99h ${key} afwezig ⇒ geen afwijking`, absent.overrides?.[key], undefined);
    }
    const explicitFalse = legacyOptionsToProfile({
      p6Source: 'XER', p6CompletedPredecessorAtDataDate: false, p6FreeFloatOnOwnCalendar: false, p6CompletedRemainingLag: false,
    }).profile;
    const resolvedFalse = resolveConventions(explicitFalse);
    for (const key of LEGACY_XER_ALSO_ON_X12) {
      eq(`99i ${key} expliciet false ⇒ blijft false`, resolvedFalse[key], false);
      eq(`99i ${key} expliciet false ⇒ afwijking van p6`, explicitFalse.overrides?.[key], false);
    }
  }
  const hypotheticalC = { ...CONVENTIONS.find(d => d.group === 'C')!, id: 'p6HypothetischeVierdeC' as never, since: '2027-01-01' };
  eq('99g een hypothetische vierde groep-C-conventie gaat NIET stil aan', legacyXerDefault(hypotheticalC), false);
  // Recept stap 2a: elke conventie staat in BOOLEAN_KEYS van de IFC-sanitizer (anders valt hij stil weg).
  for (const key of CONVENTION_KEYS) {
    eq(`99d sanitizer kent ${key}`, sanitizeSchedulingOptions({ [key]: true })?.[key], true);
  }
}

// ── 8) i18n (plan taak D1): elke conventie, elk ingebouwd profiel en de profielmelding in alle 14 talen ──
// Alleen aanwezigheid en type; de pluralcategorieën per locale bewaakt `npm run verify:i18n`.
{
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'zh', 'it', 'pt', 'pl', 'tr', 'ar', 'ja', 'ko', 'fa'];
  for (const locale of LOCALES) {
    const common = JSON.parse(readFileSync(join(ROOT, `src/i18n/locales/${locale}/common.json`), 'utf8')) as {
      conventions?: Record<string, { label?: unknown; help?: unknown }>;
      profiles?: { builtIn?: Record<string, unknown>; modified?: unknown; copyOf?: unknown };
      notifications?: { schedulingProfileApplied?: unknown; schedulingProfileShifted_other?: unknown; actions?: { openProjectInfo?: unknown } };
      schedulingProfile?: { title?: unknown };
    };
    for (const c of CONVENTIONS) {
      eq(`i18n ${locale} ${c.labelKey}.label`, typeof common.conventions?.[c.id]?.label, 'string');
      eq(`i18n ${locale} ${c.labelKey}.help`, typeof common.conventions?.[c.id]?.help, 'string');
    }
    for (const id of BUILT_IN_PROFILE_IDS) eq(`i18n ${locale} profiles.builtIn.${id}`, typeof common.profiles?.builtIn?.[id], 'string');
    eq(`i18n ${locale} profiles.modified`, typeof common.profiles?.modified, 'string');
    eq(`i18n ${locale} profiles.copyOf`, typeof common.profiles?.copyOf, 'string');
    eq(`i18n ${locale} notifications.schedulingProfileApplied`, typeof common.notifications?.schedulingProfileApplied, 'string');
    eq(`i18n ${locale} notifications.schedulingProfileShifted_other`, typeof common.notifications?.schedulingProfileShifted_other, 'string');
    eq(`i18n ${locale} notifications.actions.openProjectInfo`, typeof common.notifications?.actions?.openProjectInfo, 'string');
    // Gebruikstest I5 (3c): de melding wijst naar het blok zoals het in Projectinfo heet.
    ok(`i18n ${locale} melding noemt de bloknaam`, typeof common.schedulingProfile?.title === 'string'
      && typeof common.notifications?.schedulingProfileApplied === 'string'
      && common.notifications.schedulingProfileApplied.includes(common.schedulingProfile.title));
    // Merknamen zijn in elke taal gelijk (de store-melding gebruikt ze onvertaald, spec v3.1 §6).
    eq(`i18n ${locale} merknamen`, common.profiles?.builtIn, { p6: 'Primavera P6', msproject: 'Microsoft Project', ops: 'Open Planner Studio' });
    // Geen sleutels buiten het register: een verweesde vertaling wijst op een hernoemde conventie.
    same(`i18n ${locale} conventions == register`, Object.keys(common.conventions ?? {}).sort(), [...CONVENTION_KEYS].sort());
  }
}

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`XX  conventions-registry: ${diffs.length} van ${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  conventions-registry: alle checks groen (${checks})`);
