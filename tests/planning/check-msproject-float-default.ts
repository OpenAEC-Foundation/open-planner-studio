import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile, defaultOptionsFor } from '@/engine/scheduler/conventions/registry';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { readMPP } from '@/services/mpp/mppReader';
import { selectProfile, totalFloatModeToUi, withDefaultOptions, type ProfileChoice } from '@/state/schedulingProfileDraft';
import type { ProjectSchedulingOptions, SchedulingProfile } from '@/types/project';
import { minimalMpp14Bytes } from './mppFixtures';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const msp = builtInProfile('msproject');

const opened = readMPP(minimalMpp14Bytes({ startDays: 11328, finishDays: 11330, projectStartDays: 11328 }));
eq('01 .mpp: profiel MS Project', opened.project.schedulingProfile?.id, 'msproject');
eq('02 .mpp: geen speling-modus (Automatisch)', opened.project.schedulingOptions?.totalFloatMode, undefined);

interface WizardValue { profile: SchedulingProfile | undefined; options: ProjectSchedulingOptions | undefined }
const choose = (value: WizardValue, choice: ProfileChoice): WizardValue => {
  const profile = selectProfile(value.profile, choice, []);
  return { profile, options: withDefaultOptions(profile, value.options) };
};
const afterP6 = choose({ profile: undefined, options: undefined }, 'builtin:p6');
eq('04 wizard: eerst P6 ⇒ Finishspeling', afterP6.options?.totalFloatMode, 'finish');
const wizard = choose(afterP6, 'builtin:msproject');
eq('05 wizard: daarna MS Project ⇒ profiel msproject, geen opties', [wizard.profile?.id, wizard.options], ['msproject', undefined]);
eq('05a standaardopties MS Project: leeg', defaultOptionsFor('msproject'), {});

const button = withDefaultOptions(msp, { totalFloatMode: 'smallest' });
eq('06 knop Standaardopties: Kleinste wordt Automatisch', button?.totalFloatMode, undefined);
eq('07 nieuw MSP-project (wizard, knop) ≡ geopend .mpp in de UI, en dat is Automatisch',
  [totalFloatModeToUi(wizard.options?.totalFloatMode), totalFloatModeToUi(button?.totalFloatMode),
    totalFloatModeToUi(opened.project.schedulingOptions?.totalFloatMode)],
  ['auto', 'auto', 'auto']);

const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
S().createNewProject({
  name: 'MSP nieuw', startDate: '2026-05-04', calendar: createDefaultCalendar(2026), phaseNames: [],
  schedulingProfile: wizard.profile, schedulingOptions: wizard.options,
});
eq('08 nieuw project uit de wizard: MS Project-profiel, geen speling-modus',
  [S().project.schedulingProfile?.id, S().project.schedulingOptions?.totalFloatMode], ['msproject', undefined]);

const a = S().addTask({ name: 'A', time: { ...createDefaultTaskTime('2026-05-04', 10), actualStart: '2026-05-04', completion: 0.5, resume: '2026-05-05' } });
S().addTask({ name: 'C', time: createDefaultTaskTime('2026-05-04', 20) });
S().setStatusDate('2026-05-06');
const tfOf = (options: ProjectSchedulingOptions | undefined): number | undefined => {
  S().setProject({ schedulingOptions: options });
  S().runCPM();
  return S().tasks.find(t => t.id === a)?.time.totalFloat;
};
const tfAuto = tfOf(wizard.options);
const tfFinish = tfOf({ totalFloatMode: 'finish' });
const tfSmallest = tfOf({ totalFloatMode: 'smallest' });
eq('09 MSP-standaard rekent voor een gestarte taak de finish-speling', tfAuto, tfFinish);
eq('10 …met de hand: automatisch 14 wd (finish), kleinste 10 wd (start)', [tfAuto, tfSmallest], [14, 10]);

const autoModes = [
  ['automatisch', undefined], ['start', { totalFloatMode: 'start' }],
  ['finish', { totalFloatMode: 'finish' }], ['kleinste', { totalFloatMode: 'smallest' }],
] as const;
for (const status of ['2026-05-06', undefined]) {
  ctx.store.setState(s => { s.project.statusDate = status; });
  for (const [mode, options] of autoModes) {
    const total = tfOf(options);
    const current = S();
    const task = current.tasks.find(t => t.id === a);
    const row = current.cpmResult?.tasks.get(a);
    if (current.cpmResult?.error || !task || !row) {
      throw new Error('Knownbug 47: mislukte berekening: ' + (current.cpmResult?.error ?? mode));
    }
    console.log('KNOWNBUG47', JSON.stringify({ status: current.project.statusDate ?? null, mode, total,
      totalMinutes: row.totalFloatMinutes, completion: task.time.completion, actualStart: task.time.actualStart,
      es: row.earlyStart, ef: row.earlyFinish, ls: row.lateStart, lf: row.lateFinish }));
  }
}

if (diffs.length > 0) {
  console.log(`XX  msproject-float-default: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  msproject-float-default: alle checks groen (${checks})`);
