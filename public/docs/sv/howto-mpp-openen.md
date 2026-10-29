# Öppna en MS Project-fil (.mpp)

Mål: öppna en tidsplan från Microsoft Project direkt i appen, utan att exportera den först.

## När du behöver det här

En entreprenör, konsult eller kund skickar dig sin tidsplan som en `.mpp`-fil. Du vill visa den, beräkna den eller utveckla den vidare. Appen läser `.mpp`-filer från MS Project 2010 upp till och med 2021. Appen läser bara. Den skriver inte `.mpp` och ändrar aldrig din fil. Från filen tar den tidsplanen själv: uppgifter med struktur, varaktighet och restriktioner, samband med fördröjning, kalendrar, resurser, tilldelningar och framdrift. Den läser också de datum och det slack som MS Project själv beräknade, men använder dem bara för vyn *Datum så som de står i filen*, aldrig som indata.

## Steg

1. Välj *Start › Fil › Öppna* eller tryck på Ctrl+O. Välj `.mpp`-filen.
2. Projektet öppnas i en ny flik, eller i den aktuella fliken om den fortfarande var tom och oförändrad. Projektet har ingen fil: *Spara* skriver senare en ny IFC-fil. Sedan visas kort ett fönster som förklarar vad appen tog över från filen och hur sparandet fungerar; se [Öppna och spara en fil](docs://howto-bestand-openen-en-opslaan).
3. Läs meddelandet längst ned: *Det här projektet beräknas enligt Microsoft Project. Ändra det via ”Arkiv” → ”Projektinfo” → ”Beräkningsprofil och beräkningsalternativ”.* Appen beräknar det här projektet med MS Projects beräkningsregler, alltså beräkningsprofilen *Microsoft Project*. Med *Öppna beräkningsprofil* går du till inställningen. *Läs mer* öppnar hjälpen om beräkningsprofiler.
4. Kontrollera om det finns ett meddelande under menyfliksområdet: *Du ser datumen så som de står i filen; när du beräknar om skulle 4 uppgifter flyttas.* Då skiljer sig appens resultat för de uppgifterna från de datum som MS Project sparade. Under meddelandet från steg 3 finns då också en rad: *4 uppgifter visar datumen så som de står i filen (inte beräknas om).* Vad det betyder och hur du växlar till appens egna beräkning finns i [Datum så som de står i filen](docs://uitleg-datums-zoals-opgeslagen).
5. Om det står *Den här filen innehåller timplanering.* med knappen *Aktivera timplanering*, innehåller filen data i timmar. Se [Aktivera timplanering](docs://howto-urenplanning-aanzetten).

Om filen innehåller uppgifter med avbrott, utjämnad eller resursstyrd tidsplan läggs ett annat meddelande till, till exempel *Den här MS Project-filen innehåller 3 uppgifter med avbrott, utjämnad eller resursstyrd tidsplan. De läses in och visas så.* För en enda uppgift står meddelandet i singular.

## Fallgropar och vad appen gör då

**Inte allt följer med.** Efter att du har öppnat filen visar appen i ett meddelande vad den inte har tagit över: *Inte allt i den här MS Project-filen har tagits över.* Under det finns en rad per post med antalet, till exempel *2 baslinjer har inte tagits över.* För en `.mpp` är meningen om beräkningsprofilen från steg 3 då den första raden i det här meddelandet. Meddelandet stannar kvar tills du klickar på krysset. Om inget går förlorat får du inte det här meddelandet. En rad kan handla om:

- infogade projekt (delprojekt): appen läser in dem som en vanlig uppgift, utan länken till den andra filen;
- externa uppgifter från ett annat projekt: appen läser in dem som en vanlig uppgift;
- baslinjer: från en `.mpp` tar appen inte över någon baslinje, från MS Project-XML tar appen bara över baslinje 0 för uppgifter, och av den bara datumen och varaktigheten (för en uppgift i timmar även tiden; inte arbete och kostnad, och inga baslinjer för resurser och tilldelningar);
- med MS Project-XML: en tilldelning vars baslinje har andra datum än sin uppgift. Appen behåller bara baslinjen för uppgiften; om datumen är samma går inget förlorat och appen rapporterar inget. En annan tid samma dag räknas också som en skillnad;
- egna fält med värden, till exempel egna fält, värden från en uppslagstabell och dispositionskoder (appen räknar inte ja/nej-fält i en `.mpp`);
- anteckningar (också en anteckning med bara en bild) på resurser och tilldelningar, och från en `.mpp` även på uppgifter (från MS Project-XML kommer en uppgifts anteckning med som dess beskrivning);
- hyperlänkar;
- de fasta kostnaderna för uppgifter;
- standardtaxorna för resurser: från en `.mpp` ingen alls, från MS Project-XML bara standardtaxan;
- bara med MS Project-XML: manuellt schemalagda uppgifter (appen schemalägger dem automatiskt), inaktiva uppgifter (de ingår i beräkningen) och förskjutning pga utjämning;
- bara med en `.mpp`: det kritiska tröskelvärdet från MS Project; appen använder tröskelvärdet 0.

En WBS-kod som du själv fyllde i i MS Project tas över. Annars numrerar appen uppgifterna efter strukturen.

**En fil från MS Project 2007 eller äldre.** Appen vägrar öppna den och visar: *Den här .mpp-filen använder ett äldre format (Project 2007 eller äldre). Exportera den från MS Project som XML (Arkiv → Spara som → XML) och öppna den filen.* Under meddelandet lägger appen till en teknisk orsak på engelska.

**En fil med lösenord.** Appen visar: *Den här .mpp-filen är lösenordsskyddad. Exportera den från MS Project som XML (Arkiv → Spara som → XML) och öppna den filen.* Även här kommer meddelandet med en teknisk orsak på engelska.

**En fil som visar sig inte vara en `.mpp`.** Du får *Det gick inte att öppna filen*, med en teknisk orsak.

**XML-vägen beräknar annorlunda.** Om du öppnar MS Project-exporten i XML i stället för `.mpp` beräknar appen med beräkningsprofilen *Open Planner Studio*, och du ser inte meddelandet om *Microsoft Project*. Datumen kan då bli annorlunda än med `.mpp`-filen. Även med XML-exporten visar appen vad den inte tar över; se *Inte allt följer med*.

**En ändring släpper MS Projects styrning.** Om du ändrar en uppgift vars planering styrdes av MS Projects datumfönster visar appen en gång per projekt: *Datumfönstret från MS Project styr inte längre 2 uppgifter efter den här ändringen; timfördelningen gäller fortfarande och finns kvar i filen.* För en enda uppgift står meddelandet i singular.

**Sparandet skriver aldrig över din `.mpp`.** Projektet har ingen fil. *Spara* frågar var den nya IFC-filen ska sparas.

## Se även

- [Filer och format](docs://uitleg-bestanden): varför en `.mpp` bara läses och vad sparande skriver.
- [Datum så som de står i filen](docs://uitleg-datums-zoals-opgeslagen): vyn med MS Projects egna datum.
- [Aktivera timplanering](docs://howto-urenplanning-aanzetten): om filen innehåller data i timmar.
- [Öppna en Primavera P6-fil (.xer)](docs://howto-xer-openen): samma sak för Primavera.
- [Format för import och export](docs://ref-import-exportformaten): per format vad som följer med och vad som inte gör det.
- [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen): varför en MS Project-fil öppnas med sin egen beräkningsprofil.
