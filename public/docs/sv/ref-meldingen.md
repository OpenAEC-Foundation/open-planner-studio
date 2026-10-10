# Meddelanden och varningar

Appen visar vad som händer på tre ställen: statusfältet längst ner, panelen *Varningar* i högra kolumnen och meddelandena som visas en kort stund längst ner på skärmen. Den här artikeln beskriver för varje ställe vad du ser, när det visas och vad du kan göra åt det. Varför en tidsplan är kritisk eller har överbeläggning beskrivs i [Kritisk linje och slack](docs://uitleg-kritiek-pad); att åtgärda överbeläggning beskrivs i [Åtgärda överbeläggning](docs://howto-overbezetting-oplossen); att skapa samband beskrivs i [Skapa samband](docs://howto-relaties-leggen).

## Skillnaden mellan de tre

- **Statusfält** — en fast rad med räknare. De kommer från den senaste beräkningen och finns kvar tills du beräknar igen.
- **Panelen Varningar** — listan bakom de räknarna, med allt som den senaste beräkningen hittade. Ett klick tar dig till uppgiften, sambandet eller resursen. Den härleds från den senaste beräkningen. Inget sparas.
- **Meddelanden** — korta texter om något du just gjorde (sparandet misslyckades, samband nekades, importen lästes). De försvinner igen och finns inte i panelen.

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

## Notiser

Notiser visas längst ned på skärmen, även i tabellen, i Backstage och i presentationsläget. En notis är ett *fel* eller en *info*. Ett fel stannar tills du klickar bort det. En info försvinner efter 5 sekunder. Tidtagarna startar om så snart stapeln ändras. Om du klickar på en notis stängs den (verktygstips *Stänga meddelandet*). Högst tre visas samtidigt. Kommer en fjärde, försvinner den äldsta infon först. Finns det ingen info, försvinner den äldsta notisen. Så trycks ett fel aldrig undan av en info. Stapeln flyttar sig bort från knapparna i en öppen dialog och från fasta åtgärdsfält.

- **Räknare ×N** — en notis med en fast nyckel slår ihop en upprepning till en rad med en räknare, till exempel ett sparfel som kommer tillbaka eller ett avvisat samband som du upprepar. Inte alla notiser gör det.
- **Läs mer** — vissa notiser har en länk *Läs mer* eller ett eget ämne (till exempel *Arbetsregler förklarade*) till guiden i Backstage › Hjälp.
- **Åtgärdsknapp** — notisen om beräkningsprofilen har en knapp *Öppna beräkningsprofil* till Projektinfo.

Listan nedan är ett urval, grupperat per ämne. Där det inte anges något annat är det en info.

### Spara, öppna och återställa

- **Sparning misslyckades** (fel) — *Kunde inte spara* med orsaken under. Visas när du sparar, sparar som och exporterar en rapport.
- **Sparad som nedladdning** (info) — *Sparad som nedladdning: ”{name}” finns nu i mappen för nedladdningar. …* Med *Spara som* och export, när miljön inte låter appen skriva direkt till platsen du valde. Två nedladdningar direkt efter varandra slås ihop.
- **Sparad som nedladdning (förklaring)** (info) — *Sparad som nedladdning: ”{name}” finns i mappen för nedladdningar. Den här webbläsaren låter inte appen skriva till en egen plats, …* Med *Spara* i en webbläsare som bara sparar via en nedladdning. En gång per session, med en länk till förklaringen om filer.
- **Webbläsaren skriver inte tillbaka** (info) — *Den här webbläsaren låter inte appen skriva tillbaka till ”{name}”. …* Med *Spara* för ett projekt som har en fil, när webbläsaren måste fråga efter en plats på nytt. En gång per session, med en länk till förklaringen om filer.
- **Automatisk sparning misslyckades** (fel) — *Automatisk sparning misslyckades* med orsaken. Gäller automatisk sparning till filen och kraschskydd.
- **Biblioteket kunde inte sparas** (fel) — *Biblioteket kunde inte sparas*, när du sparar resursbiblioteket.
- **Öppnandet av en fil misslyckades** (fel) — *Det gick inte att öppna filen* med orsaken. Till exempel en nyligen använd fil eller en importerad fil.
- **Gammal eller skyddad .mpp** (fel) — *Den här .mpp-filen använder ett äldre format (Project 2007 eller tidigare)…* eller *Den här .mpp-filen är lösenordsskyddad…*, båda med rådet att exportera som XML i MS Project och öppna den filen.
- **Ogiltig XER-fil** (fel) — en av texterna *XER…*, till exempel *Den här filen är ingen giltig eller stödd XER-fil.* eller *XER-filen innehåller en dubbel tabell.*, med orsaken tillagd.
- **IFC kunde inte läsas** (fel) — *IFC kunde inte läsas* med orsaken, i IFC-vyn.
- **Återställning** (fel) — *Den återställda filen kunde inte läsas*, *Kunde inte återställa* och *N återställningsfiler kunde inte läsas in och hoppades över.* Vid återställning efter en oväntad avstängning.
- **Gren sparad som mall** (info) — *Gren sparad som mall '{name}'*.
- **Meddelande från ett tillägg** (info, eller fel om tillägget rapporterar ett fel) — *Tillägg {name}: {message}*. Ett tillägg får visa högst tre nya per 10 sekunder, så att det inte fyller stapeln. Om ett steg i ett tillägs guide misslyckas, står det *Ett steg från tillägget {name} gav ett fel. Guiden fortsätter.*, och om en projektfil från ett tillägg inte kan öppnas, *Projektfilen {file} från tillägget {name} kunde inte öppnas.* Båda är fel.
- **En ändring kom emellan** (info) — *En ändring av AI-assistenten eller ett tillägg gjordes under tiden. …* När du avbryter uppgiftsdialogen medan AI-assistenten eller ett tillägg ändrade något under tiden: uppgiftsredigeringarna från före den ändringen ångras inte och ligger kvar som vanliga steg under *Ångra*.

### Beräkning

- **Tidsplanen kunde inte beräknas** (fel) — *Tidsplanen kunde inte beräknas* med orsaken under den (se *Orsaker till tidsplanfel*). Vid *Beräkna*, när du byter dokument och när du öppnar en fil.
- **Rapportdatum satt till idag** (info) — *Det fanns inget rapportdatum ännu. Det är nu satt till idag ({date}), eftersom framdrift mäts fram till rapportdatumet. Du kan ändra det under Tidsplan → Rapportdatum.* När du anger framdrift i ett projekt utan rapportdatum.
- **Varaktighet kortare än utfört arbete** (info) — *'{name}' är redan {N} % klar. En varaktighet kortare än det redan utförda arbetet är inte möjlig. Varaktigheten har inte ändrats.*

### Samband och hierarki

- **Samband skapat** (info) — *Samband skapat: {predecessor} → {successor}*.
- **Samband avvisat** (info) — *Det här sambandet finns redan*, *Ett samband mellan en uppgift och en av dess sammanfattningsuppgifter högre upp är inte tillåtet.* eller *Det här sambandet skulle ge ett cirkelberoende i tidsplanen ({cycle}). Det har inte skapats.* Cirkelberoendet visar vilka uppgifter det gäller, så att du vet vilket samband du ska ta bort eller vända först.
- **Flytt avvisad** (info) — *Den här flytten skulle skapa ett cirkelberoende i tidsplanen ({cycle}): samband för en sammanfattningsuppgift gäller även för dess underuppgifter. Ingenting har flyttats.*
- **Samband räknas inte med efter en flytt** (info) — *Efter flytten kopplar N samband uppgifter till sina egna sammanfattningsuppgifter; de räknas inte längre med i beräkningen.*
- **Samband hoppades över vid infogning** (info) — *N samband skapades inte: ogiltig länk…*, vid inklistring eller infogning av en gren.
- **Samband räknas inte med efter import** (info) — *N samband kunde inte räknas med. Kontrollera kolumnerna Föregående och Efterföljande.*
- **Dubbla id:n efter import** (info) — *Objekt med ett dubbelt id i den här filen: N. De fick ett eget id…*

### Redigera uppgifter

- **Start sparad som restriktion** (info) — *'{name}' har ett föregående: den nya starten har sparats som restriktionen Starta tidigast (SNET) {date}. När du beräknar om (F5) startar uppgiften inte före det datumet.* När du ändrar starten för en uppgift med ett föregående. Hade uppgiften redan en sådan restriktion, visar notisen att den flyttades. För flera uppgifter samtidigt visas ett antal.
- **Start inte tillämpad** (info) — *Den nya starten för ”{name}” tillämpades inte: uppgiften har ett föregående och restriktionen {type} {date}, och de styr dess start. Ändra restriktionen för att flytta starten.*
- **Milstolpe avvisad** (info) — *'{task}' har resurstilldelningar och kan inte bli en milstolpe. Ta först bort tilldelningarna.* eller *'{task}' är en sammanfattningsuppgift med underuppgifter och kan inte bli en milstolpe.* Vid konvertering i uppgiftsdialogen, egenskapspanelen, snabbmenyn och tabellen.
- **Tilldelningar flyttades till en underuppgift** (info) — *Tilldelningen av {resources} flyttades från '{phase}' till den nya underuppgiften '{child}'. En sammanfattningsuppgift har inga tilldelningar själv.* När en uppgift med tilldelningar får underuppgifter.
- **Milstolpsmarkering borttagen** (info) — *Milstolpen '{phase}' har nu underuppgifter och har blivit en sammanfattningsuppgift. Milstolpsmarkeringen togs bort.*
- **Sammanfattningsuppgift avvisad** (info) — *”{phase}” kan inte bli en sammanfattningsuppgift: …* med orsaken, och *Ingenting ändrades.*
- **Celler hoppades över vid inklistring** (info) — *N celler hoppades över: de är skrivskyddade (till exempel automatiskt numrerade WBS-koder eller beräknade kolumner).*
- **Referenser rensades vid inklistring** (info) — *N referenser fanns inte i det här dokumentet och har tagits bort (uppgiftskalendrar, egna uppgiftstyper, aktivitetskoder eller egna fält från källdokumentet).*
- **Arbetsregel justerade varaktigheter** (info) — *Efter kalenderändringen justerade arbetsregeln varaktigheten för N uppgifter (arbetet blir kvar, timmar per dag ändrades).* Med en länk *Arbetsregler förklarade*.

### Primavera (XER)

- **XER-fil öppnad** (info) — *XER-fil öppnad: N projektdokument.* En notis per fil, även om filen öppnar flera projekt, med en länk *Läs mer* och detaljrader under den. Alltid *N projekt sedda.* Bara när antalet är större än 0: *N tomma projekt överhoppade.*, *N baslinjeprojekt exkluderade.*, *N baslinjer materialiserade.*, *N lösa baslinjehänvisningar ignorerade.*, *En skyddande baslinje-reserv användes.* och *N externa samband bevarade.* Bara för en annan teckenkodning än UTF-8: *Teckenkodning fastställd som {encoding}.* Vidare, när antalet är större än 0: *N tolkningsfynd.*, *N kalenderfynd.*, *N problem med talformat.*, *N uppräkningsreserver.* och *N P6-tidsplaninställningar med säker reservlösning.*
- **Datum så som Primavera sparade dem** (detaljrad i samma notis) — *N uppgifter visar datumen så som Primavera sparade dem (inte beräknas om).*, eller, om läget inte slogs på, *N uppgifter avviker från datumen i filen — du kan visa dem.*
- **XER-källarkiv går inte att använda** (info) — *XER-källarkivet i den här filen är oanvändbart och har utelämnats. Projektet självt öppnades helt.* med orsaken (till exempel *Orsak: kontrollsumman stämmer inte med källbytena. Arkivet är skadat.*) och följden (*Tidsplanen, beräkningsprofilen och alla projektdata från IFC är kompletta. …*). När du öppnar en IFC-fil där ett tidigare sparat XER-källarkiv inte kan användas.
- **Export gör att XER-information går förlorad** (info) — *Export till {format} gör att XER-källinformation går förlorad.* Efter en lyckad export till ett annat format än IFC av ett projekt med data som bara finns i en XER-fil. Med en länk *Läs mer*.

### Import, export och beräkningsprofil

- **Datum som i filen** (info) — *N uppgifter visar datumen så som de står i filen (inte beräknas om).* eller *N uppgifter avviker från datumen i filen — du kan visa dem.* När du öppnar en fil med sparade datum.
- **Arbete och arbetsregler visas** (info) — *Den här filen innehåller sparat arbete eller egna arbetsregler; arbetsregeln och återstående arbete visas för det här projektet.*
- **MS Project-tidsplan läst** (info) — *Den här MS Project-filen innehåller N uppgifter med avbrott, utjämnad eller resursstyrd tidsplan. De läses in och visas så.*
- **Avbrott exporterades inte** (info) — *N uppgifter med avbrott exporterades utan sina avbrott: MS Project och P6 känner bara till avbrott som en arbetsfördelning.* Vid export till MS Project eller Primavera.
- **Projektstart flyttad** (info) — *Projektstart flyttad: N uppgiftsankare utan föregående eller restriktion har flyttats till det nya startdatumet.*
- **Datumfönstret styr inte längre** (info) — *MS Projects datumfönster styr inte längre N uppgifter efter den här ändringen; …* En gång per dokument.
- **Förskjutning pga utjämning avrundad** (info) — *Utjämning avrundar MS Projects minutexakta förskjutning pga utjämning till hela arbetsdagar för N uppgifter.* En gång per dokument.
- **Beräkningsprofil tillämpad** (info) — *Det här projektet beräknas enligt {profile}. Ändra det via Arkiv → Projektinfo → Beräkningsprofil och beräkningsalternativ.* Med knappen *Öppna beräkningsprofil*. Efter att du tillämpat en profil visas *Efter tillämpning har N uppgifter flyttats.* vid behov.
