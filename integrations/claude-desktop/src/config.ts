// Instellingen van de Claude Desktop-bundel: token en poort komen uit de omgeving die het manifest
// (`server.mcp_config.env`) vult uit het installatievenster (`user_config`). Bewust los van `proxy.ts`,
// die geen manifest kent en later ook in de headless server draait (#570).
import { DEFAULT_BRIDGE_PORT } from './proxy';

/** Waar de gebruiker van de bundel token en poort instelt; komt in de foutmeldingen van de proxy. */
export const CLAUDE_DESKTOP_SETTINGS_HINT =
  'the settings of the Open Planner Studio extension in Claude Desktop (Settings › Extensions)';

export interface ProxyConfig {
  port: number;
  token: string;
  /** Meldingen over de instellingen (bijv. een ongeldige poort); gaan naar stderr. */
  notes: string[];
}

/** Leest token en poort uit `OPS_MCP_TOKEN` en `OPS_MCP_PORT`. */
export function readProxyConfig(env: Record<string, string | undefined>): ProxyConfig {
  const notes: string[] = [];
  let token = (env.OPS_MCP_TOKEN ?? '').trim();
  // Een niet-ingevulde manifestvariabele kan letterlijk blijven staan.
  if (token.startsWith('${')) token = '';
  const rawPort = (env.OPS_MCP_PORT ?? '').trim();
  let port = DEFAULT_BRIDGE_PORT;
  if (rawPort !== '' && !rawPort.startsWith('${')) {
    const parsed = Number(rawPort);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) port = parsed;
    else notes.push(`Invalid port "${rawPort}"; using ${DEFAULT_BRIDGE_PORT}.`);
  }
  return { port, token, notes };
}
