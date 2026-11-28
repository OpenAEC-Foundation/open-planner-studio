import { current, isDraft, original, type Draft } from 'immer';
import type { AppState } from './appStore';
import type { ResourceAssignment } from '@/types/resource';

function isAppStateDraft(state: AppState): state is AppState & Draft<AppState> {
  return isDraft(state);
}

export function originalAppState(state: AppState): AppState | null {
  if (!isAppStateDraft(state)) return null;
  return original<AppState>(state) ?? null;
}

export function currentAppState(state: AppState): AppState {
  if (!isAppStateDraft(state)) return state;
  return current<AppState>(state);
}

export function taskIndexById(s: AppState, id: string): number {
  const base = originalAppState(s);
  if (base) {
    const i = base.tasks.findIndex((t) => t.id === id);
    if (i >= 0 && i < s.tasks.length && s.tasks[i].id === id) return i;
  }
  return s.tasks.findIndex((t) => t.id === id);
}

export function taskAssignmentDrafts(s: AppState, taskId: string): ResourceAssignment[] {
  const base = originalAppState(s)?.assignments;
  if (base && base.length === s.assignments.length) {
    const out: ResourceAssignment[] = [];
    let intact = true;
    for (let i = 0; i < base.length && intact; i++) {
      if (base[i].taskId !== taskId) continue;
      const draft = s.assignments[i];
      if (draft.id === base[i].id && draft.taskId === taskId) out.push(draft);
      else intact = false;
    }
    if (intact) return out;
  }
  return s.assignments.filter((a) => a.taskId === taskId);
}

export function baseList(list: readonly string[]): readonly string[] {
  return isDraft(list) ? original<string[]>(list as string[] & Draft<string[]>) ?? list : list;
}
