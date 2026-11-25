# Een MCP-transactie beslist op haar uitkomst en draait bij een fout terug

Een tool die via `runMutateTool` (`services/mcp/tools/runtime.ts`) wijzigt, ook `planner_batch`, voert haar mutatie uit
in `run` van `createMcpTransactions.ts`. Andere routes lopen er niet door: `planner_undo` en `planner_redo` roepen de
store direct aan, en een handler die zonder transactie antwoordt (`okDirectGuarded`, ADR 0100) ook niet. `run` neemt
vooraf één momentopname en meet na de callback met `documentDataChanged` of de projectdata veranderden. Die meting
staat in `run` en niet in de draft, omdat ook toolcode buiten de draft schrijft: het voortgangsblok van
`planner_update_tasks` (`taskTools.ts`) schrijft rechtstreeks naar de store en roept zelf geen `markDocumentEdited`
aan, dus zonder de meting in `run` zou een aanroep met alleen voortgang niet als bewerking gelden en geen undo-stap
krijgen. Ze beslist over de eindberekening en over de undo-stap. Zonder datawijziging zet `run` het document terug en
maakt het geen undo-stap, want een nieuwe stap wist de redo van dat document (`appendSessionHistoryEvent`); de
sessiegeschiedenis en de meldingen laat het dan staan.

## Gevolgen

- De meting staat vóór de eindberekening, zodat die berekening op zich geen wijziging maakt. Toets:
  `cases-undo-noop.ts`, "no-op op een verouderde planning" (een verouderde planning, `planner_update_tasks` met de
  bestaande naam; de toets eist geen undo-stap, hetzelfde `cpmResult`-object en een ongewijzigde `scheduleStale`). Een
  berekening binnen de callback telt mee voor zover ze projectdata verandert, want de taken staan met hun berekende
  datums als `data` in de momentopname (`DOCUMENT_FIELDS`). Dat geldt ook voor `recomputeMidBatch` in `batchTool.ts`,
  dat binnen een batch na een mutatie rekent, onder meer vóór een leesstap. Een leestool binnen `run` rekent daarom
  niet zelf bij (`freshenScheduleForRead` met `isActive()`): `run` zou die berekening als datawijziging meten, met een
  undo-stap en `isDirty`.
- De eindberekening draait alleen bij een datawijziging en niet met `keepsRecordedDates(context)`. Ze draait binnen de
  lease, waar `beginUndoable` de undo-stap overslaat; zo maakt het verlaten van *datums zoals opgeslagen* in `runCPM`
  geen eigen stap.
- `rollback` (na een fout in de callback, een thenable als uitkomst of een `cpmResult.error` na de eindberekening) zet
  de momentopname, `viewRows`, `resourceLoadResult`, `isDirty`, `importPristine`, de sessiegeschiedenis en
  `ui.notifications` terug. De momentopname komt terug via `restoreSnapshot`, dat het IFC-schema en de open schemavraag
  van de live state houdt (`project.ifcSchema`, `ifcSchemaUnconfirmed`); `rollback` beëindigt ook het samenvoegen van
  undo-stappen (`resetUndoCoalescing`). Andere toestand buiten de momentopname zet het niet terug (knownbug 2008 en
  2009). `importPristine`, omdat een geweigerde AI-actie geen bewerking is: `cases-recorded-dates.ts`, "mislukte
  MCP-transactie herstelt …" (een verse import in *datums zoals opgeslagen*, een callback die een taak toevoegt en dan
  gooit; de toets eist modus, vlag en `isDirty` van vóór de aanroep). De meldingen, omdat `runCPM` een solverfout zelf
  meldt (`scheduleFailedNotice`) en die melding bij de teruggedraaide poging hoort; omdat `run` synchroon is, komt er
  in die tijd geen melding van buiten de callback bij. Toets: `cases-transaction.ts`, "cpmResult.error na de
  eind-runCPM …" (een callback die een taak toevoegt en een kring in de relaties maakt; de toets eist de momentopname
  en de meldingen van vóór de aanroep).
- Wat vóór `run` gebeurt, valt buiten de momentopname en wordt niet teruggedraaid. `planner_batch` met een lees- of
  nivelleerstap kan een verouderde planning doorrekenen in `beforeTransaction` (`batchTool.ts`, aangeroepen door
  `runMutateTool` vóór `run`), omdat een berekening binnen `run` als datawijziging zou tellen. Na een teruggedraaide
  batch blijft die berekening staan: de mutaties van de batch zijn weg, de berekende datums kunnen anders zijn dan vóór
  de aanroep.
- De lease (`runtime.enterMcpTransaction`) geldt per storecontext en wordt vóór de momentopname genomen, buiten de
  `try`. Een tweede `run` op dezelfde context binnen een lopende `run` gooit daardoor in de buitenste callback; laat
  die callback de fout door, dan draait de buitenste `run` terug. Een `run` op een andere context mag. Toets:
  `cases-transaction.ts`, "nested run op hetzelfde factoryobject …" (een buitenste `run` op context B voegt een taak
  toe en start een tweede `run` op B; de toets eist een fout met "re-entrant" en de momentopname en de undo-stapels van
  vóór de aanroep).
- De meldingen over verloren MS Project-sturing en over herschreven restwerk komen hoogstens één keer per geslaagde
  `run` met een datawijziging, na de eindberekening.
