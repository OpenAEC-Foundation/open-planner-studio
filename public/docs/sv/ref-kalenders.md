# Kalenderfönstren

Fönstret *Kalendrar* hanterar projektets kalenderbibliotek: vilka arbetsdagar, arbetstider och lediga dagar som gäller och vilken kalender som är projektkalender. Formuläret bredvid listan är detsamma som i fönstret *Resurskalender*. Den här artikeln beskriver för varje fält vad det gör, vad standardvärdet är och vad du märker av det. Hur du skapar en kalender och ger den till uppgifter står i [Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen). Hur appen räknar arbetsdagar står i [Kalendrar och arbetsdagar](docs://uitleg-kalenders).

## Var du hittar det

- **Kalendrar** — *Tidsplan › Kalender › Kalender* eller *Inställningar › Kalender › Kalender*.
- **Kalender för en uppgift** — fältet *Kalender* i fönstret *Redigera uppgift* eller i panelen *Egenskaper*. Se [Dialogrutan för uppgifter och egenskapspanelen](docs://ref-taak-eigenschappen).
- **Resurskalender** — panelen *Resurser*, kolumnen *Kalender*: välj en kalender, välj *+ Resurskalender* för en ny, eller klicka på pennsymbolen (*Redigera…*) för den valda kalendern. Se [Resurspanelen](docs://ref-resourcepaneel).

## Biblioteket i fönstret Kalendrar

Till vänster finns listan över kalendrar, till höger formuläret för den valda kalendern. Projektkalendern har en stjärna. En kalender med ogiltiga värden har en röd triangel (*Den här kalendern innehåller ogiltiga värden*).

- **Ny kalender** (plusknappen) — lägger till en kalender med namnet *Ny kalender* och appens standardinnehåll: måndag till fredag, 07:00 till 16:00, 8 nettotimmar. Om *Aktivera byggläge* är på (standard) läggs nederländska helgdagar till också, utan byggsemestern. Om det är av är listan tom. Vill du inte ha de helgdagarna väljer du *Generera helgdagar…* och sedan *Inga helgdagar* i fönstret. (Namnen *Bouwkalender NL* och *Standaardkalender* är nederländska i alla språk.)
- **Duplicera** — kopierar den valda kalendern under namnet *{name} (kopia)*.
- **Ta bort** (papperskorgen) — tar bort den valda kalendern. Knappen är inaktiv när det bara finns en kalender kvar. Om det var projektkalendern blir den första kvarvarande kalendern den nya projektkalendern. Uppgifter och resurser som använde kalendern använder i stället projektkalendern.
- **Ange som projektstandard** — gör den valda kalendern till projektkalender. På kalendern som redan är det visas *Projektkalender* med en stjärna. Effekt: varje uppgift utan egen kalender räknas i den här kalendern, och det gäller även en resurs utan egen kalender. En uppgift som du själv har gett en kalender behåller den.
- **Tillämpa** — skriver alla ändringar i hela listan till projektet på en gång, beräknar om tidsplanen och stänger fönstret. Tidsplanen beräknas inte om när sammantaget inget har ändrats. Knappen är inaktiv så länge det finns ogiltiga värden i en av kalendrarna. Enter i ett vanligt textfält gör detsamma, men fönstret förblir öppet.
- **Avbryt** — stänger fönstret och kastar alla ändringar som du har gjort sedan du öppnade det (eller sedan senaste Enter). Esc och krysset fungerar som *Avbryt*. Ett klick bredvid fönstret gör ingenting, så att du inte förlorar det du har skrivit.

Som standard har ett projekt kalendern *Bouwkalender NL* (byggläge på) eller *Standaardkalender* (byggläge av), med måndag till fredag 07:00 till 16:00.

## Formuläret

### Grunder

- **Namn** — namnet i listan och i rullgardinsmenyerna för uppgifter och resurser.
- **Arbetsdagar** — en knapp per veckodag, från *Mån* till *Sön*. En intryckt knapp är en arbetsdag. Ordningen följer *Vecka börjar på* (*Inställningar*, fliken *Tidsplan*). Standard: *Mån* till *Fre*. Det finns två snabbknappar: *Mån–fre* sätter mån–fre, 07:00 till 16:00, 8 timmar, och en inställd rast blir åter standardrasten på 12:00, 60 minuter. *Kontinuerligt (24/7)* sätter alla sju dagar, 00:00 till 24:00, 24 timmar. Effekt: en uppgift pågår bara på arbetsdagar. Appen kan inte beräkna en kalender utan arbetsdagar (*Kalendern har inga arbetsdagar inställda*).
- **Start (timme)** och **Slut (timme)** — starten och slutet av arbetsdagen, som TT:MM i 24-timmarsnotation. Standard: 07:00 och 16:00. Pilarna (eller piltangenterna) ändrar i steg på 15 minuter. Slutet får vara 24:00, och starten måste ligga före slutet. Effekt: tillsammans med rasten bestämmer de nettotimmarna per dag. De påverkar inte datumen för en uppgift i dagar, men de påverkar uppgifter i timmar. Dessa fält försvinner när *Aktivera timplanering* är på och kalendern har arbetstider per veckodag. Då gäller i stället arbetstiderna per veckodag.
- **Rast börjar** och **Rastens varaktighet (minuter)** — start och längd för rasten, med samma steg på 15 minuter. Standard: 12:00 och 60 minuter. Om du ställer varaktigheten på 0 är arbetsdagen obruten. Rasten måste ligga helt inom arbetsdagen och får inte ta upp hela arbetsdagen. Effekt: nettotimmar är slut minus start minus rast. För en uppgift i timmar utförs inget arbete under rasten. Samma fält försvinner under samma villkor som *Start (timme)*.
- **Nettotimmar per dag** — går inte att ändra: den härledda längden för en arbetsdag, med två decimaler, till exempel *8,00 h*. Standard: 8. Effekt: det här är längden på en dag när dagar omvandlas till timmar, och för uppgifter i timmar. Se [Dagar och timmar](docs://uitleg-dagen-en-uren).

### Arbetstider

Det här blocket visas bara när *Aktivera timplanering* är på (*Inställningar*, fliken *Tidsplan*). Här ställer du in arbetstider och skift per veckodag. Se [Ställa in arbetstider](docs://howto-werktijden-instellen).

- **Förinställningar** — knappar som ställer in arbetstiderna på en gång: *Dagskift* (mån–fre 08:00 till 16:00, en vanlig dagkalender), *2 skift* (mån–fre 06:00 till 22:00, 16 timmar), *3 skift* (mån–fre 06:00 till 06:00 nästa dag, 24 timmar), *Nattskift* (mån–fre 22:00 till 06:00, 8 timmar) och *24/7* (alla dagar 00:00 till 24:00). Bakom de inbyggda knapparna finns dina egna förinställningar, med ett kryss för att ta bort dem.
- **Spara som förinställning…** — sparar de aktuella arbetstiderna som din egen förinställning, på den här enheten, så att du kan använda dem i alla projekt. Du ger den ett namn (*Namn på din egen förinställning*) och klickar på *Spara* eller *Avbryt*.
- **Ange per veckodag…** — gör en dagkalender till en timkalender: de aktuella tiderna blir banden för varje arbetsdag, med rasten som ett glapp. För en timkalender heter knappen *Dölj arbetstider* eller *Visa arbetstider*, och den fäller redigeraren in eller ut. För en timkalender är redigeraren öppen som standard.
- **Redigeraren** — per veckodag en lista med band (*band*), var och en med en start- och sluttid. Bockrutan *nästa dag* låter ett band gå över midnatt (ett nattskift). *Lägg till band* (plusknappen) lägger till 08:00 till 16:00. *Kopiera till alla arbetsdagar* (bara på mån–fre) kopierar banden för den dagen till måndag till fredag. En dag utan band kallas *Ej arbetstid*. Längst ner står *Härledda timmar/dag:*. Så snart en dag har mer än ett band visas hjälptexten *Ett glapp mellan två band är en rast — justera tiderna vid behov.* Effekt: banden går före. En veckodag med band är en arbetsdag. Fälten *Start (timme)*, *Slut (timme)* och rasten försvinner då.

### Helgdagar

- **Generera helgdagar…** — öppnar genereraren. *Land* väljer *Nederländerna*, *Tyskland*, *Belgien*, *Frankrike*, *Storbritannien*, *Österrike*, *Schweiz* eller *Inga helgdagar*. *Region* visas bara om landet har regioner. Standard är *Nationellt*. *Byggsemester* visas bara för Nederländerna och när *Aktivera byggläge* är på. Valen är *Ingen* (standard), *Norra*, *Mellersta* och *Södra*, med hjälptexten *Vägledande datum — kontrollera hos Bouwend Nederland*. En förhandsgranskningsrad visar hur många helgdagar som kommer (*… helgdagar, …–…*). Den kan utökas för att visa listan. *Generera* lägger resultatet i kalendern som du redigerar (det gäller först efter *Tillämpa*). *Avbryt* stänger genereraren. Effekt: hela listan *Helgdagar* ersätts, även det du själv har lagt till. Genereraren täcker åren från året före projektstarten till och med året efter projektslutet. Utan projektslut täcker den upp till tre år efter starten. Se [Generera helgdagar och byggsemestern](docs://howto-feestdagen-genereren).
- **Generera om** — visas bredvid knappen när de genererade helgdagarna inte längre täcker projektperioden. Texten är *Helgdagar täcker …–…; projektet löper till …. Generera om?* Ett klick genererar samma val igen för den nya perioden: land, region och byggsemester. Om du inte klickar på det är dagar utanför de genererade åren vanliga arbetsdagar.
- **Helgdagar** — listan över lediga dagar: *Beskrivning*, *Från* och *Till*, och en papperskorg per rad. *Lägg till helgdag* lägger till en rad med dagens datum som *Från* och ett tomt *Till*. Ett tomt *Till* betyder en dag. Utan rader står det *Inga helgdagar ännu.* Effekt: alla dagar i perioden är lediga dagar i den här kalendern, för uppgifter i den här kalendern och för resurser som använder den. En ogiltig rad får en röd ram och en text (*Ange ett giltigt startdatum.*, *Ange ett giltigt slutdatum, eller lämna fältet tomt för en dag.* eller *Slutdatumet ligger före startdatumet.*) och blockerar *Tillämpa*.

### Felmeddelanden och undantag

Fel i arbetstiderna visas under fälten och blockerar *Tillämpa*: *Ange en giltig starttid som TT:MM.*, *Ange en giltig sluttid som TT:MM.*, *Starttiden måste vara före sluttiden.*, *Ange en giltig rasttid som TT:MM.*, *Rastens varaktighet måste vara ett heltal minuter, 0 eller mer.*, *Rasten måste helt ligga inom den inställda arbetsdagen.* och *Rasten får inte ta upp hela arbetsdagen.*

Kalendern hanterar bara lediga dagar som undantag. En kalender från en MS Project- eller Primavera-fil kan också ha arbetsundantag, alltså en extra arbetsdag. Fönstret visar eller ändrar dem inte.

## Fönstret Resurskalender

- **Resurskalender** — formuläret ovan, i ett fönster med bara *Tillämpa* och *Avbryt*. Esc och krysset fungerar som *Avbryt*. Ett klick bredvid fönstret gör ingenting, och Enter gör ingenting här. I fönstret redigerar du en kalender: en befintlig eller en ny med standardnamnet *Resurskalender*. Den kopplas till resursen när du klickar på *Tillämpa*. *Avbryt* lämnar inget kvar. Om du öppnar den i vyn *Bibliotek* i resurspanelen redigerar den en kalender i biblioteket. I vyn *Projekt* redigerar den projektets kalender, även om den kom från biblioteket. Effekt: en resurskalender bestämmer när resursen är tillgänglig i histogrammet, vid överbeläggning och vid utjämning. Den ändrar inte datumen för en uppgift. *Tillämpa* beräknar inte om. Om kalendern också finns på uppgifter eller är projektkalendern ändras tidsplanen. Den markeras då som inaktuell och *Beräkna* beräknar om den. Se [Ställa in en resurskalender](docs://howto-resourcekalender-instellen).
