/** Metadata van het DOEL van een pad: `stat`, nooit `lstat` (dat de link zelf beschrijft). */
export interface FileIdentityInfo {
  isFile: boolean;
  dev: number | null;
  ino: number | null;
}

/** De bestaande plugin-fs-naad, injecteerbaar zonder Tauri-runtime. */
export interface FileIdentityFs {
  stat(path: string): Promise<FileIdentityInfo>;
}

export type FileIdentityComparison = 'same' | 'different' | 'unknown';

function usableIdentity(info: FileIdentityInfo): boolean {
  // plugin-fs serialiseert u64 als JS-number. Afgeronde IDs mogen nooit bewijzen dat bestanden
  // verschillen. Windows levert null; een ontbrekende/ongeldige ID wordt geen padheuristiek.
  return info.isFile && info.dev !== null && info.ino !== null
    && Number.isSafeInteger(info.dev) && info.dev >= 0
    && Number.isSafeInteger(info.ino) && info.ino > 0;
}

/**
 * Alleen de concrete ENOENT-vorm van plugin-fs 2.5 `get_fs_metadata` bewijst een nieuw doel.
 * Code 2 is ENOENT op Unix en FILE_NOT_FOUND op Windows. Andere fouten (ook scope, rechten,
 * kapotte metadata of een onbekende foutvorm) blijven onbekend. `exists() === false` volstaat
 * hier niet: plugin-fs gebruikt Path::exists, dat ook bij onleesbare metadata false kan geven.
 * Bron: https://github.com/tauri-apps/plugins-workspace/blob/fs-v2.5.0/plugins/fs/src/commands.rs
 */
function missingTarget(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith('failed to get metadata of path: ')
    && message.includes(' with error: ') && message.endsWith(' (os error 2)');
}

/**
 * Kan schrijven naar `target` het geopende `source` vervangen? Het OS beslist via dev+ino,
 * dus case-alias, symlink (ook in een bovenliggende map) en harde link delen hun identiteit.
 * Geen lowercasing, platformdetectie, inhoudsvergelijking of muterende probe.
 *
 * Een aantoonbaar ontbrekend doel is vrij voor export. Een bestaand doel mag alleen als beide
 * identiteiten betrouwbaar verschillen; metadatafouten leveren `unknown`, nooit toestemming.
 * Dit is een preflight, geen lock: een extern proces kan na de controle nog een pad vervangen.
 */
export async function compareFilePaths(
  fs: FileIdentityFs, target: string, source: string,
): Promise<FileIdentityComparison> {
  if (target === source) return 'same';
  let targetInfo: FileIdentityInfo;
  try {
    targetInfo = await fs.stat(target);
  } catch (error) {
    return missingTarget(error) ? 'different' : 'unknown';
  }
  try {
    const sourceInfo = await fs.stat(source);
    if (!usableIdentity(targetInfo) || !usableIdentity(sourceInfo)) return 'unknown';
    return targetInfo.dev === sourceInfo.dev && targetInfo.ino === sourceInfo.ino ? 'same' : 'different';
  } catch {
    return 'unknown';
  }
}
