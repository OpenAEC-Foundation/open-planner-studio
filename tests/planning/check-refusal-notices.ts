// Weigeringen in het meldingenkanaal (eigenaarsbesluit 2026-10-17) — headless tegen de ECHTE store.
//
// Een weigering = een melding dat de app een handeling van de gebruiker NIET heeft uitgevoerd. Die is
// rood (`severity: 'error'`, vlag `refusal`) en blijft staan. Drie dingen kunnen stil afdrijven:
//   1. EEN BRON VALT TERUG NAAR INFO. Elke weigeringsbron hieronder (gedrag), en een bronscan die eist
//      dat geen enkele weigeringssleutel nog met een losse `severity:` wordt gebouwd: alleen via
//      `refusalNotice` (`src/state/refusalNotice.ts`). Een nieuwe meldingstekst die naar een
//      weigering klinkt, moet in de lijst staan of met een reden zijn uitgezonderd.
//   2. DEELS GELUKT. Ook als de rest van dezelfde handeling wél lukte, is een weigering rood
//      (eigenaarsbesluit 2026-10-17, "weigering = rood"), en noemt een detailregel welke taken of
//      relaties niet zijn aangepast.
//   3. STAPELEN EN WEGDUWEN. Herhaalde weigeringen vouwen samen (een melding met een aantal alleen
//      bij precies dezelfde set), duwen bij een volle stapel nooit een echte fout of een blijvende
//      info weg, en slokken een nieuwe info niet op.
//
// Draait vanzelf mee via run.sh. Exit 0 = alles groen.
import './domStub';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useAppStore } from '@/state/appStore';
import { MAX_NOTIFICATIONS } from '@/state/slices/uiSlice';
import { durationBelowDoneWorkNotice } from '@/state/progressEntryNotice';
import { startEditNotifications } from '@/state/startConstraintNotice';
import { milestoneRefusalNotices, phaseRefusalNotice } from '@/state/structuralTransition';
import { notifyHierarchyCycle } from '@/state/hierarchyRelationNotice';
import { createRelationWithFeedback } from '@/state/relationActions';
import { REFUSED_NAMES_SHOWN } from '@/state/refusalNotice';
import { notifyRelationsSkipped } from '@/state/insertedBranch';
import type { NotifyInput } from '@/state/slices/types';

const S = () => useAppStore.getState();
const N = () => S().ui.notifications;
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const clearAll = () => { for (const n of [...N()]) S().dismissNotification(n.id); };
const kind = (n: NotifyInput | undefined) => n && { severity: n.severity, refusal: n.refusal === true };
const RED = { severity: 'error', refusal: true };
const mso = { type: 'MSO', date: '2026-06-10' } as const;
const blocked = (name: string) => ({ kind: 'blocked' as const, name, constraint: mso, taskId: `id-${name}` });

// ── 1. Elke weigeringsbron is rood ──────────────────────────────────────────
eq('1a durationBelowDoneWork', kind(durationBelowDoneWorkNotice({ id: 't', name: 'T', time: { completion: 0.5 } })), RED);
const one = startEditNotifications([blocked('B')], 'dmy', '24h');
eq('1b startBlockedByConstraint', [one[0]?.messageKey, kind(one[0])], ['notifications.startBlockedByConstraint', RED]);
const noDate = startEditNotifications([{ kind: 'blocked', name: 'B', constraint: { type: 'ALAP' }, taskId: 'b' }], 'dmy', '24h');
eq('1c startBlockedByConstraintNoDate', [noDate[0]?.messageKey, kind(noDate[0])], ['notifications.startBlockedByConstraintNoDate', RED]);
const many = startEditNotifications([blocked('B'), blocked('C')], 'dmy', '24h');
eq('1d startBlockedByConstraintMany', [many[0]?.messageKey, kind(many[0])], ['notifications.startBlockedByConstraintMany', RED]);
eq('1e SNET blijft info (geen weigering)',
  kind(startEditNotifications([{ kind: 'snet', name: 'B', date: '2026-06-15', change: 'created' }], 'dmy', '24h')[0]),
  { severity: 'info', refusal: false });
const ms = milestoneRefusalNotices([{ id: 'a', name: 'A', refusal: 'assignments' }, { id: 'f', name: 'F', refusal: 'summary' }]);
eq('1f milestoneRefusedAssignments + Summary', ms.map(n => [n.messageKey, kind(n)]), [
  ['notifications.milestoneRefusedAssignments', RED], ['notifications.milestoneRefusedSummary', RED],
]);
const describe = { tasks: [], resources: [], assignments: [] };
eq('1g phaseRefusedNoAssignableChild', kind(phaseRefusalNotice(describe, { kind: 'noAssignableChild', phaseId: 'p' })), RED);
eq('1h phaseRefusedDuplicateResource',
  kind(phaseRefusalNotice(describe, { kind: 'duplicateResource', phaseId: 'p', childId: 'c', resourceId: 'r' })), RED);
const captured: NotifyInput[] = [];
notifyHierarchyCycle({ tasks: [], notify: (n) => captured.push(n) }, ['a', 'b', 'a']);
eq('1i hierarchyCycle', [captured[0]?.messageKey, kind(captured[0])], ['notifications.hierarchyCycle', RED]);

S().newProject();
clearAll();
const rA = S().addTask({ name: 'A' });
const rB = S().addTask({ name: 'B' });
createRelationWithFeedback(rA, rB);
eq('1j een geslaagde relatie meldt niets', N().length, 0);
createRelationWithFeedback(rA, rB);
eq('1k relationDuplicate', [N()[0]?.messageKey, kind(N()[0])], ['notifications.relationDuplicate', RED]);
clearAll();
createRelationWithFeedback(rB, rA);
eq('1l relationCycle', [N()[0]?.messageKey, kind(N()[0])], ['notifications.relationCycle', RED]);
clearAll();
const skippedRel: NotifyInput[] = [];
notifyRelationsSkipped((n) => skippedRel.push(n), ['A → B'], 'k');
eq('1m relationsSkippedOnInsert is rood en noemt de relatie',
  [skippedRel[0]?.messageKey, kind(skippedRel[0]), skippedRel[0]?.detailLines],
  ['notifications.relationsSkippedOnInsert', RED, [{ messageKey: 'notifications.refusedRelationNames', params: { names: 'A → B' } }]]);
const none: NotifyInput[] = [];
notifyRelationsSkipped((n) => none.push(n), [], 'k');
eq('1n geen overgeslagen relaties ⇒ geen melding', none.length, 0);

// ── 2. Welke taken niet zijn aangepast ───────────────────────────────────────
// Many: bij plakken kan een andere cel van dezelfde taak wél geschreven zijn ⇒ "Niet toegepast bij".
eq('2a Many noemt de taken (niet toegepast bij)', many[0]?.detailLines,
  [{ messageKey: 'notifications.notAppliedTaskNames', params: { names: 'B, C' } }]);
const msMany = milestoneRefusalNotices([{ id: 'a', name: 'A', refusal: 'assignments' }, { id: 'b', name: 'B', refusal: 'assignments' }]);
eq('2b mijlpaal _other noemt de taken (niet aangepast)', msMany[0]?.detailLines,
  [{ messageKey: 'notifications.refusedTaskNames', params: { names: 'A, B' } }]);
const seven = Array.from({ length: REFUSED_NAMES_SHOWN + 2 }, (_, i) => blocked(`T${i}`));
eq('2c meer dan vijf namen ⇒ "en nog N"', startEditNotifications(seven, 'dmy', '24h')[0]?.detailLines,
  [{ messageKey: 'notifications.notAppliedTaskNamesMore', params: { names: 'T0, T1, T2, T3, T4', count: 2 } }]);

// ── 3. Samenvouwen en wegduwen ──────────────────────────────────────────────
for (let i = 0; i < 10; i++) for (const n of one) S().notify(n);
eq('3a tien keer dezelfde startweigering ⇒ één regel ×10', N().map(n => [n.messageKey, n.count]),
  [['notifications.startBlockedByConstraint', 10]]);
clearAll();
for (let i = 0; i < 10; i++) for (const n of many) S().notify(n);
eq('3b tien keer Many met dezelfde taken ⇒ één regel ×10', N().map(n => n.count), [10]);
clearAll();
for (const n of startEditNotifications([blocked('A'), blocked('B'), blocked('C')], 'dmy', '24h')) S().notify(n);
for (const n of startEditNotifications([blocked('D'), blocked('E')], 'dmy', '24h')) S().notify(n);
eq('3c Many A,B,C en daarna Many D,E ⇒ twee regels, elk met zijn eigen aantal',
  N().map(n => [n.params?.count, n.count]), [[3, 1], [2, 1]]);
clearAll();
for (const n of milestoneRefusalNotices([{ id: 'a', name: 'A', refusal: 'assignments' }, { id: 'b', name: 'B', refusal: 'assignments' }, { id: 'c', name: 'C', refusal: 'assignments' }])) S().notify(n);
for (const n of milestoneRefusalNotices([{ id: 'd', name: 'D', refusal: 'assignments' }, { id: 'e', name: 'E', refusal: 'assignments' }])) S().notify(n);
eq('3d mijlpaal: twee verschillende sets ⇒ twee regels', N().map(n => [n.params?.count, n.count]), [[3, 1], [2, 1]]);
clearAll();

const refusals = (n: number) => {
  for (let i = 0; i < n; i++) S().notify(durationBelowDoneWorkNotice({ id: `t${i}`, name: `T${i}`, time: { completion: 0.5 } }));
};
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: 'disk full' });
refusals(MAX_NOTIFICATIONS);
eq('3e saveFailed + 3 weigeringen ⇒ saveFailed blijft',
  N().map(n => n.messageKey), ['notifications.saveFailed', 'notifications.durationBelowDoneWork', 'notifications.durationBelowDoneWork']);
clearAll();
S().notify({ severity: 'info', messageKey: 'notifications.summaryRelationsDropped', params: { total: 4 }, sticky: true });
refusals(MAX_NOTIFICATIONS);
eq('3f sticky info + 3 weigeringen ⇒ sticky blijft', N()[0]?.messageKey, 'notifications.summaryRelationsDropped');
eq('3g daarna nog twee weigeringen', N().length, MAX_NOTIFICATIONS);
clearAll();
S().notify({ severity: 'info', messageKey: 'notifications.templateSaved', params: { name: 'x' } });
S().notify({ severity: 'error', messageKey: 'notifications.saveFailed' });
refusals(2);
eq('3h een oudere gewone info gaat vóór een weigering', N().map(n => n.messageKey),
  ['notifications.saveFailed', 'notifications.durationBelowDoneWork', 'notifications.durationBelowDoneWork']);
clearAll();
for (let i = 0; i < MAX_NOTIFICATIONS; i++) S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', dedupeKey: `s${i}` });
refusals(1);
eq('3i drie echte fouten + een weigering ⇒ de fouten blijven', N().map(n => n.messageKey),
  Array(MAX_NOTIFICATIONS).fill('notifications.saveFailed'));
clearAll();
// Drie staande weigeringen mogen een nieuwe info niet opslokken: de info verschijnt en duwt de
// oudste weigering weg.
refusals(MAX_NOTIFICATIONS);
for (const n of startEditNotifications([{ kind: 'snet', name: 'B', date: '2026-06-15', change: 'created' }], 'dmy', '24h')) S().notify(n);
eq('3j 3 weigeringen + SNET-info ⇒ de info staat erbij', N().map(n => n.messageKey),
  ['notifications.durationBelowDoneWork', 'notifications.durationBelowDoneWork', 'notifications.startSnetCreated']);
S().notify({ severity: 'info', messageKey: 'notifications.statusDateSetToday', params: { date: '1-1-2026' } });
eq('3k daarna "Statusdatum op vandaag gezet" ⇒ ook die verschijnt', N().at(-1)?.messageKey, 'notifications.statusDateSetToday');
clearAll();
for (let i = 0; i < MAX_NOTIFICATIONS; i++) S().notify({ severity: 'error', messageKey: 'notifications.saveFailed', dedupeKey: `s${i}` });
S().notify({ severity: 'info', messageKey: 'notifications.templateSaved', params: { name: 'x' } });
eq('3l drie echte fouten + info ⇒ de fouten blijven (de info valt weg)', N().map(n => n.messageKey),
  Array(MAX_NOTIFICATIONS).fill('notifications.saveFailed'));
clearAll();

// ── 4. Bronscan ─────────────────────────────────────────────────────────────
// (a) Geen weigeringssleutel met een losse severity, overal in src/ (ook services/mcp).
// (b) Een nieuwe nl-meldingstekst die naar een weigering klinkt, staat in REFUSAL_KEYS of in
//     NOT_A_REFUSAL met een reden — zo valt een nieuwe weigering niet stil buiten deze check.
const REFUSAL_KEYS = [
  'durationBelowDoneWork', 'relationDuplicate', 'relationAncestorEndpoint', 'relationCycle', 'hierarchyCycle',
  'startBlockedByConstraint', 'startBlockedByConstraintNoDate', 'startBlockedByConstraintMany',
  'dragStartIsActual', 'dragDatesAreActual', 'milestoneRefusedAssignments', 'milestoneRefusedSummary',
  'phaseRefusedNoAssignableChild', 'phaseRefusedDuplicateResource', 'taskEditRevertBlocked', 'pasteSkippedReadOnly',
  'relationsSkippedOnInsert', 'schedulingTemplateLimit',
];
const NOT_A_REFUSAL: Record<string, string> = {
  extHelpProjectOpenFailed: 'storing (bestand niet te openen), echte fout',
  siteSaveConflict: 'opslaan geweigerd door de site: data staat op het spel, blijft een echte fout die nooit weggeduwd wordt',
  recoveryReadFailed: 'storing bij herstel', recoveryDocumentsSkipped: 'storing bij herstel',
  scheduleFailed: 'storing (planning onberekenbaar)', ifcParseFailed: 'storing (bestand onleesbaar)',
  librarySaveFailed: 'storing (opslag)', schedulingTemplateStorageFailed: 'storing (opslag vol)',
  schedulingTemplateDeleteFailed: 'storing (opslag vol)',
  xerImportEmptyProjectsSkipped: 'openingsmelding bij import (eigenaarsbesluit: niet rood)',
  summaryRelationsDropped: 'openingsmelding bij import (eigenaarsbesluit: niet rood)',
  p6xmlImportUnassignedActivities: 'openingsmelding bij import (eigenaarsbesluit: niet rood)',
  notAppliedTaskNames: 'detailregel onder een weigering', notAppliedTaskNamesMore: 'detailregel onder een weigering',
  refusedRelationNames: 'detailregel onder een weigering', refusedRelationNamesMore: 'detailregel onder een weigering',
  refusedTaskNames: 'detailregel onder een weigering', refusedTaskNamesMore: 'detailregel onder een weigering',
};
const REFUSAL_SOUND = /niet toegepast|niet aangemaakt|niet gewijzigd|niets gewijzigd|niets verplaatst|kan geen|kan niet|kunnen geen|niet toegestaan|bestaat al|overgeslagen|niet teruggedraaid|verschuift niet|verschuiven niet|niet opgeslagen|niet verwijderd|geweigerd|niet mogelijk|niet ingelezen|niet overgenomen|kon niet|konden niet|niet aangepast/i;
const nlCommon = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/i18n/locales/nl/common.json', import.meta.url)), 'utf8')) as { notifications: Record<string, unknown> };
const soundsLike = new Set<string>();
for (const [key, text] of Object.entries(nlCommon.notifications)) {
  if (typeof text === 'string' && REFUSAL_SOUND.test(text)) soundsLike.add(key.replace(/_(zero|one|two|few|many|other)$/, ''));
}
eq('4b elke tekst die naar een weigering klinkt, is ingedeeld',
  [...soundsLike].filter(k => !REFUSAL_KEYS.includes(k) && !(k in NOT_A_REFUSAL)).sort(), []);

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!/[/\\]i18n$/.test(p)) walk(p); }
    else if (/\.(ts|tsx)$/.test(name) && !p.endsWith(join('slices', 'types.ts'))) files.push(p);
  }
};
walk(SRC);
const found = new Set<string>();
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const key of REFUSAL_KEYS) {
      if (!new RegExp(`'notifications\\.${key}'`).test(line)) continue;
      found.add(key);
      // Dezelfde opdracht: terug tot de vorige regel die op `;` eindigt (hooguit 6 regels).
      let from = i;
      while (from > Math.max(0, i - 6) && !/;\s*$/.test(lines[from - 1])) from--;
      const before = `${lines.slice(from, i).join('\n')}\n${line.slice(0, line.indexOf(`'notifications.${key}'`))}`;
      if (/severity\s*:/.test(before)) diffs.push(`4a ${file.slice(SRC.length + 1)}:${i + 1}: ${key} met een losse severity — gebruik refusalNotice`);
      if (!/refusalNotice\(/.test(before) && !/REJECTION_MESSAGE/.test(lines.slice(Math.max(0, i - 12), i).join('\n'))) {
        diffs.push(`4a ${file.slice(SRC.length + 1)}:${i + 1}: ${key} niet via refusalNotice`);
      }
    }
  });
}
eq('4z elke weigeringssleutel is in de bron gevonden', REFUSAL_KEYS.filter(k => !found.has(k)), []);

if (diffs.length > 0) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`check-refusal-notices: ${diffs.length} afwijking(en) op ${checks} checks`);
  process.exit(1);
}
console.log(`OK  check-refusal-notices: ${checks} checks + bronscan van ${files.length} bestanden groen`);
