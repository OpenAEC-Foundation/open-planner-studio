/**
 * Toestemming bij het INSTALLEREN van een extensie (K-item 38, laatste deel).
 *
 * WAAR TOESTEMMING VOOR GEGEVEN WORDT — en waarvoor NIET. Extensie-code draait in dezelfde realm
 * als de app: `new Function(...)`, geen worker, geen iframe. Er valt dus niets af te bakenen. De
 * enige eerlijke vraag is de VERTROUWENSVRAAG: "ik weet dat ik code van deze auteur draai met
 * dezelfde rechten als de app zelf."
 *
 * Concreet, want vaag waarschuwen helpt niemand. `src-tauri/capabilities/default.json` verleent de
 * webview onder meer `fs:allow-home-read-recursive` en `fs:allow-home-write-recursive` — lezen én
 * schrijven in de hele thuismap — plus `shell:allow-open`, `dialog`, `store`, `os`, `updater`,
 * `process:allow-restart`/`exit` en het klembord. Dat alles zit achter `__TAURI_INTERNALS__`, dat
 * `executeExtensionCode` binnen de extensie-scope wel schaduwt maar niet weg kan nemen
 * (`globalThis.__TAURI_INTERNALS__` blijft bereikbaar). In de browserbuild is er geen Tauri, maar
 * blijven de projectdata in IndexedDB, de instellingen, de verleende bestands-handles en het
 * netwerk over.
 *
 * WAT DE MANIFEST-PERMISSIES HIER WÉL EN NIET ZIJN. `ribbon`/`events`/`backstage`/`pdf-fonts` zijn
 * poorten op de ONDERSTEUNDE API — nuttig om te tonen wat een extensie van plan is via de nette
 * route — maar ze beperken niet wat de code kán. Een dialoog die ze als afvinklijst presenteert
 * (Android-stijl) zou de situatie ERGER maken dan geen dialoog: hij leest als "de extensie is
 * hiertoe beperkt", en dat is aantoonbaar onwaar. Vandaar `ExtensionConsentRequest.declared`:
 * expliciet benoemd als declaratie/intentie, niet als grens.
 *
 * WAAROM BIJ INSTALLEREN EN NIET BIJ ELKE ACTIVERING. Installeren ís de vertrouwensbeslissing; bij
 * elke activering vragen leidt tot wegklikken en maakt de vraag betekenisloos.
 *
 * WAAROM INJECTEERBAAR. De vraag wordt standaard door een dialoog gesteld (`ExtensionConsentDialog`,
 * store-gedreven), maar de installatiedienst mag daar niet van afhangen: dan is geen enkel
 * installatiepad headless te draaien en kan een zelftest/dev-bridge niet meer installeren. Zelfde
 * patroon als de injecteerbare Tauri-randen in `services/mcp/`.
 */

/** Waar de te installeren extensie vandaan komt — bepaalt wat er over herkomst te zeggen valt. */
export type ConsentSource = 'catalog' | 'zip' | 'js';

/** Verificatiestand van de bytes die geïnstalleerd gaan worden. */
export type ConsentVerification =
  /** Catalogus-download, checksum uit de catalogus klopte. */
  | 'checksum'
  /** Catalogus-download zonder checksum in de entry — niet te verifiëren. */
  | 'unverified'
  /** Lokaal bestand dat de gebruiker zelf koos; er is geen externe bron om tegen te verifiëren. */
  | 'local';

export interface ExtensionConsentRequest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  /** De permissies uit het manifest. DECLARATIE, geen grens — zie de kop van deze module. */
  declared: string[];
  repository?: string;
  source: ConsentSource;
  verification: ConsentVerification;
  /** Draait de app als desktop-app? Bepaalt welke concrete gevolgen de dialoog noemt. */
  isDesktop: boolean;
}

export type ConsentAsker = (request: ExtensionConsentRequest) => Promise<boolean>;

/**
 * Terugval wanneer niemand een vrager heeft geïnstalleerd: WEIGEREN.
 *
 * Bewust niet "toestaan". Een ontbrekende vrager betekent dat de vraag niet gesteld kán worden, en
 * dan stilzwijgend installeren maakt de hele poort een decoratie — precies de faalstand die je niet
 * wilt bij de enige stap die om vertrouwen vraagt. `App.tsx` installeert de dialoog-vrager bij het
 * opstarten; headless code die bewust zonder dialoog wil installeren zet expliciet
 * `setConsentAsker(() => Promise.resolve(true))`.
 */
const weigerAlles: ConsentAsker = () => Promise.resolve(false);

let asker: ConsentAsker = weigerAlles;

/** Installeer de vrager (de dialoog, of een expliciete override in tests/zelftests). */
export function setConsentAsker(fn: ConsentAsker): void {
  asker = fn;
}

/** Zet terug op de weigerende terugval. */
export function resetConsentAsker(): void {
  asker = weigerAlles;
}

/**
 * Stel de vertrouwensvraag. `true` ⇒ installeren mag doorgaan.
 *
 * Gooit de vrager (dialoog kapot, component onverwacht ontkoppeld), dan telt dat als WEIGEREN: een
 * fout in de vraagstelling mag nooit in een stille installatie eindigen.
 */
export async function askExtensionConsent(request: ExtensionConsentRequest): Promise<boolean> {
  try {
    return await asker(request);
  } catch {
    return false;
  }
}
