import { isTauri } from './platform';

/** Alleen door de native Linux-schil gezet, vóór de eerste app-code. Geen browserinstelling. */
export interface LinuxEnvironment {
  managed: boolean;
  directory: string | null;
  initialFile: string | null;
  mcp: { port: number; token: string } | null;
}

export function linuxEnvironment(): Readonly<LinuxEnvironment> | null {
  if (!isTauri()) return null;
  return (window as Window & { __OPS_LINUX__?: LinuxEnvironment }).__OPS_LINUX__ ?? null;
}

export function isManagedLinux(): boolean {
  return linuxEnvironment()?.managed === true;
}
