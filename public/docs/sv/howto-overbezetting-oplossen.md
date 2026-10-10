# Lös överbeläggning

Mål: se var en resurs har för mycket att göra en dag, och lös det. Oftast gör du det med utjämning av uppgifter.

## När du behöver detta

På papper fungerar din tidsplan. Men bricklayer är inplanerad på två väggar som körs samma dagar. Appen kallar det **överbeläggning**. En resurs har överbeläggning på en arbetsdag om tidsplanen kräver mer av den den dagen än dess kapacitet (*Max enheter*). Det gäller också om resursen inte arbetar den dagen enligt sin kalender.

Du letar först upp överbeläggningen. Sedan väljer du en lösning. **Utjämning** är den lösning som appen beräknar åt dig: den låter uppgifter starta senare tills resursen klarar det. Hur det beräknas läser du i [Resursutjämning](docs://uitleg-nivelleren).

## Steg

### 1. Hitta överbeläggningen

1. Titta i menyfliksområdet på *Resurser › Överbeläggning*. Där står *Ingen* eller, i rött, antalet resurser med överbeläggning, till exempel *1 resurs*. Efter en beräkning säger statusfältet också *⚠ 1 resurs(er) med överbeläggning*.
2. Klicka på det meddelandet i statusfältet. Panelen *Varningar* öppnas till höger, med en rad per resurs, till exempel *Bricklayer* med *Överbeläggning på 5 dag(ar) (29-06-2027 – 05-07-2027)*.
3. Klicka på raden. Appen slår på histogrammet, väljer resursen och markerar alla uppgifter som resursen är kopplad till.
4. Titta på histogrammet under Gantt-diagrammet. Röda staplar är dagar med överbeläggning. Om du för musen över en dag ser du vilka uppgifter som bidrar, till exempel *2 uppgifter bidrar på 2027-06-30* med namnen under det.

Du kan också slå på histogrammet själv med *Resurser › Histogram › Histogram*. Välj en resurs i listan till vänster, eller bläddra igenom resurserna med *Föregående* och *Nästa*. En röd prick i listan betyder att resursen har överbeläggning. Raden *Alla resurser* lägger ihop resurserna, utan material.

Om en uppgift är markerad visar histogrammet bara belastningen för den uppgiften och bara de resurser som ingår i den. Tryck på Esc för att ta bort markeringen och se hela projektet igen.

### 2. Välj en lösning

- **Mer kapacitet.** Om en andra bricklayer verkligen kommer, ställ in *Max enheter* på 2 (se [Hantera resurser](docs://howto-resources-beheren)). Då är överbeläggningen borta.
- **Färre tilldelningsenheter per dag.** Sänk *Enh./dag* eller välj en annan kurva för tilldelningen (se [Tilldela resurser med en kurva](docs://howto-resource-toewijzen)).
- **Lägg uppgifterna efter varandra.** Lägg till ett samband mellan de två uppgifterna, så att den andra uppgiften bara startar när den första är klar (se [Lägga till samband](docs://howto-relaties-leggen)).
- **Utjämning.** Appen låter en uppgift starta senare.

### 3. Utjämna

1. Kontrollera att tidsplanen har beräknats med *Beräkna* (F5), till exempel via *Start › Tidsplan › Beräkna*.
2. Välj *Resurser › Utjämning › Utjämna…*. Fönstret *Utjämna resurser* öppnas.
3. Bestäm om projektets slutdatum får flyttas. Lämnar du rutan *Jämna ut endast inom slack (utjämning) — projektets slutdatum ligger fast* av, då kan slutdatumet flyttas. Slår du på rutan, flyttar appen bara uppgifter inom deras slack.
4. Under *Resurser* står de resurser som utjämnas. Som standard är alla resurser ikryssade, utom material. Ta bort krysset för en resurs som du vill lämna orörd.
5. Klicka på *Beräkna*. Medan den beräknar står det *Beräknar* och du kan stoppa med *Stoppa*. Tidsplanen ändras ännu inte: det är ett förslag.
6. Läs förslaget. Överst står slutdatumet, till exempel *Projektslutdatum: oförändrat (30-08-2027)* eller *Projektslutdatum: 25-08-2027 → 30-08-2027*. Under det står en tabell. Där ser du per uppgift kolumnerna *Gammal start*, *Ny start* och *Dagar förskjutna*, till exempel *Build outer cavity leaf*, 29-06-2027, 06-07-2027 och *5 d*.
7. Välj *Tillämpa*. Appen skriver förskjutningarna till uppgifterna och beräknar om tidsplanen direkt. Du behöver inte trycka på F5. *Avbryt* stänger fönstret utan ändring.
8. Kontrollera *Resurser › Överbeläggning*. Där står nu *Ingen*.

Om du ändrar en inställning i fönstret efter att du har klickat på *Beräkna*, försvinner förslaget. Klicka då på *Beräkna* igen. Ändras tidsplanen medan appen beräknar, står det *Tidsplanen ändrades under beräkningen. Klicka på Beräkna igen.*

### Bestäm vilken uppgift som stannar kvar

Appen placerar uppgifterna en för en, och de uppgifter som kommer först stannar kvar där de är. Uppgifterna med högst prioritet går först. Har uppgifterna lika hög prioritet går den uppgift med minst slack först.

Vill du själv bestämma vilken uppgift som stannar kvar, ge den en högre prioritet. Högerklicka på uppgiftens balk i Gantt-diagrammet och välj *Prioritet*, sedan *Låg* (100), *Normal* (500) eller *Hög* (900). *Normal* är standard. Du kan också skriva ett tal från 0 till 1000 själv i kolumnen *Utjämningsprioritet*: klicka på **+** till höger i uppgiftstabellens rubrik (*Lägga till kolumn*) och välj den kolumnen under *Tidsplan*. Ett högre tal betyder att uppgiften har större chans att stanna kvar. Appen accepterar inget tal över 1000. En uppgift med prioritet 1000 flyttas aldrig för kapacitetens skull.

### Ångra och göra om

- *Ångra* (Ctrl+Z) ångrar *Tillämpa* i ett steg.
- *Resurser › Utjämning › Ta bort utjämning* tar bort all utjämning från uppgifterna. Knappen är grå så länge det inte finns någon utjämning. Överbeläggningen som då återkommer finns helt enkelt där igen.
- Har du ändrat tidsplanen sedan dess väljer du bara *Utjämna…* igen. Appen börjar då från början: de gamla förskjutningarna räknas inte.

## Fallgropar och vad appen gör då

**Inte beräknad än.** Om tidsplanen inte har beräknats säger fönstret *Beräkna tidsplanen (F5) innan du jämnar ut.* och *Beräkna* är inte tillgänglig.

**Kvarvarande konflikter.** Inte varje överbeläggning kan lösas genom att flytta. De uppgifter som är kvar listas under *Kvarvarande konflikter*, med antalet dagar och skälet:

- *För lite ledig kapacitet inom slacken för att lösa konflikten.* Du ser detta när rutan *Jämna ut endast inom slack (utjämning) — projektets slutdatum ligger fast* är på: inom uppgiftens slack finns inget ledigt ögonblick. Ta bort krysset i rutan, så kan slutdatumet flyttas.
- *Resursen arbetar inte alla dagar som uppgiften behöver — att flytta löser inte detta.* Resursen har lediga dagar i sin egen kalender mitt i uppgiften. Ändra kalendern eller uppgiften.
- *Bricklayer kräver 2 tilldelningsenheter/dag vid toppen, kapaciteten är 1 — går inte att lösa genom att flytta.* Genom sin kurva begär uppgiften ensam mer en dag än resursen kan leverera. Välj en annan kurva eller sänk tilldelningsenheterna.

**Det står** *Inga uppgifter behöver flyttas — tidsplanen är redan konfliktfri.* Visas den raden tillsammans med listan *Kvarvarande konflikter* i förslaget, lita då på listan. Raden betyder bara att det inte finns något att flytta. Visas raden utan lista, men *Resurser › Överbeläggning* visar ändå en resurs, så är alla uppgifter som krockar låsta på prioritet 1000 eller har redan startat. De flyttas inte och fönstret visar dem inte som konflikt. Kontrollera därför alltid *Överbeläggning* efter att du har tillämpat.

**Uppgifter som inte flyttas.** En uppgift som redan har startat eller är klar flyttas aldrig. Dess belastning räknas däremot. Milstolpar och faser flyttas inte heller.

**Material utjämnas inte.** Begär en materialresurs mer än sina *Max enheter* en dag, har den överbeläggning i *Överbeläggning*, men den finns inte i fönstret *Utjämna resurser*.

**Utjämningen anpassar sig inte.** Förskjutningarna blir kvar precis så som de beräknades. Ändrar du senare varaktigheten för en uppgift, står en utjämnad uppgift kvar där den står, även om den platsen inte längre behövs. Utjämna igen då.

**Överbeläggning på grund av kalendern.** Arbetar resursen inte en dag enligt sin kalender, säger panelen *Varningar* till exempel: *Överbeläggning på 5 dag(ar) (29-06-2027 – 05-07-2027), varav 1 dag(ar) då resursen inte arbetar enligt sin kalender*. Går en uppgift alltid över en sådan dag, vilket är den andra orsaken ovan, då löser utjämning inte det.

## Se även

- [Resursutjämning](docs://uitleg-nivelleren): vad utjämning flyttar, inom slack och utanför det, och vad den inte gör.
- [Hantera resurser](docs://howto-resources-beheren): justera resursens kapacitet och kalender.
- [Lägga till samband](docs://howto-relaties-leggen): lägga uppgifter efter varandra.
- [Meddelanden och varningar](docs://ref-meldingen): varningen om överbeläggning i panelen *Varningar*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): plasterers har överbeläggning på 5 dagar. Med rutan *Jämna ut endast inom slack (utjämning) — projektets slutdatum ligger fast* på ligger slutet kvar den 17 augusti 2027 och en konflikt finns kvar. Med rutan av (standard) är allt löst och slutet flyttas till den 24 augusti 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tower crane har överbeläggning på 65 dagar och plasterers på 15 dagar. Utjämning med rutan *Jämna ut endast inom slack (utjämning) — projektets slutdatum ligger fast* av flyttar slutet från 9 maj till 12 oktober 2028.
