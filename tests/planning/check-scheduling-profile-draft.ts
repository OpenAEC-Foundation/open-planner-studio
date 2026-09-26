// Bewerkmodel van het rekenprofielblok (rekenprofielen, spec v3.1 §3.2/§6; plan taak D2). Exit 0 = groen.
// Verwachtingen met de hand afgeleid uit de spec en het register (geen gekopieerde uitvoer).
import {
  choiceOf, selectProfile, editConvention, renameProfile, resetConventionToBase, profileLabel, templateRelation,
  totalFloatModeToUi, totalFloatModeFromUi, withCriticalMode, withCriticalThreshold, withDefaultOptions, sameSettings,
  hasValidProfileName,
} from '@/state/schedulingProfileDraft';
import { builtInProfile, defaultOptionsFor, resolveConventions } from '@/engine/scheduler/conventions/registry';
import type { SchedulingProfile } from '@/types/project';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
// Een ingebouwd P6-profiel met een afwijking op A19 (zo leest een pset van vóór 2026-09-24 van een
// leeg/N-bestand: A19 uit, terwijl de P6-basis nu aan is).
const xerP6: SchedulingProfile = { ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: false } };
const own: SchedulingProfile = { baseId: 'p6', id: 'prof-own', name: 'Eigen', overrides: { clampNegativeFreeFloat: false } };
const copy = { id: 'prof-new', name: 'Kopie van Primavera P6' };

eq('01 keuzewaarde ingebouwd', choiceOf(xerP6, []), 'builtin:p6');
eq('02 keuzewaarde sjabloon', choiceOf(own, [own]), 'template:prof-own');
eq('03 keuzewaarde los eigen profiel', choiceOf(own, []), 'current');
eq('04 afwezig = ops', choiceOf(undefined, []), 'builtin:ops');
eq('05 wissel bewaart overrides op een ingebouwd id letterlijk (spec §3.2)', selectProfile(xerP6, 'builtin:msproject', []),
  { baseId: 'msproject', id: 'msproject', name: '', overrides: { p6UseRemainingStartForProgress: false } });
eq('06 wissel vanaf een eigen profiel = kale basis', selectProfile(own, 'builtin:p6', []), builtInProfile('p6'));
eq('07 wissel naar schone ops = afwezig', selectProfile(builtInProfile('p6'), 'builtin:ops', []), undefined);
const fromTemplate = selectProfile(undefined, 'template:prof-own', [own]);
eq('08 sjabloon wordt gekopieerd (eigen kopie op het project)', [fromTemplate, fromTemplate === own], [own, false]);
eq('09 conventie wijzigen op ingebouwd ⇒ eigen kopie', editConvention(xerP6, 'clampNegativeFreeFloat', false, copy),
  { baseId: 'p6', id: 'prof-new', name: 'Kopie van Primavera P6', overrides: { clampNegativeFreeFloat: false, p6UseRemainingStartForProgress: false } });
eq('10 conventie wijzigen op eigen profiel houdt het id', editConvention(own, 'p6OpenLoeTargetSpan', false, copy)?.id, 'prof-own');
eq('11 terug naar de basiswaarde haalt de override weg', editConvention(own, 'clampNegativeFreeFloat', true, copy)?.overrides, {});
eq('12 ongewijzigde waarde = no-op (zelfde object)', editConvention(own, 'clampNegativeFreeFloat', false, copy) === own, true);
eq('13 hernoemen trimt en kapt af op 200', renameProfile(own, `  ${'x'.repeat(10_000_000)}  `)?.name.length, 200);
eq('13a hernoemen: voorloopwitruimte telt niet mee voor de grens', renameProfile(own, `${' '.repeat(10_000)}Nieuw`)?.name, 'Nieuw');
// Eindreview I4 (e): tijdens het typen blijft een spatie achteraan staan (anders is 'Mijn profiel' niet te typen).
eq('13b spatie achteraan blijft tijdens het bewerken', renameProfile(own, 'Mijn ')?.name, 'Mijn ');
// Gebruikstest I5 punt 2: toets voor toets typen zoals een <input> doet (elke toets = de hele waarde
// opnieuw door renameProfile). Op b0fb3d5a werd 'Mijn P6-variant' tot 'MijnP6-variant'.
{
  let typed = { ...own, name: '' } as typeof own | undefined;
  for (const ch of 'Mijn P6-variant ') typed = renameProfile(typed, `${typed?.name ?? ''}${ch}`);
  eq('13c letterlijk typen: spatie in het midden én tijdelijk achteraan', typed?.name, 'Mijn P6-variant ');
}
eq('14 ingebouwd is niet hernoembaar', renameProfile(xerP6, 'Nee'), xerP6);
// Eindreview I4 (e): het veld is te wissen; leeg is 'nog niet geldig' (opslaan en toepassen weigeren).
eq('15 een eigen profiel mag tijdelijk leeg zijn', renameProfile(own, '   ')?.name, '');
eq('15a leeg of alleen spaties is geen geldige naam', [hasValidProfileName(renameProfile(own, '')), hasValidProfileName({ ...own, name: '  ' })], [false, false]);
eq('15b ingebouwd en een echte naam zijn geldig', [hasValidProfileName(undefined), hasValidProfileName(xerP6), hasValidProfileName(own)], [true, true, true]);
eq('16 label ingebouwd met afwijking = aangepast', profileLabel(xerP6), { kind: 'builtIn', baseId: 'p6', modified: true });
eq('17 label eigen profiel', profileLabel(own), { kind: 'custom', name: 'Eigen' });
eq('18 sjabloonrelatie', [templateRelation(own, []), templateRelation(own, [own]),
  templateRelation({ ...own, overrides: {} }, [own])], ['none', 'same', 'deviates']);
eq("19 'auto' is alleen UI", [totalFloatModeToUi(undefined), totalFloatModeFromUi('auto'), totalFloatModeFromUi('finish')], ['auto', undefined, 'finish']);
eq('20 modewissel houdt thresholdHours (A6)',
  withCriticalMode({ criticalDefinition: { mode: 'totalFloat', thresholdHours: 8 } }, 'longestPath').criticalDefinition,
  { mode: 'longestPath', thresholdHours: 8 });
eq('21 drempel in dagen zetten houdt thresholdHours',
  withCriticalThreshold({ criticalDefinition: { mode: 'totalFloat', thresholdHours: 8 } }, 'threshold', 2).criticalDefinition,
  { mode: 'totalFloat', thresholdHours: 8, threshold: 2 });
eq('22 standaardopties van p6', withDefaultOptions(builtInProfile('p6')), defaultOptionsFor('p6'));
eq('23 standaardopties van ops = afwezig', withDefaultOptions(undefined), undefined);
// Bronsignalen (alleen uit het bestand, geen profieldefault) overleven "Standaardopties"; de rest niet.
// Mutant: SOURCE_ONLY_OPTION_KEYS leeg ⇒ 23a/23b rood.
{
  const leveling = { levelAllResources: false, priority: [{ field: 'early_start_date', direction: 'ASC' as const }] };
  const current = { lagCalendar: '24hour' as const, useProjectEndDateForFloat: true, leveling };
  eq('23a standaardopties p6 houden leveling en useProjectEndDateForFloat',
    withDefaultOptions(builtInProfile('p6'), current), { ...defaultOptionsFor('p6'), useProjectEndDateForFloat: true, leveling });
  eq('23b standaardopties ops houden alleen de bronsignalen',
    withDefaultOptions(undefined, current), { useProjectEndDateForFloat: true, leveling });
  eq('23c zonder bronsignalen blijft ops afwezig', withDefaultOptions(undefined, { lagCalendar: '24hour' }), undefined);
}
eq('24 sameSettings negeert sleutelvolgorde en normaliseert ops',
  sameSettings({ profile: builtInProfile('ops'), options: { lagCalendar: 'successor', totalFloatMode: 'finish' } },
    { profile: undefined, options: { totalFloatMode: 'finish', lagCalendar: 'successor' } }), true);
eq('24a sameSettings ziet een echte optiewijziging', sameSettings({ profile: undefined, options: { lagCalendar: 'successor' } },
  { profile: undefined, options: { lagCalendar: 'predecessor' } }), false);

// ── Geen per-bestand-conventies meer (eigenaarsbesluit 2026-09-24 "a") ───────────────────────────
// Tot 2026-09-24 droeg het bewerkmodel A19 (uit `rem_target_link_flag`) bij elke wissel over, ook
// vanaf een eigen profiel en bij een sjabloonkeuze. Nu is A19 een gewone P6-conventie (aan in P6):
// een wissel vanaf een eigen profiel levert de kale basis, een sjabloonkeuze exact het sjabloon.
const ownFromXer = editConvention(xerP6, 'clampNegativeFreeFloat', false, copy);
eq('26 eigen kopie → P6: kale basis (geen overdracht meer)', selectProfile(ownFromXer, 'builtin:p6', []), builtInProfile('p6'));
eq('27 eigen kopie → MS Project: kale basis', selectProfile(ownFromXer, 'builtin:msproject', []), builtInProfile('msproject'));
eq('28 eigen kopie → OPS: het standaardprofiel (afwezig)', selectProfile(ownFromXer, 'builtin:ops', []), undefined);
eq('29 A19 in de kale P6-basis aan', resolveConventions(builtInProfile('p6')).p6UseRemainingStartForProgress, true);
eq('29a een oude A19-override true onder P6 is geen afwijking meer (geen "(aangepast)")',
  profileLabel({ ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: true } }), { kind: 'builtIn', baseId: 'p6', modified: false });

// ── "(aangepast)" volgt `diffAgainstBase`, niet het aantal sleutels in `overrides` ──────────────────
// Een sleutel gelijk aan de basis (kan na een wissel of uit oudere state blijven staan) is geen afwijking.
eq('30 override gelijk aan de basis ⇒ niet aangepast',
  profileLabel({ ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: true } }), { kind: 'builtIn', baseId: 'p6', modified: false });
eq('31 afwezig profiel = OPS, niet aangepast', profileLabel(undefined), { kind: 'builtIn', baseId: 'ops', modified: false });

// ── Critreview D deel 1 (orkestrator) ────────────────────────────────────────────────────────────
// Punt 1 (vervallen 2026-09-24): een sjabloonkeuze levert exact het sjabloon, ook op een project met
// een A19-afwijking.
const templateOnXer = selectProfile(xerP6, 'template:prof-own', [own]);
eq('32 sjabloonkeuze = exact het sjabloon', templateOnXer, own);
eq('33 …en de relatie is same', templateRelation(templateOnXer, [own]), 'same');
const templateWithA19Off: SchedulingProfile = { ...own, overrides: { ...own.overrides, p6UseRemainingStartForProgress: false } };
eq('33a sjabloonrelatie telt A19 gewoon mee', templateRelation(own, [templateWithA19Off]), 'deviates');

// Punt 3: P6 → OPS → P6 houdt afwijkingen letterlijk, ook als ze onder OPS gelijk aan de basis zijn.
const p6NoClamp: SchedulingProfile = { ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: false } };
const viaOps = selectProfile(p6NoClamp, 'builtin:ops', []);
eq('34 P6 {A13 uit} → OPS: niet genormaliseerd tot afwezig', viaOps, { ...builtInProfile('ops'), overrides: { clampNegativeFreeFloat: false } });
eq('34a …→ P6: A13 weer uit', resolveConventions(selectProfile(viaOps, 'builtin:p6', [])).clampNegativeFreeFloat, false);
eq('34b onder OPS toont de keuzelijst geen "(aangepast)"', profileLabel(viaOps), { kind: 'builtIn', baseId: 'ops', modified: false });

// Punt 7: sameSettings vergelijkt inhoudelijk (id + basis + naam + opgeloste set), niet structureel.
eq('35 afwijking gelijk aan de basis ≡ geen afwijking',
  sameSettings({ profile: { ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: true } }, options: undefined },
    { profile: builtInProfile('p6'), options: undefined }), true);
eq('35a echte conventiewijziging telt', sameSettings({ profile: p6NoClamp, options: undefined },
  { profile: builtInProfile('p6'), options: undefined }), false);
eq('35b zelfde opgeloste set, ander id telt', sameSettings({ profile: { ...own, overrides: {} }, options: undefined },
  { profile: builtInProfile('p6'), options: undefined }), false);
eq('35c hernoemen telt', sameSettings({ profile: own, options: undefined }, { profile: { ...own, name: 'Anders' }, options: undefined }), false);
// Punt 7: editConvention weigert een kopie-id dat de sanitizers niet zouden accepteren.
eq('36 kopie-id langer dan 64 ⇒ no-op', editConvention(xerP6, 'clampNegativeFreeFloat', false, { id: 'x'.repeat(65), name: 'K' }) === xerP6, true);
eq('36a kopie-id van precies 64 mag', editConvention(xerP6, 'clampNegativeFreeFloat', false, { id: 'x'.repeat(64), name: 'K' })?.id.length, 64);
eq('36b leeg kopie-id ⇒ no-op', editConvention(xerP6, 'clampNegativeFreeFloat', false, { id: '  ', name: 'K' }) === xerP6, true);
eq('36c ingebouwd id als kopie-id ⇒ no-op', editConvention(xerP6, 'clampNegativeFreeFloat', false, { id: 'ops', name: 'K' }) === xerP6, true);
// "Terug naar basis" (UI-voorstel conventiegroepen): haalt één afwijking weg, zonder kopie op een ingebouwd id.
{
  const reset = resetConventionToBase(xerP6, 'p6UseRemainingStartForProgress');
  eq('37 terug naar basis op ingebouwd houdt het id', reset?.id, xerP6.id);
  eq('37a terug naar basis haalt de afwijking weg', reset?.overrides.p6UseRemainingStartForProgress, undefined);
  eq('37b zonder afwijking ⇒ ongewijzigd', resetConventionToBase(xerP6, 'clampNegativeFreeFloat') === xerP6, true);
  eq('37c afwezig profiel ⇒ afwezig', resetConventionToBase(undefined, 'clampNegativeFreeFloat'), undefined);
  const ownReset = resetConventionToBase(own, 'clampNegativeFreeFloat');
  eq('37d eigen profiel houdt id en verliest de afwijking', [ownReset?.id, ownReset?.overrides], [own.id, {}]);
}

if (diffs.length === 0) console.log(`OK: bewerkmodel rekenprofiel — ${checks} checks groen`);
else { console.log(`XX bewerkmodel rekenprofiel — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
