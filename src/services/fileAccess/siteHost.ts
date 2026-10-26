/**
 * Het HOSTCONTRACT voor opslag via de site (issue #309, onderdeel van #307).
 *
 * OpenAEC zet de tools in één Frappe-app. Een tool draait daar in de browser, binnen een pagina van
 * een ingelogde site. Openen en opslaan lopen dan via dit kleine contract: de SITE levert het, de
 * tool gebruikt het. Uploaden en downloaden van de eigen pc blijven gewoon bestaan.
 *
 * Deze tool definieert het contract als eerste. Het is daarom bewust klein en algemeen gehouden, zonder
 * iets wat alleen voor planningen geldt; een andere tool kan het letterlijk overnemen.
 *
 * ## Hoe de site het aanbiedt
 *
 * De site zet `window.openaecHost` (een `OpenAECHost`). Dat mag vóór of na het laden van de tool: de
 * tool kijkt pas op het moment van gebruik (`getSiteStorage()`), niet één keer bij de start. Draait de
 * tool in een iframe van dezelfde origin, dan mag het object ook op `window.parent` staan. Een
 * cross-origin parent is niet bereikbaar en telt als "geen site".
 * Toont één pagina meer tools, zet de host dan per tool op het venster van zijn iframe: een host op de
 * pagina zelf (met `initialFileId` en het ready-event) geldt voor elke tool eronder.
 *
 * Gebruikt de site `initialFileId` en zet ze de host pas ná het laden, dan stuurt ze daarna één keer
 * het event `openaec-host-ready` (zie `SITE_HOST_READY_EVENT`) op het venster waar de host staat: op
 * het eigen `window` van de tool, of op `window.parent` als de host daar staat. De tool luistert op
 * beide (de parent alleen als die same-origin is). Anders mist de tool het startbestand als zijn
 * opstartcontrole al voorbij is.
 *
 * ## De vier functies
 *
 * - `list({ extensions })` — de bestanden die de tool kan openen. `extensions` zijn extensies zonder
 *   punt, in kleine letters (`['ifc', 'csv', 'xml', 'mpp', 'xer']`); de site mag erop filteren (de
 *   tool filtert daarna zelf ook op de extensie van `name`).
 * - `open(id, version?)` — de inhoud van een bestand. Zonder `version` de nieuwste versie; dan MOET
 *   `file.version` de gelezen versie zijn (anders weigert de tool het bestand: zonder versie kan hij
 *   bij de volgende opslag geen `baseVersion` meesturen). `data` mag een `Blob`, `ArrayBuffer`,
 *   `Uint8Array` of tekst zijn; tekstformaten leest de tool als UTF-8 (zoals `File.text()`).
 * - `save({ id?, name, data, baseVersion? })` — opslaan. ZONDER `id` maakt dit een NIEUW bestand; MET
 *   `id` schrijft het een nieuwe versie van dat bestand. Het antwoord MOET altijd een `id` en de
 *   net geschreven `version` hebben, en bij een opslag met `id` hetzelfde `id`. Klopt het antwoord
 *   niet, dan behandelt de tool de opslag als mislukt (melding, het document blijft gewijzigd).
 *   `baseVersion` is de versie waarop het DOCUMENT in de tool rust: de versie die dát document het
 *   laatst las of schreef (twee tabbladen op hetzelfde bestand hebben elk hun eigen basis). Is het
 *   bestand intussen verder (iemand anders sloeg op), dan weigert de site met een fout waarvan
 *   `code === 'conflict'`; de tool meldt dat apart en het document blijft gewijzigd.
 * - `versions(id)` — de versies van een bestand, nieuwste eerst.
 *
 * Alle vier geven een Promise terug. Een geweigerde Promise is een fout; de tool vangt hem af en
 * toont de tekst (`message`) van de site erbij. Twee foutcodes (`code`) hebben een eigen betekenis:
 *  - `'conflict'` bij `save`: zie hierboven.
 *  - `'not-found'` bij `open`: het bestand bestaat niet (meer). Alleen dan haalt de tool het uit de
 *    recente bestanden; bij elke andere fout (netwerk, rechten, storing) blijft het daar staan.
 *
 * De tool schrijft ALLEEN naar de site als de gebruiker opslaat (Opslaan of Opslaan als). Automatisch
 * opslaan staat voor een site-bestand uit: elke ronde zou een nieuwe versie maken. Crashherstel blijft
 * lokaal in de browser. Weigert de browser IndexedDB (bijv. in een sandbox-iframe zonder
 * `allow-same-origin`), dan gaat crashherstel stil uit voor die sessie; opslaan via de site werkt gewoon.
 *
 * Staat de host op `window.parent`, dan komen objecten uit twee vensters. De tool controleert de
 * inhoud daarom zonder `instanceof`; de site doet er goed aan hetzelfde te doen met de `Blob` die de
 * tool bij `save` meegeeft (gebruik `data.arrayBuffer()`/`data.text()`, niet `data instanceof Blob`).
 * Een `save` zonder `id` met een naam die al bestaat: wat er dan gebeurt (nieuw bestand of weigeren)
 * beslist de site.
 */

/** Eén bestand op de site. */
export interface SiteFileInfo {
  /** Vaste id van het bestand op de site. Verandert niet bij een nieuwe versie. */
  id: string;
  /** Bestandsnaam inclusief extensie (bijv. `Planning.ifc`). De extensie bepaalt het formaat. */
  name: string;
  /** De versie die deze info beschrijft. VERPLICHT in het antwoord van `save` (de net geschreven
   *  versie) en van `open` zonder `version` (de gelezen versie); in `list` optioneel. */
  version?: string;
  /** Laatst gewijzigd, bij voorkeur ISO 8601. Alleen voor weergave. */
  modified?: string;
  /** Grootte in bytes. Alleen voor weergave. */
  size?: number;
}

/** Eén versie van een bestand. */
export interface SiteVersionInfo {
  version: string;
  /** Moment van deze versie, bij voorkeur ISO 8601. Alleen voor weergave. */
  modified?: string;
  /** Wie deze versie opsloeg. Alleen voor weergave. */
  author?: string;
  /** Leesbaar label (bijv. `3`); zonder label toont de tool `version`. */
  label?: string;
}

/** De opslag die de site aanbiedt. Zie de kop van deze module. */
export interface SiteStorage {
  list(query?: { extensions?: string[] }): Promise<SiteFileInfo[]>;
  open(id: string, version?: string): Promise<{ file: SiteFileInfo; data: Blob | ArrayBuffer | Uint8Array | string }>;
  save(request: { id?: string; name: string; data: Blob; baseVersion?: string }): Promise<SiteFileInfo>;
  versions(id: string): Promise<SiteVersionInfo[]>;
}

/** Wat de site op `window.openaecHost` zet. */
export interface OpenAECHost {
  storage?: SiteStorage;
  /** Open dit bestand (nieuwste versie) bij de start, als de tool nog een leeg document heeft. */
  initialFileId?: string;
}

/** Event waarmee een site meldt dat `openaecHost` er nu staat; op het venster waar de host staat
 *  (het eigen venster van de tool of een same-origin `window.parent`). */
export const SITE_HOST_READY_EVENT = 'openaec-host-ready';

/** De `code` waarmee een site een opslag weigert omdat het bestand intussen verder is. */
export const SITE_CONFLICT_CODE = 'conflict';

/** De `code` waarmee een site meldt dat een bestand niet (meer) bestaat. */
export const SITE_NOT_FOUND_CODE = 'not-found';

declare global {
  interface Window {
    /** Gezet door de site die de tool host. Bewust `unknown`: de tool valideert de vorm zelf. */
    openaecHost?: unknown;
  }
}

/** Heeft `value` de vorm van een `SiteStorage` (vier functies)? */
export function isSiteStorage(value: unknown): value is SiteStorage {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.list === 'function' && typeof s.open === 'function'
    && typeof s.save === 'function' && typeof s.versions === 'function';
}

/**
 * Lees de host uit één venster. Een cross-origin `window.parent` gooit al bij het lezen van een
 * eigenschap (`SecurityError`); dat telt als "geen host".
 */
function readHost(read: () => unknown): Record<string, unknown> | null {
  try {
    const host = read();
    return typeof host === 'object' && host !== null ? host as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** De kandidaat-hosts in volgorde: eerst het eigen venster, dan de parent (alleen in een iframe). */
function candidateHosts(): Record<string, unknown>[] {
  if (typeof window === 'undefined') return [];
  // Desktop (Tauri) heeft nooit een site. Zo blijft de desktop-app gegarandeerd zoals hij was, ook
  // als er ooit per ongeluk iets op `window.openaecHost` staat.
  if ('__TAURI_INTERNALS__' in window) return [];
  const hosts: Record<string, unknown>[] = [];
  const own = readHost(() => window.openaecHost);
  if (own) hosts.push(own);
  const parent = readHost(() => {
    const p = window.parent;
    // Geen iframe: `window.parent === window`. Ook dat kan bij een vreemde omgeving gooien.
    return p && p !== window ? p.openaecHost : undefined;
  });
  if (parent) hosts.push(parent);
  return hosts;
}

/**
 * De opslag van de site, of `null` als er geen (geldige) is. Kijkt op het moment van aanroepen —
 * een site mag de host dus ook later zetten. Een host zonder vier functies telt als "geen site".
 */
export function getSiteStorage(): SiteStorage | null {
  for (const host of candidateHosts()) {
    if (isSiteStorage(host.storage)) return host.storage;
  }
  return null;
}

/** Is er nu opslag via de site? De ene vraag waarop de UI en de opslaanroute beslissen. */
export function siteStorageAvailable(): boolean {
  return getSiteStorage() !== null;
}

/**
 * Het bestand dat de site bij de start geopend wil hebben, of `null`. Alleen als dezelfde host ook
 * een geldige opslag levert: zonder opslag kan de tool het bestand niet openen.
 */
export function siteInitialFileId(): string | null {
  for (const host of candidateHosts()) {
    if (!isSiteStorage(host.storage)) continue;
    const id = host.initialFileId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }
  return null;
}

function siteErrorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
}

/** Weigerde de site een opslag omdat het bestand intussen verder is? (`code === 'conflict'`) */
export function isSiteConflict(err: unknown): boolean {
  return siteErrorCode(err) === SITE_CONFLICT_CODE;
}

/** Meldde de site dat het bestand niet (meer) bestaat? (`code === 'not-found'`) */
export function isSiteNotFound(err: unknown): boolean {
  return siteErrorCode(err) === SITE_NOT_FOUND_CODE;
}

/**
 * De vensters waarop een site `openaec-host-ready` kan sturen: het eigen venster en, in een iframe,
 * een same-origin parent. Een cross-origin parent valt weg (hij gooit al bij het lezen van een
 * eigenschap); Tauri heeft nooit een site.
 */
export function siteHostWindows(): Window[] {
  if (typeof window === 'undefined' || '__TAURI_INTERNALS__' in window) return [];
  const windows: Window[] = [window];
  try {
    const p = window.parent;
    // Lees één eigenschap om same-origin af te dwingen: cross-origin gooit hier een SecurityError.
    if (p && p !== window && typeof p.addEventListener === 'function') windows.push(p);
  } catch {
    /* cross-origin parent: geen host bereikbaar */
  }
  return windows;
}

/** De tekst van een fout van de site, voor het detail van een melding. */
export function siteErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}
