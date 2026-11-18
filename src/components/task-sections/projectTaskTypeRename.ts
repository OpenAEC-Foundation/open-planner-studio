// Een bevestigde hernoeming van de projectkopie van een eigen werksoort (#804 keuze 7). Eén weg naar de
// store-actie, voor het eigenschappenpaneel (meteen) en voor Taak bewerken (pas als de taakbewerking dicht
// is, zodat Annuleren of het samenvoegen bij Opslaan haar niet meeneemt; fixronde 1 van #999).
import { useAppStore } from '@/state/appStore';

/** De vraag zoals de planner haar beantwoordde, gebonden aan het document waarin ze gesteld is. */
export interface ProjectTaskTypeRename {
  documentId: string;
  id: string;
  oldName: string;
  newName: string;
}

/** Taak bewerken: de bevestigde hernoemingen wachten tot de taakbewerking dicht is. `pending` laat de
 *  keuzelijst van de dialoog intussen de gekozen naam tonen. */
export interface DeferredProjectRenames {
  pending: readonly ProjectTaskTypeRename[];
  defer: (rename: ProjectTaskTypeRename) => void;
}

/** Voert de hernoeming uit in het document waarin ze gevraagd is; is dat niet meer actief, dan niets.
 *  Een botsende naam laat de projectnaam staan, met een melding waarom. Gebruikt intussen geen taak de
 *  werksoort meer (Taak bewerken haalde het laatste gebruik weg, knownbug 1834), dan krijgt de ongebruikte
 *  kopie de naam stil, zoals bij elke ongebruikte kopie (eigenaarsbesluit 18 november 2026). */
export function applyProjectTaskTypeRename(rename: ProjectTaskTypeRename): void {
  const store = useAppStore.getState();
  const outcome = store.renameProjectTaskType(rename.documentId, rename.id, rename.newName);
  if (outcome.status === 'unused') {
    store.renameUnusedProjectTaskType(rename.documentId, rename.id, rename.newName);
    return;
  }
  if (outcome.status !== 'nameTaken') return;
  store.notify({
    severity: 'info',
    messageKey: 'notifications.taskTypeRenameNameTaken',
    params: {
      oldName: store.customTaskTypes.find(type => type.id === rename.id)?.name ?? rename.oldName,
      takenName: outcome.takenName,
    },
  });
}
