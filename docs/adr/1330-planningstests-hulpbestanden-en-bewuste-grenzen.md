# Planningstests: wat de gedeelde hulpbestanden garanderen en wat checks bewust niet toetsen

De headless checks in `tests/planning/` delen een paar hulpbestanden (DOM-stubs, een IndexedDB-dubbel, het harnas, de
fidelitykern, de prestatiemeting). Een paar keuzes daarin zien eruit als iets wat je kunt opschonen, maar dragen de
toets. Ook laten een paar checks bewust iets ongetoetst, zodat een gewone wijziging aan de app ze niet breekt.

## Gevolgen

- **Stubs als eerste import.** `domStub.ts` en `domShim.ts` zijn eigen modules en staan als allereerste import in een
  check. ES-imports worden gehoist: losse statements boven de imports draaien pas nadat elke geïmporteerde module
  zijn body heeft uitgevoerd, en `@/i18n/config` zet bij het laden al `document.documentElement.dir`. Een check die
  zijn global zelf moet laten gooien voordat de app-modules laden (`check-settings-storage-blocked.ts`, deel A: de
  getter van `localStorage` gooit), importeert de app-modules dynamisch, ná het zetten van die getter; de
  store-modules lezen de opslag al bij het laden. Maak van die imports geen statische imports en zet geen
  importsorteerder op deze bestanden.
- **De `localStorage` van `domStub.ts` is een echte `Map`,** geen no-op, zodat een check kan toetsen dat een
  instelling is weggeschreven.
- **`fakeRecoveryIndexedDb.ts` roept `oncomplete` in een microtask aan na elke `put` en `delete`,** dus bij een
  transactie met meer writes ook meer dan eens. Dat klopt alleen omdat `recoveryStore` alle writes van één ronde
  synchroon in dezelfde callback doet: de inhoud is compleet vóór die microtask. Een `readonly`-transactie zonder
  writes voltooit ook. Waarden gaan door `structuredClone`, zoals in een echte IndexedDB (een `Uint8Array` blijft een
  `Uint8Array`).
- **Het harnas zet ongeldige relaties rechtstreeks in de store.** Een zelf-lus, een relatie met een voorouder en een
  kring weigert `addSequence` (`relationAddVerdict`). `buildAndSolve` in `harness.ts` zet zulke relaties daarom met
  `setState` in `sequences`, zodat de cases de eigen bewaking van de solver en `expandSummaryRelations` toetsen: een
  bestand dat via `loadState` binnenkomt, gaat niet langs de aanmaakregels. Elke andere relatie gaat door
  `addSequence`, en een weigering daar is een fout in de case.
- **Meettolerantie van de fidelitykern.** `classifyFloatMinutes` (`fidelityCore.ts`) noemt tf/ff `exact` als het
  verschil op de raster van `FLOAT_EXACT_TOLERANCE_MIN` (0,001 min) naar 0 afrondt. Dat is dezelfde grens als
  `roundMinutes` in `fidelityCells.ts`, zodat er geen afwijkende cel met grootte 0 kan bestaan. De tolerantie geldt
  alleen voor tf/ff: de datum-assen zijn canonieke minuutstrings (`CANONICAL_MINUTE`).
- **Prestatiegrenzen van het taakraster** (`taskGridPerformanceHarness.ts`). `pasteCommitMs` (3.000 ms) is ongeveer
  twee keer de gemeten mediaan na de reparatie van het bulkplakken (`docs/superpowers/evidence/tabel-overhaul-review-fixes.md`).
  De selectie→adaptermeting duurt per keer minder dan een milliseconde; met twee warmups liepen de eerste samples nog
  in ongeoptimaliseerde code en haalde de mediaan op CI soms de grens van 2 ms. Alleen die meting krijgt daarom
  `TASK_GRID_SELECTION_ADAPTER_PROTOCOL` (30 warmups, 21 runs) tegen dezelfde 2 ms; de bewaakte regressie (adapterdomein
  en relatie-index bij iedere selectie opnieuw bouwen) zit in elke sample, dus de warmups verbergen haar niet (commit
  e7623d998).
- **De XML-shim haalt commentaar weg tot er niets meer verandert** (`parseXML` in `xmldom-shim.ts`): één ronde kan uit
  `<!<!---->--` een nieuw `<!--` maken.
- **Vaste invoer voor de vingerafdrukken in `check-f3b-production-compat.ts`.** De publieke voorbeelden bepalen welke
  acht bestanden meedoen; de inhoud komt uit `fixtures/minute-model-examples-f0/`, de voorbeelden van vóór het
  minutenmodel waarop de vingerafdrukken gemeten zijn. Lees hier niet de opnieuw gegenereerde publieke bestanden: die
  hebben andere id's en een al berekend plan, en de check bewaakt de productieroute vanaf de oude invoer.
- **Bewust niet getoetst:**
  - `check-ribbon-overlays.ts` en sectie 13 van `check-context-menu-scope.ts` pinnen geen exacte indeling of
    knoppenlijst, alleen invarianten (hoogstens drie knoppen per stack, de bestaande knoppen en de paren die bij elkaar
    horen; de knoppen uit de melding op beide tabbladen, één gedeelde groep). Een extra knop mag ze niet breken.
  - `check-knownbug-4.ts` eist niet dat een worteltaak géén projectstartwaarschuwing krijgt, zodat zo'n waarschuwing
    later kan komen.
  - `measure-xer-recovery-write-amplification.ts` toetst een structurele grens (één documentupsert plus één
    manifestput in één transactie), geen walltime of RSS; die meet `check-xer-archive-recovery-corpus.ts`.
