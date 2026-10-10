# Resursutjämning

Du har en murare och två väggar som ska byggas samma dagar. På papper fungerar tidsplanen, men i praktiken kan han bara vara på ett ställe. Utjämning är hur appen löser sådana krockar: den låter uppgifter starta senare, tills resursen klarar det. I den här artikeln läser du exakt vad utjämning flyttar, när slutdatumet ger vika och vad den inte löser åt dig.

## Begreppet

En resurs har **överbeläggning** en arbetsdag om tidsplanen kräver mer av resursen den dagen än den kan ge. Det den kan ge är dess kapacitet: *Max enheter* på arbetsdagarna i dess kalender. Om den inte arbetar den dagen enligt sin kalender är dess kapacitet 0.

**Utjämning** löser det genom att låta uppgifter starta senare. Den gör inget mer. Den förkortar inte en uppgift, delar inte en uppgift, ändrar inte tilldelningsenheter eller samband och lägger inte till en extra resurs. För varje uppgift letar appen efter första platsen där resurserna är lediga och flyttar uppgiften dit.

Det finns två sätt i fönstret *Utjämna resurser*:

- Som standard kan projektets slutdatum flyttas med. Det är utjämning i egentlig mening.
- Med kryssrutan *Jämna ut endast inom slack (utjämning) — projektets slutdatum ligger fast* flyttar appen bara uppgifter inom deras slack. Slutdatumet ligger då kvar. Fungerar det inte står uppgiften kvar på sin plats och appen rapporterar en konflikt. Vad slack är läser du i [Kritisk linje och slack](docs://uitleg-kritiek-pad).

## Så beräknar appen

### Hur mycket en uppgift begär

Per arbetsdag räknar appen hur många tilldelningsenheter varje uppgift begär av en resurs. Det är tilldelningsenheterna enligt kurvan eller din egen fördelning per timme, exakt samma timmar per dag som histogrammet visar. Resursens kapacitet är *Max enheter*, eller värdet för steget i den tidsfasade kapaciteten som gäller den dagen. En dag har överbeläggning om efterfrågan är större än kapaciteten.

### I vilken ordning

Appen placerar uppgifterna en i taget, i den här ordningen: först den högsta prioriteten, sedan uppgiften med minst totalt slack, sedan tidigaste start och sist ordningen i uppgiftstabellen. En uppgift kommer först upp när dess föregående uppgifter har fått sin plats.

Prioriteten är ett tal från 0 till 1000 som du anger per uppgift. Standard är 500. I högerklicksmenyn på en uppgiftsbalk heter den *Prioritet*, med valen *Låg* (100), *Normal* (500) och *Hög* (900). En uppgift som kommer upp tidigare får den plats den vill ha. Uppgifterna som kommer efter måste passa runt den. Så bestämmer prioriteten vilken uppgift som står kvar och vilken som ger vika. Värdet 1000 är speciellt: en sådan uppgift flyttas aldrig för kapacitet. Det är MS Projects ”Do Not Level”.

### Vart en uppgift flyttas

För varje uppgift startar appen vid den tidigaste starten som sambanden tillåter. Det tar hänsyn till att föregående uppgifter redan kan ha flyttats. Ryms uppgiften där står den kvar. Ryms den inte provar appen nästa arbetsdag för uppgiften, och så vidare. En uppgift ryms om varje resurs har tillräckligt ledigt varje dag av uppgiften. Har en uppgift flera resurser måste alla vara lediga de dagarna. En uppgift flyttas alltså alltid senare, aldrig tidigare.

Appen registrerar förflyttningen som en **förskjutning pga utjämning**: ett antal arbetsdagar, i uppgiftens kalender, som uppgiften startar senare än sambanden kräver. Du ser den i kolumnen *Förskjutning pga utjämning* under *Beräknat*. Förskjutningen sparas i projektets fil. *Beräkna* (F5) tar hänsyn till den som extra väntetid före starten. Uppgifter efter den flyttas med via sina samband.

### Inom slack eller utanför

Utan *utjämning* letar appen tills uppgiften ryms. Därför kan projektets slutdatum flyttas.

Med *utjämning* får en uppgift inte starta senare än sin senaste start, alltså den sista dag den kunde starta utan att slutdatumet flyttas. Ryms uppgiften inte inom den perioden står den kvar på sin tidigaste plats. Uppgiften visas då under *Kvarvarande konflikter*.

### Vad appen inte flyttar

- Uppgifter som redan har startat eller är klara. Deras belastning räknas, men de får aldrig någon förskjutning pga utjämning.
- Uppgifter med prioritet 1000. De följer sina föregående uppgifter, men flyttas inte för kapacitet.
- Uppgifter utan tilldelning till de valda resurserna, milstolpar och faser. De flyttas bara med om en föregående uppgift flyttas.
- Material. Det utjämnas aldrig.

### Förslag och tillämpning

*Beräkna* ger ett förslag: uppgifterna som flyttas, med gammal och ny start, och slutdatumet före och efter. Ingenting ändras i din tidsplan förrän du väljer *Tillämpa*. Då skriver appen förskjutningarna till uppgifterna och beräknar om tidsplanen direkt.

## Exempel: muraren på två väggar

Exemplet är övningsprojektet i självstudierna, *House extension*, så som det ser ut precis före utjämningen i självstudie 5. I självstudie 5 gör du det själv och kontrollerar siffrorna. I det här exemplet ligger putsningen på *Fast arbete* och putsaren arbetar med tilldelningsenheter på 2, som i [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels).

Efter håldäcket, klart måndag 28 juni, börjar både innerskalet (5 arbetsdagar) och ytterskalet (6 arbetsdagar) tisdag 29 juni. Båda har samma murare som resurs, med tilldelningsenheter på 1 och *Max enheter* på 1. Efter innerskalet kommer takelementen (ett kranjobb på 6 timmar) och takläggningen (2 arbetsdagar). Fönsterramarna väntar på takläggningen och på ytterskalet. Överlämningen är måndag 30 augusti.

### Överbeläggningen

Innerskalet löper från 29 juni till och med 5 juli, ytterskalet från 29 juni till och med 6 juli. Från 29 juni till och med 5 juli, det är 5 arbetsdagar, begär tidsplanen 2 enheter av en murare med kapacitet 1. Muraren har därför överbeläggning under de 5 dagarna.

### Ordningen

Båda uppgifterna har prioritet 500. Fönsterramarna levereras först 14 juli (i självstudie 3 satte du en restriktion *Starta tidigast (SNET)* för det). Därför har innerskalet 3 arbetsdagars slack och ytterskalet 5. Innerskalet har minst slack och kommer därför först. Det ligger kvar från 29 juni till och med 5 juli.

### Förskjutningen

Ytterskalet kan inte starta 29 juni. Den första dagen muraren är ledig igen är tisdag 6 juli. Det är 5 arbetsdagar senare än tidigaste start, så förskjutningen pga utjämning är 5. Ytterskalet löper nu från 6 juli till och med 13 juli. Fönsterramarna startar ändå först 14 juli, så överlämningen ligger kvar på måndag 30 augusti. Fönstret visar *Projektslutdatum: oförändrat (30-08-2027)* och en rad: *Build outer cavity leaf*, gammal start 29-06-2027, ny start 06-07-2027, *5 d*.

De 5 arbetsdagarna av förskjutningen är precis ytterskalets slack. Därför ger *utjämning* samma resultat här. Ytterskalet har inget slack kvar nu och är kritiskt.

### Tänk om fönsterramarna inte kommer 14 juli

Utan den restriktionen kan fönsterramarna starta fredag 9 juli och överlämningen är onsdag 25 augusti. Ytterskalet har då bara 2 arbetsdagars slack.

- Utan *utjämning* flyttas ytterskalet fortfarande 5 arbetsdagar. Nu måste fönsterramarna vänta: de startar 14 juli, 3 arbetsdagar senare. Allt efter dem flyttas med och överlämningen går från 25 augusti till 30 augusti, också 3 arbetsdagar senare.
- Med *utjämning* flyttas ingenting. Ytterskalet ryms inte inom sina 2 arbetsdagars slack. Fönstret visar konflikten *Build outer cavity leaf*, 5 dag(ar), med orsaken *För lite ledig kapacitet inom slacken för att lösa konflikten*.

### Tänk om ytterskalet får prioritet

Om du ger ytterskalet prioritet *Hög* (900) kommer det först. Det ligger kvar 29 juni och nu får innerskalet ge vika: 6 arbetsdagar senare, från 7 juli till och med 13 juli. Innerskalet har bara 3 arbetsdagars slack, så en flyttning med 6 arbetsdagar är 3 för mycket. Takelementen, fönsterramarna och allt efter dem flyttas med. Överlämningen går från måndag 30 augusti till torsdag 2 september. Samma överbeläggning ger alltså ett annat slutdatum, beroende på vilken uppgift som ligger kvar.

### Tänk om en andra murare kommer

Om du sätter murarens *Max enheter* till 2 finns ingen överbeläggning längre. *Beräkna* visar *Inga uppgifter behöver flyttas — tidsplanen är redan konfliktfri.*

## Konsekvenser och missuppfattningar

**”Utjämning hittar den kortaste tidsplanen.”** Nej. Appen arbetar uppgift för uppgift i en fast ordning och letar inte efter den bästa totallösningen. Se exemplet med prioriteten: en annan prioritet ger ett annat slutdatum.

**”En utjämnad uppgift är säker.”** Utjämning använder slack. Den förskjutna uppgiften har då mindre slack eller inget alls kvar och kan bli kritisk, som ytterskalet ovan. Om den sedan blir försenad flyttas överlämningen.

**”Utjämningen följer mina senare ändringar.”** Nej. Förskjutningen är ett fast antal arbetsdagar. Blir innerskalet kortare efter utjämningen startar ytterskalet ändå 5 arbetsdagar senare, även om det inte längre behövs. Utjämna då igen. Appen börjar från början.

**Allt går inte att lösa genom att flytta.** Om resursen inte arbetar de dagar som uppgiften behöver, eller om uppgiften genom sin kurva begär mer på en dag än resursen kan ge, finns överbeläggningen kvar. Appen anger då vid uppgiften varför.

**Material utjämnas inte.** Om material begär mer än sin kapacitet en dag rapporterar appen det som överbeläggning, men utjämningen lämnar det orört.

**Fastlåsta uppgifter.** Om alla uppgifter som krockar har prioritet 1000 visar fönstret *Inga uppgifter behöver flyttas — tidsplanen är redan konfliktfri.*, medan överbeläggningen ligger kvar. Titta därför efter meddelandet *Överbeläggning* i menyfliksområdet efter tillämpningen.

## Se även

- [Åtgärda överbeläggning](docs://howto-overbezetting-oplossen): stegen för att hitta överbeläggning och jämna ut den.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vad slack är och varför en uppgift blir kritisk.
- [Arbetsregler: varaktighet, tilldelningsenheter och arbete](docs://uitleg-werkregels): hur en uppgifts varaktighet följer med tilldelningsenheterna.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tre torn som behöver samma arbetslag och tornkranen, och vad utjämning gör med det.
