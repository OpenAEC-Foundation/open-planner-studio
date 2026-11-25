# Het documentcontract: één lijst en twee poorten

Het actieve document leeft op het hoogste niveau van de store; de andere geopende documenten liggen als
`DocumentPayload` in `documentSlice` (regel `state`). Welke velden bij een document horen, werd eerder op veel plekken
met de hand herhaald, en die lijsten liepen uit elkaar. Een veld dat bij het vastleggen of terugzetten ontbreekt, lekt
dan stil van het vorige document naar het volgende. We kozen daarom voor één lijst, `DOCUMENT_FIELDS` in
`src/state/documentContract.ts`, met per veld waar het in de state woont (`get`/`set`), de verse waarde (`fresh`), de
rol in de undo-snapshot (`snapshot`, ADR 0431) en eventueel een leesmigratie (`fromPayload`, ADR 0434).
`capturePayload`, `hydratePayload` en `freshPayload` lopen over die ene lijst, zodat vastleggen en terugzetten dezelfde
velden raken.

## Gevolgen

- Twee compilepoorten sluiten het contract van beide kanten. `_assertAllFieldsCovered`: elk veld van `DocumentPayload`
  heeft een regel in `DOCUMENT_FIELDS`. `_assertNoUnclassifiedState`: elk stateveld dat geen functie is (`StateDataKey`
  van `AppState`) staat in `DocumentPayload`, in `AppGlobalKey` of in `DerivedKey`. Zonder die tweede poort werd een nieuw
  stateveld stil app-globaal: het lekt tussen documenten, staat niet in undo en wordt niet teruggezet bij een nieuw
  project. `_assertNoStaleClassification` weigert een classificatie van een veld dat niet meer bestaat, omdat zo'n regel
  de poort ongemerkt zwakker maakt. `_assertMutationFixtureIsCaught` toont met een type dat één extra stateveld
  (`TaskGridContractMutationFixture`) door dezelfde formule als ongeclassificeerd wordt gevangen. De rode tekst van de
  echte poort zie je alleen door die sleutel tijdelijk aan een slice toe te voegen.
- `AppGlobalKey` is voor wat bij de app of de gebruiker hoort en dus gedeeld is tussen alle open documenten. De redenen
  per groep: `ui` is chrome en voorkeuren; `taskClipboard` is gedeeld zodat kopiëren en plakken tussen documenten werkt;
  `recentFiles` hoort bij de installatie; `documents` en `activeDocumentId` zijn de laag die de rest wisselt;
  `historyEvents` en `nextHistorySequence` zijn één niet-gepersisteerde chronologie over documenten en gridoppervlakken
  (regel `state`); `scheduleShift` is sessiestand van één document die `resetDocumentScopedUI` bij een wissel leegmaakt;
  de extensievelden en de resourcebibliotheek zijn app-niveau (regels `extensions` en `library`); de taakgridkolommen,
  de recente kolommen en `taskGridAutoWriteAllowed` zijn persoonlijke instellingen en hun sessiestand.
- `DerivedKey` (`viewRows`) is geen bron: in de payload zou het kunnen verouderen. Bij het activeren van een document
  zet `publishActivation` (`documentSlice.ts`) het uit de materialisatie van de activatie.
- `collapsedTaskIds` is het ene documentveld dat in `s.ui` woont (`get`/`set` in zijn regel); de rest van `ui` is
  app-globaal.
- `field()` houdt de letterlijke `key` en `snapshot`-rol per regel vast; daarop rusten de poorten hierboven en de
  koppeling met de `Snapshot`-`Pick` in `snapshot.ts`. `readField` en `writeField` bevatten de enige cast: in een lus over
  een unie van regels kan TypeScript `get` en `set` niet aan elkaar koppelen.
- De volgorde van `DOCUMENT_FIELDS` doet er niet toe: `fromPayload` leest uit de payload, niet uit de state die
  `hydratePayload` op dat moment vult.
