// METING #804, desktop-verdeling (meet-branch `meting/804-desktop-verdeling`, NIET voor main).
// Tijdstempels op vaste punten van Ctrl+S, als tekstregels in `meting-804.txt` in de gegevensmap van de app
// (Linux: ~/.local/share/org.openaec.planner/), zodat ze na de run naast het geheugenlog per seconde te leggen zijn.
// Elke regel: `<Date.now()> <ISO-tijd> <label>`. Elke regel gaat meteen naar schijf (toevoegen), zodat ook bij een
// gestopte webview vaststaat tot waar de opslag kwam. Opties staan in `meting-804-opties.txt` in dezelfde map, één
// `naam=waarde` per regel (zie `metingOptie`); het bestand wordt bij de eerste meetregel gelezen.
// In de worker bestaat geen Tauri: daar stuurt `__opsMeting804` een bericht en schrijft de hoofdthread de regel, met de
// klok van de worker (`ifcSave.worker.ts`, `ifcSaveWorker.ts`).
import { isTauri } from '@/utils/platform';

const FILE = 'meting-804.txt';
const OPTIONS_FILE = 'meting-804-opties.txt';
let chain: Promise<unknown> = Promise.resolve();
let dir: Promise<string> | null = null;
let options: Promise<Map<string, string>> | null = null;

async function appData(): Promise<string> {
  dir ??= import('@tauri-apps/api/path').then(p => p.appDataDir());
  return dir;
}

function readOptions(): Promise<Map<string, string>> {
  options ??= (async () => {
    const found = new Map<string, string>();
    if (!isTauri()) return found;
    try {
      const fs = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');
      const text = await fs.readTextFile(await join(await appData(), OPTIONS_FILE));
      for (const line of text.split('\n')) {
        const m = /^\s*([a-z0-9-]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (m) found.set(m[1], m[2]);
      }
    } catch { /* geen optiebestand: alles uit */ }
    return found;
  })();
  return options;
}

/** Eén meetregel; `at` is de klok van het moment zelf (ook van de worker). Faalt nooit. */
export function meting804(label: string, at: number = Date.now()): void {
  if (!isTauri()) return;
  const line = `${at} ${new Date(at).toISOString()} ${label}\n`;
  chain = chain.then(async () => {
    const fs = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');
    await fs.writeTextFile(await join(await appData(), FILE), line, { append: true });
  }).catch(() => { /* meten mag de app nooit hinderen */ });
}

/** Een getal uit het optiebestand, of `null`. Bekend: `pauze-voor-schrijven` (ms vóór het tijdelijke bestand),
 *  `stop-worker-na` (ms na een geslaagde Ctrl+S: de opslagworker stoppen, de volgende opslag start een nieuwe). */
export async function metingOptie(name: string): Promise<number | null> {
  const value = (await readOptions()).get(name);
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Wacht `ms` als de optie gezet is, met een meetregel ervoor en erna. */
export async function metingPauze(name: string): Promise<void> {
  const ms = await metingOptie(name);
  if (ms === null || ms === 0) return;
  meting804(`pauze ${name}=${ms} begin`);
  await new Promise(resolve => setTimeout(resolve, ms));
  meting804(`pauze ${name} eind`);
}

/** Na een geslaagde Ctrl+S: met `stop-worker-na` de opslagworker stoppen (`ifcSaveWorker.ts` zet de stopfunctie). */
export async function metingNaOpslag(): Promise<void> {
  const ms = await metingOptie('stop-worker-na');
  if (ms === null) return;
  setTimeout(() => {
    const stop = (globalThis as { __opsMeting804StopWorker?: () => boolean }).__opsMeting804StopWorker;
    meting804(`stop-worker-na=${ms}: worker ${stop?.() ? 'gestopt' : 'liep niet'}`);
  }, ms);
}

// De haak die ook de rekencode (`mergeWriter.ts`) gebruikt; in de worker zet `ifcSave.worker.ts` een eigen haak.
(globalThis as { __opsMeting804?: (label: string) => void }).__opsMeting804 ??= label => meting804(label);
