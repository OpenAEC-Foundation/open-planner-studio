# Välja en arbetsregel

Mål: ställ in per uppgift vad appen justerar när du ändrar varaktigheten, tilldelningsenheterna eller arbetet. Det kan vara varaktigheten, tilldelningsenheterna eller arbetet självt.

## När du behöver detta

Du har tilldelat resurser till en uppgift och du vill att appen beräknar på samma sätt som du gör. Ett exempel: kranen hyrs för en dag och den dagen är fast. Ett annat exempel: du vet att det finns 160 timmars murverk och du vill se hur lång tid det tar med tre personer i stället för två. Dessa två situationer behöver olika arbetsregler.

Regeln avgör vilken av de tre storheterna varaktighet, tilldelningsenheter och arbete som följer med när du ändrar en av de andra. Bakgrund och exempel med uträkning finns i [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels).

## Steg

### Visa arbetsregeln

Arbetsregeln visas inte som standard. Slå på den en gång:

1. Välj *Inställningar › Projekt › Inställningar*, fliken *Tidsplan*.
2. Under rubriken *Beräkning* bockar du för *Visa arbetsregler och arbete*.
3. Stäng fönstret med *Stäng*.

Det här är en inställning i appen, inte i projektfilen. Om en fil redan innehåller arbetsregler eller lagrat arbete, till exempel en fil från MS Project eller Primavera P6, visar appen arbetsregeln för den filen även utan den här inställningen. Detsamma gäller så snart du själv väljer en arbetsregel i en fil: visningen blir då kvar för den filen, även om du stänger av inställningen igen. Den blir kvar så länge filen är öppen. Efter att du öppnat filen igen blir den kvar så länge filen innehåller en arbetsregel eller lagrat arbete.

### Välja en regel

1. Markera uppgiften. Panelen *Egenskaper* finns till höger. Ser du den inte, slå på den med *Visa › Paneler › Egenskaper*.
2. Under *Arbetsregel* väljer du ett av de fem alternativen: *Projektstandard (Fast varaktighet och fasta enheter)*, *Fast varaktighet och fasta enheter*, *Fast varaktighet och fast arbete*, *Fast arbete* eller *Fasta enheter*. Med *Projektstandard* följer uppgiften projektets standard.
3. Under listrutan visar appen vad regeln skyddar, till exempel *Skyddat: arbete (varaktigheten följer enheterna)*.

*Projektstandard* är det första alternativet. Det är det alternativ som en uppgift har som standard. Regeln mellan parenteserna är den regel som projektet nu har som standard. Appen har ingen knapp för att ändra projektstandarden. Den kommer från en import (till exempel från MS Project eller Primavera P6) eller från MCP-kopplingen. Vill du en annan regel för en uppgift, väljer du den här.

Du kan också välja regeln i tabellen. Klicka på **+** till höger om rubrikraden i uppgiftstabellen (*Lägga till kolumn*) och välj under *Tidsplan* kolumnen *Arbetsregel*.

En uppgift utan tilldelning har inget att koppla ihop, så regeln gör ingenting där. Tilldela först en resurs (se [Tilldela resurser med en kurva](docs://howto-resource-toewijzen)).

### Se och ändra arbetet

För en uppgift med tilldelningar visas kolumnen *Arbete (kvar)* i blocket *Tilldelningar* i panelen *Egenskaper*, bredvid *Enh./dag*. Det är det återstående arbetet för den resursen, i timmar. En liten hänglås ovanför en kolumn visar vad regeln håller fast: *Enh./dag* med *Fast varaktighet och fasta enheter* och med *Fasta enheter*, *Arbete (kvar)* med *Fast varaktighet och fast arbete* och med *Fast arbete*.

Vill du ändra arbetet själv skriver du timmarna i fältet och trycker på Enter. Appen godtar inget värde på 0 eller lägre: fältet hoppar tillbaka till det föregående värdet.

### Se vad som händer

När du väljer en regel ändras ännu inget tal. Under en regel som skyddar arbetet låser appen bara det aktuella arbetet, så *Arbete (kvar)* får ett lagrat värde. Först vid nästa ändring avgör regeln vad som följer med. Ändra till exempel *Enh./dag* och se vad som händer med varaktigheten och arbetet.

Ändrar det uppgiftens varaktighet visar statusfältet *Inaktuell — beräkna om (F5)*. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*, för att se de nya datumen. Är *Beräkna automatiskt* på (samma flik *Tidsplan*, rubriken *Beräkning*) gör appen det själv.

## Vilken regel som passar

- **Fast varaktighet och fasta enheter** passar när varaktigheten är en överenskommelse och tilldelningsenheterna är det du själv anger. Arbetet följer av dessa två. Det här är standard. Kranen som hyrs för en dag hör hit: dagen är fast och du bestämmer hur många kranar som finns på den.
- **Fast varaktighet och fast arbete** passar när uppgiften måste bli klar inom en fast tidsram och du vet hur mycket arbete det finns i den. Ändras varaktigheten justerar appen tilldelningsenheterna.
- **Fast arbete** passar när du vet hur många timmar arbete det finns i uppgiften och vill se hur varaktigheten rör sig med antalet personer. De 160 timmarna murverk med tre personer i stället för två hör hit. Putsningen i övningsprojektet får den här regeln.
- **Fasta enheter** passar när tilldelningsenheterna är fasta, till exempel en kran, och arbetet avgör varaktigheten.

## Fallgropar och vad appen gör då

**Fältet *Arbetsregel* saknas.** Då är inställningen *Visa arbetsregler och arbete* avstängd och filen har ännu inga arbetsregler, eller så har du markerat en milstolpe, en fas, en hängmatta eller en uppgift med varaktighetstypen *Förfluten tid*. Där finns ingen arbetsregel. Markera en vanlig uppgift.

**Varaktigheten ändras utan att du ändrar den.** Under *Fast arbete* och *Fasta enheter* följer varaktigheten av tilldelningsenheterna och arbetet. Ändrar du något av dem eller antalet resurser justerar appen varaktigheten och avrundar uppåt till hela arbetsdagar. För en uppgift i timmar avrundar appen uppåt till hela minuter.

**Arbetet stämmer inte exakt med tilldelningsenheter × varaktighet.** Avrundning kan orsaka det. Bredvid *Arbete (kvar)* visas då en varningssymbol, *Avviker från tilldelningsenheter × varaktighet*. Histogrammet följer det lagrade arbetet.

**Material räknas inte.** För en materialresurs visar *Arbete (kvar)* ett streck. Material styr aldrig varaktigheten.

**En uppgift med framdrift.** Regeln verkar på den återstående delen. Därför visar *Arbete (kvar)* bara det som ännu återstår att göra.

**Ångra.** Att välja en regel, och varje ändring som regeln beräknar, är ett steg som *Ångra* tar bort (Ctrl+Z). Regeln är då borta igen, men fältet *Arbetsregel* finns kvar i vyn.

## Se även

- [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels): hur appen kopplar ihop varaktighet, tilldelningsenheter och arbete, med exempel med uträkning.
- [Tilldela resurser med en kurva](docs://howto-resource-toewijzen): hur du lägger en resurs på en uppgift.
