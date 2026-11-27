export const EXTENSION_API_VERSION = '1.6.0';

export interface ApiCompatibility {
  ok: boolean;
  reason?: string;
  legacy?: boolean;
}

function parts(v: string): [number, number, number] {
  const p = v.split('.').map((n) => {
    const x = parseInt(n, 10);
    return Number.isFinite(x) && x >= 0 ? x : 0;
  });
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
}

function isSemver(v: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(v.trim());
}

export function checkApiCompatibility(
  declared: string | undefined,
  hostVersion: string = EXTENSION_API_VERSION,
): ApiCompatibility {
  const d = declared?.trim();
  if (!d) return { ok: true, legacy: true };
  if (!isSemver(d)) {
    return { ok: false, reason: `Ongeldige apiVersion "${declared}" — verwacht een semver als "1.0" of "1.0.0"` };
  }
  const [dMajor, dMinor] = parts(d);
  const [hMajor, hMinor] = parts(hostVersion);
  if (dMajor !== hMajor) {
    return {
      ok: false,
      reason: `Gebouwd voor extensie-API ${dMajor}.x; deze app biedt ${hMajor}.${hMinor}`,
    };
  }
  if (dMinor > hMinor) {
    return {
      ok: false,
      reason: `Vereist extensie-API ${dMajor}.${dMinor}; deze app biedt ${hMajor}.${hMinor}`,
    };
  }
  return { ok: true };
}
