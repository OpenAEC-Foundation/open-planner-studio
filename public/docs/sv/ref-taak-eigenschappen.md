# Uppgiftsdialogen och egenskapspanelen

Du kan redigera en uppgift på två ställen: i fönstret *Redigera uppgift* och i panelen *Egenskaper*. De delar nästan alla fält. Den här artikeln beskriver per fält vad det gör, vad standardvärdet är och vad du märker av det. Hur du skapar och ställer in en uppgift står i [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen). Varför beräkningen blir som den blir står i [Kritisk linje och slack](docs://uitleg-kritiek-pad).

## De två ställena

- **Redigera uppgift** — fönstret för den första markerade uppgiften. Öppna det med F2, genom att dubbelklicka på en balk i Gantt-vyn, eller genom att högerklicka på en uppgift i Gantt-vyn eller tabellen och välja *Redigera...*. Dina ändringar stannar i ett utkast tills du klickar på *Spara* (Enter). *Avbryt* (Esc) kastar bort dem. *Spara* är inaktiv när namnet är tomt. Ett sparande räknas som ett steg för *Ångra*, även för det du gjorde i avsnitten *Arbetsregel*, *Samband*, *Tilldelningar* och *Koder och fält*. Dessa ändrar redan projektet när du redigerar. *Avbryt* ångrar dem.
- **Egenskaper** — panelen i den högra kolumnen, för den aktiva uppgiften. Varje ändring gäller direkt. Ändringar i samma fält direkt efter varandra räknas som ett steg för *Ångra*. Utan uppgift står det *Välj en uppgift för att se egenskaperna.* Slå på eller av den med *Visa › Paneler › Egenskaper*. Standard: på. Panelen sitter bredvid Gantt-vyn och på fliken *Tabell*, inte på *IFC* och *Rapport* och inte under den fullständiga resurspanelen.

Bara i fönstret: *Överordnad uppgift* och knapparna *Spara* och *Avbryt*. Bara i panelen: papperskorgen *Ta bort uppgift*, knappen *Beräkna* längst ned, avsnittet *Avbrott*, de tre markeringarna under *Arbetsregel* (lång ledig tid, MS Project, registrerade datum) och att lägga till samband och hoppa till en länkad uppgift under *Samband*. Alla andra fält finns på båda ställena. Fönstret visar *Samband*, *Tilldelningar* och *Koder och fält* bara för en befintlig uppgift.

Om du har ändrat något som påverkar datumen, tryck på *Beräkna*. Beräkningen sker inte av sig själv, om inte *Beräkna automatiskt* är på.

## Allmänt

- **Namn** (i fönstret *Namn \**) — namnet på uppgiften i Gantt-vyn, tabellen och rapporterna. Obligatoriskt: ett tomt namn sparas inte. Standard för en ny uppgift: *Ny uppgift*.
- **WBS-kod** — strukturkoden för uppgiften, till exempel `RB-301`. Obligatoriskt. Med *Tidsplan › Struktur › WBS auto* är fältet inaktiverat (verktygstips: *WBS-koder numreras automatiskt (Planning → Struktur)*), eftersom appen då hanterar koderna.
- **Beskrivning** — fri text. Ingen effekt på beräkningen. Du kan visa den som kolumnen *Beskrivning* i tabellen.
- **Typ** — uppgiftstypen. Listan har grupperna *Inbyggda typer* (*Bygg*, *Installation*, *Rivning*, *Logistik*, *Besiktning*, *Flytt*, *Renovering*, *Underhåll*), *Mina uppgiftstyper* och *Från det här projektet*. *Övrigt* visas bara om uppgiften redan har den typen. Längst ned finns *+ Ny uppgiftstyp*… och *Hantera uppgiftstyper*…. Standard: typen för den överordnade uppgiften. Annars *Bygg* (när läget Bygg är på, vilket är standard) eller *Övrigt*. Effekt: ingen effekt på beräkningen. Du kan gruppera och filtrera på typen och färga balkarna efter typen. Appen sparar en egen typ på din enhet. När du väljer den, kopieras en kopia till projektet (*Från det här projektet*). Skriver du ett namn vid *+ Ny uppgiftstyp*… som redan finns i *Mina uppgiftstyper*, även med andra versaler, skapar appen ingen ny typ. Den väljer då den befintliga. I *Hantera uppgiftstyper*… kan du bara redigera eller ta bort dina egna typer. Ett tomt namn, eller ett namn som redan finns, sparas inte. Tar du bort en typ som det öppna projektet använder, frågar appen först. Projektets kopia finns kvar. En typ under *Från det här projektet*, till exempel från någon annans fil, hamnar bara i din egen lista när du klickar på *Lägg till i mina uppgiftstyper* i *Hantera uppgiftstyper*….
- **Kalender** — kalendern där uppgiften räknar sin varaktighet, sitt slutdatum och sitt slack. Standard: *Projektkalender: {name}*. Effekt: en uppgift med en egen kalender arbetar andra dagar än projektkalendern. Efter en ändring beräknas om datumen med *Beräkna*. Se [Kalendrar och arbetsdagar](docs://uitleg-kalenders).
- **Överordnad uppgift** (bara i fönstret) — flyttar uppgiften under en annan uppgift. Standard: den nuvarande överordnade uppgiften. *- Ingen (rot) -* placerar den på översta nivån. Ett val som skulle skapa ett cirkelberoende i sambanden, vägras vid *Spara* med ett meddelande. Fönstret blir kvar öppet.

## Anteckningar

- **Anteckningar** — en checklista för uppgiften. *Lägg till anteckning* lägger till en rad. Bocken (*Klar*) stryker över raden. Papperskorgen (*Ta bort*) tar bort den. Utan rader står det *Inga anteckningar ännu.* Ingen effekt på beräkningen. Kolumnen *Anteckningar* i tabellen visar dem med ✓ eller ○ framför.

## Milstolpe

- **Milstolpe** — gör uppgiften till en milstolpe. Standard: av. Effekt: varaktigheten blir 0. Appen vägrar det för en sammanfattningsuppgift (en uppgift med underuppgifter) och för en uppgift med resurstilldelningar, med ett meddelande. Ta bort tilldelningarna först. Tar du bort bocken igen, försvinner *Milstolpstyp* och *Obligatorisk (avtalsenlig)*.
- **Milstolpstyp** (bara för en milstolpe) — *Automatisk*, *Startmilstolpe* eller *Slutmilstolpe*. Standard: *Automatisk*. Effekt: en startmilstolpe ligger i början av en dag och en slutmilstolpe i slutet. Med *Automatisk* räknas milstolpen som startmilstolpe när den är en föregående uppgift. Den ligger då i början av dagen.
- **Obligatorisk (avtalsenlig)** (bara för en milstolpe) — markerar en avtalsenlig milstolpe, till exempel en besiktning eller ett överlämnande. Standard: av. Effekt: en markering för Gantt-vyn och rapporterna. Den skyddar inte ett datum. Det gör du med en restriktion eller ett måldatum.

## Tid

- **Start** (i fönstret *Startdatum*) — visar den beräknade starten, samma datum som balken i Gantt-vyn och kolumnen *Start*, inte det råa planeringsankaret. Obligatoriskt: ett tomt fält återgår till det förra värdet. Effekt när du skriver: det nya datumet blir det planerade ankaret (kolumnen *Planerad start*). Har uppgiften en föregående uppgift och har den inte startat ännu, sparar appen den nya starten som restriktionen *Starta tidigast (SNET)* på det datumet. Den flyttar också en befintlig SNET. Appen visar ett meddelande. Efter *Beräkna* startar uppgiften därför inte tidigare. Finns det en annan restriktion än *ASAP* eller *SNET*, tillämpar appen inte starten. Appen säger vilken restriktion som avgör starten.
- **Varaktighet** — hur lång tid uppgiften arbetar. Skriv `5d` för dagar, eller `12h` eller `1h 30m` för timmar. Ett tal utan enhet räknas i uppgiftens enhet. Dagar är alltid hela. Timmar kan ha decimaler. En ogiltig inmatning ger *Ange ett helt antal dagar eller timmar, till exempel 2d eller 12h.* och fältet återgår. Standard för en ny uppgift: 5 dagar (en milstolpe: 0). Fältet är inaktiverat för en sammanfattningsuppgift, en hängmatta och en milstolpe med varaktigheten 0. Deras varaktighet följer av andra uppgifter eller är noll. En uppgift i timmar är inaktiverad så länge *Aktivera timplanering* är av. Där finns en knapp med det namnet. Effekt: efter *Beräkna* bestämmer varaktigheten slutet i uppgiftens kalender. Har uppgiften resurser och en arbetsregel, bestämmer regeln vilket av arbetet eller tilldelningsenheterna som följer med. Är uppgiften redan delvis klar, vägrar appen en varaktighet som är kortare än det utförda arbetet. Se [Dagar och timmar](docs://uitleg-dagen-en-uren).
- **Varaktighetsenhet** — ett val mellan *Dagar* och *Timmar*, med en infoknapp bredvid. Syns bara när *Aktivera timplanering* och *Tillåt blandad dag/timplanering* är på. Den andra är på som standard när timplanering är på. Effekt: appen konverterar bara om resultatet blir exakt. Då föreslår den en ändring (*Tillämpa förslaget* eller *Behålla*). Passar det inte exakt, blir enheten kvar och appen säger det. En kalender utan giltiga arbetstider vägrar bytet.
- **Arbetsregel** — vilken del av varaktighet × tilldelningsenheter = arbete som förblir fast när en av de tre ändras. Val: *Projektstandard (Fast varaktighet och fasta enheter)*, *Fast varaktighet och fasta enheter*, *Fast varaktighet och fast arbete*, *Fast arbete* och *Fasta enheter*. Standard: projektstandarden. Under den står vad regeln skyddar (*Skyddat: …*) och, för en uppgift från MS Project, *Från MS Project: insatsberoende* eller *Från MS Project: inte insatsberoende*. Syns bara när *Visa arbetsregler och arbete* är på (*Inställningar*, fliken *Tidsplan*, rubriken *Beräkning*) eller när filen själv innehåller arbetsregler eller sparat arbete. Det gäller bara en vanlig uppgift: inte en sammanfattningsuppgift, milstolpe, hängmatta eller uppgift i förfluten tid. Se [Arbetsregler: varaktighet, enheter och arbete](docs://uitleg-werkregels).

## Hängmatta

- **Hängmatta (härledd varaktighet)** — låter varaktigheten följa av två andra uppgifter i stället för att ha en egen. Standard: av. Bara för en vanlig uppgift, alltså inte för en milstolpe eller en sammanfattningsuppgift. När den är på visar *Startdrivande samband* de föregående uppgifterna med samband av typen slut-till-start eller start-till-start. *Slutdrivande samband* visar de med slut-till-slut eller start-till-slut. Var och en visas med sambandstypen efter sig. Har du inget slutdrivande samband, står det *Inget slutdrivande samband (FF/SF). Spannet blir då noll.* och varaktigheten är noll. Se [Så gör du en hängmatta](docs://howto-hammock).

## Restriktion och måldatum

För en sammanfattningsuppgift har en restriktion eller ett måldatum ingen effekt. Beräkningen räknar bara ut uppgifter utan underuppgifter. Datumen för en sammanfattningsuppgift härleds från dess underuppgifter.

- **Restriktion** — en datumgräns för uppgiften. Val: *Så tidigt som möjligt (ASAP)*, *Så sent som möjligt (ALAP)*, *Starta tidigast (SNET)*, *Starta senast (SNLT)*, *Avsluta tidigast (FNET)*, *Avsluta senast (FNLT)*, *Måste starta på (MSO)* och *Måste slutföras på (MFO)*. Standard: *ASAP*, vilket betyder ingen restriktion. Väljer du ASAP, försvinner alla restriktioner för uppgiften. Väljer du ALAP, försvinner den sekundära restriktionen. Effekt efter *Beräkna*: en gräns flyttar uppgiften eller gör slacket negativt. Se [Restriktioner och måldatum](docs://uitleg-constraints).
- **Restriktionsdatum** — datumet som hör till restriktionen. Syns för alla restriktioner utom *ALAP*. Obligatoriskt. En ny restriktion får den planerade starten som datum.
- **Obligatorisk (fastlåsning)** — bara för *MSO* och *MFO*. Standard: av. På: datumet är hårt. Det går före sambanden och låser balken även före dess föregående uppgifter. Ett brott mot datumet ger negativt slack uppströms. Första gången du slår på den visas en förklaring. Den visas bara en gång.
- **Sekundär restriktion** och **Sekundärt datum** — en andra gräns. Bara en av *SNET*, *FNET*, *SNLT* eller *FNLT* (eller *(ingen)*). Den syns så snart det finns en primär restriktion som inte är ASAP, ALAP eller en hård fastlåsning. Den är alltid mjuk. En förbjuden kombination får en röd kant och en orsak: en sekundär restriktion får inte vara hård, inte tillsammans med MSO/MFO eller en hård fastlåsning, inte tillsammans med ASAP/ALAP, måste vara en gräns, och primär och sekundär får inte begränsa samma sida. Ett giltigt par är till exempel SNET med FNLT.
- **Måldatum** — ett måldatum för slutet. Tomt = inget måldatum. Effekt: uppgiften flyttar sig inte för det. Är det tidigaste slutet senare, blir slacket negativt och appen rapporterar *Måldatum … missat — tidigaste slut …*.

## Framdrift

- **Framdrift (%)** — ett reglage från 0 till 100. Standard: 0. Effekt: över 0 fyller appen i en saknad *Verklig start*, och 100 fyller i *Verkligt slut*. Statusen följer: *Inte startad* utan verklig start, *Pågår* med verklig start och *Klar* med verkligt slut. Den återstående varaktigheten (*Återstående*) är varaktigheten × (1 − framdrift), avrundad till hela dagar för en uppgift i dagar och till hela minuter för en uppgift i timmar. Utfört arbete mäts fram till rapportdatumet. Finns det inget rapportdatum ännu, sätter appen det till idag och säger det. För en sammanfattningsuppgift är fältet inaktiverat. Dess framdrift följer av underuppgifterna efter *Beräkna* (*Härleds från underuppgifterna: ändra framdriften där. Sammanfattningsuppgiften uppdateras när du har beräknat (F5).*).
- **Verklig start** — datumet då uppgiften verkligen började. Ett datum efter det verkliga slutet eller efter rapportdatumet vägras. Är uppgiften planerad att starta först efter rapportdatumet och får den nu framdrift, frågar fönstret *Ange den verkliga starten*. För en milstolpe finns ett fält *Verkligt datum* i stället för *Verklig start* och *Verkligt slut*.
- **Verkligt slut** — datumet då uppgiften verkligen var klar. Om du fyller i det, sätts framdriften till 100 och statusen till *Klar*. Om du tömmer det, sätts framdriften tillbaka till 0 och statusen till *Pågår*. Samma avvisningar gäller som för *Verklig start*.
- **Återstående** — skrivskyddat (inte för en milstolpe): hur mycket varaktighet som återstår, i uppgiftens enhet.

Fönstret tillämpar dessa regler på utkastet. De gäller först efter *Spara*. Se [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang).

## CPM-resultat

- **CPM-resultat** — skrivskyddad vy av den senaste beräkningen: *Tidigaste start*, *Tidigaste slut*, *Senaste start*, *Senaste slut*, *Totalt slack*, *Fritt slack*, *Störande slack* och *Kritisk linje* (*Ja* eller *Nej*). Slacket anges i arbetsdagar med två decimaler. Är den föråldrad eller ännu inte beräknad? Tryck på *Beräkna*.

## Samband

- **Samband** — sambanden för den här uppgiften, en rad per samband: den länkade uppgiften (i panelen WBS-koden, eller namnet om den saknas; i fönstret namnet), en blixtikon om sambandet är drivande (*Drivande samband*, efter en beräkning), sambandstypen (*FS*, *SS*, *FF* eller *SF*), fördröjningen och en papperskorg. I panelen är WBS-koden en knapp. Pekar du på den, visas uppgiften. Klickar du på den, hoppar du till uppgiften. En liten markering före koden visar rollen: en gyllene rund markering för en föregående uppgift och en lila fyrkantig markering för en efterföljande uppgift. Det är samma färger som i [Spåra en väg](docs://howto-pad-traceren). Rollen står också i knappens namn, för en skärmläsare. I fönstret är det vanlig text. Du ser avsnittet bara om uppgiften har samband.
- **Fördröjning** — skriv ett tal med en enhet: `2d` arbetsdagar, `3ed` kalenderdagar, `2u` eller `2h` arbetstimmar, `3eu` eller `3eh` kalendertimmar, `50%` en procent av föregående uppgifts varaktighet, `-25e%` en procent i kalendertid. Ett minustecken gör det till ett överlapp. Utan enhet räknas det i arbetsdagar. En ogiltig inmatning gör fältet rött, och det återgår. Se [Samband och fördröjning](docs://uitleg-relaties).
- **Lägg till samband** (bara i panelen) — öppnar en utkastrad. Under *Riktning* väljer du *Föregående* eller *Efterföljande*. Hitta uppgiften med *Sök uppgift*… på WBS-kod eller namn. Välj typ och fördröjning, och bekräfta med *Skapa samband* (eller *Avbryt*). Ett dubblett, eller ett samband med uppgiftens egen överordnade uppgift, vägras med ett meddelande. Raden blir kvar.

## Avbrott

Bara i panelen, och inte för en milstolpe, sammanfattningsuppgift, hängmatta, uppgift i förfluten tid, manuellt schemalagd uppgift eller en uppgift som är för kort för ett avbrott.

- **Avbrott** — avbrott i arbetet på uppgiften. En rad per avbrott: *efter* (hur mycket arbete före avbrottet), *avbrott* (längden) och enheten (*arbetsdagar*, eller *timmar* för en uppgift i timmar). Under raden visas från–till för delen efter avbrottet. Ett avbrott som utjämningen har lagt till har märket *utjämning*. Ett avbrott med längden 0 tas bort. Papperskorgen på raden (*Ta bort avbrott*) tar också bort det. Effekt: balken ritas med ett avbrott, och efter *Beräkna* flyttas slutet med avbrottets längd.
- **Lägg till avbrott** — lägger till ett avbrott på en enhet mitt i den längsta delen. Inaktiv när det inte finns plats för ett avbrott.
- **Ta bort alla avbrott** — visas när avbrotten kommer från en källfil i ett format som inte kan redigeras här (*Dessa avbrott kommer från källfilen i ett format som inte kan redigeras här*). Då ser du bara datumen.

Se [Dela upp en uppgift](docs://howto-taak-splitsen).

## Tilldelningar

- **Tilldelningar** — resurserna på den här uppgiften. Per resurs: namnet med en papperskorg (*Ta bort*), *Enh./dag*, *Arbete (kvar)*, *Kurva*, en knapp *Timfördelning*… och *Flytta till*… Längst ned finns en lista *Tilldela resurs*. Den tilldelar resursen med 1 tilldelningsenhet per dag. Utan resurser står det *Skapa först resurser (Resources-fliken)*. När alla resurser är tilldelade står det *Alla resurser är redan tilldelade*. För en milstolpe eller sammanfattningsuppgift står det att tilldelning inte är möjlig.
- **Enh./dag** — hur mycket av resursen uppgiften använder per dag, ett tal över 0. Effekt: belastningen i histogrammet och överbeläggningen, och med en arbetsregel även arbetet.
- **Arbete (kvar)** — återstående arbete i timmar för den här resursen. Syns bara när arbetsreglerna syns och uppgiften har en arbetsregel. För material visas ett streck. Låset visar vilket hörn arbetsregeln skyddar (*Skyddas av arbetsregeln …*). Varningstriangeln (*Avviker från tilldelningsenheter × varaktighet*) betyder att det sparade arbetet inte är lika med tilldelningsenheter × återstående varaktighet. Histogrammet följer då det sparade arbetet.
- **Kurva** — hur arbetet fördelas över varaktigheten: *Jämn*, *Framtung*, *Baktung*, *Klockformad*, *Tidig topp*, *Sen topp*, *Dubbel topp* eller *Sköldpadda*. Standard: *Jämn*. Har tilldelningen en egen timfördelning står det *Profil* och listan är inaktiverad. En importerad kurva heter *Importerad kurva*.
- **Timfördelning…** — öppnar timfördelningen per arbetsdag för den här tilldelningen. Se [Justera timfördelningen](docs://howto-urenverdeling-aanpassen).
- **Flytta till…** — flyttar tilldelningen till en annan uppgift utan underuppgifter som ännu inte har resursen. Syns bara när en sådan uppgift finns.

## Koder och fält

- **Koder och fält** — syns bara när projektet har uppgiftskoder eller egna fält. Varje uppgiftskod är en lista med *(ingen)* och värdena som `kod — beskrivning`. För varje typ väljer du högst ett värde. Varje eget fält har ett inmatningsfält som passar dess typ: *Text*, *Tal*, *Heltal*, *Kostnad*, *Datum* eller *Ja/nej*. Effekt: ingen påverkan på beräkningen. Du kan gruppera och filtrera på dem och visa dem som kolumner. Se [Koder och egna fält](docs://howto-codes-en-velden).

## Markeringar under arbetsregeln

Visas bara i panelen, och bara när de gäller.

- **Lång ledig period** — *Den här uppgiften går över en ledig period på … dagar (… till …).*, eller med namnet på helgdagen eller byggsemestern tillagt. Visas när uppgiften går över en sammanhängande period på 8 dagar eller mer som innehåller minst en helgdag. Det är en varning, inte ett stopp. Kontrollera om tidsplanen ska se ut så.
- **MS Project-markering** — ett märke *Följer timfördelningen från MS Project*, *MS Project-datumfönstret tillämpas inte längre efter redigering — …* eller *Egen timfördelning*, med *Läs mer*. Det visar om en timfördelning från en MS Project-fil fortfarande styr datumen.
- **Sparade datum** — ett märke för en importerad fil med sparade datum: *Visar datumen så som de står i filen för den här uppgiften* (för en Primavera-fil *Visar Primaveras egna sparade datum för den här uppgiften*), *Avviker från de sparade datumen* eller *Lagringen är delvis ofullständig. Se kolumnerna senaste start/slack*, med *Läs mer*. Se [Sparade datum](docs://uitleg-datums-zoals-opgeslagen).

## Panelens överdel och underdel

- **Ta bort uppgift** — papperskorgen bredvid rubriken *Uppgift*. Den tar bort den här uppgiften tillsammans med dess underuppgifter, som ett enda steg under *Ångra*. Efter borttagningen är tidsplanen inte längre aktuell, tills du trycker på *Beräkna*.
- **Beräkna** — knappen längst ned. Samma beräkning som *Start › Tidsplan › Beräkna*.

## Det du inte hittar här

- **Utjämningsprioritet** — finns inte i fönstret eller panelen. Du ställer in den genom att högerklicka och välja *Prioritet* (*Låg* = 100, *Normal* = 500, *Hög* = 900), eller genom att skriva ett tal från 0 till 1000 i kolumnen *Utjämningsprioritet*. Standard: 500. Effekt: utjämningen låter uppgifter med högre prioritet ligga kvar först. 1000 låser uppgiften, så att utjämningen aldrig flyttar den. Se [Utjämning](docs://uitleg-nivelleren).
- **Övriga uppgiftsdata** — resten av det en uppgift innehåller, till exempel kolumnerna *Manuellt schemalagd*, *Färg* och de tekniska kolumnerna, finns bara i tabellen. Se [Tabellkolumner](docs://ref-tabelkolommen).
