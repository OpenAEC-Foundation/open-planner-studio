# Skapa en hängmatta

Mål: skapa en uppgift som inte känner till sin egen varaktighet, men som löper från början av en uppgift till slutet av en annan, till exempel arbetsplatsinrättning, tillsyn eller hyra av en byggbod.

## När du behöver detta

Byggboden står kvar så länge bygget pågår, från de första markarbetena till överlämningen. Om du ger den uppgiften en fast varaktighet på 13 arbetsdagar följer den inte med när murningen blir försenad. Då stämmer tidsplanen inte längre. En **hängmatta** (även kallad *level of effort*) följer uppgiften du hänger den på. Dess början kommer från ett samband för start, dess slut från ett samband för slut, och dess varaktighet är skillnaden mellan de två.

## Steg

1. Skapa uppgiften, till exempel *Site cabin*, eller välj en befintlig uppgift. En milstolpe och en sammanfattningsuppgift (fas) kan inte vara en hängmatta. I panelen *Egenskaper* och i *Redigera uppgift* saknas kryssrutan för en sådan uppgift. I tabellkolumnen går det inte att ändra.
2. Markera *Hängmatta (härledd varaktighet)* i panelen *Egenskaper*, i *Redigera uppgift* (högerklicka på uppgiften, välj *Redigera...*) eller i tabellkolumnen *Hängmatta (härledd varaktighet)* under *Tidsplan*. Fältet *Varaktighet* kan då inte längre redigeras.
3. Lägg till ett samband från den uppgift som hängmattan börjar med till hängmattan, av typen **SS** (hängmattan startar tillsammans med den uppgiften) eller **FS** (hängmattan startar efter den uppgiften). Så gör du: markera hängmattan, klicka på *Lägg till samband* under *Samband*, låt riktningen vara kvar på *Föregående*, välj uppgiften och välj typen. Stegen beskrivs i [Lägga till samband](docs://howto-relaties-leggen).
4. Lägg till ett samband från den uppgift som hängmattan slutar med till hängmattan, av typen **FF** (hängmattan slutar tillsammans med den uppgiften) eller **SF**.
5. Titta i panelen *Egenskaper* under *Hängmatta (härledd varaktighet)*. Där ser du *Startdrivande samband* med uppgiften och typen, och *Slutdrivande samband* med uppgiften och typen. En drivande uppgift är en uppgift som hängmattan tar sin början eller sitt slut från.
6. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*. Hängmattan löper nu från början av uppgiften i det startdrivande sambandet till slutet av uppgiften i det slutdrivande sambandet. *Varaktighet* visar den härledda varaktigheten.

I Gantt är en hängmatta en tunn turkos balk med en krok i båda ändarna.

Exempel: *Site cabin* får SS från *Groundwork* (måndag 7 juni 2027) och FF från *Roofing* (klar onsdag 23 juni). Efter **Beräkna** löper hängmattan från måndag 7 till onsdag 23 juni: 13 arbetsdagar. Om murningen blir 2 arbetsdagar försenad blir slutet av *Roofing* fredag 25 juni, och hängmattan växer med till 15 arbetsdagar.

## Så hanterar appen en hängmatta

- En hängmatta är aldrig kritisk och har inget slack. Den begränsar inte heller de uppgifter den tar sin början och sitt slut från: de får inget senaste datum på grund av hängmattan.
- En fördröjning räknas. Med SS och fördröjning `1d` startar hängmattan en arbetsdag efter det startdrivande sambandet. Med FF och fördröjning `2d` slutar den två arbetsdagar efter det slutdrivande sambandet.

## Fallgropar och vad appen gör

**Inget slutdrivande samband.** Om hängmattan inte har något FF- eller SF-samband kan appen inte räkna ut dess slut. Panelen *Egenskaper* säger *Inget slutdrivande samband (FF/SF). Spannet blir då noll*, och panelen *Varningar* säger *Hängmatta utan slutdrivande samband (inget FF/SF-föregående): varaktigheten sätts till noll*. Hängmattan startar och slutar då samma dag. Lägg till ett FF- eller SF-samband.

**En hängmatta som slutar efter den sista uppgiften.** Om hängmattan fortsätter tills efter den sista uppgiften, till exempel med FF och en fördröjning på 2 arbetsdagar, flyttas projektets slutdatum med. De uppgifter du faktiskt utför får då slack. Ingen av dem är längre kritisk.

**Uppgifter som väntar på en hängmatta.** Om du lägger till ett samband från hängmattan till en annan uppgift, startar den uppgiften först efter hängmattans slut. Hela kedjan före hängmattan, även de uppgifter som hängmattan tar sin början och sitt slut från, får då slack och är inte längre kritisk. Hängmattan ger nämligen inget tryck tillbaka. Låt därför inga uppgifter vänta på en hängmatta. Koppla sådana uppgifter hellre till hängmattans slutdrivande samband.

**Att ange en varaktighet.** Fältet *Varaktighet* för en hängmatta är härlett och kan inte redigeras. En varaktighet som du angav innan du markerade kryssrutan räknas inte längre.

## Se även

- [Lägga till samband](docs://howto-relaties-leggen): stegen för att lägga till ett samband av typen SS eller FF.
- [Samband och fördröjning](docs://uitleg-relaties): vad SS och FF betyder och hur fördröjningen räknas.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad kritisk betyder och hur slack fungerar.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): innehåller hängmattan *Structural works tower A (LOE)*.
