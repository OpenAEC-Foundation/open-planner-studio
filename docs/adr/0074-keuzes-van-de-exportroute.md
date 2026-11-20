# Keuzes van de exportroute

`exportAs` schrijft de planning naar formaten die anderen lezen. Een export laat het document ongemoeid en volgt
daarom een eenvoudiger regel dan opslaan: eerst doorrekenen, dan één bestand, dan de meldingen. Een paar keuzes per
formaat verrassen zonder uitleg en staan hier.

## Gevolgen

- Het voortgangsblad (`.xlsx`) zet de rijen in boomvolgorde (`flattenOrder`). De volgorde in de store is na een P6- of
  IFC-import "samenvattingen eerst", en dat is als rondgestuurd blad onleesbaar; de terugimport koppelt op OPS Task ID,
  dus de volgorde doet daar niet toe. Het blad krijgt een eigen naamsuffix, opent waar mogelijk in de downloadmap en
  komt niet in Recent.
- De CSV-export schrijft lag in uren met het uurteken van de app-taal (eigenaarsbesluit 2026-10-20). Het teken komt uit
  de i18next-instantie als die is geïnitialiseerd, anders `u`; de export laadt `@/i18n/config` niet, want die raakt bij
  het laden `document` aan en breekt headless gebruik.
- In de modus *Datums zoals opgeslagen* schrijft de CSV-export een as die het bronbestand niet vastlegde niet als
  verzonnen 0 of No (`unrecordedExportGate`).
- Na een geslaagde export komt er één verliesmelding: de writer van XER telt zelf per soort, P6 XML heeft een eigen
  melding, en de melding die XER-broninformatie noemt hoort alleen bij een document met XER-herkomst; een ander
  document krijgt de algemene melding (#554). Daarna volgen de losse meldingen (splitsingen zonder contour,
  kostenresources, ingekorte P6-namen, vervangen XML-tekens, de kritiek-drempel in uren, het rekenprofiel), elk apart
  verzameld. Gooit het opstellen van een latere melding, dan tonen de meldingen die al klaar waren, want het bestand
  staat er dan al.
- Een geannuleerde dialoog is geen export: geen melding en geen waarschuwingen in het resultaat. Bij de export met de
  resourcebibliotheek is het annuleren van het tweede bestand ook geen voltooide export.
