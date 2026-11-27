# Het documentregister: het actieve document zonder payload en een eerste id per context

Het actieve document leeft op het hoogste niveau van de store, de andere geopende documenten liggen als
`DocumentPayload` in het register `documents` (regel `state`, *Multi-document is single-active*; ADR 0430). In dat
register heeft het actieve document `payload: null`: zijn data staat op het hoogste niveau, en een tweede kopie in het
register zou bij de eerste bewerking verouderen. Wie alle documenten nodig heeft, leest het actieve document van het
hoogste niveau en de rest uit het register, zoals `getOpenDocuments`, `getOpenDocumentPayloads` (met `capturePayload`
voor het actieve document) en `openProjectNames` doen.

## Gevolgen

- Het id van het eerste document komt uit `initialDocumentRegistry`, één aanroep per slice-instantie, en niet uit een
  constante op moduleniveau. Met één id per module zou elke context uit `createAppStoreContext()`, ook een wegwerpcontext
  uit `state/runtime/scratchDocument.ts`, met hetzelfde `activeDocumentId` beginnen als het eerste document van de
  gemounte app. De registraties per document-id in `state/timephasedLossNotice.ts` (`notifiedDocIds`,
  `notifiedLevelingDelayDocIds`) zijn module-state en gelden over contexten heen, zodat een melding in een
  wegwerpcontext die van het echte eerste document kon opeisen. Krijgt `runInScratchDocument` een `docId` mee, dan zet
  hij in zijn context daarnaast dat id als enig document.
- Wat per tabblad leeft maar geen documentdata is, staat op `DocumentEntry` en niet in `DOCUMENT_FIELDS`: ADR 0471.
