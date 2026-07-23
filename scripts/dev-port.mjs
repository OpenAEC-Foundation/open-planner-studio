// scripts/dev-port.mjs
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
