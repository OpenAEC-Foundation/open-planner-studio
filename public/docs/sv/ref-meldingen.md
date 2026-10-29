# Meddelanden och varningar

Appen visar vad som händer på fyra ställen: statusfältet längst ner, panelen *Varningar* i högra kolumnen, meddelandena som visas en kort stund längst ner på skärmen och remsorna under menyfliksområdet. Den här artikeln beskriver för varje ställe vad du ser, när det visas och vad du kan göra åt det. Varför en tidsplan är kritisk eller har överbeläggning beskrivs i [Kritisk linje och slack](docs://uitleg-kritiek-pad); att åtgärda överbeläggning beskrivs i [Åtgärda överbeläggning](docs://howto-overbezetting-oplossen); att skapa samband beskrivs i [Skapa samband](docs://howto-relaties-leggen).

## Skillnaden mellan de fyra

- **Statusfält** — en fast rad med räknare. De kommer från den senaste beräkningen och finns kvar tills du beräknar igen.
- **Panelen Varningar** — listan bakom de räknarna, med allt som den senaste beräkningen hittade. Ett klick tar dig till uppgiften, sambandet eller resursen. Den härleds från den senaste beräkningen. Inget sparas.
- **Meddelanden** — korta texter om något du just gjorde (sparandet misslyckades, samband nekades, importen lästes). Ett informationsmeddelande försvinner igen. Ett felmeddelande stannar kvar tills du stänger det. De finns inte i panelen.
- **Remsa under menyfliksområdet** — en färgad remsa med en förklaring och en knapp. Den hör till ett tillstånd i dokumentet eller till ett läge och finns kvar så länge tillståndet gäller. Se *Remsorna under menyfliksområdet*.

## Statusfältet

Fältet längst ner visar, från vänster till höger:

- **Uppgifter:** — antalet lövuppgifter (sammanfattningsuppgifter räknas inte).
- **Milstolpar:** — antalet milstolpar.
- **Kritisk linje: N uppgifter, N arbetsdagar** — antalet kritiska uppgifter och projektets varaktighet. Syns bara efter en beräkning.
- **Slut:** — projektslutet från beräkningen. Syns bara efter en beräkning; ett tomt projekt har inget.
- **N måldatum passerade**, **N restriktioner överträdda**, **N samband med framdrift i fel ordning** och **N resurser med överbeläggning** — var och en är en knapp med ett varningstecken. Knappen syns bara när räknaren är större än 0 och det finns en beräkning. Ett klick öppnar panelen *Varningar* (verktygstips: *Öppna varningspanelen (detaljer och navigering)*). Om du är på fliken *IFC* eller *Rapport* hoppar appen samtidigt till *Start*, eftersom högerkolumnen inte finns där. Räknaren *resurs(er) med överbeläggning* uppdateras också efter ändringar i resurser och tilldelningar. De andra räknarna ändras först efter *Beräkna*. De fyra räknarna är ett urval: det som panelen visar utöver det (överlapp kapat, samband ignorerat, hängmatta utan slutdrivande samband, slutdatum kapat, tidsplanfel) finns inte i statusfältet.
- **Föråldrad — beräkna om (F5)** — med ett varningstecken (verktygstips: *Tidsplanen är föråldrad — beräkna om (F5)*). Syns så snart du ändrar något som påverkar tidsplanen och du inte har beräknat om. Om *Beräkna automatiskt* är på visas den inte, utom när beräkningen gav ett fel: då visas den.
- **Markering: N uppgift(er)** — antalet markerade uppgifter. Syns bara när något är markerat.
- **Skala:** och **Zoom: Npx/day** — tidsskalan för tidslinjen och zoomnivån. Skalan följer av zoomen.
- **Osparat** — så länge dokumentet har ändringar som inte finns i filen.
- **AI** — en färgad punkt med ordet AI, bara när AI-läget är på. Verktygstipset säger *AI-bryggan:* med *Av*, *Aktiv på port N*, *Port N är upptagen* eller *Fel*. Ett klick öppnar fliken *AI*.
- **Felsökningsterminal** — en terminalknapp, bara när felsökningsterminalen är aktiverad; den visar eller döljer terminalen (*Visa felsökningsterminalen* / *Dölj felsökningsterminalen*).

## Panelen Varningar

- **Öppna** — *Tidsplan › Tidsplan › Varningar*, *Visa › Paneler › Varningar*, eller en räknare i statusfältet. Panelen finns i högerkolumnen, under *Egenskaper* och resursdockan, och den expanderar en ihopfälld kolumn. Som standard är den stängd och den sparas inte mellan sessioner. Du drar i kanten för att ändra höjden när den ligger under andra paneler, och den höjden sparas. Krysset uppe till höger stänger den (*Stäng varningar*).
- **Rubrikrad** — *N fel, N varning(ar)*. Om ingenting är beräknat ännu står det *Ännu inte beräknad. Tryck på Beräkna (F5) för att köra kontrollerna*.
- **Beräkna** — en knapp i rubrikraden, synlig så länge tidsplanen är föråldrad eller ännu inte beräknad. Den gör samma sak som *Beräkna* i menyfliksområdet.
- **Varningstecken i rubrikraden** — när tidsplanen är föråldrad, med verktygstipset *Tidsplanen är föråldrad. Den här listan kommer från den senaste beräkningen. Beräkna om (F5)*. Listan döljs inte. Den markeras bara som föråldrad.
- **Tom lista** — *Inga varningar. Tidsplanen klarar alla kontroller*.
- **En rad** — överst visas platsen (uppgift, samband, resurs eller projekt) och under den visas beskrivningen. Ett fel har ett eget åttakantigt tecken, en varning ett triangelformat tecken. En uppgift visas som `WBS-namn`. Ett samband visas som `föregående → efterföljande (FS+2d)`, med typ och fördröjning. Ett klick går till platsen (verktygstips *Gå till: …*), se nedan. Raden som hör till din aktiva uppgift (för ett samband: dess efterföljande uppgift) eller till resursen som valts i histogrammet är markerad.
- **Ordning** — fel först. Sedan per typ, i ordningen i listan nedan. Inom en typ i dokumentordning (för ett samband den efterföljande uppgiftens ordning, för en resurs resurslistans ordning). En uppgift, ett samband eller en resurs som togs bort efter den senaste beräkningen försvinner.

### Typer av varning

- **Tidsplanfel** — *Tidsplanen kunde inte beräknas: …* med skälet efter det, se nedan. Ett klick: för ett cirkelberoende markerar appen alla uppgifter i cirkelberoendet och hoppar till den första. För andra fel finns inget att hoppa till, och raden är inte en knapp.
- **Måldatum passerat** — *Måldatum {date} passerades. Tidigaste slut {date}*. Uppgiften har ett måldatum och beräkningen uppfyller det inte. Ett klick hoppar till uppgiften. Så åtgärdar du: ändra logiken eller varaktigheten, eller flytta måldatumet.
- **Överträdd restriktion** — *Restriktionen {type and date} överskrids av logiken (negativt slack)*. Restriktionen kan inte uppfyllas utan att logiken bryts; slacket är negativt. Ett klick hoppar till uppgiften. Se [Restriktioner](docs://uitleg-constraints).
- **Framdrift i fel ordning** — *Framdrift i fel ordning: framdriften för den efterföljande uppgiften strider mot sambandet*. Framdriften för den efterföljande uppgiften passar inte till sambandstypen, till exempel en efterföljande uppgift som redan pågår medan föregående uppgift ännu inte är klar vid ett slut-till-start-samband. Ett klick markerar båda uppgifterna, med den efterföljande uppgiften aktiv. Kontrollera de verkliga datumen eller sambandet.
- **Överlapp kapat** — *Överlapp kapat av projektstarten. Sambandet utnyttjas inte fullt ut*. Överlappet i sambandet, det vill säga ett negativt värde på fördröjningen, går längre tillbaka än projektstarten. Ett klick markerar båda uppgifterna.
- **Samband ignorerat** — *Samband ignorerat: föregående eller efterföljande uppgift saknas eller är inte en lövuppgift*. Beräkningen använder inte sambandet. Ett klick markerar de uppgifter som fortfarande finns. Se [Samband](docs://uitleg-relaties).
- **Hängmatta utan slutdrivande samband** — *Hängmatta utan slutdrivande samband (inget FF/SF-föregående): varaktigheten sätts till noll*. Ett klick hoppar till uppgiften. Se [Hängmattor](docs://howto-hammock).
- **Slutdatum kapat** — *Slutdatum kapat: kalendern lämnar inget användbart fönster för uppgiften*. Beräkningen nådde gränsen för hur många dagar den söker, till exempel på grund av en mycket lång sammanhängande period med lediga dagar i kalendern. Ett klick hoppar till uppgiften. Se [Kalendrar och arbetsdagar](docs://uitleg-kalenders).
- **Överbeläggning** — *Överbeläggning på N dag(ar) (första – sista)*, med *resursen arbetar inte dessa dag(ar) enligt sin kalender* tillagt om alla dagar är lediga, eller *av dessa N dag(ar) arbetar resursen inte enligt sin kalender* om det är en blandning. Ett klick markerar uppgifterna med en tilldelning på resursen, slår på histogrammet och väljer resursen i histogrammet. Från *Tabell*, *IFC* eller *Rapport* hoppar appen till *Resurser*. Se [Resurspanelen](docs://ref-resourcepaneel).

### Orsaker till ett tidsplanfel

- *Cirkulärt samband mellan uppgifter: {path}* — sambanden bildar ett cirkelberoende. Uppgifterna finns i sökvägen. Vänd på eller ta bort ett samband.
- *Kalendern har inga arbetsdagar inställda* — ge kalendern minst en arbetsdag. Se [Kalenderfönster](docs://ref-kalenders).
- *Ogiltig varaktighet i dagar för uppgift '{task}'* och *Ogiltig varaktighet i timmar för uppgift '{task}'* — varaktigheten för uppgiften är inte ett giltigt tal.
- *Timuppgift '{task}' har inga giltiga arbetstider i sin kalender* — en uppgift i timmar i en kalender utan arbetstider.
- *Ogiltigt startdatum för uppgift '{task}'* — startdatumet för uppgiften är inte giltigt.

## Remsorna under menyfliksområdet

En remsa ligger direkt under menyfliksområdet, ovanför arbetsytan. Den har en text och en knapp. En remsa för ett läge har inget kryss. Du stänger de andra remsorna med krysset. De fem remsorna:

- **Länkläge** — *Länkläge: dra i Gantt från en balk till en annan för att skapa ett samband. Esc stoppar.* Remsan finns kvar så länge länkläget är på. Knapp: *Stoppa*. Se [Skapa samband](docs://howto-relaties-leggen).
- **Delad uppgift** — *Klicka på en balk på den dag avbrottet börjar och dra åt höger för dess längd. Esc stoppar.* Remsan finns kvar så länge *Dela uppgift* är på. Knapp: *Stoppa*.
- **Timplanering i filen** — *Den här filen innehåller timplanering.* Remsan visas när en öppnad fil innehåller timplanering medan *Aktivera timplanering* är av. Knapp: *Aktivera timplanering*. Se [Aktivera timplanering](docs://howto-urenplanning-aanzetten).
- **Struktur låst** — *Inte tillgänglig vid filtrering/gruppering/sortering*. Remsan visas när indrag eller dra ut nekas, eftersom uppgiftstabellen är filtrerad, grupperad eller sorterad. Knapp: *Rensa*, som tar bort filtret, grupperingen och sorteringen.
- **Datum som sparats** — efter att du har öppnat en fil där en omberäkning flyttade datum: *Omberäkningen flyttade N av M uppgifter från datumen i filen.* med knappen *Visa sparade datum*. Medan vyn är på: *Du ser datumen som sparades i filen …* med knappen *Beräkna om*. Se [Datum som sparats](docs://uitleg-datums-zoals-opgeslagen).

## Meddelanden

Meddelanden visas längst ned på skärmen, också i tabellen, i Backstage och i presentationsläget. Ett meddelande är ett *fel* eller ett *info*. Ett fel är rött och stannar kvar tills du klickar på krysset. Ett info-meddelande försvinner efter 5 sekunder (ett meddelande med mycket förklaring stannar längre). Tidtagningarna startar om så snart listan ändras. Varje meddelande har ett kryss högst upp till höger (verktygstips *Stänga meddelandet*). Med krysset stänger du meddelandet direkt. Ett klick på texten i meddelandet gör ingenting. En avvisning är alltid ett fel: appen meddelar att den inte utförde något du gjorde, till exempel ett avvisat samband, en varaktighet, en start eller en milstolpe. Så missar du den inte om du tittar bort en stund. En avvisning försvinner efter Ctrl+Z eller Ctrl+Y och när du går till ett annat dokument, eftersom den då inte längre stämmer. Ett annat fel, till exempel *Kunde inte spara*, stannar kvar. Det gäller också när resten av samma åtgärd lyckades, till exempel när du klistrar in i flera celler. Gäller det flera uppgifter, står en rad under som säger vilka uppgifter som inte ändrades, till exempel *Inte ändrat: Foundation, Masonry.* Är det fler än fem, slutar raden med *och N fler uppgifter*. Samma avvisning slås ihop till en rad med en räknare när den upprepas. Högst tre visas samtidigt. Kommer en fjärde, försvinner det äldsta info-meddelandet först. Finns inget info, försvinner den äldsta avvisningen, sedan det äldsta kvarstående öppningsmeddelandet och sist det äldsta felet. Ett info-meddelande eller en avvisning trycker alltså aldrig bort ett annat fel, till exempel *Kunde inte spara*. Listan flyttar sig bort från knapparna i en öppen dialogruta och från kvarstående åtgärdsrader. Ett meddelande när du öppnar en fil stannar också kvar tills du klickar på krysset, om appen fyllde i, ersatte, reparerade eller utelämnade data under öppnandet. Det gäller en rad om fynd från tolkningen eller kalendern, problem med talformat, uppräkningsreserver, P6-tidsplaninställningar med en säker reservlösning, en skyddande baslinje-reserv, ignorerade baslinjehänvisningar, uppgifter utan planerad start som fick en start, samband mellan projekt eller uppgifter utan projekt som inte lästes in (P6 XML), något från en MS Project-fil som inte lästes in (MS Project XML och `.mpp`) eller ett oanvändbart XER-källarkiv, och meddelandena om dubbla id:n och samband som inte beräknas. Innehåller meddelandet bara information utan en sådan ändring (till exempel antalet projekt, dokument eller teckenkodningen), försvinner det efter 5 sekunder.

- **Räknare ×N** — ett meddelande med en fast nyckel slår ihop en upprepning till en rad med en räknare, till exempel ett sparfel som kommer tillbaka hela tiden eller ett avvisat samband som du upprepar. Inte alla meddelanden gör det.
- **Läs mer** — några meddelanden har en länk *Läs mer* eller ett eget ämne (till exempel *Uppgiftstyper förklarade*) till guiden i Backstage › Hjälp.
- **Åtgärdsknapp** — meddelandet om beräkningsprofilen har en knapp *Öppna beräkningsprofil* till projektinställningarna.

Listan nedan är ett urval, grupperat per ämne. Där det inte säger något annat är det ett info.

### Sparning, öppning och återställning

- **Sparning misslyckades** (fel) — *Kunde inte spara* med orsaken under. Gäller när du sparar, sparar som och när du exporterar en rapport.
- **Sparad som nedladdning** (info) — *Sparad som nedladdning: ”{name}” finns nu i mappen för nedladdningar. …* Med *Spara som* och vid export, när miljön inte låter appen skriva direkt på den plats du valde. Två nedladdningar direkt efter varandra slås ihop.
- **Sparad som nedladdning (förklaring)** (info, 15 sekunder) — *Sparad som nedladdning: ”{name}” finns i mappen för nedladdningar. Den här webbläsaren låter inte appen skriva på en egen plats, …* Med *Spara* i en webbläsare som bara sparar via en nedladdning. En gång per session, med en länk till förklaringen av filer.
- **Webbläsaren skriver inte tillbaka** (info, 15 sekunder) — *Den här webbläsaren låter inte appen skriva tillbaka till ”{name}”. …* Med *Spara* för ett projekt som har en fil, när webbläsaren måste fråga efter en plats igen. En gång per session, med en länk till förklaringen av filer.
- **Automatisk sparning misslyckades** (fel) — *Automatisk sparning misslyckades* med orsaken. Gäller automatisk sparning till filen och kraschskydd.
- **Biblioteket kunde inte sparas** (fel) — *Biblioteket kunde inte sparas*, när du sparar biblioteket med resurser.
- **Öppning av en fil misslyckades** (fel) — *Det gick inte att öppna filen* med orsaken. Till exempel en senast använd fil eller en importerad fil.
- **Äldre eller skyddad .mpp** (fel) — *Den här .mpp-filen använder ett äldre format (Project 2007 eller tidigare)…* eller *Den här .mpp-filen är lösenordsskyddad…*, båda med rådet att exportera filen som XML i MS Project och öppna den filen.
- **Ogiltig XER-fil** (fel) — en av *XER…*-texterna, till exempel *Den här filen är ingen giltig eller stödd XER-fil.* eller *XER-filen innehåller en dubbel tabell.*, med orsaken tillagd.
- **IFC kunde inte läsas** (fel) — *IFC kunde inte läsas* med orsaken, i IFC-vyn.
- **Återställning** (fel) — *Den återställda filen kunde inte läsas*, *Kunde inte återställa* och *N återställningsfiler kunde inte läsas in och hoppades över.* När du återställer efter en oväntad avstängning.
- **Gren sparad som mall** (info) — *Gren sparad som mall '{name}'*.
- **Meddelande från ett tillägg** (info, eller fel om tillägget rapporterar ett fel) — *Tillägg {name}: {message}*. Ett tillägg får visa högst tre nya meddelanden per 10 sekunder, så att listan inte fylls. Om ett steg i guiden från ett tillägg misslyckas, står det *Ett steg från tillägget {name} gav ett fel. Guiden fortsätter.*, och om en projektfil från ett tillägg inte kan öppnas, *Projektfilen {file} från tillägget {name} kunde inte öppnas.* Båda är fel.
- **En ändring kom emellan** (fel) — *En ändring från AI-assistenten eller ett tillägg kom emellan. …* När du avbryter uppgiftsdialogen medan AI-assistenten eller ett tillägg ändrade något under tiden: uppgiftsändringarna från före den ändringen ångras inte och finns kvar som vanliga steg under *Ångra*.

### Beräkning

- **Tidsplanen kunde inte beräknas** (fel) — *Tidsplanen kunde inte beräknas* med orsaken under den (se *Orsaker till ett tidsplanfel*). Vid *Beräkna*, när du byter dokument och när du öppnar en fil.
- **Rapportdatum satt till idag** (info) — *Rapportdatum satt till idag ({date}).* Visas när du anger framdrift i ett projekt utan rapportdatum. Appen mäter framdriften fram till rapportdatumet, så utan rapportdatum kan den inte behandla framdrift. Du anger ett annat datum under *Tidsplan › Baslinjer & framdrift › Rapportdatum*. Med en länk *Läs mer* till [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang).
- **Varaktigheten kortare än redan utfört arbete** (fel) — *'{name}' är redan {percent} % klar. En varaktighet kortare än det redan utförda arbetet är inte möjlig. Varaktigheten har inte ändrats.*

### Samband och hierarki

- **Samband avvisat** (fel) — *Det här sambandet finns redan*, *Ett samband mellan en uppgift och en av dess sammanfattningsuppgifter högre upp är inte tillåtet.* eller *Det här sambandet skulle ge ett cirkelberoende i tidsplanen ({cycle}). Det har inte skapats.* Cirkeln visar uppgifterna, så att du vet vilket samband du ska ta bort eller vända på först.
- **Flytt avvisad** (fel) — *Den här flytten skulle skapa ett cirkelberoende i tidsplanen ({cycle}): samband för en sammanfattningsuppgift gäller även för dess underuppgifter. Ingenting har flyttats.*
- **Samband faller bort efter en flytt** (info) — *Efter flytten kopplar N samband en uppgift till dess egen sammanfattningsuppgift; det räknas inte längre med i beräkningen.*
- **Samband hoppas över vid infogning** (fel) — *N samband skapades inte: ogiltigt samband…*, när du klistrar in eller infogar en gren. En rad under säger vilka samband, till exempel *Inte skapat: Foundation → Masonry.*
- **Samband räknas inte med efter import** (info) — *N samband kunde inte räknas med. Kontrollera kolumnerna Föregående och Efterföljande.*
- **Dubbla id:n efter import** (info) — *Objekt med ett dubbelt id i den här filen: N. De fick egna id:n…*

### Redigera uppgifter

- **Start registrerad som restriktion** (info) — *'{name}' startar tidigast {date} (SNET).* När du ändrar starten för en uppgift med en föregående uppgift. Den föregående uppgiften bestämmer starten, så appen registrerar ditt datum som restriktionen *starta tidigast* (SNET). Efter att du har beräknat om (F5) startar uppgiften inte före det datumet. Hade uppgiften redan en sådan restriktion, står det *'{name}' startar nu tidigast {date} (SNET).* För flera uppgifter samtidigt visas ett antal. Med en länk *Läs mer* till [Restriktioner och måldatum](docs://uitleg-constraints).
- **Start inte tillämpad** (fel) — *Den nya starten för ”{name}” tillämpades inte: uppgiften har en föregående uppgift och restriktionen {type} {date}, och de bestämmer starten. Ändra den restriktionen för att flytta starten.*
- **Milstolpe avvisad** (fel) — *'{task}' har resurstilldelningar och kan inte bli en milstolpe. Ta först bort tilldelningarna.* eller *'{task}' är en sammanfattningsuppgift med underuppgifter och kan inte bli en milstolpe.* Gäller när du gör en uppgift till milstolpe i uppgiftsdialogen, egenskapspanelen, snabbmenyn och tabellen.
- **Tilldelningar flyttades till en underuppgift** (info) — *Tilldelningen flyttades till underuppgiften '{child}'.* eller *N tilldelningar flyttades till underuppgiften '{child}'.* När ett tillägg ger underuppgifter till en uppgift med tilldelningar. Den uppgiften blir en sammanfattningsuppgift, och en sammanfattningsuppgift har inga tilldelningar i sig. Därför flyttas de till den första nya underuppgiften. I appen självt väljer du det i fönstret *Uppgift blir en sammanfattningsuppgift*. Det här meddelandet visas då inte. Med en länk *Läs mer* till [Ändra strukturen](docs://howto-structuur-aanpassen).
- **Milstolpeflagga borttagen** (info) — *'{phase}' är inte längre en milstolpe.* När en milstolpe får underuppgifter. En milstolpe är ett ögonblick utan underuppgifter. Med underuppgifter blir den en sammanfattningsuppgift. Med en länk *Läs mer* till [Ändra strukturen](docs://howto-structuur-aanpassen).
- **Fråga inaktuell** (fel) — *Uppgifterna eller tilldelningarna har ändrats medan frågan var öppen. Ingenting har ändrats. Försök igen.* När du väljer i fönstret *Uppgift blir en sammanfattningsuppgift*, men frågan inte längre stämmer.
- **Sammanfattningsuppgift avvisad** (fel) — *'{phase}' kan inte bli en sammanfattningsuppgift: …* med orsaken, och *Ingenting har ändrats.* När ett tillägg ger underuppgifter till en uppgift med tilldelningar och tilldelningarna inte kan flyttas till den första nya underuppgiften. I appen självt visas det här meddelandet inte. Där frågar fönstret *Uppgift blir en sammanfattningsuppgift* vad som ska hända, och *Flytta* är då inaktiverat.
- **Celler hoppades över vid inklistring** (fel) — *N celler hoppades över: de är skrivskyddade (till exempel automatiskt numrerade WBS-koder eller beräknade kolumner).*
- **Referenser rensades vid inklistring** (info) — *N referenser fanns inte i det här dokumentet och har tagits bort (uppgiftskalendrar, egna arbetskategorier, uppgiftskoder eller egna fält från källdokumentet).*
- **Strukturen är låst** (fel, röd rad under menyfliksområdet) — *Inte tillgänglig vid filtrering/gruppering/sortering*, med knappen *Rensa*. Medan listan är filtrerad, grupperad eller sorterad gäller det när du gör indrag, när du drar ut uppgifter och när du drar uppgifter, och med *Infoga ovanför* och *Infoga under* (högerklicksmenyn eller genväg). Raden stannar kvar tills du klickar på krysset, använder Ctrl+Z eller Ctrl+Y, eller går till ett annat dokument. Se [Ändra strukturen](docs://howto-structuur-aanpassen).
- **Uppgift lades till sist** (fel) — *Den nya uppgiften lades till sist. Under filtrering, gruppering eller sortering kan appen inte placera den under din markering.* Med knappen *Rensa*. Med *Uppgift* och *Milstolpe ▾* när en uppgift är markerad och listan är filtrerad, grupperad eller sorterad. Uppgiften läggs till, men längst ned. *Rensa* tar bort filtret, grupperingen och sorteringen och stänger meddelandet. Se [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen).
- **Uppgiftstyp justerade varaktigheter** (info) — *Uppgiftstypen justerade varaktigheten för N uppgifter efter kalenderändringen (arbetet står kvar, timmar per dag ändrades).* Med en länk *Uppgiftstyper förklarade*.

### Primavera P6 XML

- **P6 XML-fil öppnad** (info) — *P6 XML-fil öppnad: N projektdokument.* Efter att du har öppnat en P6 XML-fil.
- **Inte importerat** (stannar kvar) — *N samband mellan projekt har inte tagits över som samband.* och *N uppgifter utan projekt har inte lästs in.* Kontrollera om din tidsplan är komplett.
- **Tom eller oanvändbar** (fel) — ingenting öppnas. Det finns tre orsaker: *Den här filen innehåller inga uppgifter som appen kan läsa.*, *Uppgifterna har inget ObjectId. …* och *Filen använder XER-kolumnnamn … Öppna .xer-filen själv.*

### Primavera (XER)

- **XER-fil öppnad** (info) — *XER-fil öppnad: N projektdokument.* Ett meddelande per fil, även om filen öppnar flera projekt, med en länk *Läs mer* och detaljrader under. Alltid *N projekt sedda.* Bara när antalet är större än 0: *N tomma projekt överhoppade.*, *N baslinjeprojekt exkluderade.*, *N baslinjer materialiserade.*, *N lösa baslinjehänvisningar ignorerade.*, *En skyddande baslinje-reserv användes.* och *N externa samband bevarade.* Bara för en annan kodning än UTF-8: *Teckenkodning fastställd som {encoding}.* Dessutom, när antalet är större än 0: *N tolkningsfynd.*, *N kalenderfynd.*, *N problem med talformat.*, *N uppräkningsreserver.* och *N P6-tidsplaninställningar med säker reservlösning.*
- **Datum som Primavera sparade** (detaljrad i samma meddelande) — *N uppgifter visar datumen så som Primavera sparade dem (inte beräknas om).* N räknar varje uppgift för vilken filen sparade datum, även de som inte skiljer sig. Eller, om läget inte slogs på: *N uppgifter skiljer sig från datumen i filen – du kan visa dem.*
- **XER-källarkivet är oanvändbart** (info) — *XER-källarkivet i den här filen är oanvändbart och har utelämnats. Projektet självt öppnades helt.* med orsaken (till exempel *Orsak: kontrollsumman stämmer inte med källbytena. Arkivet är skadat.*) och konsekvensen (*Tidsplanen, beräkningsprofilen och all projektdata från IFC är kompletta. …*). När du öppnar en IFC-fil där ett tidigare sparat XER-källarkiv inte kan användas. Även när du återställer efter en oväntad avstängning, om återställningslagret inte längre har källarkivet.
- **Export förlorar XER-information** (info) — *Export till {format} gör att XER-källinformation går förlorad.* Efter en lyckad export till ett annat format än IFC av ett projekt med data som bara finns i en XER-fil. Med en länk *Läs mer*.

### Import, export och beräkningsprofil

- **Datum som i filen** (info) — *N uppgifter visar datumen så som de står i filen (inte beräknas om).* (N räknar varje uppgift med sparade datum) eller *N uppgifter skiljer sig från datumen i filen – du kan visa dem.* När du öppnar en fil med sparade datum.
- **Arbete och uppgiftstyper syns** (info) — *Den här filen innehåller sparat arbete eller uppgiftstyper; uppgiftstypen och återstående arbete visas för det här projektet.*
- **MS Project-tidsplan läst** (info) — *Den här MS Project-filen innehåller N uppgifter med avbrott, utjämnad eller resursstyrd tidsplan. De läses in och visas så.*
- **Avbrott exporterades inte** (info) — *N uppgifter med avbrott exporterades utan sina avbrott: MS Project och P6 känner bara till avbrott som en arbetsfördelning.* När du exporterar till MS Project eller Primavera.
- **Projektstart flyttad** (info) — *N uppgifter flyttades med projektstarten.* När du sätter projektstarten senare. Bara uppgifter utan föregående uppgift och utan restriktion som skulle ligga före det nya startdatumet flyttas till det datumet. Med en länk *Läs mer* till [Nytt projekt och projektinställningar](docs://ref-projectinfo).
- **Datumfönstret styr inte längre** (info) — *MS Projects datumfönster styr inte längre N uppgifter efter den här ändringen; …* En gång per dokument.
- **Förskjutning pga utjämning avrundad** (info) — *Utjämning avrundar MS Projects minutexakta förskjutning pga utjämning till hela arbetsdagar för N uppgifter.* En gång per dokument.
- **Beräkningsprofil tillämpad** (info) — *Det här projektet beräknas enligt {profile}. Ändra det via ”Arkiv” → ”Projektinfo” → ”Beräkningsprofil och beräkningsalternativ”.* Med knappen *Öppna beräkningsprofil*. Efter att du har tillämpat en profil följer *Efter tillämpning har N uppgifter flyttats.* om det behövs.
