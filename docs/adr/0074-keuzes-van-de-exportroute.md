# Keuzes van de exportroute

`exportAs` schrijft de planning naar formaten die anderen lezen: eerst doorrekenen, dan één bestand, dan de meldingen.
Afgezien van dat doorrekenen (`runCPM` als de planning verouderd is) verandert een export het document niet. Eén
uitzondering: een IFC-export die het eigen bestand van het
document overschrijft, legt de letterlijk geschreven kalenders vast in het document, zoals Opslaan
(`recordLiteralCalendarsWritten`). Daarom schrijft een IFC-export, ook die met de resourcebibliotheek, onder hetzelfde
schrijfslot als Opslaan als (`check-ifc-literaltimes-behoud.ts` 7). Een paar keuzes per formaat verrassen zonder
uitleg en staan hier.

## Gevolgen

- Het voortgangsblad (`.xlsx`) zet de rijen in boomvolgorde (`flattenOrder`). De volgorde in de store is na een P6- of
  IFC-import "samenvattingen eerst", en dat is als rondgestuurd blad onleesbaar; de terugimport koppelt op OPS Task ID,
  dus de volgorde doet daar niet toe. Het blad krijgt een eigen naamsuffix, opent waar mogelijk in de downloadmap en
  komt niet in Recent.
- De CSV-export schrijft lag in uren met het uurteken van de app-taal als dat `u` of `h` is (eigenaarsbesluit
  2026-10-20); elk ander uurteken, bijvoorbeeld het Deense `t`, en een niet geïnitialiseerde i18next geven `u`
  (`parseableHourSuffix`). De export laadt `@/i18n/config` niet, want die raakt bij het laden `document` aan en breekt
  headless gebruik.
- In de modus *Datums zoals opgeslagen* schrijft de CSV-export een as die het bronbestand niet vastlegde niet als
  verzonnen 0 of No (`unrecordedExportGate`).
- Na een geslaagde export komt hoogstens één verliesmelding. Bij XER en P6 XML is het de melding van dat formaat, en
  die blijft weg als er niets te melden is. Bij de andere formaten noemt de melding XER-broninformatie alleen bij een
  document met XER-herkomst; een ander document krijgt de algemene melding (#554). Daarna volgen de losse meldingen
  (splitsingen zonder contour, kostenresources, ingekorte P6-namen, vervangen XML-tekens, de kritiek-drempel in uren,
  het rekenprofiel), elk apart verzameld. Gooit het opstellen van een latere melding, dan tonen de meldingen die al
  klaar waren, want het bestand staat er dan al.
- Een geannuleerde dialoog is geen export: geen melding en geen waarschuwingen in het resultaat. Bij de export met de
  resourcebibliotheek is het annuleren van het tweede bestand ook geen voltooide export, maar het projectbestand staat
  er dan al, en een download daarvan is op dat moment al gemeld.
