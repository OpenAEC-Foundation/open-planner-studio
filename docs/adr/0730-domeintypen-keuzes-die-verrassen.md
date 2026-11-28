# Domeintypen: keuzes die verrassen

`src/types/` bevat de domeintypen die engine, services en de store delen. Een paar keuzes erin zou een collega zonder
uitleg terugdraaien, omdat de gewone vorm hetzelfde lijkt te doen. De rest van wat er over deze typen te weten valt,
staat in de code, in de regels `state`, `taaktypes` en `rekenprofielen`, en in de ADR's per onderwerp.

## Gevolgen

- `src/types/` hangt niet van `src/state/` af. Een type dat de store en de engine allebei nodig hebben, staat hier,
  ook als de logica erachter in de store staat: `RecordedTaskAxis` en `RecordedTaskMark` in `taskGrid.ts` horen bij
  `src/state/recordedDatesSelectors.ts`, de weergavetypen in `view.ts` bij de store, en `state/slices/types.ts`
  exporteert ze opnieuw. Geen poort bewaakt dit; een import uit `@/state/` hier maakt de typen afhankelijk van de
  laag die ze gebruikt.
- Een kolomkop die de gebruiker zelf koos (activity code, eigen veld, baseline) staat als `labelText` in
  `TaskColumnLabelSource` en gaat nooit door `t()`; `taskColumnLabel` vertaalt alleen `labelKey`. Toen de naam nog
  als sleutel ging, maakte de terugval `humanizeTaskGridKey` van "Fase 1.2" een "2".
- De File System Access-typen staan zelf in `file-system-access.d.ts`; de
  dependency `@types/wicg-file-system-access` is bewust niet gekozen, om de lijst met dependencies klein te houden.
  `lib.dom.d.ts` van TypeScript 5.9.3 kent onder meer `showOpenFilePicker`, `queryPermission` en
  `getAsFileSystemHandle` niet. Het bestand heeft geen `import` of `export`, zodat de interfaces met de globale
  samenvloeien.
