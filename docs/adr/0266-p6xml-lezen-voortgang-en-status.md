# P6 XML lezen: voortgang, status en werkelijke datums

`p6ActivityCompletionPercent` volgt de lijn van de XER-lezer (`complete_pct_type`, `check-p6xml-nested.ts` (9)). In een
bestand dat niet van OPS komt, leidt `<Status>`: `Completed` geeft 100 %, `Not Started` 0 %, en alleen een andere
status leest een percentage. `<PercentCompleteType>` kiest de kolom, zonder terugval op de kolom van een andere soort:
Physical `PhysicalPercentComplete`, Units `UnitsPercentComplete`, Duration `DurationPercentComplete` en zonder die
kolom `1 − RemainingDuration / PlannedDuration`, begrensd op 0 tot 100 %. Zonder soort geldt Physical; een onbekend
label geldt als Duration, met een waarschuwing in de console (9a tot en met 9i). Scope geldt als Duration, met eerst de
eigen kolom `ScopePercentComplete` en zonder waarschuwing (`check-p6xml-writer-p6.ts` (10)); MPXJ leest geen kolom
`ScopePercentComplete` en schrijft bij Scope het duurpercentage (`XmlProjectWriter.getPercentComplete`). Een kolom die ontbreekt of leeg is, telt als afwezig en niet
als 0 % (`optionalFloat`), zodat de terugval van Scope en Duration werkt; zonder bruikbare kolom en terugval is het 0
%.

## Gevolgen

- De lezer rekent een percentage als fractie van 0 tot 1 en neemt het keer 100 (`p6PercentToPercent`; de writer
  schrijft een fractie, `check-p6xml-writer-p6.ts` 4a en 6e). MPXJ schrijft ook een fractie
  (`XmlProjectWriter.getPercentage`). Een export van OPS zonder `<PercentCompleteType>` schreef procenten; die
  houdt de lezer (7c). Een waarde boven 1 rekent de lezer als procent, omdat een fractie niet boven 1 komt; een procent
  van 1 of minder uit een ander programma rekent hij daardoor als fractie.
- In een export van OPS leest de lezer het percentage en de werkelijke datums zonder `<Status>`, omdat OPS de status
  afleidt uit voortgang en werkelijke datums en een taak daar op 100 % kan staan met een oude status. In een ander
  bestand wint `Not Started` ook van `ActualStartDate` en `ActualFinishDate` (`actualDateRaw`), omdat sommige
  programma's die velden met een vuldatum vullen en elke niet-gestarte taak dan als voltooid opende
  (`check-p6xml-nested.ts` (12)).
- `<Status>` bepaalt wel welke taken lopend blijven (`runningAtFullIds`): in een ander bestand elke activiteit met `In
  Progress` (zonder voortgang, dus zonder `actualStart`, `actualFinish` en met `completion` 0, levert
  `normalizeImportedProgress` ook dan `NOT_STARTED`); in een export van OPS een activiteit zonder werkelijk einde met
  `In Progress` of met een rest boven 0, omdat oudere eigen exports `Completed` op 100 % schreven en een positieve rest
  zonder werkelijk einde daar het teken is. `normalizeImportedProgress` levert de eindstatus: zo'n taak blijft
  `STARTED` op 100 %, met haar rest uit het bestand, ook met rest 0; een werkelijk einde maakt haar voltooid (knownbug
  114; `check-import-explicit-rest.ts` 9 en de gevallen van knownbug 381 in blok 12).
- De voortgangssoort gaat daarnaast als herkomstveld `p6CompletePctType` mee (ADR 0267).
