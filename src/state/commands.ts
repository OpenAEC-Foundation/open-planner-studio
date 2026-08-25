// Commandoregister (K-item 34) — ÉÉN definitie per actie, gedeeld door het lint en de sneltoetsen.
//
// HET PROBLEEM. Dezelfde elf acties stonden twee keer los gedefinieerd: in `ribbonConfig.tsx` als
// een React-hook met reactieve `disabled`/`title`, en in `shortcutRegistry.ts` als een imperatieve
// `run(store)`. Ze deelden niet eens een id — de knop heette `undo`, de sneltoets `edit.undo` — dus
// er was niets dat ze bij elkaar hield. Ze waren dan ook al uit elkaar gelopen: `toggleHistogram`
// stond letterlijk twee keer uitgeschreven, en de zoomstap verschilde (de knop zoomde uit met 5, de
// sneltoets met 10 — apart gerepareerd vóór deze commit, want dat is een gedragswijziging).
//
// HET CONTRACT, en waarom het afwijkt van het onderhoudbaarheidsrapport. Dat rapport schrijft een
// tweedelig contract voor: imperatieve `run` plus een REACTIEVE `useEnabled`-hook, omdat het lint
// zijn reactiviteit niet mag verliezen terwijl de toetsenbord-dispatcher geen hooks kan aanroepen.
// Die tweedeling is niet nodig. Eén IMPERATIEVE `isEnabled(store)` levert beide gezichten:
//
//   - het lint wikkelt hem in een selector — `useAppStore(s => cmd.isEnabled(s))` — en is daarmee
//     gewoon reactief, want Zustand abonneert op de afgeleide waarde;
//   - de dispatcher roept dezelfde functie direct aan.
//
// Eén definitie, geen hook-grens, en niets dat de twee kanten uit de pas kan laten lopen.
//
// `isEnabled` en `run` zijn BEWUST niet aan elkaar gekoppeld. Dat is geen slordigheid maar de reden
// dat dit contract het `indent`-geval aankan: buiten boommodus zet het lint de knop op grijs (dat
// is `isEnabled`), terwijl de sneltoets wél vuurt en via `notifyStructureLocked()` uitlegt waaróm
// er niets gebeurt (issue #26). Een sneltoets kan namelijk geen tooltip dragen. `run` handelt het
// geblokkeerde geval dus zelf af; de dispatcher hoeft `isEnabled` niet te raadplegen.
//
// WAT HIER NIET IN HOORT. Acties die maar op één oppervlak bestaan. Die dupliceren niets, en ze
// hierheen halen maakt dit bestand een tweede `shortcutRegistry` zonder er iets mee op te lossen.
// Labels horen er ook niet in: het lint en de sneltoetsdialoog gebruiken bewust verschillende
// vertaalsleutels ("Ongedaan maken" op een knop, een langere omschrijving in de sneltoetslijst).
import type { AppState } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';
import { deleteTasksBulk } from '@/state/taskBulkActions';
import { isTreeMode } from '@/engine/view/visibleRows';
import { saveShowHistogram } from '@/utils/settingsStore';
import { ZOOM_STEP } from '@/utils/ganttViewport';
import i18n from '@/i18n/config';
import { canRedo, canUndo } from '@/state/sessionHistory';

export interface Command {
  /** Stabiele id — tevens de sleutel in {@link COMMANDS}. */
  id: string;
  /**
   * Voert de actie uit. Krijgt de store imperatief mee, zodat zowel de toetsenbord-dispatcher als
   * een klik-handler hem kan aanroepen. Handelt zelf af wat er moet gebeuren als de actie NIET
   * beschikbaar is (bv. een melding tonen) — de dispatcher controleert `isEnabled` niet.
   */
  run: (store: AppState) => void;
  /**
   * Of de actie op dit moment zinvol is. Afwezig = altijd. Puur en synchroon, zodat het lint hem in
   * een Zustand-selector kan wikkelen (dan is hij reactief) en de dispatcher hem direct kan
   * aanroepen. Zet hier GEEN store-mutatie in.
   */
  isEnabled?: (store: AppState) => boolean;
}

const hasSelection = (s: AppState): boolean => s.selectedTaskIds.length > 0;

export const COMMANDS = {
  undo: {
    id: 'undo',
    run: (s) => s.undo(),
    isEnabled: canUndo,
  },
  redo: {
    id: 'redo',
    run: (s) => s.redo(),
    isEnabled: canRedo,
  },
  save: {
    id: 'save',
    run: (s) => { void s.saveFile(); },
  },
  saveAs: {
    id: 'saveAs',
    run: (s) => { void s.saveFileAs(); },
  },
  open: {
    id: 'open',
    // De vertaalde naam voor een geïmporteerd project. Het lint haalde die vroeger uit
    // `useTranslation`, de sneltoets uit de globale `i18n` — zelfde instantie, zelfde taal, dus
    // hier op één van de twee gestandaardiseerd. Moet de globale zijn: dit is geen hook.
    run: (s) => { void s.openFile(buildImportLabels((key) => i18n.t(key, { ns: 'common' }))); },
  },
  delete: {
    id: 'delete',
    // Gedeelde bulk-route (één handeling = één undo-stap), zelfde als het contextmenu — een kale
    // `deleteTask`-lus kostte hier N keer Ctrl+Z.
    run: (s) => { deleteTasksBulk(s.selectedTaskIds); },
    isEnabled: hasSelection,
  },
  indent: {
    id: 'indent',
    // Buiten boommodus doet inspringen niets zinnigs. Het lint grijst de knop uit (via `isEnabled`)
    // en hangt er een tooltip aan; de sneltoets kán dat niet en legt het daarom uit met een melding
    // (issue #26). Vandaar dat `run` het geblokkeerde geval zelf afvangt.
    run: (s) => {
      if (isTreeMode(s.view)) s.indentTasks(s.selectedTaskIds);
      else s.notifyStructureLocked();
    },
    isEnabled: (s) => hasSelection(s) && isTreeMode(s.view),
  },
  outdent: {
    id: 'outdent',
    run: (s) => {
      if (isTreeMode(s.view)) s.outdentTasks(s.selectedTaskIds);
      else s.notifyStructureLocked();
    },
    isEnabled: (s) => hasSelection(s) && isTreeMode(s.view),
  },
  zoomIn: {
    id: 'zoomIn',
    run: (s) => s.setZoom(s.view.zoom + ZOOM_STEP),
  },
  zoomOut: {
    id: 'zoomOut',
    run: (s) => s.setZoom(s.view.zoom - ZOOM_STEP),
  },
  toggleHistogram: {
    id: 'toggleHistogram',
    run: (s) => {
      const next = !s.ui.showHistogram;
      s.setUI({ showHistogram: next });
      void saveShowHistogram(next);
    },
  },
} satisfies Record<string, Command>;

export type CommandId = keyof typeof COMMANDS;

/** Of de actie nu uitvoerbaar is. Eén plek, zodat lint en dispatcher niet elk hun eigen aanname doen. */
export function isCommandEnabled(cmd: Command, store: AppState): boolean {
  return cmd.isEnabled ? cmd.isEnabled(store) : true;
}
