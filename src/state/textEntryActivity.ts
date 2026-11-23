// #804 stap 8, fixronde 1 van de review van #1033: open veldinvoer die nog niet in de store staat (een cel van de
// taakgrid bewaart zijn tekst lokaal tot Enter) meldt hier elke toetsaanslag. Zo ziet de rustklok van Automatisch
// opslaan met een gebouwmodel (`modelAutoSaveRhythm.ts`) dat de planner nog werkt, zonder dat de invoer al wordt
// vastgelegd. Alleen app-runtime: de gemounte app luistert (`useAutoSave`); de invoer hoort bij het actieve document.
const listeners = new Set<() => void>();

/** Een toetsaanslag in open veldinvoer. */
export function noteTextEntry(): void {
  for (const listener of listeners) listener();
}

/** Luister naar toetsaanslagen in open veldinvoer. Geeft de afmelding terug. */
export function onTextEntry(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
