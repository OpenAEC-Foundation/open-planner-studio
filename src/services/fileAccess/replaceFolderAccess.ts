/**
 * #804, knownbug 1762: toegang tot de map van een bestand dat de app op de desktop wil vervangen (Ctrl+S op het eigen
 * bestand met een vreemd deel, Opslaan als over een bestaand bestand). De vervanging zet haar hulpbestanden
 * (`save-<id>.ops-save.tmp`, `save-<id>.ops-vorige-<id>` en de kopieën) naast het doel. De capability geeft plugin-fs de
 * thuismap (`$HOME/**`); daarbuiten (een tweede schijf, een netwerkschijf) gaf de bestandskiezer alleen het gekozen
 * bestand zelf vrij, en weigert plugin-fs die hulpnamen.
 *
 * Oplossing f (besluit van de eigenaar, 21 november 2026; T1 tot en met T4 van de technisch beslisser, 20 november):
 * de planner geeft de map één keer vrij met de gewone mapkiezer van plugin-dialog. Die geeft de map vrij zoals
 * `allow_directory(map, false)`: de bestanden erin, geen submappen. `persisted-scope` bewaart dat over een herstart,
 * dus ook het herstel na een crash kan daarna bij de hulpbestanden. Geen Rust-commando: `place_file_exclusive` neemt
 * de scope die tijdens het draaien groeit al mee. Vóór de mapkiezer stelt de app in de app zelf een korte vraag
 * (`setFolderAccessAsker`, de dialoog `FolderAccessQuestionDialog`). De aanroeper beslist of de vraag mag: alleen met
 * de flag `ifcForeignContent` aan, nooit bij Automatisch opslaan.
 *
 * Geen vergelijking van padteksten: de toets is of plugin-fs een hulpnaam naast het doel toelaat (`exists`, dat eerst
 * de scope toetst op het echte pad). Dat dekt stationsletters, netwerkschijven en links.
 */
import { isForbiddenPathError, userFileDir, userFileTempPath } from './atomicWrite';

/** De vraag in de app vóór de mapkiezer, met de map. `true` = de mapkiezer openen; `false` = annuleren. */
export type FolderAccessAsker = (folder: string) => Promise<boolean>;

/** Zonder vrager (headless, proeven) annuleert de vraag: nooit een mapkiezer zonder uitleg. */
const cancel: FolderAccessAsker = () => Promise.resolve(false);
let asker: FolderAccessAsker = cancel;

export function setFolderAccessAsker(fn: FolderAccessAsker): void { asker = fn; }
export function resetFolderAccessAsker(): void { asker = cancel; }

/** `ok`: een hulpnaam naast het doel mag (al vrijgegeven, of de planner gaf de map nu vrij). `cancelled`: de planner
 *  annuleerde de vraag of de mapkiezer. `wrong-folder`: de planner koos een andere map; die blijft wel vrijgegeven. */
export type ReplaceFolderAccess = 'ok' | 'cancelled' | 'wrong-folder';

/** De map van `path` zoals de planner haar leest en de mapkiezer haar opent: zonder het scheidingsteken achteraan,
 *  behalve bij een wortel (`/`, `D:\`). */
export function replaceFolder(path: string): string {
  const dir = userFileDir(path), trimmed = dir.replace(/[\\/]$/, '');
  return trimmed === '' || /^[a-z]:$/i.test(trimmed) ? dir : trimmed;
}

/** Mag een hulpnaam naast `path` ontstaan? Alleen een scopeweigering zegt nee; een andere fout laat de vervanging zelf
 *  beslissen, zoals zonder deze vraag. */
async function helperAllowed(path: string): Promise<boolean> {
  const { exists } = await import('@tauri-apps/plugin-fs');
  try {
    await exists(userFileTempPath(path));
    return true;
  } catch (error) {
    return !isForbiddenPathError(error);
  }
}

/** Tauri: mag de vervanging naast `path`? Zo niet, eerst de vraag in de app, dan de mapkiezer op die map, en dan
 *  dezelfde toets opnieuw. Schrijft niets. */
export async function requestReplaceFolderAccessTauri(path: string): Promise<ReplaceFolderAccess> {
  if (await helperAllowed(path)) return 'ok';
  const folder = replaceFolder(path);
  if (!(await asker(folder))) return 'cancelled';
  const { open } = await import('@tauri-apps/plugin-dialog');
  const chosen = await open({ directory: true, multiple: false, recursive: false, defaultPath: folder });
  if (chosen === null) return 'cancelled';
  return await helperAllowed(path) ? 'ok' : 'wrong-folder';
}
