# Sessiegegevens per tabblad op de documentregistratie

Een paar gegevens horen bij een open tabblad maar niet bij het document: ze hoeven geen undo, crashherstel of opslag te
overleven. Ze staan daarom als optionele velden op `DocumentEntry` en niet in `DOCUMENT_FIELDS`, en ze verdwijnen met
de registratie als het tabblad sluit. Het zijn `saveState` (de opslagstand, regel `state`, *De opslagstand*), `content`
(de identiteit van de inhoud, regel `state`, *De identiteit van de inhoud*; `documentSaveState.ts` leest een ontbrekende
waarde als 0), `changedOnDisk` (regel `state`, *Multi-document*) en `pendingWorkRuleSettle`.

## Gevolgen

- `pendingWorkRuleSettle` is wat de werkregel deed in een slapend document toen `refreshAllDocumentsFromPool`
  (`librarySlice.ts`) zijn kalenders verving: alleen gezet als er taken veranderden of hun sturing verloren, en
  samengevoegd met een eerdere waarde (`mergeCalendarLibrarySettle`, per taak-id ontdubbeld). De melding komt pas als het
  document actief wordt, bij het document waar ze over gaat: `announceWorkRuleSettle` voegt na de publicatie deze waarde
  samen met de settle van de activatie zelf (`activation.workRuleSettle`), met elke taak één keer geteld, en meldt het
  zoals de kalenderdialoog (`notifyCalendarLibrarySettle` in `calendarTasks.ts`). Dat zijn per activatie hoogstens twee
  meldingen: "N taken aangepast" (`notifyWorkRuleDurationsChanged`) als er taken veranderden, en het verlies van
  tijdgefaseerde sturing (`notifyTimephasedLoss`). Alleen die tweede heeft een sessiepoort per document
  (`claimTimephasedLossNotice` in `timephasedLossNotice.ts`): ze komt hoogstens één keer per document-id in de sessie,
  en niet meer als een andere route met dezelfde poort haar voor dat document al gaf. `switchDocument` en de tak van
  `closeDocument` die naar een buur wisselt, wissen het veld op het document dat actief wordt; `duplicateDocument` en
  `restoreDocuments` geven geen registratie mee, omdat hun nieuwe registraties het veld niet hebben.
