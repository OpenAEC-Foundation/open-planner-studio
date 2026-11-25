# Een splitgat draagt zijn herkomst, en die bepaalt wie het mag veranderen

Een gat in `splitGaps` (`TaskSplitGap`) komt uit een import, van de nivelleerder of van de planner. Wie het mag
verschuiven of wissen, verschilt per herkomst, dus draagt elk gat die in `source`. Zonder `source` is het brondata uit
een import, bijvoorbeeld uit een `.mpp` (`deriveSplitGapsForTasks`). `'leveling'` is een pauze die de nivelleerder
invoegde. `'user'` is een gat dat de planner maakte of bewerkte. Het gat staat op de werkminuten-as van de taak, die
gaten meetelt, niet op de as van de zuivere werkduur (ADR 0002, ADR 0015).

## Gevolgen

- Nivelleergaten schrijft een nieuwe nivellering opnieuw (`writeLevelingResult`, ADR 0165). Ze vallen weg bij
  nivellering wissen (`clearLevelingOutput`) en bij een bewerking die de tijdbasis verzet (ADR 0213), beide via
  `clearLevelingGaps`; die functie laat gaten zonder `source` en met `'user'` staan.
- Bewerkt de planner de onderbrekingen, dan maakt `applyTaskSplits` (`splitMutations.ts`) de nivelleergaten die na
  de bewerking overblijven tot gebruikersgaten (`adoptLevelingGaps` in `splitEdit.ts`); verwijdert de planner alle
  onderbrekingen, dan is de gatenlijst leeg. De store-actie `setTaskSplits` (`taskSlice.ts`)
  en de MCP-transactie roepen die functie aan.
- Een importgat houdt bij zo'n bewerking niet altijd zijn plek. Verandert de planner het werkstuk vóór een importgat
  (`setWorkLength` in `splitEdit.ts`), dan rekent `fromSplitPieces` de offset van dat gat opnieuw uit en blijft
  `source` leeg. Een importgat krijgt `'user'` pas bij een directe wijziging van zijn pauzeduur (`setGapLength`).
- Een gat behouden is iets anders dan zijn oorspronkelijke plek herstellen. `clearLevelingGaps` haalt alleen de
  nivelleergaten weg en zet de andere niet terug. Verschoof een nivelleerpauze een later importgat (`scatterSlot` in
  `ResourceLeveler.ts`), dan blijft dat gat na het wissen op de latere plek staan (knownbug 2321).
- De nivelleerder knipt een taak met een gebruikersgat niet verder op; een importgat houdt dat niet tegen (ADR 0165).
- Bij een duurwijziging met contour herschaalt `rescaleSplitGaps` de importgaten en de gebruikersgaten, niet de
  nivelleergaten (ADR 0003). Een gebruikersgat rondt het daarbij af op de eenheid van `splitUnitMinutes`: een uur bij
  een taak in de urenmaat, anders een hele werkdag. Herschaalt er niets en krimpt het werk, dan vervalt een
  gebruikersgat op of voorbij het nieuwe werktotaal (`clipUserGapsToWork`, ADR 0214).
- `moveProject.ts` laat de gaten staan: ze zijn offsets op de as en schuiven met de taak mee.
