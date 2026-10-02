// Speling-berekening onder het MS Project-profiel (eigenaarsbesluit 2026-10-02, spec rekenprofielen
// §3.1): een NIEUW project met rekenprofiel MS Project rekent de totale speling zoals een GEOPEND
// `.mpp`-bestand, dus *Automatisch* (`totalFloatMode` afwezig) en niet *Kleinste*. Automatisch =
// finish-speling bij statusdatum én gestarte taak, anders het minimum: MSP's eigen regel (MPXJ
// `MicrosoftSlackCalculator.calculateTotalSlack`, bij ons `mppTotalSlackTenths`). *Kleinste* (altijd
// het minimum) is de P6-modus en week bij gestarte taken met een statusdatum af van MSP's opgeslagen
// speling. Gepind langs beide routes naar een nieuw MSP-project — de wizard *Nieuw project* en de knop
// *Standaardopties van dit profiel toepassen* (allebei `withDefaultOptions`) — tegen wat `readMPP`
// oplevert, plus een rekenvoorbeeld waarin de twee modi werkelijk verschillen.
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile, defaultOptionsFor } from '@/engine/scheduler/conventions/registry';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { readMPP } from '@/services/mpp/mppReader';
import { totalFloatModeToUi, withDefaultOptions } from '@/state/schedulingProfileDraft';
import type { ProjectSchedulingOptions } from '@/types/project';
import { minimalMpp14Bytes } from './mppFixtures';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const msp = builtInProfile('msproject');

// 1. Een geopend `.mpp` (mét statusdatum, het geval waarin de modi kunnen verschillen): profiel MS
//    Project, geen speling-modus ⇒ Automatisch. 11328 = ma 5-1-2015 in MPP-dagen.
const opened = readMPP(minimalMpp14Bytes({ startDays: 11328, finishDays: 11330, projectStartDays: 11328, statusDays: 11329 }));
eq('01 .mpp: profiel MS Project', opened.project.schedulingProfile?.id, 'msproject');
eq('02 .mpp: statusdatum gelezen', opened.project.statusDate?.slice(0, 10), '2015-01-06');
eq('03 .mpp: geen speling-modus (Automatisch)', opened.project.schedulingOptions?.totalFloatMode, undefined);

// 2. De twee routes naar een nieuw MSP-project leveren dezelfde modus als het geopende `.mpp`.
const wizard = withDefaultOptions(msp);
eq('04 standaardopties MS Project: leeg (afwezig)', [defaultOptionsFor('msproject'), wizard], [{}, undefined]);
// De knop overschrijft een eerder gezette *Kleinste* (een project uit de wizard van vóór dit besluit).
const button = withDefaultOptions(msp, { totalFloatMode: 'smallest' });
eq('05 knop Standaardopties: Kleinste wordt Automatisch', button?.totalFloatMode, undefined);
eq('06 nieuw MSP-project ≡ geopend .mpp in de UI (Speling-berekening)',
  [totalFloatModeToUi(wizard?.totalFloatMode), totalFloatModeToUi(button?.totalFloatMode)],
  [totalFloatModeToUi(opened.project.schedulingOptions?.totalFloatMode), totalFloatModeToUi(opened.project.schedulingOptions?.totalFloatMode)]);
eq('07 …en dat is Automatisch', totalFloatModeToUi(wizard?.totalFloatMode), 'auto');

// 3. Wizard via de store (`createNewProject`, zoals ProjectInfoPanelContent hem aanroept).
const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
S().createNewProject({
  name: 'MSP nieuw', startDate: '2026-05-04', calendar: createDefaultCalendar(2026), phaseNames: [],
  schedulingProfile: msp, schedulingOptions: wizard,
});
eq('08 wizard: MS Project-profiel, geen opties', [S().project.schedulingProfile?.id, S().project.schedulingOptions], ['msproject', undefined]);

// 4. Rekenvoorbeeld: een gestarte taak die vóórloopt. A (10 wd, gestart ma 4-5, 50%) hervat haar
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
const tfAuto = tfOf(wizard);
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
