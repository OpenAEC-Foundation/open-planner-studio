# Ställa in arbetstider

Mål: registrera per veckodag vid vilka klockslag en kalender arbetar, så att uppgifter i timmar körs vid rätt tider.

## När du behöver det

Fredag eftermiddag är ledig. Arbetslaget arbetar från 06:00 till 22:00 i två skift. Det finns ett nattlag. Rasten är kortare än en timme. Så länge du planerar bara i dagar räcker *Start (timme)*, *Slut (timme)* och rasten ([Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen)). Om du planerar uppgifter i timmar räknar appen arbetsminuter inom kalenderns **band**. I appen kallas de *band*: ett band är en sammanhängande period med arbetstid på en veckodag. Ett glapp mellan två band är en rast. Vad det betyder för din tidsplan beskrivs i [Dagar och timmar](docs://uitleg-dagen-en-uren).

För detta behöver du *Aktivera timplanering* ([Så aktiverar du timplanering](docs://howto-urenplanning-aanzetten)). Utan timplanering ser du inte panelen *Arbetstider*.

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
2. Justera start- och sluttid för varje band i de två tidsfälten.
3. Vill du lägga in en rast klickar du på **+** (*Lägg till band*) för den dagen. Justera tiderna för banden så att det blir ett glapp mellan dem. Ett nytt band börjar 08:00 och slutar 16:00.
4. För ett band som går över midnatt markerar du *nästa dag*. Bandet räknas för den dag då det börjar.
5. Klicka på papperskorgen bakom ett band för att ta bort det. En dag utan band visas som *Ej arbetstid*.
6. För en dag från måndag till fredag klickar du på kopieringssymbolen (*Kopiera till alla arbetsdagar*) för att lägga banden för den dagen på måndag till fredag.
7. Längst ner står *Härledda timmar/dag:* med nettotimmarna per dag som appen härleder av detta. Klicka på *Tillämpa*.

**Exempel: en ledig fredag eftermiddag.** Klicka på *Ställ in per veckodag…*. Ta bort det andra bandet (13:00 till 16:00) för *Fre*. Fredag har nu 5 timmar, de andra dagarna 8. De härledda timmarna per dag är fortfarande 8.

### Spara en egen förinställning

1. Klicka på *Spara som förinställning…* och skriv ett namn i fältet *Namn på din egen förinställning*.
2. Klicka på *Spara*. Förinställningen finns nu bland de andra förinställningarna, och du kan använda den i alla projekt. Med krysset bredvid tar du bort den igen.

En egen förinställning sparas på den här enheten, inte i projektfilen.

## Fallgropar och vad appen gör då

**En förinställning ersätter allt.** Väljer du en förinställning försvinner arbetsdagarna och arbetstiderna som du ställde in tidigare. Helgdagarna finns kvar.

**Dagknappar och band är två olika saker.** Knapparna under *Arbetsdagar* ändrar inte banden. En dag får arbetstid när du klickar på *Lägg till band* för den dagen. Slår du bara på en dag med knappen, räknas den för uppgifter i dagar men inte för uppgifter i timmar. Har kalendern arbetstider, använd raderna per veckodag.

**Justera arbetstider när timplanering är avstängd.** Stänger du av timplanering igen, kommer fälten *Start (timme)*, *Slut (timme)* och rasten tillbaka. I en kalender med band ändrar de inte banden. Justera därför alltid arbetstiderna medan timplanering är på.

**Inga användbara arbetstider.** En kalender utan band eller utan arbetsdagar kan inte användas för en uppgift i timmar. Appen visar då *Kalendern har inga giltiga arbetstider. Kontrollera arbetsdagarna och arbetstiderna.*

## Se även

- [Dagar och timmar](docs://uitleg-dagen-en-uren): hur appen räknar arbetstimmar och härleder nettotimmar per dag.
- [Så aktiverar du timplanering](docs://howto-urenplanning-aanzetten): planera en uppgift i timmar.
- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): vilken kalender som gäller för vilken uppgift.
- [Kalenderfönster](docs://ref-kalenders): alla fält i kalenderfönstren.
