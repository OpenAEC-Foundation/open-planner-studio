// Speling-berekening onder het MS Project-profiel (eigenaarsbesluit 2026-10-02, spec rekenprofielen
// §3.1): een NIEUW project met rekenprofiel MS Project rekent de totale speling zoals een GEOPEND
// `.mpp`-bestand, dus *Automatisch* (`totalFloatMode` afwezig) en niet *Kleinste*. Automatisch =
// finish-speling bij statusdatum én gestarte taak, anders het minimum. Met een statusdatum is dat MSP's
// regel (voor een gestarte taak de finish slack: MPXJ `MicrosoftSlackCalculator.calculateTotalSlack`,
// bij ons `mppTotalSlackTenths`); zonder statusdatum telt voortgang niet mee. *Kleinste* (altijd het
// minimum) is de P6-modus. Gepind langs beide routes naar een nieuw MSP-project — de profielkeuze in
// de wizard *Nieuw project* en de knop *Standaardopties van dit profiel toepassen* — tegen wat
// `readMPP` oplevert, plus een rekenvoorbeeld waarin de twee modi werkelijk verschillen. Of de app
// daarmee MSP's OPGESLAGEN speling haalt, meet deze check niet (dat is de corpusmeting, spec §3.1).
// Draait via run.sh. Exit 0 = alles groen.
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

// 1. De `.mpp`-kant: de lezer zet het profiel en GEEN speling-modus. Alleen dat wordt hier vastgelegd
//    (zet iemand later een modus in `readMPP`, dan moet deze kant mee); de fixture heeft geen gestarte
//    taak en hier wordt geen speling gerekend. 11328 = ma 5-1-2015 in MPP-dagen.
const opened = readMPP(minimalMpp14Bytes({ startDays: 11328, finishDays: 11330, projectStartDays: 11328 }));
eq('01 .mpp: profiel MS Project', opened.project.schedulingProfile?.id, 'msproject');
eq('02 .mpp: geen speling-modus (Automatisch)', opened.project.schedulingOptions?.totalFloatMode, undefined);

// 2. De wizard *Nieuw project*: `SchedulingProfileSection.onChoose` in mode 'wizard' doet per keuze
//    `{ profile: selectProfile(...), options: withDefaultOptions(nextProfile, value.options) }` en
//    ProjectInfoPanelContent geeft dat resultaat ongewijzigd aan `createNewProject`. Hier hetzelfde
//    pad, eerst Primavera P6 (zet *Finishspeling*) en daarna Microsoft Project: die keuze moet de
//    P6-modus wissen en mag geen *Kleinste* zetten.
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

// 3. De knop *Standaardopties van dit profiel toepassen* (`withDefaultOptions(profile, value.options)`)
//    zet een eerder gekozen *Kleinste* terug (ook een project uit de wizard van vóór dit besluit).
const button = withDefaultOptions(msp, { totalFloatMode: 'smallest' });
eq('06 knop Standaardopties: Kleinste wordt Automatisch', button?.totalFloatMode, undefined);
eq('07 nieuw MSP-project (wizard, knop) ≡ geopend .mpp in de UI, en dat is Automatisch',
  [totalFloatModeToUi(wizard.options?.totalFloatMode), totalFloatModeToUi(button?.totalFloatMode),
    totalFloatModeToUi(opened.project.schedulingOptions?.totalFloatMode)],
  ['auto', 'auto', 'auto']);

// 4. Het wizardresultaat via de store (`createNewProject`, zoals ProjectInfoPanelContent hem aanroept).
const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
S().createNewProject({
  name: 'MSP nieuw', startDate: '2026-05-04', calendar: createDefaultCalendar(2026), phaseNames: [],
  schedulingProfile: wizard.profile, schedulingOptions: wizard.options,
});
eq('08 nieuw project uit de wizard: MS Project-profiel, geen speling-modus',
  [S().project.schedulingProfile?.id, S().project.schedulingOptions?.totalFloatMode], ['msproject', undefined]);

// 5. Rekenvoorbeeld: een gestarte taak die vóórloopt. A (10 wd, gestart ma 4-5, 50%) hervat haar
//    restwerk al op 5-5 (`time.resume`, het MPP-veld), dus haar vroege einde ligt ruim vóór start + duur;
//    C (20 wd) bepaalt het projecteinde. Dan is A's finish-speling groter dan haar start-speling.
//    Bij Automatisch telt (met statusdatum) de finish-speling — MSP's regel —, bij Kleinste de
//    start-speling; hier verschillen die, dus de pin is niet triviaal. Met de hand (standaardkalender
//    2026: Hemelvaart do 14-5 en Pinkstermaandag 25-5 vrij): A eindigt ma 11-5 (5-5 + 5 wd), C di 2-6;
//    LF(A) = 2-6, LS(A) = 19-5. Finish-speling 12-5…2-6 = 14 wd, start-speling 4-5…18-5 = 10 wd.
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

if (diffs.length > 0) {
  console.log(`XX  msproject-float-default: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  msproject-float-default: alle checks groen (${checks})`);
