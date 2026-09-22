// Bewerkmodel van het rekenprofielblok (rekenprofielen, spec v3.1 §3.2/§6; plan taak D2). Exit 0 = groen.
// Verwachtingen met de hand afgeleid uit de spec en het register (geen gekopieerde uitvoer).
import {
  PER_FILE_CONVENTION_KEYS, choiceOf, selectProfile, editConvention, renameProfile, profileLabel, templateRelation,
  totalFloatModeToUi, totalFloatModeFromUi, withCriticalMode, withCriticalThreshold, withDefaultOptions, sameSettings,
} from '@/state/schedulingProfileDraft';
import { builtInProfile, defaultOptionsFor } from '@/engine/scheduler/conventions/registry';
import type { SchedulingProfile } from '@/types/project';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const xerP6: SchedulingProfile = { ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: true } };
const own: SchedulingProfile = { baseId: 'p6', id: 'prof-own', name: 'Eigen', overrides: { clampNegativeFreeFloat: false } };
const copy = { id: 'prof-new', name: 'Kopie van Primavera P6' };

eq('01 keuzewaarde ingebouwd', choiceOf(xerP6, []), 'builtin:p6');
eq('02 keuzewaarde sjabloon', choiceOf(own, [own]), 'template:prof-own');
eq('03 keuzewaarde los eigen profiel', choiceOf(own, []), 'current');
eq('04 afwezig = ops', choiceOf(undefined, []), 'builtin:ops');
eq('05 wissel bewaart overrides op een ingebouwd id letterlijk (spec §3.2)', selectProfile(xerP6, 'builtin:msproject', []),
  { baseId: 'msproject', id: 'msproject', name: '', overrides: { p6UseRemainingStartForProgress: true } });
eq('06 wissel vanaf een eigen profiel zonder bestandswaarde = kale basis', selectProfile(own, 'builtin:p6', []), builtInProfile('p6'));
eq('07 wissel naar schone ops = afwezig', selectProfile(builtInProfile('p6'), 'builtin:ops', []), undefined);
const fromTemplate = selectProfile(undefined, 'template:prof-own', [own]);
eq('08 sjabloon wordt gekopieerd (eigen kopie op het project)', [fromTemplate, fromTemplate === own], [own, false]);
eq('09 conventie wijzigen op ingebouwd ⇒ eigen kopie', editConvention(xerP6, 'clampNegativeFreeFloat', false, copy),
  { baseId: 'p6', id: 'prof-new', name: 'Kopie van Primavera P6', overrides: { clampNegativeFreeFloat: false, p6UseRemainingStartForProgress: true } });
eq('10 conventie wijzigen op eigen profiel houdt het id', editConvention(own, 'p6OpenLoeTargetSpan', false, copy)?.id, 'prof-own');
eq('11 terug naar de basiswaarde haalt de override weg', editConvention(own, 'clampNegativeFreeFloat', true, copy)?.overrides, {});
eq('12 ongewijzigde waarde = no-op (zelfde object)', editConvention(own, 'clampNegativeFreeFloat', false, copy) === own, true);
eq('13 hernoemen trimt en kapt af op 200', renameProfile(own, `  ${'x'.repeat(10_000_000)}  `)?.name.length, 200);
eq('13a hernoemen: voorloopwitruimte telt niet mee voor de grens', renameProfile(own, `${' '.repeat(10_000)}Nieuw  `)?.name, 'Nieuw');
eq('14 ingebouwd is niet hernoembaar', renameProfile(xerP6, 'Nee'), xerP6);
eq('15 lege naam wordt genegeerd', renameProfile(own, '   ')?.name, 'Eigen');
eq('16 label ingebouwd met bestandsoverride = aangepast', profileLabel(xerP6), { kind: 'builtIn', baseId: 'p6', modified: true });
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
eq('24 sameSettings negeert sleutelvolgorde en normaliseert ops',
  sameSettings({ profile: builtInProfile('ops'), options: { lagCalendar: 'successor', totalFloatMode: 'finish' } },
    { profile: undefined, options: { totalFloatMode: 'finish', lagCalendar: 'successor' } }), true);
eq('24a sameSettings ziet een echte optiewijziging', sameSettings({ profile: undefined, options: { lagCalendar: 'successor' } },
  { profile: undefined, options: { lagCalendar: 'predecessor' } }), false);

// ── Open punt uit M1 (orkestrator, 2026-09-22 22:40): een wissel VANAF een eigen profiel verliest via
// `switchProfile` alle afwijkingen, dus ook de bestandswaarde A19 (`rem_target_link_flag`). Het
// bewerkmodel draagt de per-bestand-conventies zelf over.
eq('25 per-bestand-conventies = alleen A19', PER_FILE_CONVENTION_KEYS, ['p6UseRemainingStartForProgress']);
// Een "Kopie van P6" ná een handmatige wijziging op een XER-project draagt A19 uit het bestand.
const ownFromXer = editConvention(xerP6, 'clampNegativeFreeFloat', false, copy);
eq('26 eigen kopie → P6: A19 uit het bestand blijft, de handmatige wijziging niet', selectProfile(ownFromXer, 'builtin:p6', []),
  { ...builtInProfile('p6'), overrides: { p6UseRemainingStartForProgress: true } });
eq('27 eigen kopie → MS Project: A19 blijft als afwijking', selectProfile(ownFromXer, 'builtin:msproject', []),
  { ...builtInProfile('msproject'), overrides: { p6UseRemainingStartForProgress: true } });
eq('28 eigen kopie → OPS: A19 blijft, dus niet het standaardprofiel', selectProfile(ownFromXer, 'builtin:ops', []),
  { ...builtInProfile('ops'), overrides: { p6UseRemainingStartForProgress: true } });
eq('29 heen en terug: P6 (aangepast) → kopie → P6 = het origineel', selectProfile(ownFromXer, 'builtin:p6', []), xerP6);

// ── "(aangepast)" volgt `diffAgainstBase`, niet het aantal sleutels in `overrides` ──────────────────
// Een sleutel gelijk aan de basis (kan na een wissel of uit oudere state blijven staan) is geen afwijking.
eq('30 override gelijk aan de basis ⇒ niet aangepast',
  profileLabel({ ...builtInProfile('p6'), overrides: { clampNegativeFreeFloat: true } }), { kind: 'builtIn', baseId: 'p6', modified: false });
eq('31 afwezig profiel = OPS, niet aangepast', profileLabel(undefined), { kind: 'builtIn', baseId: 'ops', modified: false });

if (diffs.length === 0) console.log(`OK: bewerkmodel rekenprofiel — ${checks} checks groen`);
else { console.log(`XX bewerkmodel rekenprofiel — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
