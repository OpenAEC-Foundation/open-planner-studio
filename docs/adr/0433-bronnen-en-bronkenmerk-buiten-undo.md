# Bronnen, bronkenmerk en eenrichtingsvlaggen: buiten undo

Een tweede groep documentvelden staat buiten de undo-snapshot (`snapshot: 'none'`) omdat bewerken ze niet verandert, of
omdat ze maar één kant op mogen bewegen. Een undo die ze terugzette, zou informatie over de bron weggooien of een
eerder genomen veilige keuze terugdraaien.

## Gevolgen

- `xerImportMetadata`, `xerSourceArchive` en `xerSourceProjectId`: bewerkingen muteren ze niet. Ze reizen mee bij een
  documentwissel en crashherstel en staan in `IFC_SAVE_KEYS`, dus de IFC bewaart ze. Het archief zijn de exacte,
  onveranderlijke XER-bronbytes: één object, bewust gedeeld tussen tabbladen; een kopie van het document deelt het
  (`duplicateDocument`, toets `check-xer-source-archive-lifecycle.ts`). `xerSourceProjectId` kiest het project van dit
  document binnen dat archief.
- `ifcSource` (#804) volgt hetzelfde patroon als het XER-archief: per document, niet in undo, één gedeeld onveranderlijk
  object. Wat de writer-invoer ermee doet, staat in de regel `state` (`ifcSaveInput.ts`) en in `AGENTS.md`.
- `foreignSourceMark` is het kenmerk van een document dat uit een IFC-bestand met een vreemd deel kwam: de vingerafdruk
  en het doel van die bron, zodat Opslaan als en een export dat bestand weigeren, ook als `ifcSource` ontbreekt. Het
  staat buiten undo; `buildWriteIFCInput` leest het niet. Het reist mee bij een documentwissel, een kopie en
  crashherstel (`payloadFromInput`, ADR 0435). `commitSavedDocument` zet het na een voorbereide opslag opnieuw, en de
  MCP-backup schrijft het mee (`foreignSourceBackupRecord`), behalve als `sourceMissing: false` alleen nog het oude doel
  beschermt.
- `xerArchiveIssue` zegt dat het XER-bronarchief bij het openen onbruikbaar was en is weggelaten. Het is sessiestand die
  wel meereist bij een documentwissel en een kopie: anders zeiden MCP en de extensie-API na een tabwissel weer dat er
  nooit een XER-bron was. Het staat niet in `IFC_SAVE_KEYS` en niet in undo, omdat er niets terug te schrijven is.
- `importPristine` ("ongewijzigd sinds import", regel `state`) staat niet in undo: undo maakt een bewerkt document niet
  weer ongewijzigd. Dat is de voorzichtige richting, omdat de vlag bij heropenen "datums zoals opgeslagen" automatisch
  aan kan zetten; nooit een gok in die richting. Bij een kopie is ze onwaar.
- `ifcLiteralCalendarIds` wordt nooit kleiner en staat daarom niet in undo (knownbug 1026, besluit Trias van
  10 november 2026; de regel en zijn bron staan in `docs/ifc-round-trip.md`, *Letterlijke kalender blijft letterlijk*).
  Een undo die de lijst kleiner maakte, liet 1026 terugkomen: opslaan met `LiteralTimes`, de bewerking ongedaan maken,
  opnieuw opslaan. Wijst een id na IFC Toepassen een andere kalender aan, dan wordt hooguit een kalender te veel
  letterlijk, de veilige richting. Dat v2026.9.0 de echte tijden van een letterlijke kalender leest zoals hij ze altijd
  las, komt uit het weggehaalde commentaar en is niet nagegaan.
