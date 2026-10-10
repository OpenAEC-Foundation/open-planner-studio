# Öppna en MS Project-fil (.mpp)

Mål: öppna en tidsplan från Microsoft Project direkt i appen, utan att exportera den först.

## När du behöver det här

En entreprenör, konsult eller kund skickar dig sin tidsplan som en `.mpp`-fil. Du vill visa den, beräkna den eller utveckla den vidare. Appen läser `.mpp`-filer från MS Project 2010 upp till och med 2021. Appen läser bara. Den skriver inte `.mpp` och ändrar aldrig din fil. Från filen tar den tidsplanen själv: uppgifter med struktur, varaktighet och restriktioner, samband med fördröjning, kalendrar, resurser, tilldelningar och framdrift. Den läser också de datum och det slack som MS Project själv beräknade, men använder dem bara för vyn *Datum så som de står i filen*, aldrig som indata.

## Steg

1. Välj *Start › Fil › Öppna* eller tryck på Ctrl+O. Välj `.mpp`-filen.
2. Projektet öppnas i en ny flik, eller i den aktuella fliken om den fortfarande var tom och oförändrad. Projektet har ingen fil: *Spara* skriver senare en ny IFC-fil.
3. Läs meddelandet längst ned: *Det här projektet beräknas enligt Microsoft Project. Ändra det via Arkiv → Projektinfo → Beräkningsprofil och beräkningsalternativ.* Appen beräknar det här projektet med MS Projects beräkningsregler, alltså beräkningsprofilen *Microsoft Project*. Med *Öppna beräkningsprofil* går du till inställningen. *Läs mer* öppnar hjälpen om beräkningsprofiler.
4. Kontrollera om det finns ett meddelande under menyfliksområdet: *Du ser datumen så som de står i filen; när du beräknar om skulle 4 uppgifter flyttas.* Då skiljer sig appens resultat för de uppgifterna från de datum som MS Project sparade. Under meddelandet från steg 3 finns då också en rad: *4 uppgifter visar datumen så som de står i filen (inte beräknas om).* Vad det betyder och hur du växlar till appens egna beräkning finns i [Datum så som de står i filen](docs://uitleg-datums-zoals-opgeslagen).
5. Om det står *Den här filen innehåller timplanering.* med knappen *Aktivera timplanering*, innehåller filen data i timmar. Se [Aktivera timplanering](docs://howto-urenplanning-aanzetten).

Om filen innehåller uppgifter med avbrott, utjämnad eller resursstyrd tidsplan läggs ett annat meddelande till, till exempel *Den här MS Project-filen innehåller 3 uppgifter med avbrott, utjämnad eller resursstyrd tidsplan. De läses in och visas så.* För en enda uppgift står meddelandet i singular.

## Fallgropar och vad appen gör då

**Inte allt följer med.** Appen tar inte över baslinjer, kostnader och standardkostnader, anteckningar och MS Projects egna fält. En WBS-kod som du själv fyllde i i MS Project tas över. Annars numrerar appen uppgifterna efter strukturen.

**En fil från MS Project 2007 eller äldre.** Appen öppnar den inte och visar: *Den här .mpp-filen använder ett äldre format (Project 2007 eller äldre). Exportera den från MS Project som XML (Arkiv → Spara som → XML) och öppna den filen.* Under meddelandet lägger appen till en teknisk orsak på engelska.

**En fil med lösenord.** Appen visar: *Den här .mpp-filen är lösenordsskyddad. Exportera den från MS Project som XML (Arkiv → Spara som → XML) och öppna den filen.* Även här kommer meddelandet med en teknisk orsak på engelska.

**En fil som inte är en `.mpp`.** Du får *Det gick inte att öppna filen*, med en teknisk orsak.

**XML-vägen beräknar annorlunda.** Om du öppnar MS Project-exporten i XML i stället för `.mpp`, beräknar appen med beräkningsprofilen *Open Planner Studio*. Då ser du inte meddelandet om *Microsoft Project*. Datumen kan då bli annorlunda än med `.mpp`-filen.

**En ändring släpper MS Projects styrning.** Om du ändrar en uppgift vars planering styrdes av MS Projects datumfönster, visar appen en gång per projekt: *Datumfönstret från MS Project styr inte längre 2 uppgifter efter den här ändringen; timfördelningen gäller fortfarande och finns kvar i filen.* För en enda uppgift står meddelandet i singular.

**Sparandet skriver aldrig över din `.mpp`.** Projektet har ingen fil. *Spara* frågar var den nya IFC-filen ska komma.

## Se även

- [Filer och format](docs://uitleg-bestanden): varför en `.mpp` bara läses och vad sparande skriver.
- [Datum så som de står i filen](docs://uitleg-datums-zoals-opgeslagen): vyn med MS Projects egna datum.
- [Aktivera timplanering](docs://howto-urenplanning-aanzetten): om filen innehåller data i timmar.
- [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen): samma sak för Primavera.
- [Format för import och export](docs://ref-import-exportformaten): per format vad som följer med och vad som inte gör det.
- [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen): varför en MS Project-fil öppnas med sin egen beräkningsprofil.
