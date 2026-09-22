// Melding bij openen (rekenprofielen, spec v3.1 §6; plan taak C6). Exit 0 = groen.
// Asserties op messageKey/action/params — nooit op gerenderde tekst (de teksten komen uit baan D1).
// Mutatiebewijs (plan C6 step 4): de wrapper in fileSlice weglaten (terug naar alleen
// xerImportNotice) ⇒ 12 rood; `action` een functie geven ⇒ typecheck rood.
import { createAppStoreContext } from '@/state/appStore';
import { withSchedulingProfileNotice, OPEN_PROJECT_INFO_ACTION } from '@/state/schedulingProfileNotice';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { readXER } from '@/services/xer/xerReader';
import type { ImportResult } from '@/services/importTypes';
import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import type { NotifyInput } from '@/state/slices/types';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
function importOf(profile: SchedulingProfile | undefined, suggested: BuiltInProfileId | undefined): ImportResult {
  const calendar = createDefaultCalendar();
  const project = { ...createDefaultProject(), calendarId: calendar.id, startDate: '2026-06-01', schedulingProfile: profile };
  return {
    project, calendar, tasks: [], sequences: [], resources: [], assignments: [],
    ...(suggested ? { suggestedProfileId: suggested } : {}),
  };
}

// 1. De pure regel.
const mpp = withSchedulingProfileNotice([importOf(builtInProfile('msproject'), 'msproject')], undefined, 'doc-1');
eq('01 .mpp-voorstel ⇒ profielmelding', mpp?.messageKey, 'notifications.schedulingProfileApplied');
eq('02 profiel als merknaam', mpp?.params, { profile: 'Microsoft Project' });
eq('03 actie naar Backstage → Projectinfo', mpp?.action,
  { kind: 'openBackstageSection', section: 'project-info', labelKey: 'notifications.actions.openProjectInfo' });
eq('04 lees-meer naar de gids', mpp?.helpArticleId, 'gids-rekenprofielen');
eq('05 dedupe per import', mpp?.dedupeKey, 'scheduling-profile-applied:doc-1');
eq('06 voorstel ops (CSV/MSPDI/P6-XML) ⇒ geen melding',
  withSchedulingProfileNotice([importOf(undefined, 'ops')], undefined, 'd'), undefined);
eq('07 eigen IFC (geen voorstel, wel p6-profiel) ⇒ geen melding',
  withSchedulingProfileNotice([importOf(builtInProfile('p6'), undefined)], undefined, 'd'), undefined);
const xerNotice: NotifyInput = {
  severity: 'info', messageKey: 'notifications.xerImportOpened', params: { count: 2 },
  detailLines: [{ messageKey: 'notifications.xerImportProjectsSeen', params: { count: 2 } }],
  helpArticleId: 'gids-xer-import',
};
const merged = withSchedulingProfileNotice(
  [importOf(builtInProfile('p6'), 'p6'), importOf(builtInProfile('p6'), 'p6')], xerNotice, 'doc-x');
eq('08 XER: samengevoegd, geen tweede toast', merged?.messageKey, 'notifications.xerImportOpened');
eq('09 XER: profielregel bovenaan', merged?.detailLines?.[0],
  { messageKey: 'notifications.schedulingProfileApplied', params: { profile: 'Primavera P6' } });
eq('10 XER: actie erbij, XER-gids blijft lees-meer', [merged?.action?.section, merged?.helpArticleId], ['project-info', 'gids-xer-import']);
eq('11 XER zonder profielvoorstel: ongewijzigd', withSchedulingProfileNotice([importOf(undefined, undefined)], xerNotice, 'd'), xerNotice);
eq('11b eigen profiel ⇒ zijn naam', withSchedulingProfileNotice(
  [importOf({ baseId: 'p6', id: 'eigen', name: 'Mijn P6', overrides: {} }, 'p6')], undefined, 'd')?.params, { profile: 'Mijn P6' });

// 2. Store: applyOpenedImport meldt precies één keer per geopend bestand.
const ctx = createAppStoreContext();
const S = () => ctx.store.getState();
const clear = () => { for (const n of [...S().ui.notifications]) S().dismissNotification(n.id); };
const profileNotices = () => S().ui.notifications.filter(n =>
  n.messageKey === 'notifications.schedulingProfileApplied'
  || n.detailLines?.some(line => line.messageKey === 'notifications.schedulingProfileApplied'));
S().applyOpenedImport(importOf(builtInProfile('msproject'), 'msproject'), { filePath: null, recompute: true });
eq('12 .mpp-achtige import ⇒ één profielmelding', profileNotices().length, 1);
eq('13 actie in de store is serialiseerbaar', JSON.parse(JSON.stringify(profileNotices()[0]?.action ?? null)), OPEN_PROJECT_INFO_ACTION);
clear();
S().applyOpenedImport(importOf(undefined, 'ops'), { filePath: null, recompute: true });
eq('14 CSV-achtige import ⇒ geen profielmelding', profileNotices().length, 0);
clear();
const twoProjects = readXER(new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tEen\tC1\t2026-01-01\t2026-01-01',
  '%R\tP2\tTwee\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tEen\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%R\tT2\tP2\tC1\tB1\tTwee\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n')));
S().applyOpenedImport(twoProjects, { filePath: null, recompute: true });
eq('15 XER met twee projecten ⇒ precies één melding, met de profielregel', profileNotices().length, 1);
eq('16 …en dat is de XER-openingsmelding', profileNotices()[0]?.messageKey, 'notifications.xerImportOpened');

if (diffs.length === 0) console.log(`OK: profielmelding — ${checks} checks groen`);
else { console.log(`XX profielmelding — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
