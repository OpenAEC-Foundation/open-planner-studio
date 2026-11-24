# Een leeg taakveld heeft een vaste betekenis, en een markering stuurt de berekening niet

Veel velden van `Task` zijn optioneel, ook omdat oudere bestanden ze niet dragen. Een lege waarde moet daarom overal
hetzelfde betekenen; leest de ene route leeg als "standaard" en de andere als "onbekend", dan rekent of toont de app
dezelfde taak verschillend. Deze betekenissen gelden; voor de precieze regel verwijst elke regel naar de functie of de
ADR die hem draagt.

- `calendarId` leeg, of een id dat niet in de kalenderbibliotheek staat: de taak rekent in de projectkalender
  (`resolveCalendar`). Die kalender telt de duur en de constraints van de taak.
- `constraint` leeg: ASAP (ADR 0302).
- `milestoneKind` leeg: de mijlpaal heeft geen vaste soort, en de relatie bepaalt welke kant een grens is (ADR 0014,
  ADR 0271).
- `workRule` leeg: de standaardregel van het project, en zonder die `FIXED_DURATION_RATE` (regel `taaktypes`).
- `mspTaskType` leeg: onbekend, niet Fixed Units (ADR 0303).
- `levelingDelay`, `levelingDelayMinutes` en `levelingDelayElapsed` leeg: geen nivelleervertraging; welke van de
  twee waarden wint, staat in ADR 0017. `leveledEarlyStart` telt de vertraging op bij de vroege start die de
  voorwaartse pass uit de voorgangers berekent, en die dragen hun eigen vertraging dan al; zo telt de vertraging van
  een voorganger niet twee keer.
- `customTaskTypeId` hoort bij `taskType` `USERDEFINED`. Een ouder IFC-bestand kan `USERDEFINED` dragen zonder eigen
  definitie; dan blijft het veld leeg.
- `isSummary` `true` houdt een taak zonder kinderen een samenvattingstaak (bijvoorbeeld een lege WBS-rij uit P6);
  een taak met kinderen is altijd een samenvattingstaak (`isSummaryTask` in `utils/taskHierarchy.ts`).

## Gevolgen

- `mandatory` is een markering voor de Gantt en de rapporten. De solver leest het niet; een datum bewaakt de
  planner met een constraint of een deadline.
- `priority` stuurt alleen de nivelleerder, van 0 tot en met 1000 met 500 als standaard voor een nieuwe taak
  (`buildNewTask`); 1000 pint de taak vast (ADR 0161).
- Een hammock is nooit kritiek (`scheduleAnalysis.ts`); haar afgeleide duur staat in ADR 0023.
- `notes` verandert via `updateTask` met `{ notes }`; er is geen eigen store-actie voor.
- Een externe koppeling rekent altijd op haar bevroren `anchorDate`, ook met `sourceMissing` (ADR 0022). De velden
  `sourceRef.siteFileId`, `sourceVersion` en `anchorReadAt` zijn herkomst van het anker; ze zijn optioneel, en hun
  betekenis, de randgevallen bij een oudere versie en het besluit van de eigenaar (keuze 4, 3 november 2026) staan in
  `docs/relaties-tussen-projecten.md`, §5.4.
