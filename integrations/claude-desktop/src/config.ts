// Instellingen van de Claude Desktop-bundel. De werkmap komt uit de omgeving die het manifest
// (`server.mcp_config.env`) vult uit het installatievenster (`user_config.workdir`). Poort en token van de
// app staan niet meer in het venster: de bundel leest ze uit `runtime.json` (`discovery.ts`). Bewust los
// van `proxy.ts`, die geen manifest kent.

/** Waar de gebruiker van de bundel de werkmap instelt; komt in de foutmeldingen. */
export const CLAUDE_DESKTOP_SETTINGS_HINT =
  'the settings of the Open Planner Studio extension in Claude Desktop (Settings › Extensions)';

export interface BundleConfig {
  /** De werkmap voor de stand zonder app, of `null` als hij niet is ingevuld. */
  root: string | null;
  /** Alleen voor tests en ontwikkelaars: lees `runtime.<slug>.json` van een dev-build. */
  devInstance: string | null;
  /** Meldingen over de instellingen; gaan naar stderr. */
  notes: string[];
}

/** Leest `OPS_MCP_ROOT` en `OPS_MCP_DEV_INSTANCE`. */
export function readBundleConfig(env: Record<string, string | undefined>): BundleConfig {
  const notes: string[] = [];
  let root: string | null = (env.OPS_MCP_ROOT ?? '').trim();
  // Een niet-ingevulde manifestvariabele kan letterlijk blijven staan.
  if (root === '' || root.startsWith('${')) root = null;
  let devInstance: string | null = (env.OPS_MCP_DEV_INSTANCE ?? '').trim();
  if (devInstance === '' || devInstance.startsWith('${')) devInstance = null;
  else if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(devInstance)) {
    notes.push(`Ignoring OPS_MCP_DEV_INSTANCE "${devInstance}": only lowercase letters, digits and dashes.`);
    devInstance = null;
  }
  return { root, devInstance, notes };
}
