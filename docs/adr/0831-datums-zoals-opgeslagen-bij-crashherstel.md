# Datums zoals opgeslagen bij crashherstel

Crashherstel hervat een onderbroken sessie; het heropent geen bestand. Daarom beslist bij herstel de bewaarde
vlag (`RecoveryManifestDoc.datesAsRecorded`, het argument `restoredMode` van `applyRecordedDatesOnLoad` in
`src/state/documentActivation.ts`) en niet de regel van het laadpad, of een beschikbare vastlegging "datums zoals
opgeslagen" weer actief wordt. Een terugleesregel ("geen verschoven taken, dus de modus stond aan") geeft valse treffers: een bewerking
verlaat de modus, en zolang de herberekening nog niet gedraaid is, kan een automatische opslag
de brondatums wegschrijven zonder modus.

## Gevolgen

- Een slapend hersteld document wordt niet doorgerekend. `applyRestoredRecordedMode` zet daarom de vastlegging en de
  modus zonder berekening, met een `recordedDates` zonder `shifted`: dat getal is een vergelijking met een
  herberekening, en een verzonnen `0` zou zeggen dat herberekenen niets verandert. De strook toont dan haar tekst
  zonder teller.
- Een taak zonder vastlegging met lege vroege slots krijgt in zo'n document voorlopig haar eigen anker
  (`scheduleStart`/`scheduleFinish`) tot de eerste herberekening; anders stond ze op vandaag, want de lezer maakt van
  een `$`-datum vandaag.
