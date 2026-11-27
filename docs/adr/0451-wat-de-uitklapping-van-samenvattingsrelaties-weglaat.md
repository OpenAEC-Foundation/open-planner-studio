# Wat de uitklapping van samenvattingsrelaties weglaat

`expandSummaryRelations` (ADR 0450) laat een relatie met een samenvattingskant in drie gevallen in haar geheel weg
en zet haar oorspronkelijke id in `droppedSequenceIds`. Het eerste: een kant heeft geen bladtaken, omdat de
samenvatting leeg is of haar `childIds` alleen naar onbekende taken of in een kring wijzen. Het tweede: de twee
kanten delen een bladtaak. Dat vangt een relatie tussen een taak en haar eigen (voor)ouder, in beide richtingen, en
een samenvatting op zichzelf. Uitschrijven zou een blad dan voorganger van zichzelf maken, of bij twee gedeelde
bladen beide richtingen geven (K1 naar K2 en K2 naar K1). Met zo'n kring geeft de solver een fout en schrijft
`solveProject` voor het hele project geen datums terug (ADR 0010). Deze toets staat daarom vóór die op het plafond en
geldt ook als het plafond al op is. Het derde: het plafond (ADR 0452).

Een relatie tussen twee bladtaken, en een relatie waarvan voorganger of opvolger niet in de takenlijst staat, gaan
ongewijzigd door. Die tweede laat de constructor van `CPMSolver` vallen, met een eigen waarschuwing (ADR 0010).

## Gevolgen

- `solveProject` voegt de weggelaten ids samen met die van de solver in `CPMResult.droppedSequenceIds`, zonder
  dubbele ids. Daaruit lezen het waarschuwingenpaneel (`collectScheduleWarnings`, soort `droppedSequence`) en het
  Relaties-paneel (`relationIndex.ts`). Na het openen van een bestand telt `fileSlice.ts` ze voor de melding
  `notifications.summaryRelationsDropped`. De eindcontrole van het taakraster (`validateFinalRelationGraph` in
  `relationPlan.ts`, voor relatiecellen en plakken) vergelijkt de weggelaten ids vóór en na de bewerking en weigert
  een bewerking die er een nieuwe bij maakt (`unrepresentableSummaryRelation`). De XER-export leest ze niet (knownbug
  2489).
- `leafDescendantsOf` slaat een onbekend kind-id en een al bezochte taak over. Een tak met daarnaast echte bladen
  geeft die bladen gewoon; alleen een tak zonder bladen valt weg. `check-summary-relation-expansion.ts` toetst de
  lege tak, een samenvatting die zichzelf als kind heeft en twee samenvattingen die elkaars kind zijn.
- Dezelfde toets dekt de drie vormen van de relatie met een eigen (voor)ouder, ook samen met een gewone relatie in
  één aanroep en daarna door `CPMSolver.solve()` zonder fout; het geval `wbs-summary-relation-ancestor-guard-01` in
  `cases-edge.json` doet dat door de store. De app weigert zo'n relatie al bij het aanleggen (gids
  `howto-relaties-leggen`); de toets hier vangt wat een bestand of een latere verhanging aanlevert. Het weggehaalde
  commentaar zei dat MS Project zo'n relatie ook niet toestaat; dat is niet nagegaan.
