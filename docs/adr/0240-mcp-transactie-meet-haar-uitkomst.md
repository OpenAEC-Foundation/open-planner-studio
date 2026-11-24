# Een MCP-transactie beslist op haar uitkomst en draait als geheel terug

Elke wijzigende `planner_*`-tool en elke `planner_batch` loopt door `run` in `createMcpTransactions.ts`: één
momentopname vooraf, de callback, één eindberekening en één undo-stap (`docs/mcp-verificatie.md`). Of er iets
veranderd is, meet `run` zelf na de callback en vóór de eindberekening, met `documentDataChanged` op twee
momentopnamen. Die meting staat in `run` en niet in de draftprimitieven, omdat ook toolcode buiten de draft schrijft:
het voortgangsblok van `planner_update_tasks` (`taskTools.ts`) muteert met een eigen `store.setState` zonder
`markDocumentEdited`. Dezelfde meting beslist over de eindberekening en over de undo-stap. `runCPM` alleen is
nooit een wijziging.

## Gevolgen

- Zonder datawijziging zet `run` het document terug op de stand van vóór de callback (`restoreDocument`: de
  momentopname, `viewRows`, `resourceLoadResult`, `isDirty` en `importPristine`) en maakt het geen undo-stap. Een
  nieuwe stap zou de redo van dat document wissen (`appendSessionHistoryEvent`). De sessiegeschiedenis en de
  meldingen houdt `run` dan zoals ze zijn. Toets: `tests/mcp/cases-undo-noop.ts`.
- De eindberekening (`runCPM({ withinEvent: true })`, `recomputeViewRows`, `recomputeResourceLoad`) draait binnen
  de lease. Daar doet `beginUndoable` niets, dus maakt ook het verlaten van *datums zoals opgeslagen* in `runCPM`
  geen tweede undo-stap. Met `keepsRecordedDates(context)` draait de eindberekening niet.
- Een fout in de callback, een callback die een thenable teruggeeft en een `cpmResult.error` na de eindberekening
  draaien alles terug (`rollback`), ook de sessiegeschiedenis. `rollback` zet ook `importPristine` terug: een
  geweigerde AI-actie is geen bewerking (`cases-recorded-dates.ts`, de mislukte transactie). En het zet
  `ui.notifications` terug op de referentie van vóór de callback: `runCPM` meldt een solverfout zelf
  (`scheduleFailedNotice`), en die melding hoort bij de teruggedraaide poging. Meldingen zijn app-globaal en staan
  niet in de documentmomentopname. Omdat `run` synchroon is, komt er in dat venster geen melding van buiten de
  callback tussen. Toets: `cases-transaction.ts`, het geval met `cpmResult.error` na de eind-runCPM.
- De lease (`runtime.enterMcpTransaction`) wordt vóór de momentopname genomen, buiten de `try`. Een geneste `run`,
  ook van een tweede factory op dezelfde context, krijgt zijn weigering dus niet in een eigen `{ ok: false }`, maar
  als throw in de buitenste callback, die daardoor helemaal terugdraait. De `finally` sluit alleen de lease die deze
  aanroep nam. Toetsen: `cases-transaction.ts`, de gevallen met een nested run en een tweede factory.
- De meldingen over verloren MS Project-sturing en over herschreven restwerk komen hoogstens één keer per
  geslaagde transactie met een datawijziging, na de eindberekening, uit wat de lease verzamelde. Het antwoord noemt ze ook
  (`timephasedGuidanceLost`, `remainingWorkRecomputed`).
