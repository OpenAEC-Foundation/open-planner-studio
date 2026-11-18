import type { ActivityCodeType, ActivityCodeValue, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { assignTaskActivityCode, assignTaskCustomField } from '@/engine/taskMutationRules';
import { customTaskTypeClashes, customTaskTypeInUse, renamedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';
import type { CustomTaskType } from '@/types/taskType';
import { generateId } from '@/utils/id';
import { rewriteDocumentHistorySnapshots } from '../sessionHistory';
import type { Snapshot } from '../snapshot';
import type { AppState } from '../appStore';
import type { AppSliceFactory } from './types';

/**
 * Structuurdefinities: activity-code-types en custom fields, per document
 * (round-trippen door IFC; zitten in undo-snapshots en de document-payloads).
 * Taak-toewijzingen leven op de taken zelf (task.activityCodes / task.customFields)
 * en liften daardoor vanzelf mee met snapshot/klembord/IFC-taken.
 */
export interface StructureSlice {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  /** Projectkopieën van de zelfgekozen taaktypen; bewust per document en IFC-roundtrip. */
  customTaskTypes: CustomTaskType[];

  addActivityCodeType: (name: string) => string;
  renameActivityCodeType: (id: string, name: string) => void;
  /** Verwijdert het type én alle toewijzingen ervan op taken; reset een actieve groepering erop. */
  removeActivityCodeType: (id: string) => void;
  addActivityCodeValue: (typeId: string, value: Omit<ActivityCodeValue, 'id'>) => string;
  updateActivityCodeValue: (typeId: string, valueId: string, patch: Partial<Omit<ActivityCodeValue, 'id'>>) => void;
  /**
   * Zet een waarde één plek omhoog (delta -1) of omlaag (+1) in de eigen volgorde van het type; die volgorde is
   * die van de keuzelijsten. Verandert nooit een toewijzing op een taak. Aan de rand of bij een onbekende
   * waarde gebeurt niets (ook geen undo-stap).
   */
  moveActivityCodeValue: (typeId: string, valueId: string, delta: -1 | 1) => void;
  /** Verwijdert de waarde én alle taak-toewijzingen ervan. */
  removeActivityCodeValue: (typeId: string, valueId: string) => void;
  /** Wijs een codewaarde toe aan een taak (null = toewijzing weghalen). Max één waarde per type. */
  setTaskActivityCode: (taskId: string, typeId: string, valueId: string | null) => void;

  addCustomField: (name: string, type: CustomFieldType) => string;
  renameCustomField: (id: string, name: string) => void;
  /** Verwijdert het veld én alle waarden ervan op taken. */
  removeCustomField: (id: string) => void;
  /** Zet een veldwaarde op een taak (null = waarde weghalen). */
  setTaskCustomField: (taskId: string, defId: string, value: CustomFieldValue | null) => void;
  ensureProjectTaskType: (type: CustomTaskType) => void;
  /**
   * Hernoemt de projectkopie van een eigen taaktype (#804 keuze 7): één ongedaan-maakstap, document
   * gewijzigd, de naam gaat mee in het IFC en het herstel. Alleen in `documentId`, het document waarin de
   * planner het bevestigde (is een ander document actief: niets), en alleen als een taak het type gebruikt
   * (een ongebruikte definitie bewaart IFC/herstel niet; die gaat via `renameUnusedProjectTaskType`).
   * Dezelfde botsingsregel als `ensureProjectTaskType`; een geweigerde of overbodige hernoeming verandert
   * niets.
   */
  renameProjectTaskType: (documentId: string, id: string, name: string) => RenameProjectTaskTypeResult;
  /**
   * De tegenhanger voor een projectkopie die GEEN taak gebruikt (eigenaarsbesluit 18 november 2026): die
   * krijgt de nieuwe naam stil. IFC en herstel bewaren zo'n definitie niet, dus wat bewaard wordt verandert
   * niet: geen ongedaan-maakstap en het document wordt niet gewijzigd. Ook de oudere momentopnames van dit
   * document waarin de kopie ongebruikt is, krijgen de naam, zodat ongedaan maken haar niet terugdraait;
   * een stand waarin een taak haar gebruikte, houdt de naam van toen. Dezelfde regels als
   * `renameProjectTaskType`; een gebruikte kopie (`inUse`) of een botsende naam verandert niets.
   */
  renameUnusedProjectTaskType: (documentId: string, id: string, name: string) => RenameProjectTaskTypeResult;
}

/** Uitkomst van `renameProjectTaskType`. `nameTaken` noemt de naam van het ándere type, zodat de
 *  planner ziet waarom de naam in het project niet veranderde. */
export type RenameProjectTaskTypeResult =
  | { status: 'renamed' }
  | { status: 'unchanged' }
  | { status: 'missing' }
  | { status: 'empty' }
  | { status: 'unused' }
  | { status: 'inUse' }
  | { status: 'otherDocument' }
  | { status: 'nameTaken'; takenName: string };

/** De regels van beide hernoemacties, in deze volgorde: het document waarin de planner hernoemde, een
 *  niet-lege naam, een type dat in het project staat, het gebruik dat bij de actie hoort (`used`), geen
 *  ánder type met die naam en een echte wijziging. Geeft de getrimde naam of de weigering. */
function checkProjectTaskTypeRename(
  state: AppState, documentId: string, id: string, name: string, used: boolean,
): { status: 'allowed'; name: string } | RenameProjectTaskTypeResult {
  if (state.activeDocumentId !== documentId) return { status: 'otherDocument' };
  const clean = name.trim();
  if (!clean) return { status: 'empty' };
  const { sameId, sameNameOtherId } = customTaskTypeClashes(state.customTaskTypes, { id, name: clean });
  if (!sameId) return { status: 'missing' };
  if (customTaskTypeInUse(state.tasks, id) !== used) return { status: used ? 'unused' : 'inUse' };
  if (sameNameOtherId) return { status: 'nameTaken', takenName: sameNameOtherId.name };
  if (sameId.name === clean) return { status: 'unchanged' };
  return { status: 'allowed', name: clean };
}

export const createStructureSlice: AppSliceFactory<StructureSlice> = (runtime) => (set, get) => ({
  activityCodeTypes: [],
  customFieldDefs: [],
  customTaskTypes: [],

  ensureProjectTaskType: (type) => {
    set((s) => {
      const id = type.id.trim();
      const name = type.name.trim();
      const { sameId, sameNameOtherId } = customTaskTypeClashes(s.customTaskTypes, { id, name });
      if (sameId || sameNameOtherId || !id || !name) return;
      runtime.beginUndoable(s);
      s.customTaskTypes.push({ id, name });
      runtime.finishMutation(s);
    });
  },

  renameProjectTaskType: (documentId, id, name) => {
    const check = checkProjectTaskTypeRename(get(), documentId, id, name, true);
    if (check.status !== 'allowed') return check;
    set((s) => {
      runtime.beginUndoable(s);
      s.customTaskTypes = s.customTaskTypes.map(type => type.id === id ? { ...type, name: check.name } : type);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
    return { status: 'renamed' };
  },

  renameUnusedProjectTaskType: (documentId, id, name) => {
    const state = get();
    const check = checkProjectTaskTypeRename(state, documentId, id, name, false);
    if (check.status !== 'allowed') return check;
    // Buiten `beginUndoable`/`finishMutation`: geen stap en geen `isDirty`. Dezelfde typelijst krijgt
    // overal dezelfde nieuwe lijst, zodat gedeelde referenties tussen momentopnames gedeeld blijven.
    const renamed = new Map<readonly CustomTaskType[], CustomTaskType[] | null>();
    const rename = (types: readonly CustomTaskType[]): CustomTaskType[] | null => {
      if (!renamed.has(types)) renamed.set(types, renamedCustomTaskTypes(types, id, check.name));
      return renamed.get(types)!;
    };
    const historyEvents = rewriteDocumentHistorySnapshots(state.historyEvents, documentId, (snapshot: Snapshot) => {
      if (customTaskTypeInUse(snapshot.tasks, id)) return snapshot;
      const customTaskTypes = rename(snapshot.customTaskTypes);
      return customTaskTypes ? { ...snapshot, customTaskTypes } : snapshot;
    });
    set({ customTaskTypes: rename(state.customTaskTypes)!, historyEvents });
    get().recomputeViewRows();
    return { status: 'renamed' };
  },

  addActivityCodeType: (name) => {
    const id = generateId('act');
    set((s) => {
      runtime.beginUndoable(s);
      s.activityCodeTypes.push({ id, name, values: [] });
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
    return id;
  },

  renameActivityCodeType: (id, name) => {
    set((s) => {
      const t = s.activityCodeTypes.find(x => x.id === id);
      if (!t || t.name === name) return;
      runtime.beginUndoable(s);
      t.name = name;
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  removeActivityCodeType: (id) => {
    set((s) => {
      if (!s.activityCodeTypes.some(x => x.id === id)) return;
      runtime.beginUndoable(s);
      s.activityCodeTypes = s.activityCodeTypes.filter(x => x.id !== id);
      for (const task of s.tasks) {
        if (task.activityCodes && id in task.activityCodes) delete task.activityCodes[id];
      }
      // Groep-/sort-niveaus die naar dit type verwezen laten vallen.
      s.view.group = s.view.group.filter(g => !(g.field.src === 'activityCode' && g.field.typeId === id));
      s.view.sort = s.view.sort.filter(g => !(g.field.src === 'activityCode' && g.field.typeId === id));
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  addActivityCodeValue: (typeId, value) => {
    const id = generateId('acv');
    set((s) => {
      const t = s.activityCodeTypes.find(x => x.id === typeId);
      if (!t) return;
      runtime.beginUndoable(s);
      t.values.push({ ...value, id });
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
    return id;
  },

  updateActivityCodeValue: (typeId, valueId, patch) => {
    set((s) => {
      const v = s.activityCodeTypes.find(x => x.id === typeId)?.values.find(x => x.id === valueId);
      if (!v) return;
      runtime.beginUndoable(s);
      Object.assign(v, patch);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  moveActivityCodeValue: (typeId, valueId, delta) => {
    set((s) => {
      const t = s.activityCodeTypes.find(x => x.id === typeId);
      const from = t ? t.values.findIndex(v => v.id === valueId) : -1;
      const to = from + delta;
      if (!t || from < 0 || to < 0 || to >= t.values.length) return;
      runtime.beginUndoable(s);
      const [moved] = t.values.splice(from, 1);
      t.values.splice(to, 0, moved!);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  removeActivityCodeValue: (typeId, valueId) => {
    set((s) => {
      const t = s.activityCodeTypes.find(x => x.id === typeId);
      if (!t || !t.values.some(v => v.id === valueId)) return;
      runtime.beginUndoable(s);
      t.values = t.values.filter(v => v.id !== valueId);
      for (const task of s.tasks) {
        if (task.activityCodes?.[typeId] === valueId) delete task.activityCodes[typeId];
      }
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  setTaskActivityCode: (taskId, typeId, valueId) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task) return;
      const current = task.activityCodes?.[typeId];
      if ((valueId ?? undefined) === current) return;
      runtime.beginUndoable(s);
      assignTaskActivityCode(task, typeId, valueId ?? undefined);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  addCustomField: (name, type) => {
    const id = generateId('cfd');
    set((s) => {
      runtime.beginUndoable(s);
      s.customFieldDefs.push({ id, name, type });
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
    return id;
  },

  renameCustomField: (id, name) => {
    set((s) => {
      const d = s.customFieldDefs.find(x => x.id === id);
      if (!d || d.name === name) return;
      runtime.beginUndoable(s);
      d.name = name;
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  removeCustomField: (id) => {
    set((s) => {
      if (!s.customFieldDefs.some(x => x.id === id)) return;
      runtime.beginUndoable(s);
      s.customFieldDefs = s.customFieldDefs.filter(x => x.id !== id);
      for (const task of s.tasks) {
        if (task.customFields && id in task.customFields) delete task.customFields[id];
      }
      s.view.group = s.view.group.filter(g => !(g.field.src === 'customField' && g.field.defId === id));
      s.view.sort = s.view.sort.filter(g => !(g.field.src === 'customField' && g.field.defId === id));
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },

  setTaskCustomField: (taskId, defId, value) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task) return;
      const current = task.customFields?.[defId];
      if ((value ?? undefined) === current) return;
      runtime.beginUndoable(s);
      assignTaskCustomField(task, defId, value ?? undefined);
      runtime.finishMutation(s);
    });
    get().recomputeViewRows();
  },
});
