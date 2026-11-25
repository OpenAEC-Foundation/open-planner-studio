# Crashherstel: de herstelinvoer en de payload die eruit komt

Crashherstel leest per document een herstel-IFC terug en legt er de metadata uit het manifest overheen (welk tabblad,
welk bestand, was het gewijzigd). `RecoveryDocInput` is daarom afgeleid van `ImportResult` plus die identiteit, en niet
met de hand opgesomd: een optioneel round-trip-veld dat in een handlijst ontbreekt, valt bij herstel stil weg, en `tsc`
zegt er niets van. Het verschil met `ImportResult` is de document-identiteit (`RecoveryDocMeta`), zoals
`buildWriteIFCInput` aan de schrijfkant. `recoveryInputFromParsed` is daardoor één spread, met `meta` ná de spread: bij
een gelijknamig veld wint de identiteit uit het manifest van wat de parser las.

`payloadFromInput` maakt er een `DocumentPayload` van via `payloadFromImport`, zodat import en herstel dezelfde
veldmapping en standaardwaarden hebben (ADR 0434), en zet daarna alleen wat bij herstel anders is.

## Gevolgen

- `isDirty` komt uit de metadata en niet vast `false`: herstel brengt een niet-opgeslagen document terug.
- `scheduleStale` wordt `true`. `documentSlice` gebruikt `payloadFromInput` ook voor de herstelde documenten die niet
  actief worden. Die rekent herstel niet door, en `switchDocument` rekent zelf ook niet; dat gebeurt pas met F5 of met
  Automatisch berekenen (`recalculateStaleSleepingDocuments`, `useAutoCalcCPM`). Met `false` toonde de statusbalk
  geen waarschuwing terwijl er geen kritiek pad en geen speling berekend is; `true` zegt dat er nog niet gerekend is, en
  de planner gaat verder met F5.
- `datesAsRecorded` zet `payloadFromInput` niet: samen met `scheduleStale: true` is dat een verboden combinatie (regel
  `state`, *Datums zoals opgeslagen*, punt 2; `check-recorded-dates.ts` 11d tot en met 11g). De modus komt er pas na
  de payloadbouw op, met `applyRecordedDatesOnLoad` voor het actieve document en `applyRestoredRecordedMode` voor een
  slapend document (`documentActivation.ts`). In de metadata is `datesAsRecorded` een feit uit het manifest, geen
  projectdata (ADR 0195).
- `foreignSourceMark`: met `sourceRestored` (alleen gezet nadat de herstelroute de volledige bron teruglas en de hash
  controleerde; geen manifestveld) komt het kenmerk uit de teruggelezen bron, met het doel uit de metadata. Anders komt
  de vingerafdruk uit de herstel-IFC (`ImportResult.recoveryForeignSource`) en het doel uit het manifest
  (`RecoveryDocMeta.foreignSource`), en blijft de bron als ontbrekend gemarkeerd (`restoredMark`): alleen een expliciete
  `sourceMissing: false` blijft onwaar. Die waarde betekent alleen nog doelbescherming na een bewuste opslag van alleen
  de planning (#804 PR 9e, regel `settings-autosave`); oude metadata zonder de waarde blijft dicht.
- `fileHandle` komt alleen terug met `sourceRestored`. `siteFileVersion` alleen met een `siteFileId`: zonder die basis
  stuurt Ctrl+S na herstel geen `baseVersion` mee en ziet de site geen conflict. Met het IFCX-kenmerk (`ifcx`) wordt
  `fileFormat` `'ifcx'` en komt `knownTargetFingerprint` uit dat kenmerk, behalve bij een site-doel.
