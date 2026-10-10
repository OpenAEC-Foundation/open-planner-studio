# Använda beläggningsöversikten

Mål: se på vilka dagar två eller fler öppna projekt tillsammans begär mer av en resurs än biblioteket har.

## När du behöver det

Ditt murarlag arbetar på fasaderna i ett projekt och på garagen i ett annat. I varje projekt ser laget väl planerat ut, eftersom histogrammet och överbeläggningen i ett projekt bara tittar på det projektet. Först när du lägger projekten bredvid varandra syns att de tillsammans begär fler murare än du har, på samma dagar. Beläggningsöversikten gör den jämförelsen åt dig.

Översikten räknar bara resurser som kommer från biblioteket, i projekt som är länkade till samma bibliotek. Hur det beräknas läser du i [Biblioteket](docs://uitleg-resourcebibliotheek).

## Steg

### 1. Gör projekten redo

1. Öppna projekten du vill jämföra, var och ett i en egen flik, se [Arbeta med flera projekt samtidigt](docs://howto-meerdere-projecten). Översikten ser bara projekt som är öppna i det här programmet.
2. Länka varje projekt till samma bibliotek och använd resursen från biblioteket i varje projekt. Utan länk till biblioteket visar resurspanelen inte översikten. Se [Använda biblioteket](docs://howto-resourcebibliotheek-gebruiken).
3. Beräkna projekten med *Beräkna* (F5), eller slå på *Beräkna automatiskt*. Vad översikten gör med föråldrade projekt beskrivs under fallgroparna nedan.

### 2. Öppna översikten

1. Gå till ett av projekten och välj *Resurser › Hantera › Resurser*.
2. Välj *Beläggning* längst upp till höger. Översikten hör till biblioteket för projektet du är i. Du kan inte ändra något i den här panelen: det är ett skrivskyddat fönster.

### 3. Läs tabellen

Varje resurs från biblioteket som är bokad i minst ett öppet projekt får en rad. Resurser utan bokning visas inte. Raderna med flest dagar med överbeläggning står överst, sedan i alfabetisk ordning.

- *Dokument* anger i hur många projekt resursen är bokad, till exempel *2 dokument*.
- *Period* går från första till sista dagen med belastning, skriven som åååå-mm-dd, till exempel *2027-06-07 – 2027-06-14*.
- *Topp / Kapacitet* anger den högsta dagliga belastningen för alla projekt tillsammans mot resursens kapacitet i biblioteket, till exempel *4,0 / 3,0*. Om det finns minst en dag med överbeläggning visas den i rött.
- En röd markering efter raden, till exempel *3 dagar med överbeläggning*, räknar de dagar då summan är större än kapaciteten. Om du håller musen över den ser du datumen.

### 4. Titta per projekt

1. Klicka på den lilla pilen före namnet på en resurs. Raden öppnas.
2. Överst står de dagar med överbeläggning, de första fem och sedan *… och 3 till* om det finns fler. Under det står per projekt namnet med perioden och toppen för just det projektet, till exempel *Houses North 2027-06-07 – 2027-06-11 Topp: 2,0*.
3. Klicka på själva raden för att se ett histogram längst ner. Varje projekt har en egen färg och staplarna är staplade. Den streckade linjen är kapaciteten i biblioteket. Om den ändras över tid ser du steg. Dagar med överbeläggning får en röd bakgrund bakom staplarna. Klicka en gång till på raden för att stänga histogrammet igen. Utan vald rad står det *Välj en resurs för att se histogrammet.*

### 5. Lös det

Översikten visar problemet, men löser det inte. Du har två alternativ:

- Flytta en uppgift i ett av projekten, eller ge den färre tilldelningsenheter per dag. Beräkna om projektet med F5.
- Om någon verkligen ansluter sig, höj *Max enheter* för resursen i biblioteket. Det gör du i *Resurser › Hantera › Resurser*, i vyn *Bibliotek*.

*Utjämna…* i menyfliksområdet hjälper inte här: den tittar på resurserna i det enda projektet du är i, se [Utjämning av resurser](docs://uitleg-nivelleren).

## Fallgropar och vad appen gör då

**Översikten är tom.** Där står *Inga bibliotekresurser bokade i de öppnade dokumenten.* Då har inget öppet projekt en resurs från biblioteket på en uppgift.

**Du ser inte knappen *Beläggning*.** Projektet du är i är inte länkat till något bibliotek.

**Ett projekt räknas inte.** Det är inte öppet i det här programmet, det är länkat till ett annat bibliotek, eller resursen i det är en egen resurs för projektet. Längst ner i översikten står alltid *Den här översikten visar bara dokumenten som är öppnade i det här programmet.* En kopia av en resurs som sedan dess tagits bort från biblioteket räknas inte heller.

**En kopia eller variant räknas helt.** Varje öppet projekt som är länkat till biblioteket räknas, även om det är en kopia eller variant av ett annat öppet projekt, till exempel en variant som en AI-assistent gjorde med `planner_duplicate_document`. Original och variant tillsammans kan då visa en överbeläggning som i verkligheten bara finns en gång. Översikten filtrerar inte tyst bort det: stäng varianten en stund, eller bortse från den när du läser.

**Ett projekt är föråldrat.** Ett projekt är föråldrat om du ändrade något i tidsplanen utan att beräkna om. Översikten hanterar då projektet så här:

- För ett projekt som inte är den aktiva fliken beräknar översikten själv i förväg, utan att ändra projektet. Ovanför tabellen står då *Ändrade dokument har förberäknats för den här översikten; tryck F5 i dokumentet, eller slå på “Beräkna automatiskt” för att göra detta permanent.* Efter projektet står *Förberäknat för den här översikten — dokumentet visar själv äldre datum tills du trycker F5 där eller slår på “Beräkna automatiskt”.* Om *Beräkna automatiskt* är på (*Inställningar › Projekt › Inställningar*, fliken *Tidsplan*), beräknar appen verkligen om sådana projekt så snart du tittar på översikten, och meddelandet försvinner. Är det aktiva projektet också föråldrat, visas i stället meddelandet från nästa punkt ovanför tabellen.
- Översikten beräknar inte det projekt du är i själv. Om det projektet är föråldrat står det *Ett ändrat dokument är ännu inte beräknat; det räknas med här med sina senast beräknade siffror. Tryck F5 i dokumentet, eller slå på “Beräkna automatiskt”.* och efter projektet *Föråldrat: det här är de senast beräknade siffrorna — tryck F5 i det här dokumentet.* Var försiktig: *senast beräknade siffror* är inte helt rätt. Översikten använder de gamla startdatumen, men redan en ändrad varaktighet eller tilldelning. Siffrorna kan därför skilja sig från både den gamla och den nya tidsplanen samt från balkarna i Gantt-diagrammet. Lita bara på dem efter F5.
- Kan översikten inte beräkna ett projekt, till exempel på grund av en loop i dess samband, räknas projektet inte. Projektet står ändå kvar i listan, med *Räknas inte med: tidsplanen är inte beräknad — aktivera dokumentet och tryck F5.* och ovanför tabellen *Minst ett dokument är inte beräknat och räknas inte med i beläggningen.*

**Översikten stämmer inte med vad du förväntar dig.** Kapaciteten kommer från biblioteket (*Max enheter* för biblioteksposten, eller dess *Tidsfasad kapacitet* den dagen), inte från *Max enheter* för kopian i projektet. En summa som är lika med kapaciteten är inte en konflikt.

## Se även

- [Biblioteket](docs://uitleg-resourcebibliotheek): hur beläggningen räknas, med ett genomräknat exempel.
- [Använda biblioteket](docs://howto-resourcebibliotheek-gebruiken): länka projekt och tilldela resurser.
- [Lösa överbeläggning](docs://howto-overbezetting-oplossen): överbeläggning inom ett projekt.
