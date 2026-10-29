# Ställa in arbetstider

Mål: registrera per veckodag vid vilka klockslag en kalender arbetar, så att uppgifter i timmar körs vid rätt tider.

## När du behöver det

Fredag eftermiddag är ledig. Arbetslaget arbetar från 06:00 till 22:00 i två skift. Det finns ett nattlag. Rasten är kortare än en timme. Så länge du planerar bara i dagar räcker *Start (timme)*, *Slut (timme)* och rasten ([Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen)). Om du planerar uppgifter i timmar räknar appen arbetsminuter inom kalenderns **band**. I appen kallas de *band*: ett band är en sammanhängande period med arbetstid på en veckodag. Ett glapp mellan två band är en rast. Vad det betyder för din tidsplan beskrivs i [Dagar och timmar](docs://uitleg-dagen-en-uren).

Om du vill att en vanlig kalender får band behöver du *Aktivera timplanering* ([Så aktiverar du timplanering](docs://howto-urenplanning-aanzetten)). Har kalendern redan band, till exempel från en MS Project-fil, finns panelen *Arbetstider* alltid kvar. Du ändrar banden då också med timplanering avstängd.

## Steg

### Välja en skiftförinställning

1. Välj *Tidsplan › Kalender › Kalender* och markera kalendern till vänster.
2. I panelen *Arbetstider* klickar du på en förinställning. Den ersätter kalenderns arbetsdagar och arbetstider.
3. Klicka på *Tillämpa*.

Varje förinställning gör följande:

- *Dagskift*: måndag till fredag från 08:00 till 16:00 utan rast. Då blir kalendern en vanlig kalender igen, utan band.
- *2 skift*: måndag till fredag från 06:00 till 14:00 och från 14:00 till 22:00, sammanlagt 16 timmar.
- *3 skift*: måndag till fredag tre skift, från 06:00 till 14:00, från 14:00 till 22:00 och från 22:00 till 06:00 nästa dag, sammanlagt 24 timmar.
- *Nattskift*: måndag till fredag från 22:00 till 06:00 nästa dag, 8 timmar.
- *24/7*: alla sju dagar från 00:00 till 24:00.

### Ställa in arbetstider per veckodag

1. I panelen *Arbetstider* klickar du på *Ställ in per veckodag…*. Under knapparna visas en rad per veckodag med arbetstiden för den dagen. Kalendern får nu band per veckodag. Har kalendern redan band, är den här översikten öppen direkt. Knappen heter då *Dölj arbetstider* och fäller ihop den.
2. Justera start- och sluttid för varje band i de två tidsfälten. Skriv tiden och tryck på Enter, eller använd pilarna (15 minuter per steg). Fälten följer *Tidsformat* i inställningarna. *13:00* och *1:00 PM* fungerar båda.
3. Vill du lägga in en rast klickar du på **+** (*Lägg till band*) för den dagen. Justera tiderna för banden så att det blir ett glapp mellan dem. Ett nytt band börjar 08:00 och slutar 16:00.
4. För ett band som går över midnatt markerar du *nästa dag*. Bandet räknas för den dag då det börjar.
5. Klicka på papperskorgen bakom ett band för att ta bort det. En dag utan band visas som *Ej arbetstid*.
6. För en dag från måndag till fredag klickar du på kopieringssymbolen (*Kopiera till alla arbetsdagar*) för att lägga banden för den dagen på måndag till fredag.
7. Ovanför panelen *Arbetstider* står *Standardarbetsdag*: arbetstiden per dag som appen härleder från banden och räknar med. Siffran ändras direkt när du ändrar banden. Har kalendern egna timmar per dag (till exempel från Primavera P6), behålls det egna värdet och följer med vid export, tills en förinställning ersätter det. Skiljer sig det egna värdet från *Standardarbetsdag*, visas direkt under siffran en orange ruta, till exempel: *Filen har en egen arbetsdag på 8h. Den följer med vid export till MS Project och P6. Där räknas en dag som 8h, här 10h.* Rutan försvinner så snart banden ger samma dagsumma, eller när en förinställning ersätter det egna värdet. Rutan ändrar inte beräkningen. Klicka på *Tillämpa*.

**Exempel: en ledig fredag eftermiddag.** Klicka på *Ställ in per veckodag…*. Ta bort det andra bandet (13:00 till 16:00) för *Fre*. Fredag har nu 5 timmar, de andra dagarna 8. *Standardarbetsdag* är fortfarande 8 timmar.

### Spara en egen förinställning

1. Klicka på *Spara som förinställning…* och skriv ett namn i fältet *Namn på din egen förinställning*.
2. Klicka på *Spara*. Förinställningen finns nu bland de andra förinställningarna, och du kan använda den i alla projekt. Med krysset bredvid tar du bort den igen.

En egen förinställning sparas på den här enheten, inte i projektfilen.

## Fallgropar och vad appen gör då

**En förinställning ersätter allt.** Väljer du en förinställning försvinner arbetsdagarna och arbetstiderna som du ställde in tidigare. Helgdagarna finns kvar.

**Dagknappar ändrar banden.** Stänger du av en dag under *Arbetsdagar*, försvinner banden för den dagen. Slår du på den igen, får den tillbaka de band den hade när du öppnade dialogrutan (eller efter den senaste förinställningen), annars banden för den första arbetsdagen. *Mån–fre* gör det för måndag till fredag och tar bort banden för lördag och söndag. *Kontinuerligt (24/7)* ersätter alla band: varje dag får 00:00 till 24:00.

**Justera arbetstider när timplanering är avstängd.** En kalender med band behåller panelen *Arbetstider*, också när du stänger av timplanering. Där ändrar du banden helt enkelt. Väljer du *Dagskift* blir det en vanlig kalender igen med fälten *Start (timme)*, *Slut (timme)* och rasten. Då går det bara att lägga tillbaka band med timplanering på.

**Inga användbara arbetstider.** En kalender utan band eller utan arbetsdagar kan inte användas för en uppgift i timmar. Appen visar då *Kalendern har inga giltiga arbetstider. Kontrollera arbetsdagarna och arbetstiderna.*

## Se även

- [Dagar och timmar](docs://uitleg-dagen-en-uren): hur appen räknar arbetstimmar och härleder standardarbetsdagen.
- [Så aktiverar du timplanering](docs://howto-urenplanning-aanzetten): planera en uppgift i timmar.
- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): vilken kalender som gäller för vilken uppgift.
- [Kalenderfönster](docs://ref-kalenders): alla fält i kalenderfönstren.
