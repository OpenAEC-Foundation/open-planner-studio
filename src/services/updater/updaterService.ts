/**
 * In-app auto-updater — dunne wrapper rond de Tauri updater/process-plugins.
 *
 * KRITIEK: `@tauri-apps/plugin-updater` en `@tauri-apps/plugin-process` worden
 * DYNAMISCH geïmporteerd binnen een `isTauri()`-tak. Top-level imports zouden de
 * web-build breken (zie het auto-save-patroon in `App.tsx`). In de browser
 * (isTauri === false) no-opt deze service netjes: `checkForUpdates` geeft `null`
 * terug en meldt 'upToDate' via de status-callback.
 */

import { isTauri } from '@/utils/platform';
import { GITHUB_REPO } from '@/services/githubRepo';
import { flushRecoveryNow } from '@/services/recovery/recoveryFlush';

export interface UpdateInfo {
  version: string;
  body: string;
  date?: string;
}

/**
 * Hoe de app op deze machine geïnstalleerd is — bepaalt óf en hoe de updater werkt.
 * - `appimage` / `native` (Windows/macOS): normale auto-install-flow.
 * - `snap`: read-only, snapd updatet zelf → in-app updater overslaan.
 * - `aur`: pacman beheert het programma (Arch, AUR-pakket `open-planner-studio-bin`).
 *   De app installeert niets; de gebruiker werkt bij via zijn pakketbeheer.
 * - `deb`: normale auto-install-flow — de updater-plugin (≥2.6) matcht de
 *   `linux-x86_64-deb`-entry in latest.json (via de bundle-type-stempel in het
 *   binary) en installeert in-place via pkexec/sudo + `dpkg -i`. Alleen als dát
 *   faalt toont de dialog nog handmatige instructies als fallback.
 */
export type InstallKind = 'appimage' | 'snap' | 'aur' | 'deb' | 'native';

/** GitHub-release-pagina (laatste release) voor handmatige .deb-installatie. */
export const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

/**
 * Detecteer het install-type via de dunne Rust-command `install_kind`.
 *
 * KRITIEK: `@tauri-apps/api/core` wordt DYNAMISCH geïmporteerd binnen een
 * `isTauri()`-tak. Op web (of bij een fout) vallen we terug op `'native'`, zodat
 * de bestaande flow ongewijzigd blijft.
 */
export async function getInstallKind(): Promise<InstallKind> {
  if (!isTauri()) return 'native';
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const kind = await invoke<string>('install_kind');
    if (kind === 'appimage' || kind === 'snap' || kind === 'aur' || kind === 'deb' || kind === 'native') {
      return kind;
    }
    return 'native';
  } catch {
    return 'native';
  }
}

export type UpdateStatus =
  | { kind: 'upToDate' }
  | { kind: 'available'; info: UpdateInfo }
  // `indeterminate`: de totale download-grootte is onbekend (geen contentLength) —
  // toon dan een onbepaalde voortgangsbalk i.p.v. een vastgepinde 0%.
  | { kind: 'downloading'; progress: number; indeterminate: boolean }
  // Download afgerond; de plugin controleert nog de handtekening, daarna volgt de herstelsnapshot.
  | { kind: 'readyToInstall' }
  | { kind: 'installing' }
  | { kind: 'restarting' }
  | { kind: 'error'; message: string };

/**
 * Controleer op applicatie-updates.
 * @param silent Indien true: onderdruk fout-meldingen (stille opstart-check).
 * @param onStatus Optionele callback om de status te volgen.
 * @returns De update-info als er een update beschikbaar is, anders `null`
 *          (up-to-date, of fout in stille modus, of geen Tauri-runtime).
 */
export async function checkForUpdates(
  silent: boolean,
  onStatus?: (status: UpdateStatus) => void,
): Promise<UpdateInfo | null> {
  // In de web-build is er geen updater — netjes no-opten.
  if (!isTauri()) {
    onStatus?.({ kind: 'upToDate' });
    return null;
  }

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();

    if (!update) {
      onStatus?.({ kind: 'upToDate' });
      return null;
    }

    const info: UpdateInfo = {
      version: update.version,
      body: update.body ?? '',
      date: update.date ?? undefined,
    };

    onStatus?.({ kind: 'available', info });
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!silent) {
      onStatus?.({ kind: 'error', message });
    }
    return null;
  }
}

/**
 * Download en installeer een beschikbare update, herstart daarna de app.
 * @param onStatus Callback om de download-voortgang en installatie te volgen.
 */
export async function downloadAndInstall(
  onStatus?: (status: UpdateStatus) => void,
): Promise<void> {
  if (!isTauri()) {
    onStatus?.({ kind: 'upToDate' });
    return;
  }

  try {
    // Ook buiten de dialoog om nooit een pakketbeheerinstallatie overschrijven.
    // Wacht op de echte detectie; het onbekende type is geen toestemming om te downloaden.
    const installKind = await getInstallKind();
    if (installKind === 'aur' || installKind === 'snap') {
      onStatus?.({ kind: 'upToDate' });
      return;
    }

    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');

    const update = await check();

    if (!update) {
      onStatus?.({ kind: 'upToDate' });
      return;
    }

    let totalLength = 0;
    let downloaded = 0;

    // Eerst alleen downloaden: op Windows sluit de app zichzelf af tijdens `install()` (beperking van
    // Windows-installers, Tauri-updaterdocs), dus alles wat ná de installatie staat komt daar nooit
    // aan de beurt (review 2026-09-28).
    await update.download((event) => {
      switch (event.event) {
        case 'Started':
          totalLength = event.data.contentLength ?? 0;
          downloaded = 0;
          onStatus?.({ kind: 'downloading', progress: 0, indeterminate: totalLength === 0 });
          break;
        case 'Progress': {
          downloaded += event.data.chunkLength;
          const indeterminate = totalLength === 0;
          const progress = indeterminate ? 0 : Math.round((downloaded / totalLength) * 100);
          onStatus?.({ kind: 'downloading', progress, indeterminate });
          break;
        }
        case 'Finished':
          onStatus?.({ kind: 'readyToInstall' });
          break;
      }
    });

    // Geen normale afsluiting (geen sluitvraag): leg vóór de installatie nog één herstelsnapshot
    // vast, zodat bewerkingen van de laatste seconden na de update via het herstel-venster
    // terugkomen.
    // Een afgewezen flush blokkeert de installatie: die kan de app al afsluiten.
    // De bestaande buitenste catch toont de fout en laat opnieuw proberen toe.
    await flushRecoveryNow();
    // Pas na de geslaagde download (inclusief handtekeningcontrole) en het herstelwerk installeren.
    onStatus?.({ kind: 'installing' });
    await update.install();
    onStatus?.({ kind: 'restarting' });
    await relaunch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onStatus?.({ kind: 'error', message });
  }
}
