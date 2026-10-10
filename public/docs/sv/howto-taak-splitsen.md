# Dela en uppgift

Mål: avbryt en uppgift, så att arbetet stannar och fortsätter senare, utan att uppgiften blir två uppgifter.

## När du behöver det

Att lägga armeringen tar åtta arbetsdagar. Men efter fyra dagar måste kranen gå till ett annat jobb, och arbetet fortsätter två dagar senare. Att göra två separata uppgifter betyder att du måste underhålla dina samband och tilldelningar två gånger. Med ett **avbrott** stannar det kvar som en uppgift, med en balk som har en lucka. Appen kallar avbrottet också för *avbrott*.

Arbetet blir lika långt, men uppgiften varar längre i kalendern. Ett exempel: en uppgift på 8 arbetsdagar som börjar tisdag 29 september 2026 slutar torsdag 8 oktober. Om du lägger ett avbrott på 2 arbetsdagar efter 4 arbetsdagar slutar den måndag 12 oktober. Varaktigheten är kvar 8 arbetsdagar. Det är bara slutet som flyttas två arbetsdagar.

## Steg

### Dela i Gantt-diagrammet

1. Välj *Start › Uppgifter › Dela uppgift* (eller *Tidsplan › Samband › Dela uppgift*). Ovanför tidsplanen visas meddelandet *Klicka på en balk på den dag avbrottet börjar och dra åt höger för dess längd. Esc stoppar*. Knappen finns också på fliken *Tabell* (*Tabell › Uppgifter › Dela uppgift*), men den är inaktiverad där.
2. Flytta musen över balken. En streckad linje och en etikett med datumet visar var avbrottet skulle börja. Klicka på balken, på den dag avbrottet börjar.
3. Dra åt höger. Etiketten visar längden, till exempel *2 arbetsdagar avbrott*: avståndet i arbetsdagar till dagen under musen. Släpp.

Om du bara klickar, utan att dra, blir avbrottet en arbetsdag. Om du drar tillbaka åt vänster blir avbrottet kortare igen, ner till minst en arbetsdag. För en uppgift i timmar fungerar det i timmar.

Läget är kvar på, så att du kan dela fler uppgifter. Du stoppar med Esc eller med knappen *Stoppa* i meddelandet. Om du trycker på Esc medan du drar, ångrar appen avbrottet och läget stoppar. Varje rörelse är ett steg för *Ångra*.

Efter en delning är tidsplanen inte längre aktuell. Tryck på **Beräkna** (F5) för de slutliga datumen.

### Dra ett befintligt avbrott i Gantt-diagrammet

Det fungerar utan delningsläge, direkt på en balk som har ett avbrott.

- Dra delen **efter** avbrottet åt höger eller vänster. Avbrottet blir längre eller kortare, med etiketten *3 arbetsdagar avbrott*. Om du drar tillbaka tills avbrottet är 0, visar etiketten *Slå ihop* och de två delarna är en igen.
- Dra högerkanten på delen **före** avbrottet. Den delen blir längre eller kortare, med etiketten *Del: 5 arbetsdagar*. Uppgiftens varaktighet ändras med den.
- Om du drar första delen flyttar du hela uppgiften, precis som med alla balkar.

### Dela och justera i egenskapspanelen

Välj uppgiften. I panelen *Egenskaper* ligger blocket *Avbrott* under *Samband* och ovanför *Tilldelningar*. Scrolla till det vid behov.

- *Lägg till avbrott* lägger ett avbrott på en arbetsdag mitt i den längsta delen.
- Varje avbrott har två rutor: *efter* (hur många arbetsdagar arbete som kommer före avbrottet) och *avbrott* (avbrottets längd). Bredvid dem visas datumen för delen efter avbrottet. För en timuppgift visar de timmar.
- Om du sätter *avbrott* till 0 försvinner avbrottet. Den lilla papperskorgen (*Ta bort avbrott*) gör samma sak.

Var försiktig med *efter*: den rutan förlänger eller förkortar arbetsdelen före avbrottet, och med den uppgiftens hela varaktighet. Med *avbrott* ändras bara slutet.

### Ta bort ett avbrott

Högerklicka på avbrottet i Gantt-diagrammet, eller på delen efter det, och välj *Ta bort avbrott*. *Ta bort alla avbrott* finns i högerklicksmenyn för varje balk som har ett avbrott. Eller använd blocket *Avbrott* i panelen *Egenskaper*, som ovan.

### Med en AI-assistent

En kopplad AI-assistent sätter avbrott med verktyget `planner_set_task_splits`, i samma form som egenskapspanelen: efter hur många arbetsdagar (eller arbetstimmar) arbete, och hur många arbetsdagar (eller arbetstimmar) avbrott. Den ger alltid hela listan. En tom lista tar bort alla avbrott. Den läser dem igen med `planner_get_task`. Samma regler gäller som nedan: en uppgift som du inte kan dela kan inte assistenten dela heller. Till skillnad från en delning som du gör själv beräknar appen om tidsplanen efteråt av sig själv. Hur du kopplar en assistent står i [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Fallgropar och vad appen gör

**Inte varje uppgift kan delas.** Du kan inte dela en milstolpe, en sammanfattningsuppgift, en uppgift med *Hängmatta (härledd varaktighet)* på (se [Skapa en hängmatta](docs://howto-hammock)), en uppgift med varaktighetstyp *Förfluten tid*, en uppgift som är *Manuellt schemalagd*, eller en uppgift som är kortare än två arbetsdagar. I delningsläget visar musen en markör för förbjudet och ingenting händer. För en sådan uppgift saknas också blocket *Avbrott* i *Egenskaper*.

**På fliken Tabell fungerar inte knappen.** *Dela uppgift* är inaktiverad där, med hjälptexten *Endast tillgänglig när Gantt-diagrammet visas*. Gesten kräver en balk. Delningsläget och länkningsläget stänger av varandra.

**Ett klick utan effekt.** Ett avbrott kan inte börja på uppgiftens första dag och inte inne i ett befintligt avbrott. Varje del av arbetet måste också vara minst en arbetsdag lång. Om du klickar på en sådan plats händer ingenting, utan något meddelande.

**En uppgift med framdrift.** Om uppgiften har framdrift kan ett avbrott bara börja efter arbetet som redan är gjort. Vid 50 % av 8 arbetsdagar är det tidigast den femte arbetsdagen. Ett klick i den klara delen gör ingenting, och en uppgift som är 100 % klar kan inte delas längre. I egenskapspanelen är *Lägg till avbrott* då inaktiverat: det gäller också om mitten av den längsta delen hamnar i klart arbete, till exempel vid 75 % av 8 arbetsdagar.

**Utjämning skapar också avbrott.** De visas i blocket *Avbrott* med etiketten *utjämning*. *Resurser › Utjämning › Ta bort utjämning* tar bort dem igen. Om du redigerar avbrotten för en sådan uppgift själv blir alla dess avbrott för utjämning dina, och *Ta bort utjämning* tar inte bort dem längre.

**Avbrott följer inte med till MS Project eller Primavera.** Om du exporterar till *MS Project XML* eller *Primavera P6 XML* känner det programmet bara till ett avbrott som en arbetsfördelning för en tilldelning. Utan en sådan fördelning kommer uppgiften utan avbrott, och appen anger hur många uppgifter det gäller: *1 uppgift med avbrott exporterades utan avbrotten: MS Project och P6 känner bara till avbrott som en arbetsfördelning*. I appens IFC-fil finns de kvar.

**En fil med avbrott som appen inte kan redigera.** Avbrott från en källfil som inte passar i appens formulär visar meddelandet *Dessa avbrott kommer från källfilen i ett format som inte kan redigeras här* i egenskapspanelen, med bara *Ta bort alla avbrott*.

## Se även

- [Kritisk linje och slack](docs://uitleg-kritiek-pad): hur tidsplanen räknar i arbetsdagar och varför slutet flyttas.
- [Lägga till samband](docs://howto-relaties-leggen): ett annat läge i Gantt-diagrammet, som du använder med att dra i en balk.
- [Uppgiftsdialogen och egenskapspanelen](docs://ref-taak-eigenschappen): avsnittet Avbrott i egenskapspanelen.
