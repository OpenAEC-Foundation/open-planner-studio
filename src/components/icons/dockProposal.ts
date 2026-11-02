import type { IconId, IconMaster } from './b2/icons.generated';

/**
 * TIJDELIJK voorstel, alleen op de dev-server: drie tekeningen voor Resourcedock (`resource.dock`). Ethan vroeg om
 * voorstellen (2 november 2026). In de Blueprint is het icoon nu één vorm en dus grijs (`docs/iconen.md`, "Grijs en
 * oranje"). Ethan kiest; daarna komt de keuze in de Blueprint-tekening en gaat deze module eruit.
 *
 * `?dockVoorstel=a`, `b` of `c` zet die tekening op elke plek van `resource.dock`. Zonder parameter: de Blueprint.
 * De tekeningen zijn gemaakt met de pen van de Blueprint (`scripts/b2_richtlijn.py`) en halen dezelfde checks als
 * de richtlijniconen: ruimte tussen de delen, scherpte, dichtheid, en grijs en oranje.
 */
export const DOCK_PROPOSALS: Readonly<Record<'a' | 'b' | 'c', { label: string; s16: IconMaster; s24: IconMaster }>> = {
  a: {
    label: "a: twee vlakken, het zijvak oranje",
    s16: { w: 1.25, parts: [[0, 0, "M2.9 2.5L7.1 2.5Q8.5 2.5 8.5 3.9L8.5 12.1Q8.5 13.5 7.1 13.5L2.9 13.5Q1.5 13.5 1.5 12.1L1.5 3.9Q1.5 2.5 2.9 2.5Z"], [0, 1, "M12.46 2.5L13.54 2.5Q14.5 2.5 14.5 3.46L14.5 12.54Q14.5 13.5 13.54 13.5L12.46 13.5Q11.5 13.5 11.5 12.54L11.5 3.46Q11.5 2.5 12.46 2.5Z"]] },
    s24: { w: 1.75, parts: [[0, 0, "M5 4L11 4Q13 4 13 6L13 18Q13 20 11 20L5 20Q3 20 3 18L3 6Q3 4 5 4Z"], [0, 1, "M18.28 4L19.72 4Q21 4 21 5.28L21 18.72Q21 20 19.72 20L18.28 20Q17 20 17 18.72L17 5.28Q17 4 18.28 4Z"]] },
  },
  b: {
    label: "b: paneel met een oranje pijl naar het zijvak",
    s16: { w: 1.25, parts: [[0, 0, "M2.9 2.5L13.1 2.5Q14.5 2.5 14.5 3.9L14.5 12.1Q14.5 13.5 13.1 13.5L2.9 13.5Q1.5 13.5 1.5 12.1L1.5 3.9Q1.5 2.5 2.9 2.5Z"], [0, 0, "M10.5 2.5L10.5 13.5"], [0, 1, "M4 8L7 8"], [0, 1, "M5.5 6.5L6.79 7.79Q7 8 6.79 8.21L5.5 9.5"]] },
    s24: { w: 1.75, parts: [[0, 0, "M5 4L19 4Q21 4 21 6L21 18Q21 20 19 20L5 20Q3 20 3 18L3 6Q3 4 5 4Z"], [0, 0, "M15 4L15 20"], [0, 1, "M6.5 12L11 12"], [0, 1, "M8.5 9.5L10.65 11.65Q11 12 10.65 12.35L8.5 14.5"]] },
  },
  c: {
    label: "c: kader rechts open, het zijvak als gevuld oranje vlak",
    s16: { w: 1.25, parts: [[0, 0, "M9 2.5L2.9 2.5Q1.5 2.5 1.5 3.9L1.5 12.1Q1.5 13.5 2.9 13.5L9 13.5"], [1, 1, "M11.5 2L14 2L14 14L11.5 14Z"]] },
    s24: { w: 1.75, parts: [[0, 0, "M14 4L5 4Q3 4 3 6L3 18Q3 20 5 20L14 20"], [1, 1, "M16.5 3.12L21 3.12L21 20.88L16.5 20.88Z"]] },
  },
};

export type DockProposal = keyof typeof DOCK_PROPOSALS;

function readProposal(): DockProposal | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('dockVoorstel');
  return value === 'a' || value === 'b' || value === 'c' ? value : null;
}

export const dockProposal: DockProposal | null = readProposal();

/** De tekening van het gekozen voorstel voor `resource.dock`; anders de master uit de Blueprint. */
export function applyDockProposal(id: IconId, box: 16 | 24, master: IconMaster): IconMaster {
  if (!dockProposal || id !== 'resource.dock') return master;
  return box === 16 ? DOCK_PROPOSALS[dockProposal].s16 : DOCK_PROPOSALS[dockProposal].s24;
}
