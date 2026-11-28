export interface FileIdentityInfo {
  isFile: boolean;
  dev: number | null;
  ino: number | null;
  mtime?: Date | null;
}

export interface FileIdentityFs {
  stat(path: string): Promise<FileIdentityInfo>;
}

export type FileIdentityComparison = 'same' | 'different' | 'unknown';

function usableIdentity(info: FileIdentityInfo): boolean {
  return info.isFile && info.dev !== null && info.ino !== null
    && Number.isSafeInteger(info.dev) && info.dev >= 0
    && Number.isSafeInteger(info.ino) && info.ino > 0;
}

export function missingTarget(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith('failed to get metadata of path: ')
    && message.includes(' with error: ') && message.endsWith(' (os error 2)');
}

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
