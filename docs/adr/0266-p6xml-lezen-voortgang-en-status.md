# P6 XML lezen: voortgang, status en werkelijke datums

`p6ActivityCompletionPercent` volgt de lijn van de XER-lezer (`complete_pct_type`, `check-p6xml-nested.ts` (9)). In een bestand dat niet van OPS komt, leidt de
status: `Completed` geeft 100 %, `Not Started` 0 %, en alleen een andere status leest een percentage.
`<PercentCompleteType>` kiest de kolom, zonder terugval op de kolom van een andere soort: Physical
`PhysicalPercentComplete`, Units `UnitsPercentComplete`, Duration `DurationPercentComplete` en zonder die kolom
`1 − RemainingDuration / PlannedDuration`, begrensd op 0 tot 100 %. Zonder soort geldt Physical; een onbekend label
geldt als Duration, met een waarschuwing in de console (9a tot en met 9i). Scope geldt als Duration, met eerst de eigen
kolom `ScopePercentComplete` en zonder waarschuwing (`check-p6xml-writer-p6.ts` (10)); dat MPXJ Scope zo rekent, komt
uit het weggehaalde commentaar en is niet in de repo nagegaan. Een kolom die ontbreekt of leeg is, telt als afwezig en
niet als 0 % (`optionalFloat`), zodat de terugval van Scope en Duration werkt; zonder bruikbare kolom en terugval is
het 0 %.

## Gevolgen

- Een percentage is een fractie van 0 tot 1 en wordt keer 100 genomen (`p6PercentToPercent`; de huidige writer schrijft
  zo, `check-p6xml-writer-p6.ts` 4a). Een export van OPS zonder `<PercentCompleteType>` schreef procenten en houdt ze
  (7c). Een waarde boven 1 kan geen fractie zijn en blijft een procent; een procent van 1 of minder uit een ander
  programma leest daardoor als fractie.
- In een export van OPS is de status geen bron: OPS leidt de status af uit voortgang en werkelijke datums
  (`normalizeImportedProgress`), en een taak kan daar op 100 % staan met een oude status. Het percentage en de
  werkelijke datums lezen dan zonder de status.
- In een ander bestand wint `Not Started` ook van `ActualStartDate` en `ActualFinishDate` (`actualDateRaw`), omdat
  sommige programma's die velden met een vuldatum vullen en elke niet-gestarte taak dan als voltooid opende
  (`check-p6xml-nested.ts` (12)).
- Een activiteit die volgens de bron loopt, blijft lopend op 100 % zonder werkelijk einde, met haar rest uit het
  bestand (`runningAtFullIds`, knownbug 114, `check-import-explicit-rest.ts` 9): in een ander bestand bij de status
  `In Progress`; in een export van OPS bij geen werkelijk einde en `In Progress` of een rest boven 0, omdat oudere
  eigen exports `Completed` op 100 % schreven en een positieve rest zonder werkelijk einde daar het teken is
  (`check-import-explicit-rest.ts` 12).
- `Task.status` neemt de lezer niet uit `<Status>`: `normalizeImportedProgress` zet hem uit voortgang en werkelijke
  datums. De voortgangssoort gaat daarnaast als herkomstveld `p6CompletePctType` mee (ADR 0267).
