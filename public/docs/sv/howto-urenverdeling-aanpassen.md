# Justera timfördelningen

Mål: för en tilldelning bestämmer du själv hur mycket resursen arbetar på varje arbetsdag under uppgiften, i stället för att använda en standardkurva.

## När du behöver det

En kurva som *Klockformad* har en fast form. Ibland vet du bättre. Murararen börjar på ytterbladet med halv kraft, eftersom byggnadsställningen fortfarande sätts upp, och arbetar sedan heltid. Eller så vill du hålla en topp precis under kapaciteten. Då justerar du **timfördelningen**.

Du arbetar med **faser**: på varandra följande arbetsdagar då resursen arbetar med samma antal tilldelningsenheter. Fördelningen ändrar bara timmarna per dag för just den här tilldelningen. Uppgiftens datum ändras inte.

## Steg

Exemplet är ytterbladet: 6 arbetsdagar, en murare, 48 timmar.

1. Markera uppgiften. Panelen *Egenskaper* finns till höger. Om du inte ser den slår du på den med *Visa › Paneler › Egenskaper*.
2. I avsnittet *Tilldelningar* klickar du på ikonen med staplar bredvid murararen, *Timfördelning…*. Fönstret *Timfördelning i faser* öppnas. Du startar från det som appen bokar nu: för ytterbladet är det en fas på 6 dagar med 1 tilldelningsenhet.
3. Vid behov väljer du en startpunkt vid *Tillämpa form:*. Med *Klockformad* skapar appen fem faser: 0,18 tilldelningsenheter på första och sista dagen, 0,84 på andra och femte dagen och 1,98 på de två mellersta dagarna. Totalen förblir 48 timmar.

### Justera faserna

Du kan arbeta i tabellen eller i remsan ovanför den.

- Skriv en annan *Tilldelningsenheter/dag* för en fas. Kolumnerna *Timmar/dag* och *Timmar* beräknas automatiskt.
- Ändra antalet *Dagar* i en fas. Den sista fasen går alltid till slutet av uppgiften och får de dagar som återstår.
- Välj *Dela upp* för att dela en fas i två, till exempel 6 dagar i 3 och 3. Välj *Slå ihop* för att slå ihop en fas med nästa.
- I remsan drar du en gräns för att förlänga eller förkorta en fas. Du drar den övre kanten för att ställa in antalet tilldelningsenheter. Du dubbelklickar på en dag för att dela upp en fas.

### Tillämpa

Välj *Tillämpa*. Med *Avbryt* stänger du fönstret utan ändringar.

Ett exempel. Du väljer *Dela upp*, ställer in *Dagar* för den första fasen på 2 och antalet tilldelningsenheter per dag för den fasen på 0,5. Den andra fasen går sedan 4 dagar med 1 tilldelningsenhet per dag. Totalen är 2 × 0,5 × 8 + 4 × 1 × 8 = 40 timmar.

Efter *Tillämpa* är kurvan för tilldelningen satt till *Profil*, och den är inaktiverad. *Enh./dag* ändras inte. Histogrammet och överbeläggningen följer den nya fördelningen direkt. Du behöver inte beräkna om, eftersom inget datum flyttas.

### Släppa fördelningen

Om tilldelningen har en egen fördelning har fönstret också *Släppa fördelningen*. Då tar du bort din egen fördelning, och appen går tillbaka till *Enh./dag* och kurvan. Välj också *Släppa fördelningen* om du vill ändra kurvan. Listrutan *Kurva* är inaktiverad så länge det finns en egen fördelning.

## Fallgropar och vad appen gör då

**Totalen ändras också.** Du delar inte upp timmarna, du bestämmer dem. Om du ställer in en fas på 0,5 i stället för 0,18 blir totalen större. Totalen i timmar finns längst ner i fönstret. Kontrollera den innan du klickar på *Tillämpa*.

**Vad enheterna gör efteråt beror på arbetsregeln.** Med *Fast varaktighet och fasta enheter* ändrar ett annat *Enh./dag* ingenting i fördelningen. Med *Fast varaktighet och fast arbete* skalar appen timmarna per dag med de nya enheterna. Vid 2 enheter i stället för 1 blir varje dag dubbelt så stor, och totalen också (från 32 till 64 timmar). Varaktigheten är densamma. Med *Fast arbete* ändrar enheterna uppgiftens varaktighet. Fördelningen pressas då ihop eller sträcks ut över den nya varaktigheten, med samma total. Med *Fasta enheter* ändrar enheterna också varaktigheten. Kontrollera totalen längst ner i fönstret efteråt.

**Ändrar du uppgiftens varaktighet, sträcks fördelningen ut med den.** Formen är densamma. Med *Fast varaktighet och fasta enheter* och med *Fasta enheter* växer totalen i proportion till varaktigheten. Om varaktigheten för en uppgift med en egen fördelning fördubblas från 4 till 8 arbetsdagar, fördubblas även totalen, från 32 till 64 timmar. Med *Fast varaktighet och fast arbete* och med *Fast arbete* är totalen densamma (32 timmar förblir 32 timmar) och enheterna minskar.

**Arbetet följer fördelningen.** *Arbete (kvar)* blir summan av dina faser, även under *Fast arbete*. Uppgiftens varaktighet ändras inte på grund av det.

**Ogiltiga enheter.** Ett tomt eller negativt antal tilldelningsenheter får en röd kant, och *Tillämpa* blir då inaktiverad. En fas med 0 tilldelningsenheter är tillåten. En sådan fas stannar inom uppgiftens varaktighet.

**Allt gäller bara den här tilldelningen.** Appen säger det själv: *Fördelningen ändrar bara timmarna per dag för den här tilldelningen; uppgiftens datum och uppdelningar förblir som de är.* Andra resurser på samma uppgift behåller sin egen fördelning.

**Utjämningen följer fördelningen.** Utjämningsfunktionen räknar samma timmar per dag som histogrammet.

**Att ångra.** *Tillämpa* och *Släppa fördelningen* är var sitt steg som du kan ångra med *Ångra* (Ctrl+Z).

## Se även

- [Tilldela resurser med en kurva](docs://howto-resource-toewijzen): lägga en resurs på en uppgift och välja en kurva.
- [Lösa överbeläggning](docs://howto-overbezetting-oplossen): vad du gör när en resurs har för mycket att göra på en dag.
