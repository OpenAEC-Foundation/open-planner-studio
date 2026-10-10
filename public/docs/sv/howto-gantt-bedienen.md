# Dra, panorera och zooma i Gantt

Mål: använd tidslinjen med musen: flytta en balk eller justera dess varaktighet, förskjut tidslinjen, markera uppgifter med en ruta och zooma in och ut.

## När du behöver detta

Du ser i Gantt att murverket måste börja två dagar senare, eller att gjutningen tar en dag längre. Då vill du göra det direkt på balken. Eller så har du ett projekt på flera månader och vill snabbt scrolla till byggets helgdag. Musen har några gester för det. Vilken gest som gör vad beror på var du börjar dra och på din scrollinställning.

## Steg

### Flytta en balk

1. Håll ned musknappen på mitten av en uppgiftsbalk och dra horisontellt. Start och slut flyttas tillsammans, i hela dagar. Varaktigheten blir densamma.
2. Släpp musknappen. Balken stannar på sin nya plats. Tidsplanen är då inte längre aktuell. Välj *Beräkna* (F5), eller låt appen göra det själv om *Beräkna automatiskt* är på.

Om uppgiften har en föregående uppgift registrerar appen den nya starten som restriktionen *Starta tidigast (SNET)*. Appen säger det när du släpper musknappen. Varför det sker, och vad som händer med en annan restriktion, står i [Restriktioner och måldatum](docs://uitleg-constraints). Drar du tillbaka till den ursprungliga starten, så kommer även den ursprungliga restriktionen tillbaka.

Drar du mest uppåt eller nedåt i stället för åt sidan, flyttar du uppgiften till en annan rad. Datumen stannar. Riktningen du väljer i de första pixlarna gäller för hela draget. Därför ändrar en gest aldrig datum och struktur samtidigt. Se [Ändra strukturen](docs://howto-structuur-aanpassen).

### Justera varaktigheten

1. Flytta musen till balkens högra kant. Markören blir en pil som pekar åt vänster och höger.
2. Dra i kanten. Medan du drar visar en liten etikett i temats accentfärg (som standard orange) den varaktighet uppgiften får nu, till exempel *4d*. Etiketten följer med direkt, så du ser den nya varaktigheten innan du släpper musknappen. Vid den högra kanten ligger etiketten inne i balken. Vid den vänstra kanten ligger den precis till vänster om balken. Etiketten visar varaktigheten på samma sätt som kolumnen varaktighet.
3. Släpp musknappen. Varaktigheten är den som etiketten visade.

Den vänstra kanten flyttar starten och lämnar slutet kvar. Uppgiften blir därmed kortare eller längre i början. Samma SNET-regel gäller som när du flyttar. Drar du i mitten av balken syns etiketten inte. Varaktigheten ändras inte.

Varaktigheten räknar arbetsdagar i uppgiftens kalender. Helger och helgdagar räknas inte. En uppgift i dagar kan inte bli kortare än en arbetsdag. För en uppgift i timmar avrundar appen till det steg på tidslinjen som finns under musen. Det är minst en timme, eller ett kvarter om du zoomar in tillräckligt långt och *Visa kvarter när du zoomar in mycket* är på.

Ett drag är ett enda steg i *Ångra*, hur länge du än drar. På en delad balk fungerar kanterna på ett annat sätt. Se [Dela en uppgift](docs://howto-taak-splitsen).

### Förskjuta tidslinjen

Vad ett drag på den tomma bakgrunden gör beror på ditt scrolläge. Du väljer det i *Inställningar*, fliken *Utseende*, under *Gantt › Scrolla & zooma* vid *Läge*:

- **Zooma + dra** (standard): om du drar på den tomma bakgrunden med vänster musknapp, rör sig tidslinjen med musen, som på en karta. Markören är en hand. På en balk startar ett drag bara en balkgest.
- **Position** och **Tangenter**: samma drag gör en markeringsruta. Du förskjuter tidslinjen med hjulet (se [Inställningar](docs://ref-instellingen)) eller med mellersta musknappen.

**Mellersta musknappen** (när du trycker på hjulet) förskjuter tidslinjen i alla lägen, även om du startar på en balk. Den fungerar inte medan en annan gest pågår, till exempel när du drar en balk.

### Markera uppgifter med en ruta

En ruta markerar alla uppgifter i de rader som rutan rör vid. Bara rutans höjd räknas, inte tidsaxeln.

1. Börja på den tomma bakgrunden. Med *Zooma + dra* håller du ned Ctrl (⌘ på en Mac) medan du gör det. Med *Position* och *Tangenter* behövs det inte.
2. Dra över de rader du vill markera. Markeringen får en ram.
3. Släpp musknappen. Tryck på Esc medan du drar för att avbryta rutan. Markeringen blir kvar som den var.

Mer om markering finns i [Markera, ta bort och ångra uppgifter](docs://howto-taken-selecteren-verwijderen). I den tomma ytan i uppgiftstabellen själv gör ett drag ingenting.

### Zooma in och ut

1. Använd *Zooma +* och *Zooma -* (*Start › Zooma*), eller tangenterna + och -. Hjulet zoomar också. När det gör det beror på ditt scrolläge (se [Inställningar](docs://ref-instellingen)).
2. Vill du se hela projektet, välj *Visa › Tidsskala › Anpassa till projekt* eller tryck på Ctrl+0. *Återställ* (på fliken *Visa*) eller tangenten 0 ställer zoomen tillbaka till standardnivån.
3. Längst ned till höger i statusfältet står zoomen i pixlar per dag, till exempel *Zoom: 15 px/dag*.

Ju längre du zoomar ut, desto färre rutnätslinjer finns det. Vid 8 pixlar per dag eller mer finns det en linje för varje dag, med en tjockare linje vid veckogränsen. Mellan 2 och 8 pixlar per dag finns bara veckogränsen kvar. Under 2 pixlar per dag, på årsnivå, finns bara månadsgränserna kvar. Annars blir ritytan ett jämnt randmönster där balkarna försvinner. De grå helgerna och helgdagarna, och veckobanden som är färgade om varandra, finns kvar på varje nivå. De bär veckostrukturen när linjerna försvinner. I tidslinjens rubrik visas veckonummer och dagnummer bara när det finns plats för dem. Från 40 pixlar per dag visas också veckodagen före dagnumret.

## Fallgropar och vad appen gör då

**Starten flyttas inte.** Om uppgiften har en föregående uppgift och en annan restriktion än SNET, till exempel *Så sent som möjligt (ALAP)*, använder appen inte den dragna starten. När du har släppt musknappen säger appen vilken restriktion som håller tillbaka starten. Ändra den restriktionen för att flytta starten. Den högra kanten fungerar, för den ändrar bara varaktigheten.

**Gesten gör något annat.** I läget för samband och läget för delade uppgifter gör balkgester något annat. Esc stoppar dessa lägen. Håller du Shift nedtryckt när du drar från en balk, skapar du ett samband i stället för att flytta en balk. Se [Lägga till samband](docs://howto-relaties-leggen).

**I läget *Position* eller *Tangenter* panorerar inte den vänstra musknappen.** Du ser då en vanlig markör i stället för en hand. Använd hjulet eller mellersta musknappen, eller ställ läget in på *Zooma + dra*.

**Ett klick i en paus i en delad balk** markerar uppgiften och startar varken ett drag eller en ruta.

## Se även

- [Högerklicksmenyer](docs://ref-contextmenus): menyerna på en balk, en rad och en grupprubrik.
- [Snabbtangenter](docs://ref-sneltoetsen): tangenterna för att zooma och för att avbryta en gest.
- [Inställningar](docs://ref-instellingen): scrolläget och tidsaxeln.
- [Restriktioner och måldatum](docs://uitleg-constraints): varför en flyttad start blir en restriktion.
