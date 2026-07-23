import type { Task } from '@/types/task';

/**
 * Weergavevolgorde van taken, exact zoals TableEditor en GanttRenderer flattenen:
 * wortels in array-volgorde, kinderen per ouder in array-volgorde, diepte-eerst;
 * wezen (ouder onvindbaar) achteraan op rootniveau. Dit is de canonieke
 * sibling-volgorde en daarmee de bron van waarheid voor WBS-nummering —
 * `childIds`-volgorde wordt door de renderers genegeerd en telt hier dus ook niet.
 */
export function flattenOrder(tasks: Task[]): Task[] {
  const out: Task[] = [];
  const seen = new Set<string>();
  // Ouder→kinderen in array-volgorde: één keer over `tasks` itereren en elke
  // taak achteraan de lijst van zijn ouder pushen levert precies dezelfde
  // sibling-volgorde als de vroegere per-taak-scan (`child.parentId === id`),
  // maar in O(n) i.p.v. O(n²). `!= null` matcht exact wat de `===`-scan als
  // kind zag (een parentId `''` matcht alleen een — pathologisch — id `''`).
  const childrenByParent = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.parentId != null) {
      const list = childrenByParent.get(t.parentId);
      if (list) list.push(t);
      else childrenByParent.set(t.parentId, [t]);
    }
  }
  const addRecursive = (task: Task) => {
    if (seen.has(task.id)) return; // corrupte cyclus — niet vastlopen
    seen.add(task.id);
    out.push(task);
    const kids = childrenByParent.get(task.id);
    if (kids) {
      for (const child of kids) addRecursive(child);
    }
  };
  for (const root of tasks) {
    if (!root.parentId) addRecursive(root);
  }
  // Wezen: ouder-id wijst naar een niet-bestaande taak.
  for (const task of tasks) {
    if (!seen.has(task.id)) addRecursive(task);
  }
  return out;
}

/**
 * Afgeleide, gestructureerde WBS-codes (1, 1.1, 1.2.3 …) volgens flattenOrder:
 * het n-de kind van een ouder met code P krijgt `P.n`; de n-de wortel krijgt `n`.
 * Puur numeriek (maskers/prefixen zijn bewust v2).
 */
export function deriveWbsCodes(tasks: Task[]): Map<string, string> {
  const codes = new Map<string, string>();
  const childCount = new Map<string | null, number>();
  for (const task of flattenOrder(tasks)) {
    // Wees-taken nummeren als wortels (parent zonder code).
    const parentCode = task.parentId ? codes.get(task.parentId) : undefined;
    const siblingKey = parentCode !== undefined ? task.parentId : null;
    const n = (childCount.get(siblingKey) ?? 0) + 1;
    childCount.set(siblingKey, n);
    codes.set(task.id, parentCode !== undefined ? `${parentCode}.${n}` : String(n));
  }
  return codes;
}

/** Schrijf de afgeleide nummering in de (Immer-draft-)taken. */
export function applyWbsNumbering(tasks: Task[]): void {
  const codes = deriveWbsCodes(tasks);
  for (const task of tasks) {
    const code = codes.get(task.id);
    if (code !== undefined) task.wbsCode = code;
  }
}
