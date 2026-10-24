// Dagenmaat of urenmaat (alleen uren §3.2, §3.3, §3.5, §3.14). Exit 0 = groen.
//
// Wat hier bewezen wordt: `taskCountsInWorkdays` en `lagCountsInWorkdays` geven alleen "dagenmaat" als
// de data in de dagenmaat staat EN het profiel de conventie `workdayDurationMeasure` aan heeft. Dat is
// het OPS-profiel; onder P6 en MSP telt alles als uren. Kalendertijd telt nooit in de dagenmaat. Een
// procentlag volgt de maat van de voorganger (B7): in de dagenmaat alleen bij een dagtaak als voorganger.
// Mutatiebewijs: zet in een functie de conventievoorwaarde op `true` ⇒ de P6/MSP-gevallen worden rood;
// laat de kalendertijdvoorwaarde weg ⇒ de ELAPSEDTIME-gevallen worden rood; laat een procentlag altijd
// in uren tellen ⇒ de OPS-gevallen met een dagtaak als voorganger worden rood.
import { effectiveSchedulingOptions, builtInProfile } from '@/engine/scheduler/conventions/registry';
import { lagCountsInWorkdays, taskCountsInWorkdays } from '@/engine/scheduler/conventions/durationMeasure';
import type { BuiltInProfileId } from '@/types/project';
import type { DurationType, TaskDurationUnit } from '@/types/task';
import type { Sequence } from '@/types/sequence';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const optionsFor = (id: BuiltInProfileId) =>
  effectiveSchedulingOptions({ schedulingProfile: builtInProfile(id), schedulingOptions: undefined });
const PROFILES = ['ops', 'p6', 'msproject'] as const;
const task = (durationUnit: TaskDurationUnit, durationType: DurationType = 'WORKTIME') => ({ time: { durationUnit, durationType } });
type Lag = Pick<Sequence, 'lagMinutes' | 'lagUnit' | 'lagPercent'>;

// ── Taak ──
for (const id of PROFILES) {
  const o = optionsFor(id);
  eq(`taak ${id}: dagtaak`, taskCountsInWorkdays(task('days'), o), id === 'ops');
  eq(`taak ${id}: urentaak`, taskCountsInWorkdays(task('hours'), o), false);
  eq(`taak ${id}: dagtaak in kalendertijd`, taskCountsInWorkdays(task('days', 'ELAPSEDTIME'), o), false);
  eq(`taak ${id}: urentaak in kalendertijd`, taskCountsInWorkdays(task('hours', 'ELAPSEDTIME'), o), false);
}
// Zonder profiel ≡ OPS; een eigen afwijking op P6 zet de dagenmaat aan, op OPS uit.
eq('taak zonder profiel: dagtaak', taskCountsInWorkdays(task('days'),
  effectiveSchedulingOptions({ schedulingProfile: undefined, schedulingOptions: undefined })), true);
eq('taak P6 + afwijking aan: dagtaak', taskCountsInWorkdays(task('days'), effectiveSchedulingOptions({
  schedulingProfile: { ...builtInProfile('p6'), overrides: { workdayDurationMeasure: true } }, schedulingOptions: undefined,
})), true);
eq('taak OPS + afwijking uit: dagtaak', taskCountsInWorkdays(task('days'), effectiveSchedulingOptions({
  schedulingProfile: { ...builtInProfile('ops'), overrides: { workdayDurationMeasure: false } }, schedulingOptions: undefined,
})), false);

// ── Lag ──
const LAGS: readonly [string, Lag, boolean][] = [
  ['dagen (lagDays zonder lagMinutes)', {}, true],
  ['dagen met lagUnit WORKTIME', { lagUnit: 'WORKTIME' }, true],
  ['minuten', { lagMinutes: 240 }, false],
  ['minuten 0', { lagMinutes: 0 }, false],
  ['kalendertijd in dagen', { lagUnit: 'ELAPSEDTIME' }, false],
  ['kalendertijd in minuten', { lagMinutes: 2160, lagUnit: 'ELAPSEDTIME' }, false],
  ['procent zonder voorganger', { lagPercent: 50 }, false],
];
for (const id of PROFILES) {
  const o = optionsFor(id);
  for (const [label, lag, inOps] of LAGS) {
    eq(`lag ${id}: ${label}`, lagCountsInWorkdays(lag, o), id === 'ops' && inOps);
  }
}
// Procentlag in de maat van de voorganger (B7, §3.3).
const PCT: readonly [string, Lag, ReturnType<typeof task>, boolean][] = [
  ['procent na een dagtaak', { lagPercent: 50 }, task('days'), true],
  ['procent-lead na een dagtaak', { lagPercent: -50 }, task('days'), true],
  ['procent na een urentaak', { lagPercent: 50 }, task('hours'), false],
  ['procent na een dagtaak in kalendertijd', { lagPercent: 50 }, task('days', 'ELAPSEDTIME'), false],
  ['procent in kalendertijd na een dagtaak', { lagPercent: 50, lagUnit: 'ELAPSEDTIME' }, task('days'), false],
];
for (const id of PROFILES) {
  const o = optionsFor(id);
  for (const [label, lag, pred, inOps] of PCT) {
    eq(`lag ${id}: ${label}`, lagCountsInWorkdays(lag, o, pred), id === 'ops' && inOps);
  }
}
// Een gewone lag kijkt niet naar de voorganger.
eq('lag ops: dagen na een urentaak', lagCountsInWorkdays({}, optionsFor('ops'), task('hours')), true);

if (diffs.length === 0) console.log(`OK: dagenmaat of urenmaat — ${checks} checks groen`);
else { console.log(`XX dagenmaat of urenmaat — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
