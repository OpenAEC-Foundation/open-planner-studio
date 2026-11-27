# Bestandsnaam en volgnummer van een naamloos document

Een naamloos project krijgt als voorgestelde bestandsnaam het vaste woord `project` (`projectFileBase` in
`src/utils/documents.ts`), niet de vertaalde naam van een nieuw project. Een bestandsnaam belandt op een schijf en
wordt door andere systemen gelezen; een naam in het Japans of Arabisch maakt het bestand lastiger uit te wisselen,
en de gebruiker kiest in het opslagvenster toch zelf een naam. Opslaan, rapportexport, de STEP-kop en de
uitwisselingsformaten gebruiken dezelfde terugval.

Meerdere naamloze documenten krijgen een volgnummer in de weergave (`untitledOrdinals`, `displayDocumentTitle`), niet
in de projectnaam. Zo komt er geen taalgebonden tekst in de projectdata en dus niet in het IFC-bestand.
