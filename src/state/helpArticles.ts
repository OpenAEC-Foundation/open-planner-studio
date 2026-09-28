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
// Niet hier: de `docsId`'s in `src/services/updater/releaseHighlights.ts`. Die horen bij een
// uitgebrachte versie en blijven letterlijk staan; poort 10 controleert ze apart.

/** Werkregels (taaktypes): melding bij openen en de detailregel in de bestandsmelding. */
export const TASK_TYPES_HELP_ARTICLE_ID = 'gids-taaktypes';

/** Rekenprofielen: de melding "dit project rekent als …" bij openen. */
export const SCHEDULING_PROFILE_HELP_ARTICLE_ID = 'gids-rekenprofielen';

/** Relaties en constraints: startbewerking tegen een constraint, relaties uitgesloten door de hiërarchie. */
export const RELATIONS_CONSTRAINTS_HELP_ARTICLE_ID = 'gids-relaties-constraints';

/** Baselines en voortgang: statusdatum op vandaag gezet bij voortgang invoeren. */
export const BASELINES_PROGRESS_HELP_ARTICLE_ID = 'gids-baselines-voortgang';

/** MS Project-import: tijdgefaseerde gegevens (contouren) die niet meekwamen. */
export const MPP_TIMEPHASED_HELP_ARTICLE_ID = 'gids-msproject-import';

/** Primavera P6 (.xer): openen, exportverlies, onbruikbaar bronarchief. */
export const XER_IMPORT_HELP_ARTICLE_ID = 'gids-xer-import';

/** "Datums zoals opgeslagen": melding bij openen en de markering in het eigenschappenpaneel. */
export const RECORDED_DATES_HELP_ARTICLE_ID = 'datums-zoals-opgeslagen';

/** De planningsgids voor agents (MCP `planner_get_planning_guide`). Id en pad zijn publiek (§8.3):
 *  uitgeleverde versies en geïnstalleerde skills linken ernaar — nooit hernoemen. */
export const PLANNING_GUIDE_ARTICLE_ID = 'gids-goed-plannen';

/** ?-knop in de sneltoetsendialoog (proefplek van de contextuele hulp). */
export const SHORTCUTS_HELP_ARTICLE_ID = 'ref-sneltoetsen';
