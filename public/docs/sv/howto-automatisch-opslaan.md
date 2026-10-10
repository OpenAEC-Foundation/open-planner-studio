# Slå på automatisk sparning

Mål: låt appen uppdatera din projektfil medan du arbetar, så att du inte behöver trycka på Ctrl+S hela tiden.

## När du behöver detta

Du arbetar länge med en tidsplan, eller så glömmer du ofta att spara, och du vill att filen på disken eller i en delad mapp ska hänga med. Automatisk sparning ersätter inte kraschskyddet: det är alltid på och fungerar separat från detta. Vad skillnaden är, läser du i [Filer och format](docs://uitleg-bestanden).

## Steg

1. Om projektet inte har någon fil än, spara det först en gång med *Start › Fil › Spara som*. Så länge det inte finns någon fil är strömbrytaren grå, och hjälptexten säger: *Spara projektet först för att använda automatisk sparning.*
2. Uppe till vänster i den översta raden klickar du på strömbrytaren *Automatisk sparning*. När den är på säger hjälptexten: *Automatisk sparning är på: ändringar skrivs till den här filen.*
3. Fortsätt arbeta. Så snart projektet har ändringar skriver appen projektet till din fil, utan något fönster och högst en gång var tionde sekund. Markeringen *Ej sparad* försvinner då av sig själv.
4. Vill du sluta klickar du på strömbrytaren en gång till. Hjälptexten säger då: *Automatisk sparning är av. Kraschskyddet förblir alltid aktivt.*

Chrome och Edge låter dig först bara läsa en fil som du har öppnat. Strömbrytaren gör ingenting där förrän du har sparat en gång med *Spara* (Ctrl+S) och webbläsaren har gett tillstånd att skriva. Sedan kan du slå på den. I Firefox förblir strömbrytaren grå: appen kan inte skriva till din fil där.

## Fallgropar och vad appen gör då

**Strömbrytaren hör till ett enda projekt.** Varje flik har sitt eget läge. Efter att du har öppnat ett projekt är den alltid av, och appen minns den inte nästa gång.

**Automatisk sparning skriver bara till den fil som projektet redan har.** Om du väljer *Spara som* skriver den till den nya filen från och med då. Appen skriver bara om det finns ändringar.

**Skrivningen kan misslyckas.** Om filen till exempel har försvunnit eller är låst visas meddelandet *Automatisk sparning misslyckades* med orsaken. Om webbläsaren inte (eller inte längre) har tillstånd att skriva hoppar appen tyst över den omgången. Den frågar inte om tillstånd.

**Filen får också ändringar som du hellre inte vill behålla.** Automatisk sparning skriver projektets läge precis så det är i just det ögonblicket. Om du ångrar något med Ctrl+Z får filen också det läget där ändringen är ångrad inom tio sekunder. Vill du behålla en äldre version gör du först en kopia med *Spara som*.

**En krasch kostar fortfarande de sista sekunderna.** Appen skriver högst en gång var tionde sekund, så det du gjorde däremellan finns ännu inte i din fil. Kraschskyddet har samma gräns.

**Efter en återställning i webbläsaren är strömbrytaren grå igen.** Ett projekt som du får tillbaka i webbläsaren efter en krasch är inte längre kopplat till sin fil. Spara det en gång, så fungerar strömbrytaren igen. Se [Återställning efter en krasch](docs://howto-herstellen-na-een-crash).

**Ett projekt i ett annat format har ingen fil.** En fil i CSV-, XML-, `.mpp`- eller `.xer`-format får först en IFC-fil när du sparar. Därefter kan du slå på automatisk sparning.

## Se även

- [Filer och format](docs://uitleg-bestanden): skillnaden mellan att spara, automatisk sparning och kraschskydd.
- [Öppna och spara en fil](docs://howto-bestand-openen-en-opslaan): spara, spara som och markeringen *Ej sparad*.
- [Återställning efter en krasch](docs://howto-herstellen-na-een-crash): vad appen erbjuder om den inte avslutades på rätt sätt.
