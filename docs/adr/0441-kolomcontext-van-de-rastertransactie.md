# De kolomcontext van de rastertransactie volgt het raster

De rastertransactie beslist zelf of een kolom beschikbaar en schrijfbaar is (`available` en `readOnly` van de
kolomdescriptor, in `applyCellEdits`). Ze bouwt daarvoor een eigen `TaskColumnContext` (`buildGridColumnRuntime` in
`src/state/gridTransaction.ts`). We kozen ervoor de gates in die context op dezelfde manier te vullen als
`FullTaskGrid`. Een andere context zou een cel weigeren die het raster toont, of haar schrijfbaarheid anders
beoordelen.

## Gevolgen

- `taskTypesUnlocked` is `ui.showTaskTypes || taskTypesVisible`, dezelfde uitdrukking als in `FullTaskGrid`. Zonder
  die waarde zijn `task.workRule` en `assignment.remainingWork` niet beschikbaar en weigert de transactie ze met
  `plannerNotAvailable`.
- `signedWorkDaysBetween` telt op de projectkalender, zoals `FullTaskGrid` met zijn `CalendarEngine` op `calendar`
  doet; de transactie maakt die engine pas bij het eerste gebruik. `check-grid-transaction.ts` (blok *Bronstructuur*)
  toetst alleen dat deze regel in de brontekst van `buildGridColumnRuntime` staat.
- Uit `recordedGridBinding` neemt de transactie alleen `recordedMark` over. Die beslist of de kolom `recorded.source`
  beschikbaar is; zonder die waarde gaf een write naar die kolom `plannerNotAvailable` in plaats van de route voor
  alleen-lezen cellen (ADR 0443). `recordedUnrecordedAxes` laat ze weg: dat stuurt `read`, `format` en `copy` van de
  kolommen voor late datums en speling (`recordedAxisRead`, `recordedAxisFormat`, `recordedAxisCopy`), en dat zijn
  allemaal kolommen uit `readonlyColumn`, waarin de transactie niet schrijft.
