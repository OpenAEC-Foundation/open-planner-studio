# Extensie-API: keuzes die verrassen

Een paar keuzes in `src/extensions/` lijken overbodig of te streng, maar houden iets tegen wat de code niet laat zien.
De gids voor makers (`docs/extensions.md`) dekt de rest: toestemming, versievelden, permissies, `loadProject` en het
begeleidingspaneel.

- **De vrager voor de toestemming staat in een eigen module.** `installConsentDialogAsker` (`consentBridge.ts`) wordt
  in `App.tsx` meteen geladen, de dialoog `ExtensionConsentDialog` lui. Zonder geregistreerde vrager weigert
  `askExtensionConsent`, dus een installatie die start voordat het dialoogdeel binnen is, zou stil afketsen als de
  vrager in de dialoog zelf woonde.
- **Elke schrijfroute van `api.data.*` loopt via `batch.withTransaction`**, nooit via `finishUndoable` daarbuiten
  (`createExtensionApi`). Tijdens een open bewerksessie, zoals het taakvenster, krijgt een stap anders de `sessionKey`
  van die sessie, en dan draait Annuleren in het venster het werk van de extensie stil mee terug.
- **Reken-opties van een extensie worden per publieke sleutel overgenomen**, niet met een spread
  (`publicSchedulingOptions` in `extMappers.ts`). Een ongetypeerd extensie-object kan interne `p6*`-sleutels dragen;
  een spread zou die als solverinvoer laten meetellen.
- **`remainingTime` en `remainingMinutes` gaan bij `api.data.updateTask` ongetoetst door** (`fromExtTaskTimePatch`),
  anders dan bij de MCP-tools, die ze weigeren. Directe toegang tot de taaktijd is het contract van de extensie-API;
  een toets tegen `completion` zou een extensie die zelf een precieze restduur bijhoudt ook tegenhouden.
- **`resolvePageOffset` (`extImportSource.ts`) telt `+ 0` op** om een offset `-0` als `0` terug te geven:
  `validatePageOptions` laat `-0` door, en een extensie die met `Object.is` vergelijkt of de offset als sleutel
  gebruikt, zou anders `-0` zien.
