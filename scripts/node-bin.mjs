// Start de opdrachtregel van een npm-pakket via Node zelf. Sinds Node 18.20.2 en
// 20.12.2 weigert `spawn` een .cmd of .bat zonder shell (EINVAL, CVE-2024-27980),
// dus `node_modules/.bin/vite.cmd` en `tauri.cmd` werken op Windows niet meer.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/**
 * Wat `spawn` nodig heeft om `name` te starten: het script `bin` van pakket `pkg`
 * met Node, of als dat pakket niet lokaal staat de globale opdracht (op Windows via
 * de shell, want dat is een .cmd).
 *
 *   const { command, args, shell } = nodeBin(root, 'vite', 'bin/vite.js', 'vite', ['--host', '127.0.0.1']);
 *   spawn(command, args, { shell, ... });
 */
export function nodeBin(root, pkg, bin, name, args = []) {
  const script = join(root, 'node_modules', pkg, bin);
  if (existsSync(script)) return { command: process.execPath, args: [script, ...args], shell: false };
  return { command: name, args, shell: process.platform === 'win32' };
}
