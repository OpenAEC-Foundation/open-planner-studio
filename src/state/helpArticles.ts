// Alle Help-artikel-id's die de app zelf gebruikt ("Lees meer" in meldingen, markeringen in het
// eigenschappenpaneel, ?-knoppen in dialogen, de MCP-gids). Eén plek, zodat een hernoeming niet
// meer stil breekt (ontwerp gebruikersdocumentatie §8.2): `npm run verify:docs` (poort 10) leest
// ELKE stringexport van dit bestand en eist dat het id in `public/docs/manifest.json` bestaat — als
// artikel of als alias — en in productie zichtbaar is (geen draft). Een id mag een `#anker` dragen
// (een kop in dat artikel, in de GitHub-vorm; zie `headingSlug` in `utils/helpManifest.ts`).
//
// Regels: alleen `export const X = '<id>'` in dit bestand (geen andere exports, geen logica), zodat
// het een blad blijft dat elke laag mag importeren (store, componenten, MCP). Wordt een artikel
// hernoemd, zet dan in het manifest een alias van het oude naar het nieuwe id; uitgeleverde versies
// linken nog naar het oude.
//
// Sinds fase 4 (omschakelen) wijzen deze constanten naar de nieuwe artikelen. De id's van vóór fase 4
// (`gids-taaktypes`, `gids-xer-import`, …) staan als alias in het manifest: uitgeleverde versies
// sturen hun meldingen nog daarheen.
//
// Niet hier: de `docsId`'s in `src/services/updater/releaseHighlights.ts`. Die horen bij een
// uitgebrachte versie en blijven letterlijk staan; poort 10 controleert ze apart.

/** Werkregels (taaktypes): melding bij openen en de detailregel in de bestandsmelding. */
export const TASK_TYPES_HELP_ARTICLE_ID = 'uitleg-werkregels';

/** Rekenprofielen: de melding "dit project rekent als …" bij openen. */
export const SCHEDULING_PROFILE_HELP_ARTICLE_ID = 'uitleg-rekenprofielen';

/** Constraints: een nieuwe start die een SNET werd of door een andere constraint werd tegengehouden. */
export const CONSTRAINTS_HELP_ARTICLE_ID = 'uitleg-constraints';

/** Relaties op samenvattingstaken: relaties die de hiërarchie uitsluit van de berekening. */
export const HIERARCHY_RELATIONS_HELP_ARTICLE_ID = 'uitleg-relaties';

/** Baselines en voortgang: statusdatum op vandaag gezet bij voortgang invoeren. */
export const BASELINES_PROGRESS_HELP_ARTICLE_ID = 'uitleg-voortgang';

/** MS Project-import: tijdgefaseerde gegevens (contouren) die niet meekwamen. */
export const MPP_TIMEPHASED_HELP_ARTICLE_ID = 'howto-mpp-openen';

/** Primavera P6 (.xer): openen, exportverlies, onbruikbaar bronarchief. */
export const XER_IMPORT_HELP_ARTICLE_ID = 'howto-xer-openen';

/** "Datums zoals opgeslagen": melding bij openen en de markering in het eigenschappenpaneel. */
export const RECORDED_DATES_HELP_ARTICLE_ID = 'uitleg-datums-zoals-opgeslagen';

/** Het Help-artikel "Goed plannen" voor mensen. Id en pad zijn publiek (§8.3): uitgeleverde
 *  versies (hun MCP-instructie en `planner_get_planning_guide`) en eerder geïnstalleerde skills linken
 *  ernaar — nooit hernoemen. Agents krijgen sinds oktober 2026 de aparte agentgids
 *  `public/agent/planning-guide.md`; verify:docs (poort 11) houdt de principes van beide gelijk. */
export const PLANNING_GUIDE_ARTICLE_ID = 'gids-goed-plannen';

/** ?-knop in de sneltoetsendialoog (proefplek van de contextuele hulp). */
export const SHORTCUTS_HELP_ARTICLE_ID = 'ref-sneltoetsen';

// ── ?-knoppen in dialogen en panelen (ontwerp §8.1, fase 4) ─────────────────────────────────────────

/** Taak bewerken en het paneel Eigenschappen. */
export const TASK_PROPERTIES_HELP_ARTICLE_ID = 'ref-taak-eigenschappen';

/** De kalenderbibliotheek (Planning › Kalender › Kalender). */
export const CALENDARS_HELP_ARTICLE_ID = 'ref-kalenders';

/** De kalender van een resource. */
export const RESOURCE_CALENDAR_HELP_ARTICLE_ID = 'howto-resourcekalender-instellen';

/** Filter en layouts (Beeld › Layout). */
export const LAYOUTS_HELP_ARTICLE_ID = 'howto-layouts-gebruiken';

/** Codes & velden (activity codes en eigen velden). */
export const CODES_FIELDS_HELP_ARTICLE_ID = 'howto-codes-en-velden';

/** Baselines beheren. */
export const BASELINES_HELP_ARTICLE_ID = 'howto-baseline-opslaan-en-beheren';

/** De urenverdeling (contour) van een toewijzing. */
export const CONTOUR_HELP_ARTICLE_ID = 'howto-urenverdeling-aanpassen';

/** Externe relaties naar een ander project. */
export const EXTERNAL_LINKS_HELP_ARTICLE_ID = 'howto-externe-relaties';

/** Instellingen (en de downloadstatistieken daaronder). */
export const SETTINGS_HELP_ARTICLE_ID = 'ref-instellingen';

/** De app bijwerken (Software-update). */
export const UPDATE_HELP_ARTICLE_ID = 'howto-app-bijwerken';

/** De verbindingsgegevens van de AI-bridge. */
export const AI_CONNECTION_HELP_ARTICLE_ID = 'howto-ai-assistent-koppelen';

/** Het resourcepaneel. */
export const RESOURCE_PANEL_HELP_ARTICLE_ID = 'ref-resourcepaneel';

/** Het paneel Waarschuwingen. */
export const WARNINGS_HELP_ARTICLE_ID = 'ref-meldingen';

// ── ?-knoppen in zes vensters (besluit eigenaar na fase 4) ──────────────────────────────────────────

/** Projectinformatie (Instellingen › Project › Projectinfo): de referentie van het formulier. */
export const PROJECT_INFO_HELP_ARTICLE_ID = 'ref-projectinfo';

/** Project verplaatsen. */
export const MOVE_PROJECT_HELP_ARTICLE_ID = 'howto-project-verplaatsen';

/** Resources nivelleren: stap 3 van dit artikel loopt het venster door (het oude `ref-nivellering`
 *  is een alias hierheen). */
export const LEVELING_HELP_ARTICLE_ID = 'howto-overbezetting-oplossen';

/** Resourcebibliotheek koppelen (Herkennen en Afwijkingen). */
export const LIBRARY_LINK_HELP_ARTICLE_ID = 'howto-resourcebibliotheek-gebruiken';

/** Bibliotheek importeren (beheerscherm van de resourcebibliotheken). */
export const LIBRARY_IMPORT_HELP_ARTICLE_ID = 'howto-bibliotheken-beheren';

/** Voortgang bijwerken uit een blad. */
export const PROGRESS_IMPORT_HELP_ARTICLE_ID = 'howto-voortgang-importeren';

/** Niet-opgeslagen werk herstellen (na een crash). */
export const RECOVERY_HELP_ARTICLE_ID = 'howto-herstellen-na-een-crash';
