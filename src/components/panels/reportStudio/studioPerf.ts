// Snelheidsmeting van het nieuwe Rapport-tabblad (issue #817: "je moet niet eens merken dat je klikt").
//
// Elke bediening zet een beginmerk (`markReportInput`). Twee metingen hangen eraan, als
// `performance.measure` (lees ze met `performance.getEntriesByName(...)`, bijv. vanuit Playwright):
//  - `ops-report:feedback` — van de klik tot het eerste frame met de nieuwe stand van de bediening;
//  - `ops-report:paper`    — van de klik tot het eerste frame met het bijgewerkte papier.
// Daarnaast meten `ops-report:record` (de render voor maten en bladindeling, met de rijen van de bladen
// in beeld), `ops-report:record-rows` (de rijen van een blad dat later in beeld komt) en `ops-report:svg`
// (een blad als SVG-tekst) de rekenstappen apart. Meten kost vrijwel niets; het staat altijd aan.

let pending: { name: string; start: number; feedbackDone: boolean } | null = null;

function measure(name: string, start: number, detail: string): void {
  try {
    performance.measure(name, { start, end: performance.now(), detail });
  } catch {
    // Een omgeving zonder User Timing Level 3 meet gewoon niet.
  }
}

/** Een bediening van de gebruiker: begin van beide metingen. */
export function markReportInput(name: string): void {
  const start = performance.now();
  pending = { name, start, feedbackDone: false };
  // Het eerste frame na deze taak toont de bediening in haar nieuwe stand.
  requestAnimationFrame(() => {
    if (pending && pending.start === start && !pending.feedbackDone) {
      pending.feedbackDone = true;
      measure('ops-report:feedback', start, name);
    }
  });
}

/** Het papier heeft de nieuwe stand vastgelegd; het volgende frame toont hem. */
export function markReportPaperCommitted(): void {
  const current = pending;
  if (!current) return;
  pending = null;
  requestAnimationFrame(() => measure('ops-report:paper', current.start, current.name));
}

/** Meet een synchrone rekenstap. */
export function timeReportStep<T>(name: 'ops-report:record' | 'ops-report:record-rows' | 'ops-report:svg', run: () => T): T {
  const start = performance.now();
  const result = run();
  measure(name, start, '');
  return result;
}
