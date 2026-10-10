# Menyfliksområdet, flik för flik

Menyfliksområdet överst på skärmen har flikar, och varje flik har grupper med knappar. Den här artikeln beskriver för varje knapp vad den gör och var du ser resultatet. Hur du gör något steg för steg står i de praktiska guiderna. Här slår du upp vad en knapp är. En knapp som bara finns eller fungerar under ett villkor har villkoret bredvid sig.

## Så fungerar menyfliksområdet

- **Flikar** — *Fil* ligger till vänster, följt av *Start*, *Tidsplan*, *Resurser*, *Visa*, *Inställningar*, *Tabell*, *IFC*, *Rapport* och, bara när AI-läget är på, *AI*.
- **Smalt fönster** — när menyfliksområdet inte får plats krymper knapparna till en ikon, från höger till vänster. Namnet visas då som verktygstipset på knappen. Varje knapp utan eget verktygstips visar sitt namn.
- **Fäll ihop menyfliksområdet** — den lilla pilen nere till höger i menyfliksområdet gör det till en platt remsa med bara ikoner. Gruppen *Baslinjer & framdrift* och gruppen *Anslutning* på fliken *AI* försvinner då bakom en enda knapp med en popup. Standard: utökad. Ditt val sparas.
- **Knappar för tillägg** — ett tillägg kan lägga till en egen grupp sist på en flik. En sådan knapp gör det som tillägget gav den.

## Fil

När du klickar på *Fil* tar en egen skärm (Backstage) över arbetsytan. Den har inget menyfliksområde. *Tillbaka* stänger den. Om du har ändrat något under *Projektinfo* och inte tillämpat det frågar appen först vad du vill göra med ändringen.

- **Nytt** — öppnar fönstret *Nytt projekt* och stänger Backstage. Fälten finns under [Nytt projekt och Projektinfo](docs://ref-projectinfo).
- **Öppna** — väljer en fil och öppnar den som ett dokument. Stänger Backstage.
- **Senaste** — en lista med nyss öppnade projekt; ett klick öppnar ett av dem. Syns bara när miljön kan öppna filer igen: i skrivbordsappen och i webbläsare som erbjuder filåtkomst, som Chrome och Edge. I andra webbläsare finns knappen, men sidan förblir tom.
- **Exempel** — medföljande exempeltidsplaner, uppdelade i *Kompletta showcase-tidsplaner* (märke *Alla funktioner*) och *Enkla exempel*. Ett klick öppnar ett exempel i en ny flik.
- **Spara** — skriver projektet till filen för det här dokumentet. Har dokumentet ännu ingen fil väljer du först ett namn och en plats. En fil som du öppnade i ett annat format än IFC skrivs aldrig över; då frågar *Spara* efter ett namn och en plats för en IFC-fil.
- **Spara som** — väljer ett nytt namn eller en ny plats och sparar där som IFC.
- **Exportera** — ett kort per exportformat, med en beskrivning. Ett klick konverterar projektet och sparar det, och tar dig tillbaka till *Start*. Har tidsplanen ett cirkelberoende visas felet i Backstage, och du stannar där. Är projektet kopplat till ett bibliotek visas kryssrutan *Spara biblioteksfilen bredvid* nedanför. Den fungerar bara för IFC-kortet.
- **Importera** — överst kortet *Uppdatera framdrift från ett kalkylblad* (inaktivt utan uppgifter), under det importerna som tillägg lägger till.
- **Skriv ut** — knappen *Öppna förhandsgranskning* tar dig till fliken *Rapport*.
- **Projektinfo** — metadata och beräkningsprofil för det här projektet. Ändringar gäller först efter *Tillämpa*. Se [Nytt projekt och Projektinfo](docs://ref-projectinfo) och [Beräkningsprofiler och beräkningsregler](docs://uitleg-rekenprofielen).
- **Inställningar** — samma inställningar som i fönstret *Inställningar*.
- **Tillägg** — hantering och installation av tillägg; se [Installera och hantera ett tillägg](docs://howto-extensie-installeren).
- **Bibliotek** — hantering av bibliotek för resurser; se [Hantera och dela bibliotek för resurser](docs://howto-bibliotheken-beheren).
- **Hjälp** — den inbyggda dokumentationen, även med F1. Sökfältet söker i titlar, rubriker och själva texten. Artiklarna finns i fyra avsnitt: *Självstudier*, *Praktiska guider*, *Förklaring* och *Referens*. Under *Dokumentationsspråk* väljer du *Följ appens språk*, *Nederlands* eller *English*. Hjälp finns bara på nederländska och engelska. Är appen på ett annat språk läser du den engelska versionen, med en notis. Valet sparas på den här enheten, separat från appens språk. Du kan också öppna Hjälp från ett fönster eller en panel. Många fönster och panelerna *Egenskaper*, *Resurser* och *Varningar* har ett frågetecken uppe till höger (*Hjälp om det här avsnittet*). Det öppnar Hjälp på artikeln om fönstret eller panelen. Har du skrivit något i fönstret som ännu inte är sparat, frågar appen först: *Spara*, *Avbryt* (kasta bort det du skrev) eller *Tillbaka* (stanna i fönstret). Sedan stängs fönstret och Hjälp öppnas. Några fönster, som *Redigera uppgift* och *Utjämna resurser*, frågar alltid. Utan inmatning öppnas Hjälp direkt.
- **Starta rundtur** — stänger Backstage och startar rundturen vid steg 1.
- **Stäng projekt** — stänger det aktiva dokumentet. Har det osparade ändringar frågar appen om bekräftelse.

## Start

### Start › Fil

- **Nytt**, **Spara**, **Öppna** och **Spara som** — samma åtgärder som under *Fil*.
- **Senaste** — rullgardinslista med de senaste projekten; ett klick öppnar ett av dem. Syns bara under samma villkor som *Fil › Senaste*. Utan nyligen använda filer står det *Inga nyligen använda filer*.
- **Exportera** — rullgardinslista med exportformaten (korta namn). Ett klick konverterar projektet och sparar det.

### Start › Redigera

- **Ångra** — ångrar den senaste ändringen. Inaktiv när det inte finns något att ångra.
- **Gör om** — återställer den senaste ångrade ändringen. Inaktiv när det inte finns något att göra om.
- **Ta bort** — tar bort de markerade uppgifterna, tillsammans med deras underuppgifter, som ett steg. Inaktiv utan markering.

### Start › Uppgifter

- **Uppgift** — lägger till en uppgift som heter *Ny uppgift*, med en varaktighet på 5 arbetsdagar och start på projektstarten. Om *Aktivera timplanering* är på och *Standardenhet för nya uppgifter* i *Projektinfo* är timmar, är varaktigheten 5 timmar. Är en uppgift markerad och vyn är det enkla trädet, hamnar den nya uppgiften direkt under den understa markerade uppgiften (verktygstips *Ny uppgift direkt under markeringen*). Utan markering hamnar den längst ned (verktygstips *Ny uppgift längst ned i listan*). Med en markering men när du filtrerar, grupperar eller sorterar, hamnar den också längst ned, och en remsa säger *Inte tillgänglig vid filtrering/gruppering/sortering*. Den nya uppgiften blir den enda markeringen. Gantt-diagrammet hoppar till den, och du kan skriva över namnet i panelen *Egenskaper*.
- **Milstolpe ▾** — rullgardinsmeny som lägger en milstolpe (varaktighet 0) på samma plats som *Uppgift*. *Startmilstolpe* och *Slutmilstolpe* väljer vilken sorts milstolpe det är. Den nya milstolpen heter *Ny milstolpe* och får uppgiftstyp *Övrigt*. *Inspektionspunkt (obligatorisk)* gör en slutmilstolpe med uppgiftstyp *Besiktning* och flaggan *Obligatorisk (avtalsenlig)*, och den heter *Ny inspektion*.
- **Länka ▾** — rullgardinsmeny med fyra fasta åtgärder. Huvudknappen ändrar aldrig betydelse. Se *Tidsplan › Samband* för de fyra åtgärderna.
- **Dela uppgift** — slår läget för delade uppgifter på eller av. På: en remsa under menyfliksområdet förklarar att du klickar på en balk där avbrottet börjar och drar åt höger för dess längd. Inaktiv när Gantt-diagrammet inte visas, på flikarna *Tabell*, *IFC* och *Rapport* och under den fullständiga resurspanelen. Verktygstipset säger då *Endast tillgänglig när Gantt-diagrammet visas*. Se [Dela en uppgift](docs://howto-taak-splitsen).

### Start › Beräkning

- **Beräkna** — beräknar tidsplanen: datum, slack, kritisk linje och resursbelastning. Det sker aldrig av sig självt, om du inte slår på *Beräkna automatiskt* (*Inställningar*, flik *Tidsplan*, rubrik *Beräkning*). Medan tidsplanen är inaktuell visar statusfältet *Inaktuell — beräkna om (F5)*.

### Start › Zoom

- **Zooma +** — zoomar in tidsaxeln med 10 pixlar per dag.
- **Zooma -** — zoomar ut tidsaxeln med 10 pixlar per dag.

## Tidsplan

### Tidsplan › Beräkning

Knappen *Beräkna* är samma som under *Start*.

- **Flytta projekt…** — öppnar fönstret *Flytta projekt*. Inaktiv utan projektstart. Se [Flytta ett projekt](docs://howto-project-verplaatsen).
- **Varningar** — visar eller döljer panelen *Varningar* i den högra kolumnen. Knappen lyser när du kan se panelen. Slår du på den expanderas en ihopfälld kolumn. Vad som finns i den beskrivs i [Meddelanden och varningar](docs://ref-meldingen).

### Tidsplan › Samband

Gruppen har knappen *Länka ▾* med fyra åtgärder och knappen *Dela uppgift* (samma som under *Start*). De fyra åtgärderna:

- **Rita samband** — slår läget för att länka på eller av. En bockmarkering visas när det är på, och huvudknappen lyser. På: du drar från en balk till en annan i Gantt-diagrammet för att skapa ett samband. En remsa under menyfliksområdet säger hur du stoppar (*Stoppa* eller Esc). Inaktiv när Gantt-diagrammet inte visas.
- **Länka markerade uppgifter** — skapar ett slut-till-start-samband utan fördröjning mellan två uppgifter. Den först markerade blir föregående. Bara tillgänglig när exakt två uppgifter är markerade (annars *Markera exakt två uppgifter*). Ett dubbelt samband eller ett cirkelberoende avvisas med ett meddelande.
- **Lägg till externt samband…** — öppnar ett fönster för att lägga till en extern föregående eller efterföljande uppgift till den markerade uppgiften. Bara tillgänglig med exakt en markerad uppgift (annars *Markera exakt en uppgift*).
- **Uppdatera alla externa samband** — uppdaterar ankarna för alla externa samband och visar i menyn hur många som uppdaterades eller saknas. Bara tillgänglig när projektet har externa samband (annars *Det här projektet innehåller inga externa samband*).

Mer om hur samband fungerar finns i [Skapa samband](docs://howto-relaties-leggen) och [Samband och fördröjning](docs://uitleg-relaties).

### Tidsplan › Spåra drivkedja

- **Föregående** — markerar i Gantt-diagrammet de föregående uppgifterna för de markerade uppgifterna, kedja för kedja.
- **Efterföljande** — markerar de efterföljande uppgifterna för de markerade uppgifterna.

Du kan ha båda på samtidigt. Ett andra klick på en knapp stänger av den sidan igen. Drivande samband får en starkare färgton. Se [Spåra en drivkedja](docs://howto-pad-traceren).

### Tidsplan › Kalender

- **Kalender** — öppnar fönstret *Kalendrar* med projektets bibliotek för kalendrar. Se [Kalenderfönster](docs://ref-kalenders).

### Tidsplan › Struktur

- **Koder & fält** — öppnar fönstret *Koder & fält* för uppgiftskoder och egna fält. Se [Koder och egna fält](docs://howto-codes-en-velden).
- **WBS auto** — slår på eller av automatisk numrering av WBS-koderna. Standard: av. På: hela trädet numreras om på en gång. Därefter följer koderna varje strukturändring, och fältet *WBS-kod* i panelen och dialogrutan är inaktiverat.
- **Numrera om WBS** — numrerar om WBS-koderna en gång, enligt positionen i trädet (1.2.3). Inaktiv medan *WBS auto* är på.
- **Mallar** — rullgardinsmeny med sparade WBS-mallar, var och en med antalet uppgifter och samband. Ett klick infogar mallen under den markerade uppgiften, eller på översta nivån när ingen uppgift är markerad. Papperskorgsikonen tar bort en mall. Utan mallar står det hur du sparar en (högerklicka på en sammanfattningsuppgift, *Spara gren som mall*). Se [Spara och infoga WBS-mallar](docs://howto-wbs-sjablonen).
- **Indrag** — gör de markerade uppgifterna till underuppgifter till uppgiften före dem. Inaktiv utan markering och så snart du filtrerar, grupperar eller sorterar. Verktygstipset säger då *Inte tillgänglig vid filtrering/gruppering/sortering*.
- **Dra ut** — flyttar de markerade uppgifterna en nivå upp, direkt efter deras nuvarande överordnade uppgift. Samma villkor som *Indrag*.

### Tidsplan › Baslinjer & framdrift

- **Hantera baslinjer…** — öppnar fönstret för baslinjer. Se [Spara och hantera en baslinje](docs://howto-baseline-opslaan-en-beheren).
- **Rapportdatum** — datumet t.o.m. vilket du mäter framdriften. Skriv ett datum. Krysset (*Töm rapportdatum*) tar bort det. Effekt: framdriften mäts t.o.m. det datumet, och rapportdatumlinjen och framdriftslinjen i Gantt-diagrammet ligger på det datumet. Se [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang).
- **Framdriftsläge** — ett val mellan *Retained Logic* och *Progress Override*. Standard: *Retained Logic*. Effekt: med *Retained Logic* följer det återstående arbetet för en påbörjad efterföljande uppgift sambandet. Med *Progress Override* börjar det återstående arbetet på rapportdatumet, utan att vänta på den föregående uppgiften. Se [Välja framdriftsläge](docs://howto-voortgangsmodus-kiezen).

I det ihopfällda menyfliksområdet ligger dessa tre bakom en flaggknapp med namnet *Baslinjer & framdrift*.

### Tidsplan › Framdrift

- **Exportera framdriftsblad** — skapar ett `.xlsx`-blad med uppgifterna, för att fylla i framdriften utanför appen. Inaktiv utan uppgifter.
- **Uppdatera framdrift från ett kalkylblad** — öppnar importfönstret för ett returnerat blad. Inaktiv utan uppgifter. Se [Importera framdrift från ett kalkylblad](docs://howto-voortgang-importeren).

Den här gruppen finns också på *Tabell* och *Rapport*.

## Resurser

### Resurser › Hantera

- **Resurser** — öppnar den fullständiga resurspanelen. Den tar över arbetsytan. Knappen lyser medan du ser panelen. Se [Resurspanelen](docs://ref-resourcepaneel).
- **Resursdocka** — dockar den kompakta resurspanelen i den högra kolumnen, bredvid Gantt-diagrammet. Knappen lyser medan dockan syns. Ett nytt klick stänger den. Dockan visar bara namn, färg, en varning vid överbeläggning och *Max enheter*. Om du har markerat en eller flera uppgifter visar den bara resurserna för de uppgifterna.
- **Ny resurs** — öppnar den fullständiga resurspanelen med en tom utkastrad för en ny resurs. Ingenting skapas förrän du skriver ett namn. Klickar du bort lämnas inget kvar. Resursen hamnar i biblioteket eller i projektet, beroende på vyn.

### Resurser › Tilldelning

- **Tilldela ▾** — tilldelar en resurs till den markerade uppgiften. Bara tillgänglig med exakt en markerad uppgift som är en lövuppgift och inte en milstolpe. Annars är knappen grå. I menyn ställer du först in *Enh./dag* (standard 1) och *Kurva* (standard *Jämn*). Ett klick på en resurs tilldelar den med dessa värden. Menyn visar bara resurser som inte redan finns på uppgiften. Se [Tilldela resurser med en kurva](docs://howto-resource-toewijzen).

### Resurser › Histogram

- **Histogram** — visar eller döljer histogramremsan under Gantt-diagrammet. Standard: av. Ditt val sparas.
- **Föregående** och **Nästa** — bläddrar bland resurserna i väljaren för histogramremsan, med *Alla resurser* som ett extra steg i varvet. Inaktiva när histogrammet är av eller projektet saknar resurser.

### Resurser › Utjämning

- **Utjämna…** — öppnar fönstret *Utjämna resurser*. Se [Utjämning](docs://uitleg-nivelleren).
- **Rensa utjämning** — tar bort de förseningar och avbrott som utjämningen lade till. Inaktiv när ingen uppgift har ett utjämningsresultat.

### Resurser › Överbeläggning

- **Överbeläggning** — inte en knapp utan en räknare: antalet resurser med minst en dag med överbeläggning, eller *Ingen*. Röd med en varningsikon så snart det finns en. Siffran uppdateras efter *Beräkna* och efter ändringar av resurser och tilldelningar. Ändrar du datum på uppgifter räknas det först efter *Beräkna*.

## Vy

### Vy › Tidsskala

- **Zooma +** och **Zooma -** — zoomar tidsskalan in eller ut med 10 pixlar per dag.
- **Återställ** — återställer zoomen till standardvärdet 30 pixlar per dag.
- **Anpassa till projekt** — zoomar och rullar så att hela projektet får plats i vyn.
- **Skalval** — en lista med *År*, *Kvartal*, *Månad*, *Vecka*, *Dag* och, bara med *Aktivera timplanering* på, *Timme*. Ett val ställer in en fast zoom. Värdet som visas följer den aktuella zoomen, och under det visas zoomen i pixlar per dag.

### Vy › Visning

- **Kolumner…**, **Filtrera…**, **Gruppera…** och **Sortera…** — syns bara när *Visa klassiska vyknappar* är på (*Inställningar*, fliken *Avancerat*, rubriken *Äldre funktioner*). Standard: av. *Kolumner…* tar dig till *Tabell* och öppnar kolumnväljaren där. *Filtrera…* öppnar filterfönstret direkt, så länge det inte finns något sparat filter. Med sparade filter öppnas en meny med *Filtrera…*, *Rensa* (bara när ett filter är aktivt) och de sparade filtren. *Gruppera…* tillåter två nivåer. *Sortera…* tillåter fler nivåer. En knapp lyser när den vyinställningen är aktiv. I det aktuella menyfliksområdet gör du det med layoutknappar; se [Skapa och använda en layout](docs://howto-layouts-gebruiken).

### Vy › Disposition

- **Fäll ihop** — fäller ihop de valda sammanfattningsuppgifterna. Utan val fälls alla ihop. I en grupperad vy fälls alla grupper ihop, och ett val har ingen effekt.
- **Fäll ut** — tvärtom.

### Vy › Layout

- **Layoutknappar** — varje layout är en omkopplare med en ikon och ett namn. *Resursdiagram* ingår. Ett klick slår på layouten. Ett nytt klick slår av den och återställer vyn från före klicket. Layouter med olika delar kan vara på samtidigt. Högerklicka på en layout: *Redigera…*, *Duplicera* och *Ta bort* (efter bekräftelse). En inbyggd layout kan bara dupliceras.
- **Ny layout** — öppnar layoutfönstret för en ny layout.

### Vy › Presentation

- **Presentation** — slår presentationsläget på eller av (F11 eller Esc för att stoppa). Bara Gantt fyller skärmen. Se [Presentera på en stor skärm](docs://howto-presentatie).
- **Delad vy** — delar Gantt i två tidsfönster som båda börjar med din aktuella zoom och position (delning 50 procent), eller gör den till ett fönster igen. Standard: av. Se [Använda delad vy och minikartan](docs://howto-split-view-en-mini-map).
- **Minikarta** — visar eller döljer minikartan. Standard: av. Ditt val sparas.

### Vy › Paneler

- **Egenskaper** — visar eller döljer panelen *Egenskaper* i den högra spalten. Standard: på. Se [Uppgiftsdialogen och egenskapspanelen](docs://ref-taak-eigenschappen).

Knapparna *Resurser*, *Resursdocka* och *Histogram* är samma som på *Resurser*, och *Varningar* är samma som på *Tidsplan*.

### Vy › Baslinjer och framdrift

Den här gruppen har samma namn som gruppen på *Tidsplan*, men innehåller ritalternativen för Gantt.

- **Baslinjeöverlägg** — visar den aktiva baslinjen som en tunn balk under varje uppgiftsbalk. Standard: på. Utan aktiv baslinje finns inget att se.
- **Framdriftslinje** — ritar en linje på rapportdatumet som buktar ut per uppgift i proportion till dess framdrift. Standard: på. Utan rapportdatum finns inget att se. När framdriftslinjen är på är den också markeringen för rapportdatumet.
- **Rapportdatumlinje** — ritar en streckad linje på rapportdatumet. Standard: på. Du ser den bara när framdriftslinjen är av, för annars ersätter framdriftslinjen den. Etiketten med datumet i rubriken finns kvar så länge minst en av de två är på.
- **Balkfärger** — väljer hur balkarna färgas: *Kritisk linje* (standard), *Per uppgift — automatiskt* eller *Efter kategori* med ett val av fält. Om det fältet inte finns i det här projektet står det i menyn att *Uppgiftstyp* används tillfälligt. Utanför *Kritisk linje* markerar en röd kontur den kritiska linjen. Valet gäller även rapporten.
- **Resursmarkering** — ritar en tunn remsa i resursens färg under varje balk för en uppgift utan underuppgifter, uppdelad i proportion till tilldelningsenheter per dag. Standard: av.
- **Slackband** — ritar det gröna området efter en icke-kritisk balk, upp till uppgiftens senaste slut. Standard: på.
- **Sambandslinjer** — visar eller döljer sambandslinjerna mellan uppgifter. Standard: på. Valet hör till dokumentet och till layouten.

## Inställningar

### Inställningar › Projekt

- **Projektinfo** — öppnar fönstret *Projektinfo*: projektets metadata och, i blocket *Beräkningsprofil och beräkningsalternativ*, hur projektet räknar ut. Se [Nytt projekt och projektinfo](docs://ref-projectinfo).
- **Inställningar** — öppnar fönstret *Inställningar* med flikarna *Utseende*, *Tidsplan* och *Avancerat*. Samma inställningar finns under *Fil › Inställningar*.

### Inställningar › Kalender

Knappen *Kalender* är samma som på *Tidsplan*.

### Inställningar › Kortkommandon

- **Kortkommandon** — öppnar fönstret *Kortkommandon*.

## Tabell

Fliken *Tabell* visar uppgifterna som en fullständig tabell i stället för Gantt. Grupperna *Fil*, *Redigera*, *Uppgifter*, *Tidsplan* och *Spåra drivkedja* är samma som på *Start* och *Tidsplan* och arbetar med samma markering. Det finns ingen grupp *Zoom*, eftersom zoomning bara skalar Gantts tidsskala. Knapparna *Dela uppgift* och *Rita samband* är inaktiverade här, för det finns ingen Gantt.

### Tabell › Kolumner

- **Kolumner…** — öppnar kolumnväljaren för den här tabellen. Samma väljare öppnas med plusknappen i tabellrubriken. Tooltipen säger *Välj kolumner för tabellvyn*. Se [Anpassa tabellkolumner](docs://howto-tabelkolommen-aanpassen) och [Tabellkolumner](docs://ref-tabelkolommen).

## IFC

Fliken visar IFC-panelen i arbetsytan. Menyfliksområdet har inga knappar här, bara textraden *IFC 4x3 - Industry Foundation Classes*.

## Rapport

### Rapport › Rapport

- **Skriv ut** — bara på den här fliken, där det inte gör något eftersom *Rapport* redan är öppen. Rapportvalen finns på rapportskärmen.

## AI

Fliken *AI* finns bara när *Aktivera AI-läge* är på (*Inställningar*, fliken *Avancerat*, rubriken *AI-läge*). Standard: av. Om du stänger av det tas fliken bort och bryggan stoppas. En AI-assistent arbetar med din tidsplan via en MCP-brygga som du startar här. Se [Koppla en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Server

- **Starta bryggan** och **Stoppa bryggan** — startar eller stoppar MCP-bryggan. Bredvid knapparna står statusen: *Av*, *Igång på port …*, *Port … är upptagen* (med orsaken) eller *Fel*. Inaktiveras i webbversionen; tooltipen säger *Bryggan fungerar bara i desktopappen.* Samma status visas som en punkt med *AI* i statusfältet.

### AI › Anslutning

- **Port** — bryggans port. Standard: 3877. Du kan bara ändra den när statusen är *Av* (tooltipen *Kan bara ändras när servern är stoppad.*).
- **Token** — lösenordet för bryggan, visas dolt. Små knappar *Visa token*/*Dölj token*, *Kopiera* och *Ny token*. *Ny token* frågar först om bekräftelse, eftersom en ny token bryter alla befintliga anslutningar. Om bryggan är igång startar den om med den nya token.
- **Anslut** — visar anslutningsuppgifterna: slutpunkt, token, ett konfigurationsutdrag och en anslutningsprompt som du klistrar in i din AI-agent.

### AI › Säkerhet

- **Pausa** / **Återuppta** — tillfälligt avvisar alla ändringar från AI:n. Läsning blir kvar tillåten och bryggan är kvar igång. Knappen lyser rött så länge den är pausad.
- **Skrivskyddad** — avvisar alla verktyg som ändrar något så länge den är på.
- **Automatisk säkerhetskopia: på** / **Automatisk säkerhetskopia: av** — skriver automatiskt en IFC-säkerhetskopia före den första AI-ändringen per dokument. Standard: på.
- **Säkerhetskopiera nu** — skriver direkt en säkerhetskopia och visar filnamnet. Bara i desktopappen.
- **Öppna mappen för säkerhetskopior** — öppnar mappen med säkerhetskopiorna. Bara i desktopappen.

### AI › Logg

- **Loggpanel** — visar eller döljer panelen *AI-uppgifter* med anropen till bryggan, med deras argument och svar.
