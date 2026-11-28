# Voortgangsblad: lezen zonder raden

Het voortgangsblad (`src/services/progressImport/`) komt terug uit een spreadsheet die iemand buiten de app invult.
Waar een waarde op twee manieren te lezen is, kiest het blad niet stil: het weigert, vraagt of waarschuwt in de
preview. Een stil verkeerd gelezen datum of percentage belandt ongemerkt in de planning, een weigering ziet de planner in de preview.

## Gevolgen

- `parseSheetDate` (`sheetValues.ts`) gebruikt `csvDateOrToday` (`importDates.ts`) niet, want die geeft bij
  onherkenbare invoer stil vandaag terug.
- De dag/maand-volgorde geldt voor het hele bestand (`detectDateOrder`). Spreekt het bereikbewijs zichzelf tegen
  (een cel kan alleen dag-eerst zijn, een andere alleen maand-eerst), dan stopt de detectie bij de vraag of bij
  `contradictoryNoSample` en gaat ze niet door naar de ijkpunten, die een van de twee signalen zouden negeren.
  IJkpunten komen alleen uit rijen met een treffer op id: een WBS-treffer is te zwak voor een besluit over het hele
  bestand. Als voorbeeld in de vraag dient alleen een cel die onder beide lezingen een bestaande, verschillende
  datum is (`findGenuineAmbiguousSample`).
- `Completion (%)` is altijd een percentage: `1` is 1 %, nooit een fractie (`parseSheetPercent`).
- Een te lange celwaarde, of een id met een stuurteken na het trimmen, telt als leeg en wordt nooit afgekapt, want een afgekapt
  id kan een andere taak treffen (`boundedCell` en `boundedTaskId`, `sheetColumns.ts`).
- De markering in de invulcellen van een verzameltaak in het eigen blad begint met een em-dash en telt als leeg,
  niet als onleesbaar (`isMarkerCell`): een ongewijzigd teruggestuurd blad houdt daar geen weigering aan over.
- `rowNumber` is het rijnummer uit het bestand, geen teller (`parseProgressXlsx.ts`), omdat de handmatige
  koppelingen erop sleutelen.
- Of een bladwaarde een wijziging is, beslist `buildPlan.ts`. Voltooiing vergelijkt op de precisie van de ingelezen
  waarde (`isCompletionUnchanged`), niet met een vaste marge. Een kale datum die het datumdeel van het moment in de app herhaalt, is geen wijziging (`isDateNoop`),
  zodat een blad een moment niet stil naar middernacht zet.
- De preview toont in `changes` alleen de velden die de rij zelf aanleverde. Wat de voortgangsregels daaruit
  afleiden (een werkelijke start bij een percentage, een einde bij 100 %), wordt wel geschreven, maar de invuller
  herkent het niet als eigen invoer.
- De exportstand staat als één tekstcel per bladtaak in de verborgen kolom `OPS Export` (`exportState.ts`). Uit het
  weggehaalde commentaar, niet nagegaan: een tekst overleeft het opslaan in een spreadsheet, waar een datumcel van
  opmaak kan veranderen. Een cel die niet precies in het formaat past, telt als afwezig
  (`decodeProgressExportState`), want een half gelezen exportstand geeft een verkeerde vergelijking.
