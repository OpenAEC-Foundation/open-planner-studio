// Eén eigenaar van de afsluitfase (#804 stap 3, fixronde 2 van #987). Gewoon afsluiten en de updater beëindigen allebei
// de app; ze mogen dat niet door elkaar heen doen. Zonder één eigenaar opende Alt+F4 tijdens een installatie de
// sluitvraag terwijl de updater de schrijfpoort al dicht had (Opslaan schreef dan stil niets), en kon de updater de poort
// sluiten terwijl de sluitvraag nog openstond.
//
// Afsluiten neemt de fase bij de eerste sluitpoging en houdt hem tot het afbreekt of het venster weg is; de updater
// neemt hem na de download en houdt hem tot de herstart of een fout. Wie hem niet krijgt: afsluiten vangt de sluitpoging
// op zonder vraag (de updater herstart de app zo), de updater wacht tot afsluiten klaar of afgebroken is. Store- en
// Tauri-vrij; app-runtime, geen documentdata.
export type ShutdownOwner = 'quit' | 'update';

let owner: ShutdownOwner | null = null;
let waiting: Array<() => void> = [];

/** Neemt de fase als niemand hem heeft, anders `null`. De teruggegeven functie geeft hem terug (één keer telt). */
export function claimShutdown(who: ShutdownOwner): (() => void) | null {
  if (owner !== null) return null;
  owner = who;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    owner = null;
    const next = waiting;
    waiting = [];
    for (const wake of next) wake();
  };
}

/** Neemt de fase zodra hij vrij is. */
export async function claimShutdownWhenFree(who: ShutdownOwner): Promise<() => void> {
  for (;;) {
    const release = claimShutdown(who);
    if (release) return release;
    await new Promise<void>((resolve) => { waiting.push(resolve); });
  }
}
