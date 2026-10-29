// MCP-backups van de headless server: de `BackupFs`-naad van `src/services/mcp/backupService.ts` op
// Node `fs`. De service (uitdunbeleid `BACKUP_RETENTION`, mapindeling per document, bestandsnamen) is
// dezelfde als in de app; alleen de plek verschilt: `<data-map>/ai-backups/<document>/…` in plaats van
// `<appDataDir>/ai-backups/…`. De data-map kiest de server zelf (`--data-dir`), nooit de agent.
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { BackupFs } from '@/services/mcp/backupService';
import { writeViaTemp } from '@/services/fileAccess/atomicWrite';

/** De standaard data-map per platform (XDG op Linux), met een eigen submap voor deze server. */
export function defaultDataDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
): string {
  const name = 'open-planner-studio-mcp';
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA || env.APPDATA || path.join(home, 'AppData', 'Local');
    return path.join(base, name);
  }
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', name);
  const xdg = env.XDG_DATA_HOME && path.isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : path.join(home, '.local', 'share');
  return path.join(xdg, name);
}

export function createNodeBackupFs(dataDir: string): BackupFs {
  return {
    appDataDir: async () => dataDir,
    join: async (...parts) => path.join(...parts),
    mkdir: async (dir) => { await fsp.mkdir(dir, { recursive: true }); },
    // Eerst een halffabricaat, dan een rename: een backup is nooit half geschreven.
    writeTextFile: (p, content) => writeViaTemp(
      {
        writeTextFile: (file, text) => fsp.writeFile(file, text, { encoding: 'utf8', flag: 'wx' }),
        rename: (from, to) => fsp.rename(from, to),
        remove: (file) => fsp.unlink(file),
      },
      p,
      `${p}.${process.pid}.tmp`,
      content,
    ),
    readDir: async (dir) => (await fsp.readdir(dir, { withFileTypes: true }))
      .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() })),
    remove: async (p) => {
      const info = await fsp.lstat(p);
      if (info.isDirectory()) await fsp.rmdir(p); // alleen een LEGE map, zoals het contract zegt
      else await fsp.unlink(p);
    },
  };
}
