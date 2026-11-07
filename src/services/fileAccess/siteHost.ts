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
 * ## Twee vormen: `storage` en de SuperCloud-vorm (#818)
 *
 * Een host levert de opslag op één van twee manieren. De tool kiest per host, bij elk gebruik:
 *
 *  1. De `storage`-vorm (hieronder beschreven): de vier functies staan op `host.storage`. Is
 *     `host.storage` geldig, dan wint die altijd.
 *  2. De SuperCloud-vorm: de functies staan direct op de host, met een andere vorm:
 *     `open(id, version?)` geeft `{ id, name, version, readOnly, bytes }`, `save(bytes, { id?, name?,
 *     expectedVersion? })` geeft `{ id, name, version }`, `list()` en `versions(id)`. Versies mogen een
 *     getal zijn. `superCloudHost.ts` zet deze vorm om naar de `storage`-vorm; de rest van de tool
 *     kent alleen die. Verschillen in gedrag:
 *      - `readOnly: true` bij `open`: de tool opent het bestand zonder opslagdoel en meldt dat Opslaan
 *        een nieuw bestand maakt (een `storage`-host mag `readOnly` ook meegeven).
 *      - Een conflict geeft een KOPIE: `save` met `id` geeft een ander `id` terug. De tool maakt die
 *        kopie het opslagdoel, telt het document als opgeslagen en meldt de naam van de kopie. Bij de
 *        `storage`-vorm blijft een ander `id` een fout.
 *      - De fout `code: 'VERSION_CONFLICT'` telt als `'conflict'`. De fout `soort_niet_toegestaan`
 *        (Opslaan als met een vreemd formaat) toont de tool met de tekst van de host.
 *     `initialFileId` en het event `openaec-host-ready` werken voor beide vormen gelijk.
 *
 * ## Ingebed starten: geen welkomstvenster, de taal van de host
 *
 * Staat er een host (elk object op `window.openaecHost`, ook zonder `storage`), of is dit de
 * platformbouw, dan draait de tool ingebed (issue #716). Hij toont dan bij de start geen
 * welkomstvenster, en dus ook geen taalvraag en geen rondleiding (die opent alleen vanuit dat venster).
 * De handmatige ingangen (lint, backstage, de taalkeuze in de instellingen) blijven werken. Het oude
 * veld `skipWelcome` (#583) is daarom niet meer nodig; een host die het zet, werkt gewoon. Zonder
 * `localStorage` slaat de tool het venster ook buiten een host over (#706): hij kan niet onthouden dat
 * het gezien is.
 *
 * De taal komt ingebed van de host, in deze volgorde: `taal` op de host (bijv. `'nl'`, `'de'`), dan de
 * `lang` van een same-origin parentpagina (`<html lang="nl">`), dan `taal=` in de hash van de url
 * (`#taal=nl`). De eerste taal die de tool kent, wint, ook boven een eerder bewaarde keuze; een
 * regiocode valt terug op de taal (`de-AT` wordt `de`). Kent de tool geen enkele, dan kiest hij zoals
 * buiten een host (bewaarde keuze, dan de browsertaal). De tool bewaart de taal van de host niet.
 *
 * Zet de host vóór de tool start. De tool kiest de taal vóór de eerste weergave, en kijkt voor het
 * welkomstvenster bij de start en nog eens vlak voordat het zou openen (na de herstelvraag). Een
 * venster dat al open staat, sluit een latere host niet.
 *
 * ## Taal en thema tijdens de sessie, en instellingen (#818)
 *
 * Sinds #818 volgt de tool de host ook ná de start (dit vervangt "een latere host verandert de taal
 * niet" uit #716):
 *
 * - `thema` (`'light'` of `'dark'`): de tool start in dat thema, als sessiethema (niet in
 *   `ops-theme`). Het pre-paint-script `public/theme-prepaint.js` leest het al vóór de eerste paint.
 * - Het event `openaec-host-preferences` (`SITE_HOST_PREFERENCES_EVENT`, op hetzelfde venster als
 *   `openaec-host-ready`) meldt dat `taal` of `thema` op hetzelfde object veranderde. De tool neemt
 *   dan over wat veranderde, zonder het te bewaren. Een keuze die de gebruiker in de app maakte,
 *   blijft staan tot de host die waarde zelf wijzigt.
 * - Komt de host pas later (`openaec-host-ready`), dan neemt de tool zijn taal en thema alsnog over,
 *   maar niet zijn instellingen.
 * - `settings` (`get`, `set`, `delete`): de tool bewaart daar zijn blijvende `ops-`-instellingen, één
 *   hostsleutel per `ops-`-sleutel. Hij leest ze ALLEEN bij de start, vóór de app laadt: de start wacht
 *   daarop, hoogstens 5 s (`HYDRATE_TIMEOUT_MS`). Op tijd: elke wijziging gaat daarna gebundeld naar de
 *   host. Te laat, een fout, of een host die pas na de start kwam: de sessie draait zonder de
 *   instellingen van de host, schrijft niets naar de host (ook niet na een laat antwoord) en meldt dat
 *   één keer. Details in `siteHostSettings.ts`.
 *
 * Code: `siteHostPreferences.ts` (lezen), `siteHostSettings.ts` (instellingen) en
 * `src/hooks/useSiteHostPreferences.ts` (de luisteraars).
 *
 * ## De vier functies (de `storage`-vorm)
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
 *  - `'conflict'` bij `save`: zie hierboven (bij de SuperCloud-vorm ook `'VERSION_CONFLICT'`).
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

import { PLATFORM_BUILD } from '@/utils/buildFlags';
import { isSuperCloudHost, superCloudStorage, type HostVersion } from './superCloudHost';

/** Een bestand in de SuperCloud-vorm (#818): de versie mag een getal zijn. */
export interface HostFileRef { id: string; name: string; version: HostVersion }

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
  /** `readOnly: true` (optioneel): de site staat geen nieuwe versie toe; de tool opent het bestand dan
   *  zonder opslagdoel (#818). */
  open(id: string, version?: string): Promise<{ file: SiteFileInfo; data: Blob | ArrayBuffer | Uint8Array | string; readOnly?: boolean }>;
  save(request: { id?: string; name: string; data: Blob; baseVersion?: string }): Promise<SiteFileInfo>;
  versions(id: string): Promise<SiteVersionInfo[]>;
}

/** De instellingenopslag die de site kan aanbieden (#818): per sleutel een waarde. De tool bewaart er
 *  tekst onder de naam van zijn `ops-`-sleutels; zie `siteHostSettings.ts`. */
export interface SiteHostSettings {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

/** Wat de site op `window.openaecHost` zet. */
export interface OpenAECHost {
  /** De `storage`-vorm. Staat hij er (geldig), dan wint hij boven de functies hieronder. */
  storage?: SiteStorage;
  /** De SuperCloud-vorm (#818): de functies direct op de host. Zie `superCloudHost.ts`. Alleen als
   *  alle vier er zijn, telt de host als opslag. */
  open?: (id: string, version?: HostVersion) => Promise<HostFileRef & { readOnly: boolean; bytes: ArrayBuffer | Uint8Array }>;
  save?: (bytes: Uint8Array, options: { id?: string; name?: string; expectedVersion?: HostVersion }) => Promise<HostFileRef>;
  list?: () => Promise<{ id: string; name: string; modified: string }[]>;
  versions?: (id: string) => Promise<{ version: HostVersion; modified: string; author?: string }[]>;
  /** Open dit bestand (nieuwste versie) bij de start, als de tool nog een leeg document heeft. */
  initialFileId?: string;
  /** De taal van de site (bijv. `'nl'`); de tool start in die taal als hij hem kent (#716). */
  taal?: string;
  /** Het thema van de site: `'light'` of `'dark'` (#818). De tool start erin en volgt een wijziging
   *  (`openaec-host-preferences`), zonder het te bewaren. Zie `siteHostPreferences.ts`. */
  thema?: string;
  /** Opslag voor de instellingen van de tool, als de browser zelf niets bewaart (#818). Zie
   *  `siteHostSettings.ts`. */
  settings?: SiteHostSettings;
  /** Niet meer nodig (#716): elke host slaat het welkomstvenster al over. Blijft geldig. */
  skipWelcome?: boolean;
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

/** De kandidaat-hosts in volgorde: eerst het eigen venster, dan de parent (alleen in een iframe).
 *  Geëxporteerd voor `siteHostPreferences.ts` (thema en instellingen, #818). */
export function candidateHosts(): Record<string, unknown>[] {
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
 * De opslag van één host: `host.storage` als die geldig is, anders de adapter voor de SuperCloud-vorm
 * als de host zelf de vier functies heeft (#818), anders `null`.
 */
function storageOf(host: Record<string, unknown>): SiteStorage | null {
  if (isSiteStorage(host.storage)) return host.storage;
  if (isSuperCloudHost(host)) return superCloudStorage(host);
  return null;
}

/**
 * De opslag van de site, of `null` als er geen (geldige) is. Kijkt op het moment van aanroepen —
 * een site mag de host dus ook later zetten. Een host zonder vier functies (onder `storage` of op de
 * host zelf) telt als "geen site".
 */
export function getSiteStorage(): SiteStorage | null {
  for (const host of candidateHosts()) {
    const storage = storageOf(host);
    if (storage) return storage;
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
    if (!isSiteStorage(host.storage) && !isSuperCloudHost(host)) continue;
    const id = host.initialFileId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }
  return null;
}

/**
 * Draait de tool ingebed (#716): de platformbouw, of een host op `window.openaecHost` (eigen venster
 * of same-origin parent, ook zonder opslag). Kijkt op het moment van aanroepen. Desktop nooit.
 */
export function runsEmbedded(): boolean {
  return PLATFORM_BUILD || candidateHosts().length > 0;
}

/**
 * De taalcodes die de host doorgeeft (#716), in volgorde: `taal` op de host, de `lang` van een
 * same-origin parentpagina, `taal=` in de hash van de url. Ruwe tekst; de i18n-laag kiest de eerste
 * die hij kent. Alleen zinvol als `runsEmbedded()`.
 */
export function siteLanguageHints(): string[] {
  if (typeof window === 'undefined') return [];
  const hints: string[] = [];
  for (const host of candidateHosts()) {
    if (typeof host.taal === 'string') hints.push(host.taal);
  }
  const lang = readSafely(() => {
    const p = window.parent;
    return p && p !== window ? p.document.documentElement.lang : undefined;
  });
  if (lang) hints.push(lang);
  const hash = readSafely(() => /(?:^#|[?&])taal=([^&]*)/.exec(window.location.hash)?.[1]);
  if (hash) hints.push(readSafely(() => decodeURIComponent(hash)) ?? hash);
  return hints;
}

/** Een cross-origin parent gooit al bij het lezen (`SecurityError`); dat telt als "niets". */
function readSafely(read: () => string | undefined): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
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
