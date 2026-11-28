export interface SiteOpenRequest {
  extensions: string[];
}

export type SiteOpenChoice =
  | { kind: 'site'; id: string; version?: string; copyName?: string }
  | { kind: 'local' }
  | null;

export interface SiteSaveRequest {
  defaultName: string;
}

export type SiteSaveChoice =
  | { kind: 'site'; name: string }
  | { kind: 'local' }
  | null;

export type SiteOpenAsker = (request: SiteOpenRequest) => Promise<SiteOpenChoice>;
export type SiteSaveAsker = (request: SiteSaveRequest) => Promise<SiteSaveChoice>;

const localOpen: SiteOpenAsker = () => Promise.resolve({ kind: 'local' });
const localSave: SiteSaveAsker = () => Promise.resolve({ kind: 'local' });

let openAsker: SiteOpenAsker = localOpen;
let saveAsker: SiteSaveAsker = localSave;

export function setSiteOpenAsker(fn: SiteOpenAsker): void {
  openAsker = fn;
}

export function setSiteSaveAsker(fn: SiteSaveAsker): void {
  saveAsker = fn;
}

export function resetSiteAskers(): void {
  openAsker = localOpen;
  saveAsker = localSave;
}

export function askSiteOpen(request: SiteOpenRequest): Promise<SiteOpenChoice> {
  return openAsker(request);
}

export function askSiteSave(request: SiteSaveRequest): Promise<SiteSaveChoice> {
  return saveAsker(request);
}
