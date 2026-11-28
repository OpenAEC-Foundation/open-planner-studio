export const CLAUDE_DESKTOP_SETTINGS_HINT =
  'the settings of the Open Planner Studio extension in Claude Desktop (Settings › Extensions)';

export interface BundleConfig {
  root: string | null;
  devInstance: string | null;
  notes: string[];
}

export function readBundleConfig(env: Record<string, string | undefined>): BundleConfig {
  const notes: string[] = [];
  let root: string | null = (env.OPS_MCP_ROOT ?? '').trim();
  if (root === '' || root.startsWith('${')) root = null;
  let devInstance: string | null = (env.OPS_MCP_DEV_INSTANCE ?? '').trim();
  if (devInstance === '' || devInstance.startsWith('${')) devInstance = null;
  else if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(devInstance)) {
    notes.push(`Ignoring OPS_MCP_DEV_INSTANCE "${devInstance}": only lowercase letters, digits and dashes.`);
    devInstance = null;
  }
  return { root, devInstance, notes };
}
