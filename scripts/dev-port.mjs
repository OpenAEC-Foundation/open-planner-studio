// scripts/dev-port.mjs
import { readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';

export const MIN_PORT = 3007;
export const MAX_PORT = 3106;

/**
 * Laagste poort in [MIN_PORT, MAX_PORT] die noch geclaimd noch gebonden is.
 * Puur: `claimed` is een Set<number>, `isBound` een predicaat (port) => boolean.
 */
export function chooseFreePort(claimed, isBound) {
  for (let port = MIN_PORT; port <= MAX_PORT; port++) {
    if (!claimed.has(port) && !isBound(port)) return port;
  }
  throw new Error(`Geen vrije dev-poort in ${MIN_PORT}-${MAX_PORT}`);
}

/** De opsDevPort-markering uit <root>/.claude/launch.json, of null. Gooit nooit. */
export function readRecordedPort(root, readFile = readFileSync) {
  if (!root) return null;
  try {
    const json = JSON.parse(readFile(join(root, '.claude', 'launch.json'), 'utf8'));
    const p = json?.opsDevPort;
    return Number.isInteger(p) && p >= MIN_PORT && p <= MAX_PORT ? p : null;
  } catch {
    return null;
  }
}
