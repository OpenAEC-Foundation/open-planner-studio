// Publieke typen van de headless kern (`@openaec/open-planner-core`).
//
// Dit bestand importeert BEWUST niets: de gegenereerde typedeclaraties van het pakket bestaan uit
// precies dit bestand en `index.ts`, en mogen niet naar interne app-typen wijzen. Een wijziging
// hier is een wijziging van het publieke contract — zie docs/headless-kern.md (versiemodel).

/** Vaste foutcodes. Een nieuwe code is een minor-wijziging van het contract; een bestaande code
 *  verandert nooit van betekenis. */
export type CoreErrorCode =
  /** De invoer is geen tekst, is leeg, of is geen ISO-10303-21 (STEP/IFC) bestand. */
  | 'INVALID_INPUT'
  /** De IFC-lezer kon het bestand niet lezen of openen. */
  | 'IFC_READ_FAILED'
  /** Het bestand bevat geen taken; er valt niets te plannen. */
  | 'NO_TASKS'
  /** De planning kan niet worden doorgerekend (bijv. een kring in de relaties, of een kalender
   *  zonder werkdagen). `details.reason` bevat de solvertekst, `details.taskIds` de kring. */
  | 'SCHEDULE_FAILED'
  /** Het terugschrijven naar IFC mislukte. */
  | 'IFC_WRITE_FAILED';

/** Eén waarschuwing van de berekening. De planning is wel doorgerekend. */
export interface ScheduleWarning {
  code:
    /** Een late-zijde-constraint wordt door de logica overschreden (negatieve speling). */
    | 'CONSTRAINT_VIOLATED'
    /** De vroege einddatum valt na de deadline. */
    | 'DEADLINE_MISSED'
    /** Voortgang die de relatielogica tegenspreekt (out-of-sequence). */
    | 'OUT_OF_SEQUENCE'
    /** Een kalender maakt het taakvenster onwerkbaar; de datum is afgekapt. */
    | 'CALENDAR_CAPPED'
    /** Een relatie wees naar een onbekende taak en is genegeerd. */
    | 'RELATION_IGNORED'
    /** Een hamertaak zonder finish-driver; de duur valt terug op nul. */
    | 'HAMMOCK_WITHOUT_FINISH_DRIVER'
    /** Het bestand had een P6-bronarchief (XER) dat niet bruikbaar is. Het is bij het openen
     *  weggelaten; `toIfc()` schrijft het niet meer mee. `detail` is de reden
     *  (`schema-version`, `hash-mismatch`, `truncated`, `bytes-missing`, `metadata-invalid`,
     *  `structure`). `ids` is leeg. */
    | 'XER_ARCHIVE_DROPPED'
    /** De datums in het bestand zijn niet in minuten berekend (een IFC van een oudere versie van de
     *  app). Het openen rekende het project om, net als de app, en daarbij kregen deze taken een
     *  ander begin of einde. `ids` zijn die taken; `maxShiftWorkdays` is de grootste verschuiving.
     *  `toIfc()` schrijft de nieuwe datums. */
    | 'MINUTE_MODEL_CONVERTED';
  /** Taak-id's (of relatie-id's bij `OUT_OF_SEQUENCE`/`RELATION_IGNORED`) waar het om gaat. */
  ids: string[];
  /** Een korte vaste reden, alleen bij codes die er een hebben. */
  detail?: string;
  /** Alleen bij `MINUTE_MODEL_CONVERTED`: de grootste verschuiving in werkdagen, op één decimaal. */
  maxShiftWorkdays?: number;
}

/** Eén taak in de samenvatting. Datums zijn ISO-8601-tekst zoals de app ze bewaart (datum of
 *  datum+tijd); speling staat in werkdagen (fractioneel bij urenplanning). */
export interface ScheduleTaskSummary {
  id: string;
  name: string;
  wbs: string;
  /** Id van de WBS-ouder, `null` op het hoogste niveau. */
  parentId: string | null;
  /** `true` voor een samenvattingstaak (heeft kindtaken). */
  summary: boolean;
  milestone: boolean;
  start: string;
  finish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  critical: boolean;
}

/** De JSON-samenvatting van één doorgerekend project. Alleen gewone JSON-waarden. */
export interface ScheduleSummary {
  /** Versie van dit samenvattingsformaat. Verandert alleen bij een brekende wijziging. */
  formatVersion: 1;
  project: {
    id: string;
    name: string;
    /** Het rekenprofiel van het project (bijv. `ops`, `p6`, `msp`). */
    schedulingProfile: string;
    /** De projectstart zoals in het bestand vastgelegd. */
    start: string;
    /** De berekende einddatum van het project. */
    finish: string;
    /** Projectduur in werkdagen. */
    durationWorkdays: number;
  };
  counts: {
    tasks: number;
    summaryTasks: number;
    milestones: number;
    relations: number;
    resources: number;
    assignments: number;
    criticalTasks: number;
  };
  /** Alle taken, in de volgorde van het bestand. */
  tasks: ScheduleTaskSummary[];
  /** Id's van de taken op het kritieke pad, in padvolgorde. */
  criticalPath: string[];
  warnings: ScheduleWarning[];
}

/** Eén geopend document. Elk document heeft een eigen, losse rekencontext; documenten delen niets. */
export interface PlannerDocument {
  /** De waarschuwingen van het openen (`XER_ARCHIVE_DROPPED`, `MINUTE_MODEL_CONVERTED`), direct na
   *  `openIfc()`, dus ook vóór `toIfc()` zonder `schedule()`. Elke samenvatting van `schedule()`
   *  bevat ze ook. Leeg als het openen niets te melden had. */
  readonly openWarnings: ScheduleWarning[];
  /** Reken het project door zoals de knop Berekenen (F5) in de app doet, en geef de samenvatting.
   *  Het document is bij het openen al eens doorgerekend, zoals in de app; `schedule()` rekent
   *  opnieuw en verlaat een eventuele stand "datums zoals opgeslagen".
   *  Gooit `PlannerCoreError` met code `SCHEDULE_FAILED` als de planning niet te berekenen is. */
  schedule(): ScheduleSummary;
  /** Schrijf het document als IFC-tekst, in het IFC-schema van het project. Na `schedule()` bevat
   *  de tekst de berekende datums; zonder `schedule()` de stand zoals de app hem na openen heeft.
   *  Gooit `PlannerCoreError` met code `IFC_WRITE_FAILED`. */
  toIfc(): string;
}
