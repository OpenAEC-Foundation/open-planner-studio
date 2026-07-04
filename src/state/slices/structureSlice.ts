import type { ActivityCodeType, ActivityCodeValue, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import { generateId } from '@/utils/id';
import { createSnapshot } from '../snapshot';
import type { AppSlice } from './types';

/**
 * Structuurdefinities (fase 2.2): activity-code-types en custom fields, per document
 * (round-trippen door IFC; zitten in undo-snapshots en de document-payloads).
 * Taak-toewijzingen leven op de taken zelf (task.activityCodes / task.customFields)
 * en liften daardoor vanzelf mee met snapshot/klembord/IFC-taken.
 */
export interface StructureSlice {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];

  addActivityCodeType: (name: string) => string;
  renameActivityCodeType: (id: string, name: string) => void;
  /** Verwijdert het type én alle toewijzingen ervan op taken; reset een actieve groepering erop. */
  removeActivityCodeType: (id: string) => void;
  addActivityCodeValue: (typeId: string, value: Omit<ActivityCodeValue, 'id'>) => string;
  updateActivityCodeValue: (typeId: string, valueId: string, patch: Partial<Omit<ActivityCodeValue, 'id'>>) => void;
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
}

export const createStructureSlice: AppSlice<StructureSlice> = (set, get) => ({
  activityCodeTypes: [],
  customFieldDefs: [],

  addActivityCodeType: (name) => {
    const id = generateId('act');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.activityCodeTypes.push({ id, name, values: [] });
      s.isDirty = true;
    });
    get().recomputeViewRows();
    return id;
  },

  renameActivityCodeType: (id, name) => {
    set((s) => {
      const t = s.activityCodeTypes.find(x => x.id === id);
      if (!t || t.name === name) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      t.name = name;
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  removeActivityCodeType: (id) => {
    set((s) => {
      if (!s.activityCodeTypes.some(x => x.id === id)) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.activityCodeTypes = s.activityCodeTypes.filter(x => x.id !== id);
      for (const task of s.tasks) {
        if (task.activityCodes && id in task.activityCodes) delete task.activityCodes[id];
      }
      if (s.view.groupBy === id) s.view.groupBy = undefined;
      // Groep-/sort-niveaus die naar dit type verwezen laten vallen (§4.3, code-mutatie).
      s.view.group = s.view.group.filter(g => !(g.field.src === 'activityCode' && g.field.typeId === id));
      s.view.sort = s.view.sort.filter(g => !(g.field.src === 'activityCode' && g.field.typeId === id));
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  addActivityCodeValue: (typeId, value) => {
    const id = generateId('acv');
    set((s) => {
      const t = s.activityCodeTypes.find(x => x.id === typeId);
      if (!t) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      t.values.push({ ...value, id });
      s.isDirty = true;
    });
    get().recomputeViewRows();
    return id;
  },

  updateActivityCodeValue: (typeId, valueId, patch) => {
    set((s) => {
      const v = s.activityCodeTypes.find(x => x.id === typeId)?.values.find(x => x.id === valueId);
      if (!v) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      Object.assign(v, patch);
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  removeActivityCodeValue: (typeId, valueId) => {
    set((s) => {
      const t = s.activityCodeTypes.find(x => x.id === typeId);
      if (!t || !t.values.some(v => v.id === valueId)) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      t.values = t.values.filter(v => v.id !== valueId);
      for (const task of s.tasks) {
        if (task.activityCodes?.[typeId] === valueId) delete task.activityCodes[typeId];
      }
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  setTaskActivityCode: (taskId, typeId, valueId) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task) return;
      const current = task.activityCodes?.[typeId];
      if ((valueId ?? undefined) === current) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      if (valueId === null) {
        if (task.activityCodes) delete task.activityCodes[typeId];
      } else {
        task.activityCodes = { ...(task.activityCodes ?? {}), [typeId]: valueId };
      }
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  addCustomField: (name, type) => {
    const id = generateId('cfd');
    set((s) => {
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.customFieldDefs.push({ id, name, type });
      s.isDirty = true;
    });
    get().recomputeViewRows();
    return id;
  },

  renameCustomField: (id, name) => {
    set((s) => {
      const d = s.customFieldDefs.find(x => x.id === id);
      if (!d || d.name === name) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      d.name = name;
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  removeCustomField: (id) => {
    set((s) => {
      if (!s.customFieldDefs.some(x => x.id === id)) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      s.customFieldDefs = s.customFieldDefs.filter(x => x.id !== id);
      for (const task of s.tasks) {
        if (task.customFields && id in task.customFields) delete task.customFields[id];
      }
      s.view.group = s.view.group.filter(g => !(g.field.src === 'customField' && g.field.defId === id));
      s.view.sort = s.view.sort.filter(g => !(g.field.src === 'customField' && g.field.defId === id));
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },

  setTaskCustomField: (taskId, defId, value) => {
    set((s) => {
      const task = s.tasks.find(t => t.id === taskId);
      if (!task) return;
      const current = task.customFields?.[defId];
      if ((value ?? undefined) === current) return;
      s.undoStack.push(createSnapshot(s));
      s.redoStack = [];
      if (value === null) {
        if (task.customFields) delete task.customFields[defId];
      } else {
        task.customFields = { ...(task.customFields ?? {}), [defId]: value };
      }
      s.isDirty = true;
    });
    get().recomputeViewRows();
  },
});
