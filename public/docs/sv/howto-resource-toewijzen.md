# Tilldela resurser med en kurva

Mål: lägg en resurs på en uppgift, med tilldelningsenheter per dag och en kurva som avgör hur de tilldelningsenheterna fördelas över uppgiftens dagar.

## När du behöver detta

Så snart du vill se vem som arbetar var och när: muraren på ytterbladet i hålmuren, kranen på håldäcksplattorna. Utan tilldelning finns ingen belastning. Därmed finns inget histogram och ingen överbeläggning.

Två begrepp. **Tilldelningsenheterna** (i appen *Enh./dag*) är hur mycket av resursen som arbetar på uppgiften per arbetsdag: 1 är en murare, 2 är två av dem, 0,5 är en halv dag. **Kurvan** avgör hur totalen, tilldelningsenheter gånger varaktighet, fördelas över uppgiftens arbetsdagar. Arbete är sällan jämnt: på en vägg är starten lugn, mitten full av arbete och slutet lugnt igen.

Ytterbladet i hålmuren tar 6 arbetsdagar. Med en murare och kurvan *Jämn* blir det 1 tilldelningsenhet på var och en av de 6 dagarna, 6 tillsammans. Med kurvan *Klockformad* blir det fortfarande 6 tilldelningsenheter tillsammans, men fördelningen blir 0, 1, 2, 2, 1 och 0.

## Steg

Du kan tilldela en resurs på två sätt. Resursen måste redan finnas (se [Hantera resurser](docs://howto-resources-beheren)).

### Via menyfliksområdet

1. Välj en uppgift i uppgiftstabellen. Det måste vara en vanlig uppgift, inte en milstolpe och inte en fas.
2. Välj *Resurser › Tilldelning › Tilldela ▾*.
3. Fyll i *Enh./dag* (standard 1) och välj *Kurva* (standard *Jämn*) i fönstret. Värdena gäller för resursen du väljer nu.
4. Klicka på resursen. Fönstret stängs och tilldelningen finns där.

För en andra resurs öppnar du fönstret igen. Resurser som redan finns på uppgiften saknas i listan.

### Via egenskapspanelen

1. Välj uppgiften. Egenskapspanelen finns till höger. Ser du den inte, slå på den med *Visa › Paneler › Egenskaper*.
2. I blocket *Tilldelningar*, längst ned, väljer du resursen vid *Tilldela resurs*. Tilldelningen startar med tilldelningsenheter på 1 och kurvan *Jämn*.
3. För varje tilldelning ändrar du *Enh./dag* och väljer en annan *Kurva*.

Så ändrar du även en befintlig tilldelning. Med papperskorgen (*Ta bort*) bredvid namnet tar du bort tilldelningen från uppgiften. Resursen själv finns kvar. Med *Flytta till…* flyttar du tilldelningen till en annan uppgift.

### Kurvorna

- *Jämn*: samma varje dag. Det är standard och passar arbete som är lika tungt varje dag.
- *Framtung*: starten är tyngre än slutet. Passar arbete som börjar med tung insats, till exempel utsättning.
- *Baktung*: slutet är tyngre än starten. Passar arbete som blir mer intensivt mot slutet.
- *Klockformad*: en topp i mitten, med en lugn start och ett lugnt slut. Passar en vägg som börjar lugnt, är i full gång i mitten och avtar.
- *Tidig topp*: en topp före mitten. Passar arbete som snabbt kommer igång.
- *Sen topp*: en topp efter mitten. Passar arbete vars intensiva period kommer först sent.
- *Dubbel topp*: två toppar. Passar arbete med två intensiva moment.
- *Sköldpadda*: en lugn start och ett lugnt slut med en bred topp i mitten. Passar långt arbete som byggs upp och avtar gradvis.

Kurvan ändrar bara fördelningen. Varaktigheten, datumen och totalen är oförändrade. Du behöver inte beräkna om efteråt. Histogrammet uppdateras direkt. Välj *Resurser › Histogram › Histogram* för att se det. Om du väljer en uppgift visar histogrammet bara belastningen för den uppgiften.

## Fallgropar och vad appen gör då

**En kurva kan driva toppen över dina tilldelningsenheter.** Med hela tal som tilldelningsenheter avrundar appen värdet per dag till hela tilldelningsenheter. Totalen blir densamma. En murare med 1 tilldelningsenhet på ytterbladet i hålmuren och kurvan *Klockformad* ger 0, 1, 2, 2, 1, 0. På de två mittendagarna är det 2 tilldelningsenheter mot *Max enheter* på 1. Histogrammet färgar de dagarna röda och resursen har överbeläggning. Välj en annan kurva, eller fördela timmarna själv (se [Justera timfördelningen](docs://howto-urenverdeling-aanpassen)). Med tilldelningsenheter som 0,5 avrundar appen till hundradelar. På en kort uppgift med hela tilldelningsenheter blir formen därför grov: över 10 dagar ger *Sköldpadda* med tilldelningsenheter på 1 fördelningen 0, 1, 1, 2, 2, 1, 1, 1, 1, 0, precis samma som *Tidig topp*.

**Ingen milstolpe eller fas.** Då är knappen *Tilldela* inaktiv. Panelen *Egenskaper* visar *Tilldelningar är inte möjliga på milstolpar.* eller *Tilldelningar är inte möjliga på sammanfattningsuppgifter.*

**En resurs kan bara läggas till en gång per uppgift.** Finns resursen redan på uppgiften, finns den inte längre i listan. Är alla resurser redan på uppgiften, säger appen *Alla resurser är redan tilldelade.* Finns ännu ingen resurs, säger den *Skapa först resurser (Resources-fliken).*

**Tilldelningsenheterna måste vara större än 0.** Appen accepterar inte ett värde på 0 eller lägre.

**Material.** För en materialresurs är tilldelningsenheterna mängden per dag, i resursens enhet, till exempel m³. Material räknas inte in i uppgiftens varaktighet.

**En arbetsregel kan ändra varaktigheten.** Står uppgiften på *Fast arbete* eller *Fasta enheter*, ändrar en andra resurs uppgiftens varaktighet. Tidsplanen är då inte längre aktuell. Tryck på **Beräkna** (F5). Se [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels).

**En egen fördelning.** Har tilldelningen redan en egen timfördelning, är kurvan inaktiv och visar *Profil*. Ta först bort den fördelningen via *Timfördelning…*.

**Ångra.** Du kan ångra att du skapar, ändrar eller tar bort en tilldelning med *Ångra* (Ctrl+Z).

## Se även

- [Justera timfördelningen](docs://howto-urenverdeling-aanpassen): att du själv ställer in timmarna per dag.
- [Åtgärda överbeläggning](docs://howto-overbezetting-oplossen): vad du gör när en resurs har för mycket att göra en dag.
- [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels): vad som händer med varaktigheten när du ändrar tilldelningsenheterna.
- [Resurspanelen](docs://ref-resourcepaneel): alla fält och knappar i resurspanelen.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): alla fem resurstyper, alla sex kurvor och en tornkran med ett kapacitetssteg från 30 augusti 2027.
