/**
 * Voorbeeld-extensie voor Open Planner Studio — "Takenlijst-importer".
 *
 * Demonstreert de hele extensie-API:
 *   • require('open-planner-studio')  → de host-SDK (versie, utils, factory, hostEvents)
 *   • api.importers.register(...)      → een import-formaat dat in Bestand → Importeren verschijnt
 *   • api.ui.addRibbonButton(...)      → een knop in de ribbon  (permissie: "ribbon")
 *   • api.events.on(...)               → luisteren naar host-events (permissie: "events")
 *   • api.ui.showNotification(...)     → melding in de debug-terminal
 *
 * Een extensie is een CommonJS-module: zet { onLoad(api), onUnload() } op module.exports.
 * Bij uitschakelen draait de host alle registraties automatisch terug; onUnload is optioneel.
 */

const sdk = require('open-planner-studio');

/**
 * Parse een eenvoudige takenlijst naar een ImportResult.
 * Formaat: één taak per regel als "Naam | duur"  (duur in werkdagen, optioneel; standaard 5).
 * Lege regels en regels die met '#' beginnen worden genegeerd. Taken worden in een
 * rechte keten gekoppeld (elke taak Eind→Start na de vorige).
 */
function parseTaskList(text) {
  const result = sdk.factory.emptyImportResult();
  result.project = sdk.factory.createProject({ name: 'Geïmporteerde takenlijst' });
  const startDate = result.project.startDate;

  let previousId = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [namePart, durationPart] = line.split('|');
    const name = (namePart || '').trim();
    if (!name) continue;

    const duration = Math.max(0, parseInt((durationPart || '').trim(), 10) || 5);

    const task = sdk.factory.createTask({ name });
    task.time = sdk.factory.createTaskTime(startDate, duration);
    result.tasks.push(task);

    if (previousId) {
      result.sequences.push({
        id: sdk.utils.generateId('seq'),
        predecessorId: previousId,
        successorId: task.id,
        type: 'FINISH_START',
        lagDays: 0,
      });
    }
    previousId = task.id;
  }

  return result;
}

module.exports = {
  onLoad(api) {
    api.ui.showNotification(`Takenlijst-importer geladen (host v${sdk.version}).`, 'info');

    // 1) Registreer het import-formaat. Verschijnt in Bestand → Importeren.
    api.importers.register({
      id: 'tasklist-text',
      name: 'Eenvoudige takenlijst (.tasklist)',
      description: 'Tekstbestand met één taak per regel: "Naam | duur".',
      fileExtensions: ['.tasklist', '.txt'],
      async handler(file) {
        const text = await file.text();
        return parseTaskList(text);
      },
    });

    // 2) Voeg een ribbon-knop toe (permissie "ribbon"). Voegt een demo-taak toe en herberekent.
    api.ui.addRibbonButton({
      tab: 'planning',
      group: 'Voorbeeld',
      label: 'Demo-taak',
      tooltip: 'Voeg een voorbeeldtaak toe en herbereken het schema',
      onClick: () => {
        api.data.addTask({ name: 'Demo-taak (extensie)' });
        api.data.recalculate();
        api.ui.showNotification('Demo-taak toegevoegd en schema herberekend.', 'info');
      },
    });

    // 3) Luister naar host-events (permissie "events"). Geeft een melding na elke CPM-berekening.
    api.events.on(sdk.hostEvents.scheduleCalculated, (data) => {
      const critical = data && typeof data === 'object' ? data.criticalTasks : '?';
      api.ui.showNotification(`Schema herberekend — kritieke taken: ${critical}.`, 'info');
    });
  },

  onUnload() {
    // Niets te doen: de host draait alle registraties (importer, ribbon-knop, event) automatisch terug.
  },
};
