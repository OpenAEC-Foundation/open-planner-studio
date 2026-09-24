// "Taak bewerken" → Opslaan, headless tegen de ECHTE store, via exact de functies die
// `TaskDialog.tsx` gebruikt (`draftWith*` voor de concepttaak, `createTaskDialogSave` voor Opslaan).
//
// Bevinding 4 (taakmutaties-audit): de dialoog schreef completion/actualStart/actualFinish kaal via
// `updateTask` weg, zonder de voortgangsregels (`applyProgressInvariants`) die het paneel, het raster
// en MCP wél toepassen. Gevolg: de status bleef NOT_STARTED (ook op 100%), een werkelijk einde maakte
// de taak niet voltooid, en een eerder (via paneel/raster/MCP/import) gezette resterende duur bleef
// staan, zodat de taak in de planning te laat eindigde. Hier: paneel en dialoog naast elkaar, zelfde
// uitgangspositie, zelfde handeling ⇒ zelfde voortgangsvelden en zelfde einddatum.
//
// Bevinding 10: één keer Opslaan gaf 2–3 undo-stappen (gewijzigde ouder, eerste gebruik van een
// persoonlijk taaktype), en één Ctrl+Z draaide maar een deel terug. Hier: één Opslaan = één stap.
//
// De browserkant (dubbelklik, schuif, Opslaan, Ctrl+Z) staat in tests/browser/task-dialog-save.spec.ts.
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStoreContext, type AppStoreContext } from '@/state/appStore';
import {
  createTaskDialogSave, draftWithActualFinish, draftWithActualStart, draftWithProgress,
  type TaskDialogSaveInput,
} from '@/state/taskDialogSave';
import { historyDepthsForActiveScope } from '@/state/sessionHistory';
import { addPersonalTaskType } from '@/services/taskTypes/personalTaskTypes';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

interface Fixture {
  ctx: AppStoreContext;
  S: () => ReturnType<AppStoreContext['store']['getState']>;
  task: (id: string) => Task;
  save: (input: TaskDialogSaveInput) => void;
  /** Wat de dialoog bij openen vastlegt (TaskDialog.tsx, init-effect). */
  open: (id: string) => TaskDialogSaveInput;
  undoDepth: () => number;
}

/** Eigen storecontext met taken van 10 werkdagen vanaf ma 2 maart 2026, statusdatum vr 6 maart. */
function fixture(names: string[]): Fixture & { ids: string[] } {
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().setProject({ startDate: '2026-03-02', statusDate: '2026-03-06' });
  const ids = names.map(name => {
    const id = S().addTask({ name });
    const current = S().tasks.find(t => t.id === id)!;
    S().updateTask(id, { time: { ...current.time, scheduleStart: '2026-03-02', scheduleDuration: 10 } });
    return id;
  });
  S().runCPM();
  const task = (id: string) => S().tasks.find(t => t.id === id)!;
  return {
    ctx, S, ids, task,
    save: createTaskDialogSave(ctx),
    open: (id) => {
      const t = task(id);
      return { editingTaskId: id, draft: { ...t, time: { ...t.time } }, startDate: t.time.earlyStart || t.time.scheduleStart };
    },
    undoDepth: () => historyDepthsForActiveScope(S()).undoDepth,
  };
}

function progressOf(t: Task) {
  return {
    completion: t.time.completion,
    status: t.status,
    remainingTime: t.time.remainingTime ?? null,
    actualStart: t.time.actualStart ?? null,
    actualFinish: t.time.actualFinish ?? null,
    earlyFinish: t.time.earlyFinish ?? null,
  };
}

// ── 1. Voortgang na eerdere paneelvoortgang (het r5-scenario): 20% in week 1, dan 60% en 100% ─────
{
  const f = fixture(['Paneel', 'Dialoog']);
  const [panel, dialog] = f.ids;
  for (const id of f.ids) f.S().setTaskProgress(id, 0.2);
  f.S().runCPM();
  f.S().setProject({ statusDate: '2026-03-13' });
  f.S().runCPM();
  eq('1.0 uitgangspositie: resterend 8 na 20% via het paneel', f.task(dialog).time.remainingTime, 8);

  for (const target of [0.6, 1]) {
    f.S().setTaskProgress(panel, target);
    const input = f.open(dialog);
    f.save({ ...input, draft: draftWithProgress(input.draft, target, f.S().project.statusDate) });
    f.S().runCPM();
    eq(`1.${target * 100} dialoog = paneel (voortgang, status, resterend, einde)`, progressOf(f.task(dialog)), progressOf(f.task(panel)));
  }
  eq('1.x paneel op 100%: voltooid, einde = statusdatum', {
    status: f.task(panel).status, actualFinish: f.task(panel).time.actualFinish, remainingTime: f.task(panel).time.remainingTime,
  }, { status: 'COMPLETED', actualFinish: '2026-03-13', remainingTime: 0 });
}

// ── 2. Voortgang alleen via de dialoog: de status volgt (gestart, voltooid) ─────────────────────────
{
  const f = fixture(['Paneel', 'Dialoog']);
  const [panel, dialog] = f.ids;
  for (const target of [0.4, 1]) {
    f.S().setTaskProgress(panel, target);
    const input = f.open(dialog);
    f.save({ ...input, draft: draftWithProgress(input.draft, target, f.S().project.statusDate) });
    f.S().runCPM();
    eq(`2.${target * 100} dialoog = paneel`, progressOf(f.task(dialog)), progressOf(f.task(panel)));
  }
  eq('2.x dialoog op 100%: voltooid', f.task(dialog).status, 'COMPLETED');
}

// ── 3. Werkelijke datums via de dialoogvelden = de paneelsetters ────────────────────────────────────
{
  const f = fixture(['Paneel', 'Dialoog']);
  const [panel, dialog] = f.ids;
  const statusDate = () => f.S().project.statusDate;
  const viaDialog = (edit: (draft: Task) => Task | null) => {
    const input = f.open(dialog);
    const draft = edit(input.draft);
    if (!draft) throw new Error('dialoog weigerde een geldige datum');
    f.save({ ...input, draft });
    f.S().runCPM();
  };

  // 3a. Werkelijke start op een onbegonnen taak ⇒ gestart.
  f.S().setActualStart(panel, '2026-03-04');
  viaDialog(d => draftWithActualStart(d, '2026-03-04', statusDate()));
  f.S().runCPM();
  eq('3a werkelijke start: dialoog = paneel', progressOf(f.task(dialog)), progressOf(f.task(panel)));
  eq('3a werkelijke start ⇒ gestart', f.task(dialog).status, 'STARTED');

  // 3b. Werkelijk einde ⇒ voltooid (100%, resterend 0).
  f.S().setActualFinish(panel, '2026-03-05');
  viaDialog(d => draftWithActualFinish(d, '2026-03-05', statusDate()));
  f.S().runCPM();
  eq('3b werkelijk einde: dialoog = paneel', progressOf(f.task(dialog)), progressOf(f.task(panel)));
  eq('3b werkelijk einde ⇒ voltooid', { completion: f.task(dialog).time.completion, status: f.task(dialog).status }, { completion: 1, status: 'COMPLETED' });

  // 3c. Werkelijk einde wissen op een voltooide taak ⇒ terug naar gestart, resterend weer vol.
  f.S().setActualFinish(panel, undefined);
  viaDialog(d => draftWithActualFinish(d, undefined, statusDate()));
  f.S().runCPM();
  eq('3c einde wissen: dialoog = paneel', progressOf(f.task(dialog)), progressOf(f.task(panel)));
  eq('3c einde wissen ⇒ gestart', f.task(dialog).status, 'STARTED');

  // 3d. Een datum ná de statusdatum wordt (net als in het paneel) geweigerd.
  const input = f.open(dialog);
  eq('3d werkelijke start ná statusdatum geweigerd', draftWithActualStart(input.draft, '2026-03-09', statusDate()), null);
  eq('3d werkelijk einde ná statusdatum geweigerd', draftWithActualFinish(input.draft, '2026-03-09', statusDate()), null);
}

// ── 4. Geen voortgangswijziging ⇒ de voortgangsvelden blijven ongemoeid ─────────────────────────────
// Een geïmporteerde resterende duur (MSP/P6/raster) die niet op de afronding van completion valt,
// mag niet stil worden herberekend door alleen de naam te wijzigen.
{
  const f = fixture(['Geïmporteerd']);
  const [id] = f.ids;
  const current = f.task(id);
  f.S().updateTask(id, { status: 'STARTED', time: { ...current.time, completion: 0.5, actualStart: '2026-03-02', remainingTime: 3 } });
  const input = f.open(id);
  f.save({ ...input, draft: { ...input.draft, name: 'Geïmporteerd (hernoemd)' } });
  eq('4 alleen naam: resterende duur en status ongemoeid', {
    name: f.task(id).name, remainingTime: f.task(id).time.remainingTime, completion: f.task(id).time.completion, status: f.task(id).status,
  }, { name: 'Geïmporteerd (hernoemd)', remainingTime: 3, completion: 0.5, status: 'STARTED' });
}

// ── 5. Eén Opslaan = één undo-stap ──────────────────────────────────────────────────────────────────
{
  // 5a. Naam + ouder + voortgang.
  const f = fixture(['Fase', 'Taak']);
  const [phase, id] = f.ids;
  const before = { name: f.task(id).name, parentId: f.task(id).parentId, ...progressOf(f.task(id)) };
  const depth0 = f.undoDepth();
  const input = f.open(id);
  const draft = draftWithProgress({ ...input.draft, name: 'Taak (hernoemd)', parentId: phase }, 0.5, f.S().project.statusDate);
  f.save({ ...input, draft });
  eq('5a opgeslagen: naam, ouder, voortgang', {
    name: f.task(id).name, parentId: f.task(id).parentId, completion: f.task(id).time.completion, status: f.task(id).status,
  }, { name: 'Taak (hernoemd)', parentId: phase, completion: 0.5, status: 'STARTED' });
  eq('5a één Opslaan = één undo-stap', f.undoDepth() - depth0, 1);
  f.S().undo();
  eq('5a één undo draait alles terug', { name: f.task(id).name, parentId: f.task(id).parentId, ...progressOf(f.task(id)) }, before);
  eq('5a undo-diepte terug op de uitgangswaarde', f.undoDepth(), depth0);
}
{
  // 5b. Eerste gebruik van een persoonlijk taaktype (materialiseert pas bij Opslaan) + naam.
  const f = fixture(['Taak']);
  const [id] = f.ids;
  const type = addPersonalTaskType('Keuring');
  if (!type) throw new Error('persoonlijk taaktype niet aangemaakt');
  const depth0 = f.undoDepth();
  const input = f.open(id);
  f.save({ ...input, draft: { ...input.draft, name: 'Keuren', taskType: 'USERDEFINED', customTaskTypeId: type.id } });
  eq('5b opgeslagen: type in het project en op de taak', {
    types: f.S().customTaskTypes.map(t => t.name), typeId: f.task(id).customTaskTypeId, name: f.task(id).name,
  }, { types: ['Keuring'], typeId: type.id, name: 'Keuren' });
  eq('5b één Opslaan = één undo-stap', f.undoDepth() - depth0, 1);
  f.S().undo();
  eq('5b één undo draait type én taak terug', {
    types: f.S().customTaskTypes.length, typeId: f.task(id).customTaskTypeId ?? null, name: f.task(id).name,
  }, { types: 0, typeId: null, name: 'Taak' });
}

if (diffs.length) {
  console.log(`XX check-task-dialog-save: ${diffs.length}/${checks} afwijkingen`);
  for (const d of diffs) console.log(`   ${d}`);
  process.exit(1);
}
console.log(`OK  check-task-dialog-save: ${checks}/${checks} (voortgangsregels en één undo-stap bij Opslaan)`);
