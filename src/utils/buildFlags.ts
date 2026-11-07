// Bouwvlaggen (issue #307): één bron voor de verschillen tussen de gewone bouw en de platformbouw.
//
// De platformbouw (`npm run build:platform`, Vite-modus `platform`, zie `.env.platform`) is de bundel
// die de OpenAEC-app op Frappe als statische bestanden onder een subpad serveert. Alle tools delen
// daar één origin met de ingelogde gebruiker van de site. Wat op die gedeelde origin niet veilig of
// niet zinvol is, staat hier uit.
//
// Bewust CONSTANTEN en geen functies: Vite vervangt `import.meta.env.VITE_OPS_PLATFORM` bij het bouwen
// door een letterlijke waarde, zodat de bundelaar de uitgeschakelde takken (en de modules die alleen
// daar gebruikt worden) wegsnoeit. De `?.` houdt dit bestand importeerbaar in de headless testbundels
// (esbuild op Node), waar `import.meta.env` alleen via losse defines bestaat; daar is de vlag uit.

/** De platformbouw voor de OpenAEC-app (Frappe). Bron: `VITE_OPS_PLATFORM=1` in `.env.platform`. */
export const PLATFORM_BUILD: boolean = import.meta.env?.VITE_OPS_PLATFORM === '1';

/** Extensies (catalogus, installatie, ribbongroepen, importers, tutorialaanbod). Uit in de
 *  platformbouw (#311): een extensie draait zonder afscherming in de context van de ingelogde
 *  gebruiker van de site (zie `extensions/consent.ts`). */
export const EXTENSIONS_ENABLED: boolean = !PLATFORM_BUILD;

/** De live browserbouw opent bij de start een voorbeeldplanning (#276). Uit in de platformbouw
 *  (#310): daar start de tool met een leeg document. */
export const DEMO_START_EXAMPLE: boolean = !PLATFORM_BUILD;

/** AI-modus (MCP-koppeling, AI-tabblad, bridge-token). Uit in de platformbouw (#307): de koppeling
 *  werkt alleen in Tauri, en het token zou in localStorage staan, leesbaar voor elke tool op
 *  dezelfde origin. */
export const AI_MODE_AVAILABLE: boolean = !PLATFORM_BUILD;

/** Downloadcijfers in Instellingen → Geavanceerd (`DownloadStatsSection`). Uit in de platformbouw (#818): de
 *  cijfers komen van raw.githubusercontent.com, en de werkplek van de SuperCloud laat geen netwerk buiten de
 *  bundel toe (CSP). */
export const DOWNLOAD_STATS_AVAILABLE: boolean = !PLATFORM_BUILD;

/** Feedbackknop in de titelbalk, de feedbackdialoog en stap 7 van de rondleiding (die naar de knop
 *  wijst). Uit in de platformbouw (#818): de werkplek van de SuperCloud heeft een eigen feedbackknop. De
 *  dialoog post naar een externe dienst en opent een venster; CSP en sandbox van de werkplek blokkeren
 *  beide. */
export const FEEDBACK_AVAILABLE: boolean = !PLATFORM_BUILD;

/** Updates en releasegegevens: "Controleren op updates", "Wat is er nieuw", de updatedialoog en de
 *  dialoog "Net bijgewerkt". Uit in de platformbouw (#818): het contract vraagt een bundel zonder
 *  update-check. De site levert de versie; releasegegevens komen van GitHub, en de werkplek laat geen
 *  netwerk buiten de bundel toe. */
export const UPDATES_AVAILABLE: boolean = !PLATFORM_BUILD;
