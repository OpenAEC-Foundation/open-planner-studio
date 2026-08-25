import { current, isDraft } from 'immer';
import type { Task } from '@/types/task';

/**
 * PRESTATIE — lees een takenlijst PLAIN, ook als het een Immer-draft is.
 *
 * Élke aanroep van `deriveWbsCodes`/`applyWbsNumbering` in de app krijgt `s.tasks` binnen een
 * `set()`-producer, dus een draft. Een draft lezen is niet gratis: de `get`-trap maakt per bezochte
 * taak een proxy, en die proxy's belanden allemaal in de scope die Immer bij het afsluiten van de
 * producer weer moet aflopen (finalize + deep freeze). Deze functies bezoeken per definitie ÉLKE
 * taak, dus één mutatie op een project van n taken betaalt n proxy's — de kwadratische factor
 * achter "5000 taken werkt niet" (`docs/TODO.md`).
 *
 * `current()` levert een plain momentopname van de draft-inhoud INCLUSIEF de mutaties die in deze
 * producer al gedaan zijn — dat is precies wat we nodig hebben, want de nummering draait ná de
 * mutatie (`original()` zou de zojuist toegevoegde taak missen). Onaangeraakte kinderen worden
 * daarbij als referentie doorgegeven en niet gekopieerd, dus de kosten zijn één O(n)-wandeling in
 * plaats van n proxy's.
 *
 * Gemeten op een project van 5.000 taken kost één `addTask` 132 ms zoals het was, 104 ms met alleen
 * de goedkopere snapshot, en 18 ms met beide. Deze module is dus de kleinste van de twee helften,
 * maar wel de helft die overblijft zodra de snapshot goedkoop is.
 *
 * Alleen LEZEN gaat via deze view. Schrijven blijft op de originele (draft-)array — anders komt de
 * mutatie nergens aan.
 */
function plainView(tasks: readonly Task[]): readonly Task[] {
  return isDraft(tasks) ? (current(tasks as never) as readonly Task[]) : tasks;
}

/**
 * Weergavevolgorde van taken, exact zoals TableEditor en GanttRenderer flattenen:
 * wortels in array-volgorde, kinderen per ouder in array-volgorde, diepte-eerst;
 * wezen (ouder onvindbaar) achteraan op rootniveau. Dit is de canonieke
 * sibling-volgorde en daarmee de bron van waarheid voor WBS-nummering —
 * `childIds`-volgorde wordt door de renderers genegeerd en telt hier dus ook niet.
 *
 * Krijgt deze functie een Immer-draft, dan leest hij via {@link plainView} en zijn de teruggegeven
 * taken dus PLAIN kopieën, geen drafts. Vandaar `readonly Task[]`: schrijven naar het resultaat zou
 * in de draft niet aankomen, en de compiler blokkeert dat nu in plaats van het stil te laten
 * gebeuren. Alle huidige aanroepers lezen alleen (`.map(t => t.id)`, of de nummering hieronder).
 */
export function flattenOrder(tasks: readonly Task[]): readonly Task[] {
  tasks = plainView(tasks);
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
export function deriveWbsCodes(tasks: readonly Task[]): Map<string, string> {
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

/**
 * Schrijf de afgeleide nummering in de (Immer-draft-)taken.
 *
 * Lezen gaat via {@link plainView}, schrijven via de meegegeven array — en alleen waar de code
 * ECHT verandert. Dat tweede is nodig omdat `tasks[i]` uitrekenen al een draft-proxy oplevert, óók
 * als de toekenning daarna niets verandert (Immer slaat een schrijfactie met dezelfde waarde wel
 * over, maar de proxy is dan al gemaakt en moet aan het eind van de producer alsnog gefinaliseerd
 * worden). En bij de meeste mutaties — een taak achteraan toevoegen, een naam wijzigen — blijft de
 * nummering van vrijwel álle taken gelijk. Gemeten bij 5.000 taken scheelt de filter 30 ms → 18 ms
 * op één `addTask`.
 *
 * Let op wat dit betekent voor tests: omdat Immer een gelijkwaardige schrijfactie tóch negeert, is
 * de filter NIET zichtbaar aan objectidentiteit. Hem weghalen maakt de app langzamer zonder één
 * gedragsverschil — vandaar de bron-assert in `check-mutation-cost.ts`.
 *
 * De index-voor-index-koppeling klopt omdat `view` uit dezelfde array komt: zelfde lengte, zelfde
 * volgorde.
 */
export function applyWbsNumbering(tasks: Task[]): void {
  const view = plainView(tasks);
  const codes = deriveWbsCodes(view);
  for (let i = 0; i < view.length; i++) {
    const code = codes.get(view[i].id);
    if (code !== undefined && code !== view[i].wbsCode) tasks[i].wbsCode = code;
  }
}
