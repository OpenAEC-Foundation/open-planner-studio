import type { AppState } from '@/state/appStore';
import type { ScheduleWarning } from '@/engine/scheduler/scheduleWarnings';
import { saveShowHistogram } from '@/utils/settingsStore';

/**
 * "Ga naar" voor een rij uit het Waarschuwingenpaneel (issue #53). Imperatief op de store, naar het
 * model van `COMMANDS.*.run`: de UI roept 'm aan met `useAppStore.getState()`, de headless test
 * met een eigen `createAppStoreContext()`. Geen undo-stap — selectie, focus en histogramkeuze zijn
 * geen documentdata.
 *
 * Per doelsoort de bestaande mechaniek, niets nieuws in de renderer:
 *  - taak      → `focusOnTask`: selecteert, klapt een ingeklapte oudersketen uit en laat de
 *                GanttCanvas ernaartoe zoomen/scrollen (issue #65-sprong).
 *  - relatie   → focus op de OPVOLGER (die ondervindt de waarschuwing) en daarna beide taken
 *                geselecteerd met de opvolger actief: beide balken gemarkeerd, en het
 *                eigenschappenpaneel toont de relatie in "Afhankelijkheden".
 *  - resource  → de taken met een toewijzing op déze resource geselecteerd (dat zijn de
 *                veroorzakers, en hun balken lichten op) en de histogramstrook aan en op de resource
 *                gezet — dat ís de weergave van de overbezetting (dezelfde `overallocatedDays`-bron).
 *                De selectie is geen bijzaak: `GanttCanvas` scopet de strook op de taakselectie
 *                (`scopeTaskResources`), dus met een willekeurige andere taak geselecteerd zou de
 *                strook "geen resources" tonen. Alle toegewezen taken selecteren geeft precies de
 *                volledige belasting van de resource.
 *  - project   → een cyclus met bekende taak-ids: de hele loop geselecteerd, focus op de eerste;
 *                een solverfout zonder taken (kalender zonder werkdagen) heeft geen doel.
 *
 * `focusOnTask` zet `pendingFocusTaskId`; dat signaal wordt pas verwerkt zodra een GanttCanvas is
 * gemount. Op het Tabel-tabblad (rail wél zichtbaar, canvas niet) blijft de selectie dus het
 * zichtbare effect en voert de Gantt de sprong uit zodra je terugschakelt — precies zoals de
 * WBS-sprongknop in het taakgrid zich daar al gedraagt.
 */
export function revealScheduleWarning(store: AppState, warning: ScheduleWarning): void {
  const { target } = warning;
  switch (target.type) {
    case 'task':
      store.focusOnTask(target.taskId);
      return;
    case 'sequence': {
      const hasSucc = store.tasks.some(t => t.id === target.successorId);
      const hasPred = store.tasks.some(t => t.id === target.predecessorId);
      if (hasSucc) store.focusOnTask(target.successorId);
      else if (hasPred) store.focusOnTask(target.predecessorId);
      const ids = [target.predecessorId, target.successorId].filter(id => store.tasks.some(t => t.id === id));
      if (ids.length > 1) store.selectTasks(ids, false, hasSucc ? target.successorId : ids[0]);
      return;
    }
    case 'resource': {
      const taskIds = new Set(store.assignments
        .filter(a => a.resourceId === target.resourceId)
        .map(a => a.taskId));
      const ids = store.tasks.filter(t => taskIds.has(t.id)).map(t => t.id);
      if (ids.length > 0) store.selectTasks(ids, false, ids[0]);
      else store.deselectAll();
      store.setHistogramResource(target.resourceId);
      if (!store.ui.showHistogram) {
        store.setUI({ showHistogram: true });
        void saveShowHistogram(true);
      }
      return;
    }
    case 'project': {
      const ids = target.taskIds.filter(id => store.tasks.some(t => t.id === id));
      if (ids.length === 0) return;
      store.focusOnTask(ids[0]);
      if (ids.length > 1) store.selectTasks(ids, false, ids[0]);
      return;
    }
  }
}
