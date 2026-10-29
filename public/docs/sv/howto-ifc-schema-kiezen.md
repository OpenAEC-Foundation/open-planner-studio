# Välja IFC-schema

Mål: spara din tidsplan i det IFC-schema som byggnadsmodellen har, så att du kan slå ihop dem.

## När du behöver det

Som standard sparar appen ett projekt som IFC 4.3 ADD2. Det är namnet på IFC 4.3 i de filer som IfcOpenShell och Bonsai skapar. Om du vill slå ihop tidsplanen med en byggnadsmodell till en enda 4D-fil, till exempel med receptet *MergeProjects* i IfcOpenShell (ifcpatch), måste båda filerna ha samma schema. Om byggnadsmodellen är en IFC4-fil vägrar IfcOpenShell att slå ihop den med en tidsplan i IFC 4.3. Välj då schemat för modellen här.

## Steg

1. Öppna *Projektinställningar*: *Inställningar › Projekt › Projektinställningar*, eller *Fil › Projektinställningar*.
2. Välj schemat för din byggnadsmodell under *IFC-schema vid sparning*.
3. Klicka på *Tillämpa*. Projektet står nu som *Ej sparad*.
4. Spara med *Spara* (Ctrl+S) eller *Spara som*.

Här är de tre alternativen:

- *IFC 4.3 ADD2 (standard)* skriver `IFC4X3_ADD2` i filens huvud.
- *IFC 4.3* skriver `IFC4X3`. Så skrev äldre versioner av appen IFC 4.3.
- *IFC4* skriver `IFC4`, för en byggnadsmodell i IFC4.

## Fallgropar och vad appen gör

**Slå ihop som sista steg.** Öppna inte den ihopslagna 4D-filen (byggnadsmodell plus tidsplan) i appen för att spara den igen. Appen behåller bara tidsplanen: väggarna och de andra delarna av byggnadsmodellen försvinner, även om du behåller schemat. Ändra tidsplanen i din egen fil och slå ihop igen efteråt.

**Appen frågar först när en öppnad fil har ett annat schema.** Om du öppnar till exempel en IFC4-fil, eller en IFC 4.3-fil från en äldre version av appen, ändrar appen inte bara filtypen. Första gången du använder *Spara* eller *Spara som* frågar appen först om du vill behålla filens schema eller gå över till IFC 4.3 ADD2. *Behåll IFC4* (eller *Behåll IFC 4.3*) är knappen som Enter väljer. Om du stänger frågan med Esc eller krysset sparar appen ingenting.

**Appen frågar bara en gång per fil.** Ditt val sparas i filen själv. Om du öppnar den igen senare frågar appen inte igen. Om du väljer ett schema själv i *Projektinställningar* och klickar på *Tillämpa* frågar appen inte heller.

**Ett schema som appen inte kan skriva**, till exempel IFC2X3, öppnas i appen. Första gången du sparar säger frågan det, och du väljer ett av de tre schemana ovan.

**Automatisk sparning och kraschskydd frågar ingenting.** De skriver filens schema och behåller frågan till första gången du sparar själv. För ett schema som appen inte kan skriva, skriver *Automatisk sparning* inte till filen förrän du har svarat på frågan.

**Ett nytt projekt frågar ingenting.** Ett nytt projekt, och ett projekt från ett annat format som XER, MPP eller CSV, startar med *IFC 4.3 ADD2 (standard)*.

**Filens innehåll ändras inte.** De tre schemana stöder tidsplansdata som appen skriver på samma sätt. Bara raden `FILE_SCHEMA` i huvudet skiljer sig. Du förlorar alltså ingenting när du väljer ett annat schema.

**En IFC 4.3-modell från IfcOpenShell eller Bonsai** har oftast `IFC4X3_ADD2` i huvudet, precis som appens standard. IfcOpenShell slår inte ihop en tidsplan med `IFC4X3` i modellen. Om du är osäker, titta på raden `FILE_SCHEMA` överst i modellfilen.

**Ångra ändrar inte schemat.** Schemat hör till filen, precis som platsen där den sparas. Ett val i *Projektinställningar* och svaret på frågan vid sparning är därför inget steg i *Ångra*. Om du vill gå tillbaka väljer du det andra schemat i *Projektinställningar*. Då skriver *Automatisk sparning* aldrig tyst ett annat schema efter att du har ångrat en ändring.

## Se även

- [Nytt projekt och Projektinställningar](docs://ref-projectinfo): alla fält i formuläret.
- [Filer och format](docs://uitleg-bestanden): varför IFC är appens eget format.
- [Öppna och spara en fil](docs://howto-bestand-openen-en-opslaan): spara och spara som.
